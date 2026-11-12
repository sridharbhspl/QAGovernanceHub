"""
Phase 2 Migration: Change Request Management — Module 11
Creates change_requests, cr_comments, cr_audit_histories tables idempotently.
"""
import logging
from sqlalchemy import text, inspect

log = logging.getLogger(__name__)


def run_phase2_migration(engine) -> dict:
    """
    Execute all Phase 2 Change Request DDL.
    Returns a dict of {label: status} for logging.
    """
    results = {}
    inspector = inspect(engine)
    existing_tables = inspector.get_table_names()

    ddl_statements = [
        ("change_requests.create_table", """
            CREATE TABLE IF NOT EXISTS change_requests (
                id                  INT AUTO_INCREMENT PRIMARY KEY,
                cr_id               VARCHAR(50) NOT NULL UNIQUE,
                title               VARCHAR(200) NOT NULL,
                description         TEXT NULL,
                justification       TEXT NULL,
                impact_analysis     TEXT NULL,
                implementation_plan TEXT NULL,
                rollback_plan       TEXT NULL,
                test_plan           TEXT NULL,

                category            VARCHAR(80) NOT NULL DEFAULT 'Functional',
                priority            VARCHAR(30) NOT NULL DEFAULT 'Medium',
                change_type         VARCHAR(50) NOT NULL DEFAULT 'Enhancement',
                risk_level          VARCHAR(30) NOT NULL DEFAULT 'Low',
                status              VARCHAR(50) NOT NULL DEFAULT 'Requested',
                rejection_reason    TEXT NULL,
                estimated_effort    VARCHAR(50) NULL,
                target_version      VARCHAR(100) NULL,

                project_id          INT NOT NULL,
                application_id      INT NULL,
                sprint_id           INT NULL,
                release_id          INT NULL,

                requested_by_id     INT NULL,
                assigned_to_id      INT NULL,
                reviewed_by_id      INT NULL,
                approved_by_id      INT NULL,
                implemented_by_id   INT NULL,
                verified_by_id      INT NULL,

                requested_date      DATETIME NULL,
                reviewed_date       DATETIME NULL,
                approved_date       DATETIME NULL,
                implemented_date    DATETIME NULL,
                verified_date       DATETIME NULL,
                target_date         DATETIME NULL,

                created_at          DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at          DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

                INDEX idx_cr_project (project_id),
                INDEX idx_cr_status (status),
                INDEX idx_cr_priority (priority),
                INDEX idx_cr_assigned (assigned_to_id),
                INDEX idx_cr_application (application_id),

                FOREIGN KEY (project_id)        REFERENCES projects(id) ON DELETE CASCADE,
                FOREIGN KEY (application_id)    REFERENCES applications(id) ON DELETE SET NULL,
                FOREIGN KEY (sprint_id)         REFERENCES sprints(id) ON DELETE SET NULL,
                FOREIGN KEY (release_id)        REFERENCES releases(id) ON DELETE SET NULL,
                FOREIGN KEY (requested_by_id)   REFERENCES users(id) ON DELETE SET NULL,
                FOREIGN KEY (assigned_to_id)    REFERENCES users(id) ON DELETE SET NULL,
                FOREIGN KEY (reviewed_by_id)    REFERENCES users(id) ON DELETE SET NULL,
                FOREIGN KEY (approved_by_id)    REFERENCES users(id) ON DELETE SET NULL,
                FOREIGN KEY (implemented_by_id) REFERENCES users(id) ON DELETE SET NULL,
                FOREIGN KEY (verified_by_id)    REFERENCES users(id) ON DELETE SET NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        """),
        ("cr_comments.create_table", """
            CREATE TABLE IF NOT EXISTS cr_comments (
                id          INT AUTO_INCREMENT PRIMARY KEY,
                cr_db_id    INT NOT NULL,
                user_id     INT NOT NULL,
                comment     TEXT NOT NULL,
                stage       VARCHAR(50) NULL,
                created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_crc_cr (cr_db_id),
                FOREIGN KEY (cr_db_id)  REFERENCES change_requests(id) ON DELETE CASCADE,
                FOREIGN KEY (user_id)   REFERENCES users(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        """),
        ("cr_audit_histories.create_table", """
            CREATE TABLE IF NOT EXISTS cr_audit_histories (
                id          INT AUTO_INCREMENT PRIMARY KEY,
                cr_db_id    INT NOT NULL,
                user_id     INT NOT NULL,
                from_status VARCHAR(50) NULL,
                to_status   VARCHAR(50) NULL,
                field_name  VARCHAR(100) NULL,
                old_value   TEXT NULL,
                new_value   TEXT NULL,
                notes       TEXT NULL,
                changed_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_crah_cr (cr_db_id),
                FOREIGN KEY (cr_db_id)  REFERENCES change_requests(id) ON DELETE CASCADE,
                FOREIGN KEY (user_id)   REFERENCES users(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        """),
    ]

    with engine.connect() as conn:
        for label, sql in ddl_statements:
            table_name = label.split(".")[0]
            if table_name in existing_tables:
                results[label] = "exists"
                continue
            try:
                conn.execute(text(sql))
                conn.commit()
                results[label] = "created"
                log.info(f"Phase 2: Created table '{table_name}'")
            except Exception as e:
                msg = str(e)
                results[label] = f"ERROR: {msg}"
                log.error(f"Phase 2 migration error [{label}]: {msg}")

    return results
