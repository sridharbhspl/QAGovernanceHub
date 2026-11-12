from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Optional
from datetime import datetime, timedelta, timezone
from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.auth import User
from app.models.org import Group, Company, Project, Application
from app.models.work import Module, Release, Sprint
from app.models.defect import Defect
from app.models.test_case import TestCase, ExecutionHistory, Requirement, TestScenario

router = APIRouter()

@router.get("/metrics")
def get_dashboard_metrics(
    group_id: Optional[int] = Query(None),
    company_id: Optional[int] = Query(None),
    project_id: Optional[int] = Query(None),
    application_id: Optional[int] = Query(None),
    release_id: Optional[int] = Query(None),
    sprint_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Determine the Dashboard Level dynamically
    # Level 6: Sprint
    if sprint_id:
        return get_level_5_sprint_metrics(sprint_id, db)
    # Level 5: Release
    if release_id:
        return get_level_4_release_metrics(release_id, db)
    # Level 4: Application
    if application_id:
        return get_level_4_application_metrics(application_id, db)
    # Level 3: Project
    if project_id:
        return get_level_3_project_metrics(project_id, db)
    # Level 2: Company
    if company_id:
        return get_level_2_company_metrics(company_id, db)
    # Level 1: Group (or general)
    if group_id:
        return get_level_1_group_metrics(group_id, db)
        
    # If no filters, fallback to overall/Group 1
    first_group = db.query(Group).first()
    if first_group:
        return get_level_1_group_metrics(first_group.id, db)  # type: ignore
        
    return {"message": "No group/company/project setup found"}


def get_level_1_group_metrics(group_id: int, db: Session):
    companies = db.query(Company).filter(Company.group_id == group_id).all()
    company_ids = [c.id for c in companies]
    
    total_companies = len(companies)

    if not company_ids:
        return {
            "level": 1,
            "widgets": {
                "totalCompanies": 0, "totalProjects": 0, "totalUsers": 0,
                "totalOpenDefects": 0, "totalClosedDefects": 0, "overallTestingProgress": 0
            },
            "charts": {
                "companyWiseDefects": [], "companyWiseReleases": [], "companyWiseProjectHealth": []
            }
        }

    total_projects = db.query(Project).filter(Project.company_id.in_(company_ids)).count()
    total_users = db.query(User).filter(User.company_id.in_(company_ids)).count()
    
    open_defects = db.query(Defect).join(Project).filter(
        Project.company_id.in_(company_ids),
        Defect.status.in_(["New", "Assigned", "Open", "Reopened"])
    ).count()
    
    closed_defects = db.query(Defect).join(Project).filter(
        Project.company_id.in_(company_ids),
        Defect.status == "Closed"
    ).count()
    
    # Overall QA coverage (Passed runs / Total TCs)
    total_tcs = db.query(TestCase).join(TestScenario).join(Project).filter(
        Project.company_id.in_(company_ids)
    ).count()
    
    passed_tcs = db.query(func.count(func.distinct(ExecutionHistory.test_case_id))).join(TestCase).join(TestScenario).join(Project).filter(
        Project.company_id.in_(company_ids),
        ExecutionHistory.status == "Passed"
    ).scalar() or 0
    
    qa_progress = (passed_tcs / total_tcs * 100) if total_tcs > 0 else 0
    
    # Company-wise defects distribution — fetch project ids per company directly (avoid lazy load N+1)
    company_defects = []
    company_releases = []
    company_health = []
    
    for comp in companies:
        p_ids = [p.id for p in db.query(Project).filter(Project.company_id == comp.id).all()]
        c_bugs = db.query(Defect).filter(Defect.project_id.in_(p_ids)).count() if p_ids else 0
        c_rels = db.query(Release).filter(Release.project_id.in_(p_ids)).count() if p_ids else 0
        
        company_defects.append({"name": comp.name, "value": c_bugs})
        company_releases.append({"name": comp.name, "value": c_rels})
        
        # Health = 100% minus open defects ratio
        total_b = c_bugs
        open_b = db.query(Defect).filter(
            Defect.project_id.in_(p_ids),
            Defect.status.in_(["New", "Assigned", "Open", "Reopened"])
        ).count() if p_ids else 0
        health = (100 - (open_b / total_b * 100)) if total_b > 0 else 100
        company_health.append({"name": comp.name, "value": round(health, 2)})

    return {
        "level": 1,
        "widgets": {
            "totalCompanies": total_companies,
            "totalProjects": total_projects,
            "totalUsers": total_users,
            "totalOpenDefects": open_defects,
            "totalClosedDefects": closed_defects,
            "overallTestingProgress": round(qa_progress, 2)
        },
        "charts": {
            "companyWiseDefects": company_defects,
            "companyWiseReleases": company_releases,
            "companyWiseProjectHealth": company_health
        }
    }


def get_level_2_company_metrics(company_id: int, db: Session):
    projects = db.query(Project).filter(Project.company_id == company_id).all()
    project_ids = [p.id for p in projects]
    
    total_projects = len(projects)
    total_users = db.query(User).filter(User.company_id == company_id).count()

    if not project_ids:
        return {
            "level": 2,
            "widgets": {
                "projectsCount": 0, "usersCount": total_users, "openBugs": 0,
                "closedBugs": 0, "activeSprints": 0
            },
            "charts": {
                "projectWiseDefects": [], "projectWiseQAProgress": [], "projectWiseReleaseStatus": []
            }
        }

    open_bugs = db.query(Defect).filter(
        Defect.project_id.in_(project_ids),
        Defect.status.in_(["New", "Assigned", "Open", "Reopened"])
    ).count()
    closed_bugs = db.query(Defect).filter(
        Defect.project_id.in_(project_ids),
        Defect.status == "Closed"
    ).count()
    active_sprints = db.query(Sprint).filter(
        Sprint.project_id.in_(project_ids),
        Sprint.status == "Active"
    ).count()

    project_defects = []
    project_qa_progress = []
    project_release_status = []

    for proj in projects:
        bugs = db.query(Defect).filter(Defect.project_id == proj.id).count()
        project_defects.append({"name": proj.name, "value": bugs})
        
        # QA progress
        tot_tcs = db.query(TestCase).join(TestScenario).filter(TestScenario.project_id == proj.id).count()
        pas_tcs = db.query(func.count(func.distinct(ExecutionHistory.test_case_id))).join(TestCase).join(TestScenario).filter(
            TestScenario.project_id == proj.id,
            ExecutionHistory.status == "Passed"
        ).scalar() or 0
        p_progress = (pas_tcs / tot_tcs * 100) if tot_tcs > 0 else 0
        project_qa_progress.append({"name": proj.name, "value": round(p_progress, 2)})
        
        # Releases
        rels_count = db.query(Release).filter(Release.project_id == proj.id).count()
        project_release_status.append({"name": proj.name, "value": rels_count})

    return {
        "level": 2,
        "widgets": {
            "projectsCount": total_projects,
            "usersCount": total_users,
            "openBugs": open_bugs,
            "closedBugs": closed_bugs,
            "activeSprints": active_sprints
        },
        "charts": {
            "projectWiseDefects": project_defects,
            "projectWiseQAProgress": project_qa_progress,
            "projectWiseReleaseStatus": project_release_status
        }
    }


def get_level_3_project_metrics(project_id: int, db: Session):
    requirements = db.query(Requirement).filter(Requirement.project_id == project_id).count()
    
    total_tcs = db.query(TestCase).join(TestScenario).filter(TestScenario.project_id == project_id).count()
    
    # Execution aggregates
    exec_passed = db.query(func.count(func.distinct(ExecutionHistory.test_case_id))).join(TestCase).join(TestScenario).filter(
        TestScenario.project_id == project_id, ExecutionHistory.status == "Passed"
    ).scalar() or 0
    
    exec_failed = db.query(func.count(func.distinct(ExecutionHistory.test_case_id))).join(TestCase).join(TestScenario).filter(
        TestScenario.project_id == project_id, ExecutionHistory.status == "Failed"
    ).scalar() or 0
    
    exec_blocked = db.query(func.count(func.distinct(ExecutionHistory.test_case_id))).join(TestCase).join(TestScenario).filter(
        TestScenario.project_id == project_id, ExecutionHistory.status == "Blocked"
    ).scalar() or 0
    
    open_defects = db.query(Defect).filter(
        Defect.project_id == project_id,
        Defect.status.in_(["New", "Assigned", "Open", "Reopened"])
    ).count()
    
    closed_defects = db.query(Defect).filter(
        Defect.project_id == project_id,
        Defect.status == "Closed"
    ).count()

    # Severity distribution
    severities = ["Low", "Medium", "High", "Critical"]
    severity_dist = []
    for sev in severities:
        count = db.query(Defect).filter(Defect.project_id == project_id, Defect.severity == sev).count()
        severity_dist.append({"name": sev, "value": count})

    # Priority distribution
    priorities = ["Low", "Medium", "High", "Urgent"]
    priority_dist = []
    for prio in priorities:
        count = db.query(Defect).filter(Defect.project_id == project_id, Defect.priority == prio).count()
        priority_dist.append({"name": prio, "value": count})

    # Defect aging (Days since created vs current time)
    now = datetime.now(timezone.utc).replace(tzinfo=None)  # naive UTC for DB comparison
    aging_ranges = {
        "0-3 Days": now - timedelta(days=3),
        "4-7 Days": now - timedelta(days=7),
        "8-15 Days": now - timedelta(days=15),
        "15+ Days": now - timedelta(days=1000) # anything older
    }
    defect_aging = []
    # 0-3 days
    c1 = db.query(Defect).filter(Defect.project_id == project_id, Defect.created_at >= aging_ranges["0-3 Days"]).count()
    # 4-7 days
    c2 = db.query(Defect).filter(Defect.project_id == project_id, Defect.created_at >= aging_ranges["4-7 Days"], Defect.created_at < aging_ranges["0-3 Days"]).count()
    # 8-15 days
    c3 = db.query(Defect).filter(Defect.project_id == project_id, Defect.created_at >= aging_ranges["8-15 Days"], Defect.created_at < aging_ranges["4-7 Days"]).count()
    # 15+ days
    c4 = db.query(Defect).filter(Defect.project_id == project_id, Defect.created_at < aging_ranges["8-15 Days"]).count()
    
    defect_aging = [
        {"name": "0-3 Days", "value": c1},
        {"name": "4-7 Days", "value": c2},
        {"name": "8-15 Days", "value": c3},
        {"name": "15+ Days", "value": c4}
    ]

    return {
        "level": 3,
        "widgets": {
            "requirements": requirements,
            "testCases": total_tcs,
            "executedTestsPassed": exec_passed,
            "executedTestsFailed": exec_failed,
            "executedTestsBlocked": exec_blocked,
            "openDefects": open_defects,
            "closedDefects": closed_defects
        },
        "charts": {
            "severityDistribution": severity_dist,
            "priorityDistribution": priority_dist,
            "defectAging": defect_aging,
            "sprintTrend": [{"name": "Sprint 1", "defects": 5, "tests": 20}, {"name": "Sprint 2", "defects": 3, "tests": 35}],
            "releaseTrend": [{"name": "v1.0.0", "defects": 10}, {"name": "v1.1.0", "defects": 6}]
        }
    }


def get_level_4_release_metrics(release_id: int, db: Session):
    release = db.query(Release).filter(Release.id == release_id).first()
    if not release:
        return {"error": "Release not found"}
        
    total_bugs = db.query(Defect).filter(Defect.release_id == release_id).count()
    closed_bugs = db.query(Defect).filter(Defect.release_id == release_id, Defect.status == "Closed").count()
    
    # Release Health: closed bugs / total bugs
    release_health = (closed_bugs / total_bugs * 100) if total_bugs > 0 else 100
    
    # Regression Status: Passed regression test runs
    regression_tests = db.query(TestCase).join(TestScenario).filter(
        TestScenario.project_id == release.project_id,
        TestCase.title.ilike("%regression%")
    ).count()
    passed_regression = db.query(func.count(func.distinct(ExecutionHistory.test_case_id))).join(TestCase).join(TestScenario).filter(
        TestScenario.project_id == release.project_id,
        TestCase.title.ilike("%regression%"),
        ExecutionHistory.status == "Passed"
    ).scalar() or 0
    regression_status = (passed_regression / regression_tests * 100) if regression_tests > 0 else 100

    # Defect Leakage: defects in Prod environment vs QA/other environment
    prod_defects = db.query(Defect).filter(Defect.release_id == release_id, Defect.environment == "Production").count()
    defect_leakage = (prod_defects / total_bugs * 100) if total_bugs > 0 else 0

    # Automation Coverage: Automation runs vs Manual runs
    auto_runs = db.query(func.count(func.distinct(ExecutionHistory.test_case_id))).join(TestCase).join(TestScenario).filter(
        TestScenario.project_id == release.project_id,
        ExecutionHistory.run_type == "Automation"
    ).scalar() or 0
    total_runs = db.query(TestCase).join(TestScenario).filter(
        TestScenario.project_id == release.project_id
    ).count()
    automation_coverage = (auto_runs / total_runs * 100) if total_runs > 0 else 0

    return {
        "level": 5,
        "widgets": {
            "releaseHealth": round(release_health, 2),
            "defectLeakage": round(defect_leakage, 2),
            "regressionStatus": round(regression_status, 2),
            "automationCoverage": round(automation_coverage, 2)
        },
        "charts": {
            "defectLeakageTrend": [
                {"name": "QA Env", "value": total_bugs - prod_defects},
                {"name": "Production Env", "value": prod_defects}
            ],
            "regressionPassedFailed": [
                {"name": "Passed", "value": passed_regression},
                {"name": "Failed/Blocked", "value": regression_tests - passed_regression}
            ]
        }
    }


def get_level_4_application_metrics(application_id: int, db: Session):
    app = db.query(Application).filter(Application.id == application_id).first()
    if not app:
        return {"error": "Application not found"}

    releases = db.query(Release).filter(Release.application_id == application_id).all()
    release_ids = [r.id for r in releases]

    total_tcs = db.query(TestCase).join(TestScenario).filter(TestScenario.application_id == application_id).count()

    exec_passed = db.query(func.count(func.distinct(ExecutionHistory.test_case_id))).join(TestCase).join(TestScenario).filter(
        TestScenario.application_id == application_id, ExecutionHistory.status == "Passed"
    ).scalar() or 0

    exec_failed = db.query(func.count(func.distinct(ExecutionHistory.test_case_id))).join(TestCase).join(TestScenario).filter(
        TestScenario.application_id == application_id, ExecutionHistory.status == "Failed"
    ).scalar() or 0

    exec_blocked = db.query(func.count(func.distinct(ExecutionHistory.test_case_id))).join(TestCase).join(TestScenario).filter(
        TestScenario.application_id == application_id, ExecutionHistory.status == "Blocked"
    ).scalar() or 0

    open_defects = 0
    closed_defects = 0
    severity_dist = []
    priority_dist = []
    defect_aging = []

    if release_ids:
        open_defects = db.query(Defect).filter(
            Defect.release_id.in_(release_ids),
            Defect.status.in_(["New", "Assigned", "Open", "Reopened"])
        ).count()

        closed_defects = db.query(Defect).filter(
            Defect.release_id.in_(release_ids),
            Defect.status == "Closed"
        ).count()

        for sev in ["Low", "Medium", "High", "Critical"]:
            count = db.query(Defect).filter(Defect.release_id.in_(release_ids), Defect.severity == sev).count()
            severity_dist.append({"name": sev, "value": count})

        for prio in ["Low", "Medium", "High", "Urgent"]:
            count = db.query(Defect).filter(Defect.release_id.in_(release_ids), Defect.priority == prio).count()
            priority_dist.append({"name": prio, "value": count})

        now = datetime.now(timezone.utc).replace(tzinfo=None)
        aging_ranges = {
            "0-3 Days": now - timedelta(days=3),
            "4-7 Days": now - timedelta(days=7),
            "8-15 Days": now - timedelta(days=15),
            "15+ Days": now - timedelta(days=1000)
        }
        c1 = db.query(Defect).filter(Defect.release_id.in_(release_ids), Defect.created_at >= aging_ranges["0-3 Days"]).count()
        c2 = db.query(Defect).filter(Defect.release_id.in_(release_ids), Defect.created_at >= aging_ranges["4-7 Days"], Defect.created_at < aging_ranges["0-3 Days"]).count()
        c3 = db.query(Defect).filter(Defect.release_id.in_(release_ids), Defect.created_at >= aging_ranges["8-15 Days"], Defect.created_at < aging_ranges["4-7 Days"]).count()
        c4 = db.query(Defect).filter(Defect.release_id.in_(release_ids), Defect.created_at < aging_ranges["8-15 Days"]).count()
        
        defect_aging = [
            {"name": "0-3 Days", "value": c1},
            {"name": "4-7 Days", "value": c2},
            {"name": "8-15 Days", "value": c3},
            {"name": "15+ Days", "value": c4}
        ]
    else:
        for sev in ["Low", "Medium", "High", "Critical"]:
            severity_dist.append({"name": sev, "value": 0})
        for prio in ["Low", "Medium", "High", "Urgent"]:
            priority_dist.append({"name": prio, "value": 0})
        for rng in ["0-3 Days", "4-7 Days", "8-15 Days", "15+ Days"]:
            defect_aging.append({"name": rng, "value": 0})

    release_trend = []
    for rel in releases[:5]:
        r_bugs = db.query(Defect).filter(Defect.release_id == rel.id).count()
        release_trend.append({"name": rel.version, "defects": r_bugs})

    return {
        "level": 4,
        "widgets": {
            "requirements": len(releases),
            "testCases": total_tcs,
            "executedTestsPassed": exec_passed,
            "executedTestsFailed": exec_failed,
            "executedTestsBlocked": exec_blocked,
            "openDefects": open_defects,
            "closedDefects": closed_defects
        },
        "charts": {
            "severityDistribution": severity_dist,
            "priorityDistribution": priority_dist,
            "defectAging": defect_aging,
            "sprintTrend": [],
            "releaseTrend": release_trend
        }
    }


def get_level_5_sprint_metrics(sprint_id: int, db: Session):
    sprint = db.query(Sprint).filter(Sprint.id == sprint_id).first()
    if not sprint:
        return {"error": "Sprint not found"}
        
    # Sprints widgets: Sprint Progress, Sprint Burndown, Resolved Bugs, Pending Bugs, Testing Completion
    total_bugs = db.query(Defect).filter(Defect.sprint_id == sprint_id).count()
    resolved_bugs = db.query(Defect).filter(Defect.sprint_id == sprint_id, Defect.status.in_(["Fixed", "Closed"])).count()
    pending_bugs = total_bugs - resolved_bugs
    
    # Testing Completion
    tcs_sprint = db.query(TestCase).join(TestScenario).filter(TestScenario.project_id == sprint.project_id).count()
    executed_sprint = db.query(func.count(func.distinct(ExecutionHistory.test_case_id))).join(TestCase).join(TestScenario).filter(
        TestScenario.project_id == sprint.project_id,
        ExecutionHistory.status.in_(["Passed", "Failed", "Blocked"])
    ).scalar() or 0
    testing_completion = (executed_sprint / tcs_sprint * 100) if tcs_sprint > 0 else 100
    
    # Sprint Progress: based on executed test cases percentage
    sprint_progress = testing_completion

    # Burndown chart points
    burndown = [
        {"day": "Day 1", "ideal": 10, "actual": 10},
        {"day": "Day 3", "ideal": 8, "actual": 9},
        {"day": "Day 5", "ideal": 6, "actual": 6},
        {"day": "Day 7", "ideal": 4, "actual": 3},
        {"day": "Day 9", "ideal": 2, "actual": 1},
        {"day": "Day 10", "ideal": 0, "actual": 0}
    ]

    return {
        "level": 6,
        "widgets": {
            "sprintProgress": round(sprint_progress, 2),
            "resolvedBugs": resolved_bugs,
            "pendingBugs": pending_bugs,
            "testingCompletion": round(testing_completion, 2)
        },
        "charts": {
            "burndown": burndown,
            "defectStatus": [
                {"name": "Resolved", "value": resolved_bugs},
                {"name": "Pending", "value": pending_bugs}
            ]
        }
    }
