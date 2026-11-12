import json
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.auth import User
from app.models.org import Project
from app.models.test_case import TestScenario, TestCase, ExecutionHistory
from app.models.defect import Defect, DefectAuditHistory

router = APIRouter()

@router.post("/upload-results")
def upload_automation_results(
    project_id:     int            = Form(...),
    build_number:   str            = Form(...),
    framework:      str            = Form(...),   # Cypress, Playwright, Selenium, etc.
    file:           UploadFile     = File(...),
    # ── Enrichment fields (all optional) ─────────────────────────────────────
    application_id: Optional[int]  = Form(None),  # Scoped to an application
    release_id:     Optional[int]  = Form(None),  # Tagged to a release/version
    sprint_id:      Optional[int]  = Form(None),  # Tagged to a sprint
    environment:    Optional[str]  = Form("QA"),  # QA | Staging | UAT | Pre-Prod | CI …
    test_type:      Optional[str]  = Form("Regression"),  # Regression | Smoke | E2E …
    # ─────────────────────────────────────────────────────────────────────────
    db:             Session        = Depends(get_db),
    current_user:   User           = Depends(get_current_user),
):
    """
    Parse an automation test-runner JSON report and import it into the QA Hub.

    Strategy
    ────────
    • Derive a unique scenario title from the framework + test_type combination so
      results from different run types (Regression vs Smoke, Playwright vs Cypress)
      land in separate scenario buckets rather than one catch-all scenario.
    • Attach application_id / release_id / sprint_id to the scenario so that
      filtering by hierarchy works correctly in all dashboards.
    • Set test_environment on executions so environment-based reporting is accurate.
    • Auto-create defects only for failures with no open existing defect for the
      same test + build to avoid duplicate noise.
    """

    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    try:
        content = file.file.read()
        report_data = json.loads(content)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Invalid JSON report file: {exc}")

    # ── Derive a meaningful, unique scenario title ────────────────────────────
    run_label = f"{test_type} – {framework}" if test_type else framework
    scenario_title = f"[AUTO] {run_label} Suite"

    scen = db.query(TestScenario).filter(
        TestScenario.project_id == project_id,
        TestScenario.title == scenario_title,
    ).first()

    if not scen:
        scen_count = db.query(TestScenario).filter(
            TestScenario.project_id == project_id
        ).count()
        scen_id = f"TS-{project.code.upper().replace(' ', '')}-{(scen_count + 1):03d}"
        scen = TestScenario(
            scenario_id=scen_id,
            title=scenario_title,
            description=(
                f"Auto-generated scenario for {framework} {test_type} runs. "
                f"Results imported from CI/CD pipeline report."
            ),
            test_type=test_type or "Regression",
            priority="High",
            project_id=project_id,
            application_id=application_id,
            release_id=release_id,
            sprint_id=sprint_id,
        )
        db.add(scen)
        db.commit()
        db.refresh(scen)
    else:
        # Keep context fields in sync with the latest upload
        updated = False
        if application_id and scen.application_id != application_id:
            scen.application_id = application_id; updated = True
        if release_id and scen.release_id != release_id:
            scen.release_id = release_id; updated = True
        if sprint_id and scen.sprint_id != sprint_id:
            scen.sprint_id = sprint_id; updated = True
        if updated:
            db.commit()
            db.refresh(scen)

    # ── Parse report file (multi-framework support) ───────────────────────────
    raw_tests: list[dict] = []

    if "results" in report_data:                        # Cypress mochawesome JSON
        for res in report_data["results"]:
            for suite in res.get("suites", []):
                for test in suite.get("tests", []):
                    raw_tests.append({
                        "title": f"{suite.get('title')} › {test.get('title')}",
                        "passed": test.get("state") == "passed",
                        "error": test.get("err", {}).get("message"),
                    })
    elif "suites" in report_data:                       # Playwright JSON reporter
        for suite in report_data["suites"]:
            for spec in suite.get("specs", []):
                for test in spec.get("tests", []):
                    for result in test.get("results", []):
                        raw_tests.append({
                            "title": spec.get("title", "Unnamed"),
                            "passed": result.get("status") in ("expected", "passed"),
                            "error": (result.get("error") or {}).get("message"),
                        })
    else:                                               # Generic / flat format
        for key in ("tests", "testSuites", "testRuns", "testcases"):
            if key in report_data and isinstance(report_data[key], list):
                for item in report_data[key]:
                    raw_tests.append({
                        "title": item.get("title") or item.get("name") or item.get("classname") or "Unnamed Test",
                        "passed": (
                            item.get("passed") is True
                            or item.get("status") in ("passed", "pass")
                            or item.get("state") == "passed"
                        ),
                        "error": item.get("errorMessage") or item.get("error") or item.get("failureMessage"),
                    })
                break  # Use first matching key only

    # ── Process extracted tests ───────────────────────────────────────────────
    tests_parsed  = 0
    passed_count  = 0
    failed_count  = 0
    created_defects: list[str] = []

    env_label = environment or "QA"
    env_display = f"{framework} / {env_label}"

    for rt in raw_tests:
        tests_parsed += 1
        status_str = "Passed" if rt["passed"] else "Failed"
        if rt["passed"]:
            passed_count += 1
        else:
            failed_count += 1

        # Upsert test case by title under this scenario
        tc = db.query(TestCase).filter(
            TestCase.test_scenario_id == scen.id,
            TestCase.title == rt["title"],
        ).first()

        if not tc:
            tc_count = (
                db.query(TestCase)
                .join(TestScenario)
                .filter(TestScenario.project_id == project_id)
                .count()
            )
            tc_id = f"TC-{project.code.upper().replace(' ', '')}-{(tc_count + 1):04d}"
            tc = TestCase(
                test_case_id=tc_id,
                title=rt["title"],
                precondition=f"Executed automatically via {framework}",
                steps="1. Execute automation script\n2. Verify assertion passes",
                expected_result="Test assertion succeeds with exit code 0",
                test_type=test_type or "Regression",
                status="Active",
                test_scenario_id=scen.id,
            )
            db.add(tc)
            db.commit()
            db.refresh(tc)

        # Log execution with full context
        actual = (
            f"[{framework}] Error: {rt['error']}" if rt["error"]
            else f"[{framework}] Passed successfully in {env_label}"
        )
        db_exec = ExecutionHistory(
            test_case_id=tc.id,
            status=status_str,
            actual_result=actual,
            test_environment=env_display,
            executed_by_id=current_user.id,
            run_type="Automation",
            build_number=build_number,
        )
        db.add(db_exec)
        db.commit()
        db.refresh(db_exec)

        # Auto-create defect for failures (deduplicated by title + open status)
        if status_str == "Failed":
            defect_title = f"[AUTO-{framework}] Failed: {tc.title[:120]}"

            existing = db.query(Defect).filter(
                Defect.project_id == project_id,
                Defect.title == defect_title,
                Defect.status.in_(["New", "Assigned", "Open", "Reopened"]),
            ).first()

            if not existing:
                def_count = db.query(Defect).filter(
                    Defect.project_id == project_id
                ).count()
                defect_id_str = f"BUG-{project.code.upper().replace(' ', '')}-{(def_count + 1):06d}"

                new_defect = Defect(
                    defect_id=defect_id_str,
                    title=defect_title,
                    description=(
                        f"Automated {test_type or 'regression'} test failed.\n"
                        f"Framework : {framework}\n"
                        f"Build     : {build_number}\n"
                        f"Environment: {env_label}\n\n"
                        f"Error:\n{rt['error'] or 'No error message captured'}"
                    ),
                    project_id=project_id,
                    environment=env_label,
                    build_number=build_number,
                    severity="High",
                    priority="High",
                    status="New",
                    reported_by_id=current_user.id,
                )
                db.add(new_defect)
                db.commit()
                db.refresh(new_defect)

                # Link defect ↔ execution
                db_exec.defect_id = new_defect.id
                db.commit()

                # Audit trail
                db.add(DefectAuditHistory(
                    defect_id=new_defect.id,
                    user_id=current_user.id,
                    field_name="defect",
                    old_value=None,
                    new_value=(
                        f"Auto-created from failed {framework} {test_type} run "
                        f"in build {build_number} on {env_label}"
                    ),
                ))
                db.commit()
                created_defects.append(defect_id_str)

    return {
        "message": "Automation report uploaded and parsed successfully",
        "framework": framework,
        "test_type": test_type,
        "environment": env_label,
        "build_number": build_number,
        "scenario": scenario_title,
        "tests_parsed": tests_parsed,
        "passed": passed_count,
        "failed": failed_count,
        "pass_rate": round((passed_count / tests_parsed * 100) if tests_parsed else 0, 1),
        "auto_created_defects": created_defects,
    }

