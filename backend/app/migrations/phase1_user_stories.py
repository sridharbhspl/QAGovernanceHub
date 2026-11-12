"""
Phase 1 Migration: User Stories & Epics
Creates the epics and user_stories tables idempotently.
"""
import logging
from sqlalchemy import text, inspect

log = logging.getLogger(__name__)


def run_phase1_migration(engine) -> dict:
    """
    Execute all Phase 1 User Stories DDL.
    Returns a dict of {label: status} for logging.
    """
    results = {}
    inspector = inspect(engine)
    existing_tables = inspector.get_table_names()

    ddl_statements = [
        ("epics.create_table", """
            CREATE TABLE IF NOT EXISTS epics (
                id             INT AUTO_INCREMENT PRIMARY KEY,
                epic_id        VARCHAR(50) NOT NULL UNIQUE,
                title          VARCHAR(150) NOT NULL,
                description    TEXT NULL,
                status         VARCHAR(50) NOT NULL DEFAULT 'Backlog',
                project_id     INT NOT NULL,
                created_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_epic_project (project_id),
                FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        """),
        ("user_stories.create_table", """
            CREATE TABLE IF NOT EXISTS user_stories (
                id                  INT AUTO_INCREMENT PRIMARY KEY,
                story_id            VARCHAR(50) NOT NULL UNIQUE,
                title               VARCHAR(200) NOT NULL,
                description         TEXT NULL,
                epic_id             INT NULL,
                story_points        INT NULL,
                acceptance_criteria TEXT NULL,
                sprint_id           INT NULL,
                project_id          INT NOT NULL,
                application_id      INT NULL,
                status              VARCHAR(50) NOT NULL DEFAULT 'Backlog',
                priority            VARCHAR(30) NOT NULL DEFAULT 'Medium',
                assigned_to_id      INT NULL,
                created_by_id       INT NULL,
                created_at          DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at          DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_us_project (project_id),
                INDEX idx_us_sprint (sprint_id),
                INDEX idx_us_epic (epic_id),
                INDEX idx_us_assigned (assigned_to_id),
                FOREIGN KEY (epic_id) REFERENCES epics(id) ON DELETE SET NULL,
                FOREIGN KEY (sprint_id) REFERENCES sprints(id) ON DELETE SET NULL,
                FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
                FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE SET NULL,
                FOREIGN KEY (assigned_to_id) REFERENCES users(id) ON DELETE SET NULL,
                FOREIGN KEY (created_by_id) REFERENCES users(id) ON DELETE SET NULL
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
            except Exception as e:
                msg = str(e)
                results[label] = f"ERROR: {msg}"
                log.error(f"Migration error [{label}]: {msg}")

    return results
