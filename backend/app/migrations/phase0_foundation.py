"""
Phase 0 Foundation Migration — Idempotent
Creates Phase 0 tables and seeds the RBAC matrix.
Safe to call on every app startup (checks before altering).
"""
import logging
from datetime import datetime
from sqlalchemy import text, inspect
from sqlalchemy.orm import Session

log = logging.getLogger(__name__)


def run_phase0_migration(engine, SessionLocal) -> dict:
    """
    Execute all Phase 0 DDL and seed operations.
    Returns a dict of {label: status} for logging.
    """
    results = {}
    inspector = inspect(engine)
    existing_tables = inspector.get_table_names()

    # ── DDL: New Tables ───────────────────────────────────────────────────────
    ddl_statements = [
        ("permissions.create_table", """
            CREATE TABLE IF NOT EXISTS permissions (
                id          INT AUTO_INCREMENT PRIMARY KEY,
                action      VARCHAR(50) NOT NULL UNIQUE,
                description VARCHAR(255) NULL,
                created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        """),
        ("roles.create_table", """
            CREATE TABLE IF NOT EXISTS roles (
                id             INT AUTO_INCREMENT PRIMARY KEY,
                name           VARCHAR(100) NOT NULL UNIQUE,
                description    VARCHAR(255) NULL,
                is_system_role TINYINT(1) DEFAULT 1,
                is_active      TINYINT(1) DEFAULT 1,
                created_at     DATETIME DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        """),
        ("role_permissions.create_table", """
            CREATE TABLE IF NOT EXISTS role_permissions (
                id            INT AUTO_INCREMENT PRIMARY KEY,
                role_id       INT NOT NULL,
                permission_id INT NOT NULL,
                granted_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY uq_role_permission (role_id, permission_id),
                FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
                FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        """),
        ("user_sessions.create_table", """
            CREATE TABLE IF NOT EXISTS user_sessions (
                id                  INT AUTO_INCREMENT PRIMARY KEY,
                user_id             INT NOT NULL,
                refresh_token_hash  VARCHAR(255) NOT NULL UNIQUE,
                device_info         VARCHAR(255) NULL,
                ip_address          VARCHAR(45) NULL,
                user_agent          TEXT NULL,
                created_at          DATETIME DEFAULT CURRENT_TIMESTAMP,
                expires_at          DATETIME NOT NULL,
                last_used_at        DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                is_active           TINYINT(1) DEFAULT 1,
                INDEX idx_us_user (user_id),
                INDEX idx_us_hash (refresh_token_hash),
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        """),
        ("login_history.create_table", """
            CREATE TABLE IF NOT EXISTS login_history (
                id               INT AUTO_INCREMENT PRIMARY KEY,
                user_id          INT NULL,
                email_attempted  VARCHAR(150) NOT NULL,
                ip_address       VARCHAR(45) NULL,
                user_agent       TEXT NULL,
                status           VARCHAR(20) NOT NULL,
                failure_reason   VARCHAR(255) NULL,
                created_at       DATETIME DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_lh_user (user_id),
                INDEX idx_lh_status (status),
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        """),
        ("audit_logs.create_table", """
            CREATE TABLE IF NOT EXISTS audit_logs (
                id           INT AUTO_INCREMENT PRIMARY KEY,
                user_id      INT NULL,
                action       VARCHAR(50) NOT NULL,
                entity_type  VARCHAR(100) NULL,
                entity_id    INT NULL,
                entity_label VARCHAR(255) NULL,
                old_values   JSON NULL,
                new_values   JSON NULL,
                ip_address   VARCHAR(45) NULL,
                user_agent   TEXT NULL,
                context      JSON NULL,
                created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_al_user (user_id),
                INDEX idx_al_action (action),
                INDEX idx_al_entity (entity_type, entity_id),
                INDEX idx_al_created (created_at),
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        """),
        ("activity_logs.create_table", """
            CREATE TABLE IF NOT EXISTS activity_logs (
                id           INT AUTO_INCREMENT PRIMARY KEY,
                user_id      INT NOT NULL,
                description  VARCHAR(500) NOT NULL,
                action       VARCHAR(50) NULL,
                entity_type  VARCHAR(100) NULL,
                entity_id    INT NULL,
                metadata     JSON NULL,
                created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_acl_user (user_id),
                INDEX idx_acl_created (created_at),
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        """),
    ]

    # Columns to add to existing tables
    alter_statements = [
        ("users.last_login",
         "ALTER TABLE users ADD COLUMN last_login DATETIME NULL;"),
        ("users.failed_login_count",
         "ALTER TABLE users ADD COLUMN failed_login_count INT DEFAULT 0 NOT NULL;"),
        ("users.locked_until",
         "ALTER TABLE users ADD COLUMN locked_until DATETIME NULL;"),
        ("users.password_changed_at",
         "ALTER TABLE users ADD COLUMN password_changed_at DATETIME NULL;"),
        ("users.must_change_password",
         "ALTER TABLE users ADD COLUMN must_change_password TINYINT(1) DEFAULT 0;"),
        ("users.mfa_enabled",
         "ALTER TABLE users ADD COLUMN mfa_enabled TINYINT(1) DEFAULT 0;"),
        ("users.mfa_secret",
         "ALTER TABLE users ADD COLUMN mfa_secret VARCHAR(255) NULL;"),
    ]

    with engine.connect() as conn:
        # Run CREATE TABLE statements
        for label, sql in ddl_statements:
            try:
                conn.execute(text(sql))
                results[label] = "created"
            except Exception as e:
                msg = str(e)
                if "already exists" in msg or "1050" in msg:
                    results[label] = "already_exists"
                else:
                    results[label] = f"ERROR: {msg}"
                    log.error(f"Migration error [{label}]: {msg}")

        # Run ALTER TABLE statements (add columns)
        for label, sql in alter_statements:
            try:
                conn.execute(text(sql))
                results[label] = "added"
            except Exception as e:
                msg = str(e)
                if "Duplicate column" in msg or "1060" in msg:
                    results[label] = "already_exists"
                else:
                    results[label] = f"ERROR: {msg}"
                    log.error(f"Migration error [{label}]: {msg}")

        conn.commit()

    # ── Seed RBAC Data ────────────────────────────────────────────────────────
    seed_results = _seed_rbac(SessionLocal)
    results.update(seed_results)

    return results


def _seed_rbac(SessionLocal) -> dict:
    """Seed roles and permissions tables if empty."""
    from app.core.rbac import ROLE_PERMISSION_MATRIX, PERMISSION_DESCRIPTIONS, Permissions
    from app.models.rbac import RoleDB, Permission, RolePermission

    results = {}
    db: Session = SessionLocal()
    try:
        # Seed permissions
        existing_perms = {p.action: p for p in db.query(Permission).all()}
        perm_map = {}

        for action in Permissions.ALL:
            if action not in existing_perms:
                perm = Permission(action=action, description=PERMISSION_DESCRIPTIONS.get(action))
                db.add(perm)
                db.flush()
                perm_map[action] = perm
                results[f"permission.{action}"] = "seeded"
            else:
                perm_map[action] = existing_perms[action]
                results[f"permission.{action}"] = "exists"

        # Seed roles
        existing_roles = {r.name: r for r in db.query(RoleDB).all()}
        role_descriptions = {
            "Super Admin":     "Full platform access, bypasses all permission checks",
            "Group Admin":     "Manages multiple companies and their users",
            "Company Admin":   "Manages a single company, all projects and users",
            "Project Manager": "Manages projects, approves releases and defects",
            "QA Lead":         "Leads QA team, approves test results and defects",
            "QA Engineer":     "Creates and executes test cases, logs defects",
            "Developer":       "Views and updates defect status, uploads builds",
            "Client":          "Read-only access + export reports",
            "Viewer":          "Read-only access",
        }

        for role_name, perms_set in ROLE_PERMISSION_MATRIX.items():
            if role_name not in existing_roles:
                role = RoleDB(
                    name=role_name,
                    description=role_descriptions.get(role_name),
                    is_system_role=True,
                )
                db.add(role)
                db.flush()
                results[f"role.{role_name}"] = "seeded"
            else:
                role = existing_roles[role_name]
                results[f"role.{role_name}"] = "exists"

            # Assign permissions (skip existing)
            existing_rp = {
                rp.permission_id
                for rp in db.query(RolePermission).filter(RolePermission.role_id == role.id).all()
            }
            for action in perms_set:
                perm = perm_map.get(action)
                if perm and perm.id not in existing_rp:
                    db.add(RolePermission(role_id=role.id, permission_id=perm.id))

        db.commit()
    except Exception as e:
        db.rollback()
        results["rbac_seed"] = f"ERROR: {e}"
        log.error(f"RBAC seed error: {e}")
    finally:
        db.close()

    return results
