import os
import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.core.database import init_db, engine, Base, SessionLocal
import app.models
from app.api import auth, org, work, defect, test_case, dashboard, reports, automation, admin
from app.api import rbac, audit as audit_api, user_story, change_request as change_request_api

log = logging.getLogger(__name__)

# Setup database and schemas on launch
sync_error = None
sync_traceback = None
try:
    init_db()
    # Create all tables dynamically
    Base.metadata.create_all(bind=engine)
    print("Database tables synchronized successfully.")
    
    # Run Migration v3
    from sqlalchemy import text
    migrations = [
        ("applications.create_table",
         """
         CREATE TABLE IF NOT EXISTS applications (
             id INT AUTO_INCREMENT PRIMARY KEY,
             name VARCHAR(100) NOT NULL,
             code VARCHAR(20) NOT NULL,
             description VARCHAR(255) NULL,
             project_id INT NOT NULL,
             is_active TINYINT(1) DEFAULT 1,
             created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
             FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
         );
         """),
        ("releases.application_id",
         "ALTER TABLE releases ADD COLUMN application_id INT NULL AFTER project_id;"),
        ("releases.fk_application",
         "ALTER TABLE releases ADD CONSTRAINT fk_releases_application FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE;"),
        ("sprints.application_id",
         "ALTER TABLE sprints ADD COLUMN application_id INT NULL AFTER project_id;"),
        ("sprints.fk_application",
         "ALTER TABLE sprints ADD CONSTRAINT fk_sprints_application FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE;"),
        ("test_scenarios.application_id",
         "ALTER TABLE test_scenarios ADD COLUMN application_id INT NULL AFTER project_id;"),
        ("test_scenarios.fk_application",
         "ALTER TABLE test_scenarios ADD CONSTRAINT fk_test_scenarios_application FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE;"),
        ("execution_histories.step_results",
         "ALTER TABLE execution_histories ADD COLUMN step_results TEXT NULL AFTER actual_result;"),
        ("requirements.application_id",
         "ALTER TABLE requirements ADD COLUMN application_id INT NULL AFTER project_id;"),
        ("requirements.fk_application",
         "ALTER TABLE requirements ADD CONSTRAINT fk_requirements_application FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE;"),
        # v4 – tag test scenarios with release / sprint (mirrors Defect model)
        ("test_scenarios.release_id",
         "ALTER TABLE test_scenarios ADD COLUMN release_id INT NULL;"),
        ("test_scenarios.fk_release",
         "ALTER TABLE test_scenarios ADD CONSTRAINT fk_ts_release FOREIGN KEY (release_id) REFERENCES releases(id) ON DELETE SET NULL;"),
        ("test_scenarios.sprint_id",
         "ALTER TABLE test_scenarios ADD COLUMN sprint_id INT NULL;"),
        ("test_scenarios.fk_sprint",
         "ALTER TABLE test_scenarios ADD CONSTRAINT fk_ts_sprint FOREIGN KEY (sprint_id) REFERENCES sprints(id) ON DELETE SET NULL;"),
        # v5 – extended Bug/CR Report columns on defects table
        ("defects.source_screen",
         "ALTER TABLE defects ADD COLUMN source_screen VARCHAR(500) NULL;"),
        ("defects.bug_type",
         "ALTER TABLE defects ADD COLUMN bug_type VARCHAR(100) NULL DEFAULT 'Bug';"),
        ("defects.screenshot_url",
         "ALTER TABLE defects ADD COLUMN screenshot_url VARCHAR(500) NULL;"),
        ("defects.reproducible",
         "ALTER TABLE defects ADD COLUMN reproducible VARCHAR(30) NULL DEFAULT 'YES';"),
        ("defects.steps_to_reproduce",
         "ALTER TABLE defects ADD COLUMN steps_to_reproduce TEXT NULL;"),
        ("defects.expected_behavior",
         "ALTER TABLE defects ADD COLUMN expected_behavior TEXT NULL;"),
        ("defects.actual_behavior",
         "ALTER TABLE defects ADD COLUMN actual_behavior TEXT NULL;"),
        ("defects.developer_name",
         "ALTER TABLE defects ADD COLUMN developer_name VARCHAR(150) NULL;"),
        ("defects.developer_comments",
         "ALTER TABLE defects ADD COLUMN developer_comments TEXT NULL;"),
        ("defects.date_of_fixing",
         "ALTER TABLE defects ADD COLUMN date_of_fixing VARCHAR(50) NULL;"),
        # v6 – application context tagging on defects
        ("defects.application_id",
         "ALTER TABLE defects ADD COLUMN application_id INT NULL;"),
        # v7 – project team mappings role support
        ("project_team_mappings.role",
         "ALTER TABLE project_team_mappings ADD COLUMN role VARCHAR(100) NULL AFTER user_id;"),
    ]
    migration_log_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "migration_run.log")
    with open(migration_log_path, "w", encoding="utf-8") as log_f:
        log_f.write("=== Run Migration v3 from main.py ===\n")
        with engine.connect() as conn:
            for label, sql in migrations:
                try:
                    conn.execute(text(sql))
                    log_f.write(f"  ✓  {label}\n")
                except Exception as e:
                    msg = str(e)
                    if "Duplicate column" in msg or "already exists" in msg or "1060" in msg or "1061" in msg or "1091" in msg:
                        log_f.write(f"  ~  {label}: already exists / duplicate\n")
                    else:
                        log_f.write(f"  ✗  {label}: {msg}\n")
            conn.commit()
            
            # Check if applications table has any data
            has_apps = False
            try:
                count_res = conn.exec_driver_sql("SELECT COUNT(*) FROM applications").fetchone()
                has_apps = bool(count_res and count_res[0] > 0)
            except Exception as e:
                log_f.write(f"Failed to check applications count: {e}\n")
                
            if not has_apps:
                log_f.write("Applications table is empty. Truncating tables to force clean re-seed...\n")
                try:
                    conn.exec_driver_sql("SET FOREIGN_KEY_CHECKS = 0;")
                    for tbl in ["execution_histories", "defect_comments", "defect_audit_histories", 
                               "defect_attachments", "defects", "test_cases", "test_scenarios", 
                               "requirements", "sprints", "releases", "sub_modules", "modules", 
                               "project_team_mappings", "projects", "users", "companies", "groups", "applications"]:
                        conn.exec_driver_sql(f"TRUNCATE TABLE `{tbl}`;")
                    conn.exec_driver_sql("SET FOREIGN_KEY_CHECKS = 1;")
                    conn.exec_driver_sql("COMMIT;")
                    log_f.write("Tables truncated successfully.\n")
                except Exception as truncate_err:
                    log_f.write(f"Truncation error: {truncate_err}\n")
        log_f.write("Migration complete.\n")
    
    # Auto-seed database if empty (idempotent guard — checks if groups exist)
    try:
        import sys
        sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        from seed import seed_database
        from app.core.database import SessionLocal as _SeedSession
        from app.models.org import Group as _Group
        _check_db = _SeedSession()
        try:
            group_count = _check_db.query(_Group).count()
        finally:
            _check_db.close()
        if group_count == 0:
            print("Database has no groups — running seed...")
            seed_database()
        else:
            print(f"Database already seeded ({group_count} groups found) — skipping seed.")
    except Exception as seed_err:
        print(f"Seed skipped: {seed_err}")

    # ── Phase 0 Foundation Migration ──────────────────────────────────────────
    try:
        from app.migrations.phase0_foundation import run_phase0_migration
        p0_results = run_phase0_migration(engine, SessionLocal)
        # Log results to migration_run.log
        with open(migration_log_path, "a", encoding="utf-8") as log_f:
            log_f.write("\n=== Phase 0 Foundation Migration ===\n")
            for label, result in p0_results.items():
                status_icon = "✓" if result in ("created", "added", "seeded") else "~" if result == "exists" or result == "already_exists" else "✗"
                log_f.write(f"  {status_icon}  {label}: {result}\n")
            log_f.write("Phase 0 complete.\n")
        print(f"Phase 0 migration complete: {sum(1 for v in p0_results.values() if v in ('created','added','seeded'))} new items.")
    except Exception as p0_err:
        print(f"Phase 0 migration warning: {p0_err}")
        import traceback
        traceback.print_exc()

    # ── Phase 1 User Stories Migration ────────────────────────────────────────
    try:
        from app.migrations.phase1_user_stories import run_phase1_migration
        p1_results = run_phase1_migration(engine)
        with open(migration_log_path, "a", encoding="utf-8") as log_f:
            log_f.write("\n=== Phase 1 User Stories Migration ===\n")
            for label, result in p1_results.items():
                status_icon = "✓" if result == "created" else "~" if result == "exists" else "✗"
                log_f.write(f"  {status_icon}  {label}: {result}\n")
            log_f.write("Phase 1 complete.\n")
        print(f"Phase 1 migration complete: {sum(1 for v in p1_results.values() if v == 'created')} new items.")
    except Exception as p1_err:
        print(f"Phase 1 migration warning: {p1_err}")
    # ── Phase 2 Change Request Migration ────────────────────────────────────────────
    try:
        from app.migrations.phase2_change_requests import run_phase2_migration
        p2_results = run_phase2_migration(engine)
        with open(migration_log_path, "a", encoding="utf-8") as log_f:
            log_f.write("\n=== Phase 2 Change Requests Migration ===\n")
            for label, result in p2_results.items():
                status_icon = "✓" if result == "created" else "~" if result == "exists" else "✗"
                log_f.write(f"  {status_icon}  {label}: {result}\n")
            log_f.write("Phase 2 complete.\n")
        print(f"Phase 2 migration complete: {sum(1 for v in p2_results.values() if v == 'created')} new items.")
    except Exception as p2_err:
        print(f"Phase 2 migration warning: {p2_err}")
except Exception as err:
    import traceback
    sync_error = err
    sync_traceback = traceback.format_exc()
    print(f"Database sync warning/error: {err}")

# Log database users and sync error for verification
try:
    from app.core.database import SessionLocal
    from app.models.auth import User
    db = SessionLocal()
    users = db.query(User).all()
    log_path = os.path.join(os.path.dirname(__file__), "db_users.log")
    with open(log_path, "w", encoding="utf-8") as f:
        if sync_error:
            f.write("Sync Error Traceback:\n")
            f.write(sync_traceback or "")
            f.write("\n")
        f.write(f"Total Users: {len(users)}\n")
        f.write(str([(u.id, u.email, u.role) for u in users]))
    db.close()
except Exception as log_err:
    log_path = os.path.join(os.path.dirname(__file__), "db_users.log")
    try:
        with open(log_path, "w", encoding="utf-8") as f:
            if sync_error:
                f.write("Sync Error Traceback:\n")
                f.write(sync_traceback or "")
                f.write("\n")
            f.write(f"Log Error: {log_err}\n")
    except Exception:
        pass

# Setup uploads folder
uploads_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads")
os.makedirs(uploads_path, exist_ok=True)

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json"
)

# CORS setup
origins = ["*"] # Allow all for development. Customize in prod.

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routes
app.include_router(auth.router, prefix=f"{settings.API_V1_STR}/auth", tags=["auth"])
app.include_router(org.router, prefix=f"{settings.API_V1_STR}/org", tags=["organization"])
app.include_router(work.router, prefix=f"{settings.API_V1_STR}/work", tags=["work setup"])
app.include_router(defect.router, prefix=f"{settings.API_V1_STR}/defects", tags=["defects"])
app.include_router(test_case.router, prefix=f"{settings.API_V1_STR}/testcases", tags=["test cases"])
app.include_router(dashboard.router, prefix=f"{settings.API_V1_STR}/dashboard", tags=["dashboards"])
app.include_router(reports.router, prefix=f"{settings.API_V1_STR}/reports", tags=["reports"])
app.include_router(automation.router, prefix=f"{settings.API_V1_STR}/automation", tags=["automation"])
app.include_router(admin.router, prefix=f"{settings.API_V1_STR}/admin", tags=["admin"])
# Phase 0 — Foundation
app.include_router(rbac.router, prefix=f"{settings.API_V1_STR}/rbac", tags=["rbac"])
app.include_router(audit_api.router, prefix=f"{settings.API_V1_STR}/audit", tags=["audit"])
app.include_router(user_story.router, prefix=f"{settings.API_V1_STR}/user-stories", tags=["user stories"])
# Phase 2 — Change Request Management
app.include_router(change_request_api.router, prefix=f"{settings.API_V1_STR}/change-requests", tags=["change requests"])

@app.get("/health")
def health_check():
    return {"status": "healthy", "service": settings.PROJECT_NAME}


@app.post("/admin/run-migration")
def run_migration_now():
    """One-shot endpoint: adds application_id to defects if missing. Safe to call multiple times."""
    from app.core.database import engine
    from sqlalchemy import text
    results = []
    with engine.connect() as conn:
        n = conn.execute(text(
            "SELECT COUNT(*) FROM information_schema.columns "
            "WHERE table_schema = DATABASE() "
            "AND table_name = 'defects' "
            "AND column_name = 'application_id'"
        )).scalar()
        if n:
            results.append("defects.application_id: already exists")
        else:
            conn.execute(text("ALTER TABLE defects ADD COLUMN application_id INT NULL"))
            conn.commit()
            results.append("defects.application_id: ADDED ✓")
    return {"migrations": results}

