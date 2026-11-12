import sys
import os
from datetime import datetime, date, timedelta

# Add backend folder to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.core.database import SessionLocal, init_db, engine, Base
import app.models
from app.core.security import get_password_hash
from app.models.auth import User, Role
from app.models.org import Group, Company, Project, ProjectTeamMapping, Application
from app.models.work import Module, SubModule, Release, Sprint
from app.models.defect import Defect, DefectComment, DefectAuditHistory
from app.models.test_case import Requirement, TestScenario, TestCase, ExecutionHistory

def seed_database():
    print("Starting seeding process...")
    # Initialize DB (create database sridhar if not exists)
    init_db()
    
    # Synchronize all tables
    Base.metadata.create_all(bind=engine)
    print("Tables synchronized.")
    
    db = SessionLocal()
    try:
        # Check if groups already exist
        if db.query(Group).count() > 0:
            print("Database already seeded with groups. Skipping.")
            return

        # 1. Create Users
        password_hash = get_password_hash("password123")
        
        super_admin = db.query(User).filter(User.email == "superadmin@qahub.com").first()
        if not super_admin:
            super_admin = User(
                email="superadmin@qahub.com",
                hashed_password=password_hash,
                full_name="Sridhar SuperAdmin",
                role=Role.SUPER_ADMIN,
                is_active=True
            )
            db.add(super_admin)
            db.commit()
            db.refresh(super_admin)

        group_admin = db.query(User).filter(User.email == "groupadmin@qahub.com").first()
        if not group_admin:
            group_admin = User(
                email="groupadmin@qahub.com",
                hashed_password=password_hash,
                full_name="Alex GroupAdmin",
                role=Role.GROUP_ADMIN,
                is_active=True
            )
            db.add(group_admin)
            db.commit()
            db.refresh(group_admin)
        
        comp_admin = db.query(User).filter(User.email == "compadmin@qahub.com").first()
        if not comp_admin:
            comp_admin = User(
                email="compadmin@qahub.com",
                hashed_password=password_hash,
                full_name="Sarah CompanyAdmin",
                role=Role.COMPANY_ADMIN,
                is_active=True
            )
            db.add(comp_admin)
            db.commit()
            db.refresh(comp_admin)
        
        qa_lead = db.query(User).filter(User.email == "qalead@qahub.com").first()
        if not qa_lead:
            qa_lead = User(
                email="qalead@qahub.com",
                hashed_password=password_hash,
                full_name="Michael QA Lead",
                role=Role.QA_LEAD,
                is_active=True
            )
            db.add(qa_lead)
            db.commit()
            db.refresh(qa_lead)
        
        qa_eng = db.query(User).filter(User.email == "qaeng@qahub.com").first()
        if not qa_eng:
            qa_eng = User(
                email="qaeng@qahub.com",
                hashed_password=password_hash,
                full_name="David QA Engineer",
                role=Role.QA_ENGINEER,
                is_active=True
            )
            db.add(qa_eng)
            db.commit()
            db.refresh(qa_eng)
        
        dev = db.query(User).filter(User.email == "dev@qahub.com").first()
        if not dev:
            dev = User(
                email="dev@qahub.com",
                hashed_password=password_hash,
                full_name="Robert Developer",
                role=Role.DEVELOPER,
                is_active=True
            )
            db.add(dev)
            db.commit()
            db.refresh(dev)

        # 2. Create Groups
        group_a = Group(name="Global Tech Solutions", description="Top Tier Tech Group", is_active=True)
        db.add(group_a)
        db.commit()
        db.refresh(group_a)

        # Assign Group ID to group admin
        group_admin.group_id = group_a.id
        db.commit()

        # 3. Create Companies
        comp_a = Company(
            name="Quantum Software Corp",
            description="Quantum-grade SaaS Provider",
            group_id=group_a.id,
            is_active=True,
            settings='{"theme": "dark", "notifications": "enabled"}'
        )
        comp_b = Company(
            name="Apex Digital Agency",
            description="Premium Web Development",
            group_id=group_a.id,
            is_active=True
        )
        db.add(comp_a)
        db.add(comp_b)
        db.commit()
        db.refresh(comp_a)
        db.refresh(comp_b)

        # Assign Company ID to users
        comp_admin.company_id = comp_a.id
        qa_lead.company_id = comp_a.id
        qa_eng.company_id = comp_a.id
        dev.company_id = comp_a.id
        db.commit()

        # 4. Create Projects for Quantum Software
        proj_1 = Project(
            name="Governance Portal",
            code="GOVP",
            description="Centralized compliance and governance portal",
            company_id=comp_a.id,
            is_active=True
        )
        proj_2 = Project(
            name="Analytics Dashboards",
            code="ANDB",
            description="Data visualization and charts engine",
            company_id=comp_a.id,
            is_active=True
        )
        db.add(proj_1)
        db.add(proj_2)
        db.commit()
        db.refresh(proj_1)
        db.refresh(proj_2)

        # Create Applications
        app_1 = Application(
            name="Core Compliance Platform",
            code="COMP",
            description="Enterprise compliance checking application",
            project_id=proj_1.id,
            is_active=True
        )
        app_2 = Application(
            name="Regulatory Audit Tool",
            code="AUDT",
            description="Regulatory mapping and auditing tool",
            project_id=proj_1.id,
            is_active=True
        )
        db.add_all([app_1, app_2])
        db.commit()
        db.refresh(app_1)
        db.refresh(app_2)

        # 5. Project Team Mappings
        m1 = ProjectTeamMapping(project_id=proj_1.id, user_id=qa_lead.id)
        m2 = ProjectTeamMapping(project_id=proj_1.id, user_id=qa_eng.id)
        m3 = ProjectTeamMapping(project_id=proj_1.id, user_id=dev.id)
        db.add_all([m1, m2, m3])
        db.commit()

        # 6. Modules and SubModules
        mod_auth = Module(name="Authentication", description="Users login and registration", project_id=proj_1.id)
        mod_dash = Module(name="Reporting Module", description="Dashboard reports and graphs", project_id=proj_1.id)
        db.add_all([mod_auth, mod_dash])
        db.commit()
        db.refresh(mod_auth)
        db.refresh(mod_dash)

        sub_jwt = SubModule(name="JWT Verification", description="Token security logic", module_id=mod_auth.id)
        sub_pdf = SubModule(name="PDF Export Engine", description="PDF report formatting", module_id=mod_dash.id)
        db.add_all([sub_jwt, sub_pdf])
        db.commit()
        db.refresh(sub_jwt)
        db.refresh(sub_pdf)

        # 7. Releases
        rel_1 = Release(
            version="v1.0.0",
            description="Initial production release",
            status="Released",
            release_date=date.today() - timedelta(days=10),
            project_id=proj_1.id,
            application_id=app_1.id
        )
        rel_2 = Release(
            version="v1.1.0",
            description="Sprint 2 modifications & dashboard features",
            status="Testing",
            release_date=date.today() + timedelta(days=15),
            project_id=proj_1.id,
            application_id=app_1.id
        )
        db.add_all([rel_1, rel_2])
        db.commit()
        db.refresh(rel_1)
        db.refresh(rel_2)

        # 8. Sprints
        spr_1 = Sprint(
            name="Sprint 1 - Foundation",
            description="Establish setup & auth",
            start_date=date.today() - timedelta(days=20),
            end_date=date.today() - timedelta(days=6),
            status="Completed",
            project_id=proj_1.id,
            application_id=app_1.id
        )
        spr_2 = Sprint(
            name="Sprint 2 - Visualization",
            description="Charts and exports implementation",
            start_date=date.today() - timedelta(days=5),
            end_date=date.today() + timedelta(days=9),
            status="Active",
            project_id=proj_1.id,
            application_id=app_1.id
        )
        db.add_all([spr_1, spr_2])
        db.commit()
        db.refresh(spr_1)
        db.refresh(spr_2)

        # 9. Requirements
        req_1 = Requirement(
            requirement_id=f"REQ-{proj_1.code}-001",
            title="User JWT Authentication",
            description="System must authenticate users via encrypted JWT headers and block unauthorized requests.",
            project_id=proj_1.id
        )
        req_2 = Requirement(
            requirement_id=f"REQ-{proj_1.code}-002",
            title="PDF Document Generation",
            description="System must compile a PDF detailing project health stats dynamically.",
            project_id=proj_1.id
        )
        db.add_all([req_1, req_2])
        db.commit()
        db.refresh(req_1)
        db.refresh(req_2)

        # 10. Test Scenarios
        scen_1 = TestScenario(
            scenario_id=f"TS-{proj_1.code}-001",
            title="Authenticate via Valid & Invalid Credentials",
            description="Scenario verifies login tokens are issued and reject expired tokens.",
            project_id=proj_1.id,
            application_id=app_1.id,
            requirement_id=req_1.id
        )
        scen_2 = TestScenario(
            scenario_id=f"TS-{proj_1.code}-002",
            title="Export Report Verification",
            description="Scenario validates PDF files format and structure.",
            project_id=proj_1.id,
            application_id=app_1.id,
            requirement_id=req_2.id
        )
        db.add_all([scen_1, scen_2])
        db.commit()
        db.refresh(scen_1)
        db.refresh(scen_2)

        # 11. Test Cases
        tc_1 = TestCase(
            test_case_id=f"TC-{proj_1.code}-001",
            title="Login with correct credentials succeeds",
            precondition="User registration completed",
            steps="1. POST to /auth/login with valid user credentials\n2. Inspect response token",
            expected_result="Access token is generated and returned with bearer type.",
            status="Active",
            test_scenario_id=scen_1.id
        )
        tc_2 = TestCase(
            test_case_id=f"TC-{proj_1.code}-002",
            title="Login with incorrect password fails",
            precondition="User registration completed",
            steps="1. POST to /auth/login with invalid password\n2. Inspect response error status",
            expected_result="Returns HTTP 400 Bad Request with error details.",
            status="Active",
            test_scenario_id=scen_1.id
        )
        tc_3 = TestCase(
            test_case_id=f"TC-{proj_1.code}-003",
            title="Generate PDF includes Summary Table",
            precondition="Dashboard results exist",
            steps="1. GET /reports/project-health/pdf\n2. Open generated PDF document",
            expected_result="PDF compiles successfully with a tabular breakdown of requirements.",
            status="Active",
            test_scenario_id=scen_2.id
        )
        db.add_all([tc_1, tc_2, tc_3])
        db.commit()
        db.refresh(tc_1)
        db.refresh(tc_2)
        db.refresh(tc_3)

        # 12. Defects
        def_1 = Defect(
            defect_id=f"BUG-{proj_1.code}-000001",
            title="PDF Export throws division by zero on empty project",
            description="When running PDF report on a project with zero test cases, the system crashes.",
            project_id=proj_1.id,
            module_id=mod_dash.id,
            sub_module_id=sub_pdf.id,
            release_id=rel_2.id,
            sprint_id=spr_2.id,
            environment="QA",
            build_number="b1.1.0-alpha2",
            severity="High",
            priority="High",
            status="Open",
            assigned_to_id=dev.id,
            reported_by_id=qa_eng.id
        )
        db.add(def_1)
        db.commit()
        db.refresh(def_1)

        # Audit History
        audit = DefectAuditHistory(
            defect_id=def_1.id,
            user_id=qa_eng.id,
            field_name="defect",
            old_value=None,
            new_value="Defect reported from test case run."
        )
        db.add(audit)
        
        # Defect Comment
        comment = DefectComment(
            defect_id=def_1.id,
            user_id=dev.id,
            comment="Investigating. Looks like a division by zero in python reports.py line 250."
        )
        db.add(comment)
        db.commit()

        # 13. Execution History
        exec_1 = ExecutionHistory(
            test_case_id=tc_1.id,
            status="Passed",
            actual_result="Bearer token received. API returns 200.",
            executed_by_id=qa_eng.id,
            run_type="Manual",
            build_number="b1.0.0"
        )
        exec_2 = ExecutionHistory(
            test_case_id=tc_2.id,
            status="Passed",
            actual_result="Rejected correctly with HTTP 400.",
            executed_by_id=qa_eng.id,
            run_type="Manual",
            build_number="b1.0.0"
        )
        exec_3 = ExecutionHistory(
            test_case_id=tc_3.id,
            status="Failed",
            actual_result="Server exception thrown: ZeroDivisionError.",
            defect_id=def_1.id,
            executed_by_id=qa_eng.id,
            run_type="Manual",
            build_number="b1.1.0-alpha2"
        )
        db.add_all([exec_1, exec_2, exec_3])
        db.commit()

        # ── Phase 1: User Stories & Epics Seeding ──────────────────────────────
        from app.models.user_story import Epic, UserStory

        epic_1 = Epic(
            epic_id=f"EPIC-{proj_1.code}-001",
            title="Core Authentication & Security Hardening",
            description="Agile epic covering login, session tracking, token rotation, and MFA.",
            status="Active",
            project_id=proj_1.id
        )
        epic_2 = Epic(
            epic_id=f"EPIC-{proj_1.code}-002",
            title="Interactive Analytics Dashboards",
            description="Epic covering charts, metric aggregations, and export filters.",
            status="Backlog",
            project_id=proj_1.id
        )
        db.add_all([epic_1, epic_2])
        db.commit()
        db.refresh(epic_1)
        db.refresh(epic_2)

        us_1 = UserStory(
            story_id=f"US-{proj_1.code}-001",
            title="As a user, I want to securely log in to the dashboard using JWT",
            description="Implement JWT issuance, password verification, and validation rules.",
            epic_id=epic_1.id,
            story_points=5,
            acceptance_criteria="- Correct username/password yields JWT token\n- Token contains user's roles and permissions\n- Expired tokens throw HTTP 401 Unauthorized",
            sprint_id=spr_1.id,
            project_id=proj_1.id,
            application_id=app_1.id,
            status="Done",
            priority="Critical",
            assigned_to_id=dev.id,
            created_by_id=comp_admin.id
        )

        us_2 = UserStory(
            story_id=f"US-{proj_1.code}-002",
            title="As a user, I want my token to refresh automatically to keep me logged in",
            description="Setup sliding-window refresh token rotation on `/auth/refresh`.",
            epic_id=epic_1.id,
            story_points=3,
            acceptance_criteria="- Call `/auth/refresh` with valid refresh token returns new access/refresh pair\n- Old refresh token is invalidated immediately\n- Session is revoked upon logout",
            sprint_id=spr_1.id,
            project_id=proj_1.id,
            application_id=app_1.id,
            status="Done",
            priority="High",
            assigned_to_id=dev.id,
            created_by_id=comp_admin.id
        )

        us_3 = UserStory(
            story_id=f"US-{proj_1.code}-003",
            title="As a PM, I want to see real-time Agile charts on the dashboard",
            description="Build chart engine and wire up backend analytics queries.",
            epic_id=epic_2.id,
            story_points=8,
            acceptance_criteria="- Dashboard displays defect breakout by status and severity\n- Filters for Group/Company/Project immediately update widgets\n- Skeleton loaders are shown during API fetch",
            sprint_id=spr_2.id,
            project_id=proj_1.id,
            application_id=app_1.id,
            status="In Progress",
            priority="High",
            assigned_to_id=dev.id,
            created_by_id=comp_admin.id
        )

        us_4 = UserStory(
            story_id=f"US-{proj_1.code}-004",
            title="As a QA Lead, I want to filter user stories by active sprints",
            description="Scaffolding filter cascades and wiring backlog components.",
            epic_id=epic_2.id,
            story_points=2,
            acceptance_criteria="- Dropdown filter for Sprints shows active and completed sprints\n- Selecting Sprint filters backlog list dynamically\n- Selecting 'All' displays full backlog",
            sprint_id=spr_2.id,
            project_id=proj_1.id,
            application_id=app_1.id,
            status="To Do",
            priority="Medium",
            assigned_to_id=qa_lead.id,
            created_by_id=comp_admin.id
        )

        db.add_all([us_1, us_2, us_3, us_4])
        db.commit()
        
        print("Database seeded successfully with premium mock records!")
    except Exception as e:
        print(f"Error seeding database: {e}")
        db.rollback()
        raise e
    finally:
        db.close()

if __name__ == "__main__":
    seed_database()
