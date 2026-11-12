from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import List, Optional
import io
import csv
import pandas as pd
import docx
from datetime import datetime, timezone
from sqlalchemy import or_
from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.auth import User
from app.models.org import Project
from app.models.test_case import Requirement, TestScenario, TestCase, ExecutionHistory
from app.models.defect import Defect
from app.schemas.test_case import (
    RequirementCreate, RequirementResponse,
    TestScenarioCreate, TestScenarioUpdate, TestScenarioResponse,
    TestCaseCreate, TestCaseUpdate, TestCaseResponse,
    ExecutionHistoryCreate, ExecutionHistoryResponse
)
def parse_date_safely(date_val) -> datetime:
    if not date_val:
        return datetime.now(timezone.utc).replace(tzinfo=None)
    
    # If already a datetime object (e.g. read from Excel Date format)
    if isinstance(date_val, datetime):
        return date_val.replace(tzinfo=None)
        
    # If it's a pandas Timestamp/other object with to_pydatetime()
    if hasattr(date_val, "to_pydatetime"):
        try:
            return date_val.to_pydatetime().replace(tzinfo=None)
        except Exception:
            pass
            
    # Normalize to string and attempt format parsing
    s = str(date_val).strip()
    for fmt in ("%d/%m/%Y", "%Y-%m-%d %H:%M:%S", "%Y-%m-%d", "%m/%d/%Y"):
        try:
            return datetime.strptime(s, fmt)
        except ValueError:
            continue
            
    # Ultimate fallback: pandas parse
    try:
        parsed = pd.to_datetime(s, dayfirst=True)
        if hasattr(parsed, "to_pydatetime"):
            return parsed.to_pydatetime().replace(tzinfo=None)
        elif isinstance(parsed, datetime):
            return parsed.replace(tzinfo=None)
    except Exception:
        pass
        
    return datetime.now(timezone.utc).replace(tzinfo=None)

router = APIRouter()

# ----------------- Requirements -----------------
@router.get("/requirements", response_model=List[RequirementResponse])
def get_requirements(
    project_id: int,
    application_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(Requirement).filter(Requirement.project_id == project_id)
    if application_id:
        query = query.filter(Requirement.application_id == application_id)
    return query.all()

@router.post("/requirements", response_model=RequirementResponse)
def create_requirement(
    req_in: RequirementCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    project = db.query(Project).filter(Project.id == req_in.project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
        
    db_req = Requirement(
        requirement_id=req_in.requirement_id,
        title=req_in.title,
        description=req_in.description,
        project_id=req_in.project_id,
        application_id=req_in.application_id
    )
    db.add(db_req)
    db.commit()
    db.refresh(db_req)
    return db_req


# ----------------- Test Scenarios -----------------
@router.get("/scenarios", response_model=List[TestScenarioResponse])
def get_scenarios(
    project_id: int,
    application_id: Optional[int] = None,
    release_id: Optional[int] = None,
    sprint_id: Optional[int] = None,
    requirement_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(TestScenario).filter(TestScenario.project_id == project_id)

    # Application: hard filter (scenarios belong to a specific app)
    if application_id:
        query = query.filter(TestScenario.application_id == application_id)

    # Release / Sprint: use OR-NULL logic.
    # Scenarios tagged to the selected release/sprint are shown.
    # Scenarios with NO tag (NULL) are "global" and visible in every context.
    if release_id:
        query = query.filter(
            or_(TestScenario.release_id == release_id, TestScenario.release_id.is_(None))
        )
    if sprint_id:
        query = query.filter(
            or_(TestScenario.sprint_id == sprint_id, TestScenario.sprint_id.is_(None))
        )

    if requirement_id:
        query = query.filter(TestScenario.requirement_id == requirement_id)

    return query.all()


@router.post("/scenarios", response_model=TestScenarioResponse)
def create_scenario(
    scen_in: TestScenarioCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    project = db.query(Project).filter(Project.id == scen_in.project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
        
    # Count scenarios in project to auto gen ID
    scen_count = db.query(TestScenario).filter(TestScenario.project_id == project.id).count()
    scen_id = f"TS-{project.code.upper().replace(' ', '')}-{(scen_count + 1):03d}"
    # Make sure auto-generated ID is unique within this project (loop until free)
    offset = 0
    while db.query(TestScenario).filter(
        TestScenario.project_id == project.id,
        TestScenario.scenario_id == scen_id
    ).first():
        offset += 1
        scen_id = f"TS-{project.code.upper().replace(' ', '')}-{(scen_count + 1 + offset):03d}"
    
    db_scen = TestScenario(
        scenario_id=scen_id,
        title=scen_in.title,
        module=scen_in.module,
        description=scen_in.description,
        objective=scen_in.objective,
        precondition=scen_in.precondition,
        post_condition=scen_in.post_condition,
        priority=scen_in.priority or "Medium",
        test_type=scen_in.test_type or "Functional",
        project_id=scen_in.project_id,
        application_id=scen_in.application_id,
        requirement_id=scen_in.requirement_id
    )
    db.add(db_scen)
    db.commit()
    db.refresh(db_scen)

    # Check if we should create a linked test case
    if scen_in.create_test_case:
        tc_count = db.query(TestCase).join(TestScenario).filter(TestScenario.project_id == project.id).count()
        tc_id = f"TC-{project.code.upper().replace(' ', '')}-{(tc_count + 1):04d}"
        
        db_tc = TestCase(
            test_case_id=tc_id,
            title=scen_in.title,
            precondition=scen_in.precondition,
            steps=scen_in.tc_steps or "1. Execute test scenario steps",
            test_data=scen_in.tc_test_data,
            expected_result=scen_in.tc_expected_result or "Verify successful scenario validation",
            priority=scen_in.priority or "Medium",
            status="Active",
            test_scenario_id=db_scen.id
        )
        db.add(db_tc)
        db.commit()
        db.refresh(db_tc)

        # Check if we should log initial execution
        if scen_in.log_execution and scen_in.exec_status:
            db_exec = ExecutionHistory(
                test_case_id=db_tc.id,
                status=scen_in.exec_status,
                actual_result=scen_in.exec_actual_result,
                test_environment=scen_in.exec_environment or "Manual",
                comments=scen_in.exec_comments,
                executed_by_id=current_user.id,
                run_type="Manual"
            )
            db.add(db_exec)
            db.commit()

    return db_scen



@router.patch("/scenarios/{scen_id}", response_model=TestScenarioResponse)
def update_scenario(
    scen_id: int,
    scen_update: TestScenarioUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    scen = db.query(TestScenario).filter(TestScenario.id == scen_id).first()
    if not scen:
        raise HTTPException(status_code=404, detail="Test Scenario not found")
    update_data = scen_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(scen, field, value)
    db.commit()
    db.refresh(scen)
    return scen


@router.delete("/scenarios/{scen_id}", status_code=204)
def delete_scenario(
    scen_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    scen = db.query(TestScenario).filter(TestScenario.id == scen_id).first()
    if not scen:
        raise HTTPException(status_code=404, detail="Test Scenario not found")
    db.delete(scen)
    db.commit()
    return None


# ----------------- Test Cases -----------------
@router.get("/test-cases", response_model=List[TestCaseResponse])
def get_test_cases(
    test_scenario_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return db.query(TestCase).filter(TestCase.test_scenario_id == test_scenario_id).all()

@router.post("/test-cases", response_model=TestCaseResponse)
def create_test_case(
    tc_in: TestCaseCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    scenario = db.query(TestScenario).filter(TestScenario.id == tc_in.test_scenario_id).first()
    if not scenario:
        raise HTTPException(status_code=404, detail="Test Scenario not found")
        
    project = db.query(Project).filter(Project.id == scenario.project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
        
    # Count test cases under scenario/project to auto gen ID
    tc_count = db.query(TestCase).join(TestScenario).filter(TestScenario.project_id == scenario.project_id).count()
    tc_id = f"TC-{project.code.upper().replace(' ', '')}-{(tc_count + 1):04d}"
    # Ensure TC id is unique within this project
    offset = 0
    while db.query(TestCase).join(TestScenario).filter(
        TestScenario.project_id == scenario.project_id,
        TestCase.test_case_id == tc_id
    ).first():
        offset += 1
        tc_id = f"TC-{project.code.upper().replace(' ', '')}-{(tc_count + 1 + offset):04d}"
    
    db_tc = TestCase(
        test_case_id=tc_id,
        title=tc_in.title,
        precondition=tc_in.precondition,
        steps=tc_in.steps,
        test_data=tc_in.test_data,
        expected_result=tc_in.expected_result,
        post_condition=tc_in.post_condition,
        priority=tc_in.priority or "Medium",
        test_type=tc_in.test_type or "Functional",
        status=tc_in.status or "Active",
        test_scenario_id=tc_in.test_scenario_id
    )
    db.add(db_tc)
    db.commit()
    db.refresh(db_tc)

    # Check if we should log initial execution
    if tc_in.log_execution and tc_in.exec_status:
        db_exec = ExecutionHistory(
            test_case_id=db_tc.id,
            status=tc_in.exec_status,
            actual_result=tc_in.exec_actual_result,
            test_environment=tc_in.exec_environment or "Manual",
            comments=tc_in.exec_comments,
            executed_by_id=current_user.id,
            run_type="Manual"
        )
        db.add(db_exec)
        db.commit()

    return db_tc



@router.patch("/test-cases/{tc_id}", response_model=TestCaseResponse)
def update_test_case(
    tc_id: int,
    tc_update: TestCaseUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    tc = db.query(TestCase).filter(TestCase.id == tc_id).first()
    if not tc:
        raise HTTPException(status_code=404, detail="Test case not found")
    update_data = tc_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(tc, field, value)
    db.commit()
    db.refresh(tc)
    return tc


@router.delete("/test-cases/{tc_id}", status_code=204)
def delete_test_case(
    tc_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    tc = db.query(TestCase).filter(TestCase.id == tc_id).first()
    if not tc:
        raise HTTPException(status_code=404, detail="Test case not found")
    db.delete(tc)
    db.commit()
    return None


# ----------------- Test Execution -----------------
@router.post("/executions", response_model=ExecutionHistoryResponse)
def create_execution(
    exec_in: ExecutionHistoryCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    tc = db.query(TestCase).filter(TestCase.id == exec_in.test_case_id).first()
    if not tc:
        raise HTTPException(status_code=404, detail="Test case not found")
        
    # Check if defect_id is provided and valid
    if exec_in.defect_id:
        def_check = db.query(Defect).filter(Defect.id == exec_in.defect_id).first()
        if not def_check:
            raise HTTPException(status_code=404, detail="Linked defect not found")
            
    db_exec = ExecutionHistory(
        test_case_id=exec_in.test_case_id,
        status=exec_in.status,
        actual_result=exec_in.actual_result,
        step_results=exec_in.step_results,
        test_environment=exec_in.test_environment,
        comments=exec_in.comments,
        defect_id=exec_in.defect_id,
        executed_by_id=current_user.id,
        run_type=exec_in.run_type,
        build_number=exec_in.build_number
    )
    db.add(db_exec)
    db.commit()
    db.refresh(db_exec)
    return db_exec


# ----------------- RTM compilation -----------------
@router.get("/rtm/matrix")
def get_rtm_matrix(project_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """
    RTM: Requirement -> Test Scenario -> Test Case -> Execution -> Defect
    """
    requirements = db.query(Requirement).filter(Requirement.project_id == project_id).all()
    
    matrix = []
    for req in requirements:
        req_scenarios = db.query(TestScenario).filter(TestScenario.requirement_id == req.id).all()
        scenarios_list = []
        
        passed_count = 0
        total_tc = 0
        
        for scen in req_scenarios:
            tcs = db.query(TestCase).filter(TestCase.test_scenario_id == scen.id).all()
            tcs_list = []
            
            for tc in tcs:
                total_tc += 1
                # Find latest execution
                latest_exec = db.query(ExecutionHistory).filter(ExecutionHistory.test_case_id == tc.id).order_by(ExecutionHistory.executed_at.desc()).first()
                
                exec_status = "Untested"
                linked_defect_id = None
                linked_defect_code = None
                
                if latest_exec:
                    exec_status = latest_exec.status
                    if latest_exec.status == "Passed":
                        passed_count += 1
                    if latest_exec.defect_id:
                        linked_defect_id = latest_exec.defect_id
                        defect_obj = db.query(Defect).filter(Defect.id == latest_exec.defect_id).first()
                        if defect_obj:
                            linked_defect_code = defect_obj.defect_id
                
                tcs_list.append({
                    "id": tc.id,
                    "test_case_id": tc.test_case_id,
                    "title": tc.title,
                    "status": exec_status,
                    "defect_id": linked_defect_id,
                    "defect_code": linked_defect_code
                })
                
            scenarios_list.append({
                "id": scen.id,
                "scenario_id": scen.scenario_id,
                "title": scen.title,
                "test_cases": tcs_list
            })
            
        coverage_pct = (passed_count / total_tc * 100) if total_tc > 0 else 0.0
        
        matrix.append({
            "requirement_internal_id": req.id,
            "requirement_id": req.requirement_id,
            "title": req.title,
            "description": req.description,
            "scenarios": scenarios_list,
            "total_test_cases": total_tc,
            "passed_test_cases": passed_count,
            "coverage_percentage": round(coverage_pct, 2)
        })
        
    return matrix


# ----------------- Bulk Templates & Uploads -----------------

def generate_csv_template(headers: List[str], sample_row: List[str]) -> bytes:
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(headers)
    writer.writerow(sample_row)
    return output.getvalue().encode('utf-8')

def generate_excel_template(headers: List[str], sample_row: List[str]) -> bytes:
    df = pd.DataFrame([sample_row], columns=headers)
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        df.to_excel(writer, index=False)
    return output.getvalue()

def generate_docx_template(title: str, headers: List[str], sample_row: List[str]) -> bytes:
    doc = docx.Document()
    doc.add_heading(title, level=1)
    doc.add_paragraph("Please fill in the table below. Do not modify the column headers.")
    
    table = doc.add_table(rows=2, cols=len(headers))
    table.style = 'Table Grid'
    
    # Headers
    hdr_cells = table.rows[0].cells
    for i, h in enumerate(headers):
        hdr_cells[i].text = h
        
    # Sample Row
    data_cells = table.rows[1].cells
    for i, val in enumerate(sample_row):
        data_cells[i].text = val
        
    output = io.BytesIO()
    doc.save(output)
    return output.getvalue()


@router.get("/templates/download")
def download_template(type: str, format: str):
    scen_headers = [
        "Scenario ID", "Module", "Test Scenario Description", "Pre Conditions", 
        "Test Steps", "Expected Result", "Actual Result", "Status", 
        "Priority", "Tested By", "Test Date", "Comments"
    ]
    scen_sample = [
        "TS-AUTH-001", "Authentication", "Verify user authentication end-to-end", "User account is active", 
        "1. Open login page\n2. Enter valid email and password\n3. Click Sign In", "User is redirected to the Dashboard", 
        "Redirected successfully", "Passed", "High", "admin@company.com", "2026-06-04", "Verified on Chrome and Edge"
    ]

    tc_headers = [
        "Test Scenario ID", "Test Case ID", "Module", "Test Case", "Test Case Description", 
        "Preconditions", "Test Steps", "Test Data", "Expected Result", "Actual Result", 
        "Status", "Post conditions", "Test Environment", "Notes/Comments"
    ]
    tc_sample = [
        "TS-AUTH-001", "TC-AUTH-0001", "Authentication", "Verify login with valid credentials", 
        "Verify that active users can login with valid email and password", "User is on the login page", 
        "1. Enter valid email\n2. Enter valid password\n3. Click Sign In", "Email: qa@company.com\nPassword: Password123", 
        "Successfully authenticated and redirected to dashboard", "Redirected to dashboard", "Passed", 
        "Auth cookie/token is set in browser", "Chrome / Windows / Staging", "Verified regression testing"
    ]

    if type == "scenarios":
        title = "Scenarios Bulk Upload Template"
        headers = scen_headers
        sample = scen_sample
    elif type == "testcases":
        title = "Test Cases Bulk Upload Template"
        headers = tc_headers
        sample = tc_sample
    else:
        raise HTTPException(status_code=400, detail="Invalid template type. Use 'scenarios' or 'testcases'.")

    # Generate file bytes
    fmt = format.lower()
    if fmt == "csv":
        data = generate_csv_template(headers, sample)
        media_type = "text/csv"
        filename = f"{type}_template.csv"
    elif fmt == "xlsx":
        data = generate_excel_template(headers, sample)
        media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        filename = f"{type}_template.xlsx"
    elif fmt == "docx":
        data = generate_docx_template(title, headers, sample)
        media_type = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        filename = f"{type}_template.docx"
    else:
        raise HTTPException(status_code=400, detail="Invalid template format. Use 'csv', 'xlsx', or 'docx'.")

    return StreamingResponse(
        io.BytesIO(data),
        media_type=media_type,
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.post("/upload/scenarios")
def upload_scenarios(
    project_id: int = Form(...),
    application_id: Optional[int] = Form(None),
    release_id: Optional[int] = Form(None),
    sprint_id: Optional[int] = Form(None),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
        
    filename = (file.filename or "").lower()
    content = file.file.read()
    
    # Parse into DataFrame
    try:
        if filename.endswith(".csv"):
            try:
                text = content.decode("utf-8")
            except UnicodeDecodeError:
                text = content.decode("latin-1")
            df = pd.read_csv(io.StringIO(text))
        elif filename.endswith((".xlsx", ".xls")):
            df = pd.read_excel(io.BytesIO(content))
        elif filename.endswith(".docx"):
            doc = docx.Document(io.BytesIO(content))
            rows_data = []
            for table in doc.tables:
                if len(table.rows) < 2:
                    continue
                headers = [cell.text.strip() for cell in table.rows[0].cells]
                
                clean_hdrs = [h.lower().replace(" ", "").replace("_", "").replace("-", "") for h in headers]
                if not any(k in h for h in clean_hdrs for k in ["scenario", "testcase", "teststeps", "expectedresult", "module"]):
                    continue
                    
                for row in table.rows[1:]:
                    row_dict = {}
                    for idx, cell in enumerate(row.cells):
                        if idx < len(headers):
                            row_dict[headers[idx]] = cell.text.strip()
                    rows_data.append(row_dict)
            if not rows_data:
                raise HTTPException(status_code=400, detail="No valid scenario tables found in Word document.")
            df = pd.DataFrame(rows_data)
        else:
            raise HTTPException(status_code=400, detail="Unsupported file format. Please upload .csv, .xlsx, or .docx.")
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=400, detail=f"Failed to parse file: {str(e)}")

    df.columns = [f"{c}".strip() for c in df.columns]
    
    def find_col_val(row, keywords):
        for col in df.columns:
            cleaned = col.lower().replace(" ", "").replace("_", "").replace("-", "").replace("/", "")
            if cleaned in keywords:
                val = row[col]
                return str(val).strip() if pd.notna(val) else None
        return None
    scenarios_created = 0
    test_cases_created = 0
    executions_logged = 0
    errors = []
    skipped_duplicates = 0

    # Prefetch counts to avoid N+1 queries during ID generation
    scen_count = db.query(TestScenario).filter(TestScenario.project_id == project_id).count()
    tc_count = db.query(TestCase).join(TestScenario).filter(TestScenario.project_id == project_id).count()
    
    used_scen_ids = {s[0].lower() for s in db.query(TestScenario.scenario_id).filter(TestScenario.project_id == project_id).all() if s[0]}
    used_tc_ids = {t[0].lower() for t in db.query(TestCase.test_case_id).join(TestScenario).filter(TestScenario.project_id == project_id).all() if t[0]}

    for index, row in df.iterrows():
        sp = db.begin_nested()   # savepoint: IntegrityError on this row rolls back only this row
        try:
            scen_id_val = find_col_val(row, ["scenarioid", "scenid", "testscenarioid"])
            module_val = find_col_val(row, ["module", "featurearea", "modulefeaturearea"])
            scen_desc_val = find_col_val(row, ["testscenariodescription", "scenariodescription", "description", "scenariodetails"])
            precondition_val = find_col_val(row, ["preconditions", "precondition"])
            steps_val = find_col_val(row, ["teststeps", "steps", "actions"])
            expected_result_val = find_col_val(row, ["expectedresult", "expectedresults", "expected"])
            actual_result_val = find_col_val(row, ["actualresult", "actualresults", "actual"])
            status_val = find_col_val(row, ["status", "state", "result"])
            priority_val = find_col_val(row, ["priority", "severity"])
            tested_by_val = find_col_val(row, ["testedby", "tester", "executedby"])
            test_date_val = find_col_val(row, ["testdate", "executiondate", "date"])
            comments_val = find_col_val(row, ["comments", "notes", "notescomments"])

            if not scen_desc_val:
                sp.rollback()
                continue

            # ── Find or create Scenario (idempotent) ──────────────────────
            scen = None
            if scen_id_val:
                scen = db.query(TestScenario).filter(
                    TestScenario.project_id == project_id,
                    TestScenario.scenario_id == scen_id_val,
                    TestScenario.application_id == application_id,
                    TestScenario.release_id == release_id,
                    TestScenario.sprint_id == sprint_id
                ).first()
            if not scen:
                scen = db.query(TestScenario).filter(
                    TestScenario.project_id == project_id,
                    TestScenario.title == scen_desc_val[:200],
                    TestScenario.application_id == application_id,
                    TestScenario.release_id == release_id,
                    TestScenario.sprint_id == sprint_id
                ).first()

            if not scen:
                scen_count += 1
                # Prefer file-supplied ID; fall back to auto-generated ID
                new_scen_id = scen_id_val or f"TS-{project.code.upper().replace(' ', '')}-{scen_count:03d}"
                
                # Make sure auto-generated ID is unique within this project (loop until free)
                while new_scen_id.lower() in used_scen_ids:
                    scen_count += 1
                    new_scen_id = f"TS-{project.code.upper().replace(' ', '')}-{scen_count:03d}"
                
                scen = TestScenario(
                    scenario_id=new_scen_id,
                    title=scen_desc_val[:200],
                    module=module_val,
                    description=scen_desc_val,
                    precondition=precondition_val,
                    priority=priority_val or "Medium",
                    project_id=project_id,
                    application_id=application_id,
                    release_id=release_id,
                    sprint_id=sprint_id,
                )
                db.add(scen)
                db.flush()   # validate before commit so IntegrityError hits the savepoint
                used_scen_ids.add(new_scen_id.lower())
                scenarios_created += 1

            # ── Find or create Test Case ──────────────────────────────────
            if steps_val or expected_result_val:
                tc_title = scen_desc_val[:200]
                tc = db.query(TestCase).filter(
                    TestCase.test_scenario_id == scen.id,
                    TestCase.title == tc_title
                ).first()
                
                if not tc:
                    tc_count += 1
                    tc_id = f"TC-{project.code.upper().replace(' ', '')}-{tc_count:04d}"
                    
                    # Ensure TC id is unique within this project
                    while tc_id.lower() in used_tc_ids:
                        tc_count += 1
                        tc_id = f"TC-{project.code.upper().replace(' ', '')}-{tc_count:04d}"
                    tc = TestCase(
                        test_case_id=tc_id,
                        title=tc_title,
                        precondition=precondition_val,
                        steps=steps_val or "1. Execute test scenario steps",
                        expected_result=expected_result_val or "Verify successful validation",
                        priority=priority_val or "Medium",
                        status="Active",
                        test_scenario_id=scen.id
                    )
                    db.add(tc)
                    db.flush()
                    used_tc_ids.add(tc_id.lower())
                    test_cases_created += 1

                # ── Log Execution if status/result present ───────────────
                if status_val or actual_result_val:
                    exec_status = "Untested"
                    s_clean = (status_val or "").lower()
                    if "pass" in s_clean:     exec_status = "Passed"
                    elif "fail" in s_clean:   exec_status = "Failed"
                    elif "block" in s_clean:  exec_status = "Blocked"
                    elif "skip" in s_clean:   exec_status = "Skipped"

                    exec_date = parse_date_safely(test_date_val)

                    executed_by_id = current_user.id
                    if tested_by_val:
                        user_obj = db.query(User).filter(
                            (User.email == tested_by_val) | (User.full_name == tested_by_val)
                        ).first()
                        if user_obj:
                            executed_by_id = user_obj.id

                    db_exec = ExecutionHistory(
                        test_case_id=tc.id,
                        status=exec_status,
                        actual_result=actual_result_val,
                        comments=comments_val,
                        executed_by_id=executed_by_id,
                        executed_at=exec_date,
                        run_type="Manual"
                    )
                    db.add(db_exec)
                    db.flush()
                    executions_logged += 1

            sp.commit()   # commit savepoint for this row

        except Exception as row_err:
            sp.rollback()   # roll back ONLY this row's changes; session stays valid
            err_msg = str(row_err)
            row_num = int(index)  # type: ignore[arg-type]
            if "Duplicate entry" in err_msg:
                skipped_duplicates += 1
                errors.append(f"Row {row_num + 2}: Skipped — already exists (duplicate ID or title)")
            else:
                errors.append(f"Row {row_num + 2}: {err_msg}")

    db.commit()   # final commit for all successful savepoints

    return {
        "message": "Scenarios imported successfully",
        "scenarios_created": scenarios_created,
        "test_cases_created": test_cases_created,
        "executions_logged": executions_logged,
        "skipped_duplicates": skipped_duplicates,
        "errors": errors
    }


@router.post("/upload/testcases")
def upload_testcases(
    project_id: int = Form(...),
    application_id: Optional[int] = Form(None),
    release_id: Optional[int] = Form(None),
    sprint_id: Optional[int] = Form(None),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
        
    filename = (file.filename or "").lower()
    content = file.file.read()
    
    # Parse into DataFrame
    try:
        if filename.endswith(".csv"):
            try:
                text = content.decode("utf-8")
            except UnicodeDecodeError:
                text = content.decode("latin-1")
            df = pd.read_csv(io.StringIO(text))
        elif filename.endswith((".xlsx", ".xls")):
            df = pd.read_excel(io.BytesIO(content))
        elif filename.endswith(".docx"):
            doc = docx.Document(io.BytesIO(content))
            rows_data = []
            for table in doc.tables:
                if len(table.rows) < 2:
                    continue
                headers = [cell.text.strip() for cell in table.rows[0].cells]
                
                clean_hdrs = [h.lower().replace(" ", "").replace("_", "").replace("-", "") for h in headers]
                if not any(k in h for h in clean_hdrs for k in ["testscenario", "testcase", "teststeps", "expectedresult", "module"]):
                    continue
                    
                for row in table.rows[1:]:
                    row_dict = {}
                    for idx, cell in enumerate(row.cells):
                        if idx < len(headers):
                            row_dict[headers[idx]] = cell.text.strip()
                    rows_data.append(row_dict)
            if not rows_data:
                raise HTTPException(status_code=400, detail="No valid test case tables found in Word document.")
            df = pd.DataFrame(rows_data)
        else:
            raise HTTPException(status_code=400, detail="Unsupported file format. Please upload .csv, .xlsx, or .docx.")
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=400, detail=f"Failed to parse file: {str(e)}")

    df.columns = [f"{c}".strip() for c in df.columns]
    
    def find_col_val(row, keywords):
        for col in df.columns:
            cleaned = col.lower().replace(" ", "").replace("_", "").replace("-", "").replace("/", "")
            if cleaned in keywords:
                val = row[col]
                return str(val).strip() if pd.notna(val) else None
        return None

    test_cases_created = 0
    scenarios_created = 0
    executions_logged = 0
    errors = []
    skipped_duplicates = 0

    # Prefetch counts and existing IDs
    scen_count = db.query(TestScenario).filter(TestScenario.project_id == project_id).count()
    tc_count = db.query(TestCase).join(TestScenario).filter(TestScenario.project_id == project_id).count()
    used_scen_ids = {s[0].lower() for s in db.query(TestScenario.scenario_id).filter(TestScenario.project_id == project_id).all() if s[0]}
    used_tc_ids = {t[0].lower() for t in db.query(TestCase.test_case_id).join(TestScenario).filter(TestScenario.project_id == project_id).all() if t[0]}

    for index, row in df.iterrows():
        sp = db.begin_nested()
        try:
            scen_id_val = find_col_val(row, ["testscenarioid", "scenarioid", "scenid"])
            tc_id_val = find_col_val(row, ["testcaseid", "tcid", "caseid"])
            module_val = find_col_val(row, ["module", "featurearea"])
            tc_title_val = find_col_val(row, ["testcase", "testcasetitle", "title"])
            tc_desc_val = find_col_val(row, ["testcasedescription", "description", "details"])
            precondition_val = find_col_val(row, ["preconditions", "precondition"])
            steps_val = find_col_val(row, ["teststeps", "steps"])
            test_data_val = find_col_val(row, ["testdata", "data"])
            expected_result_val = find_col_val(row, ["expectedresult", "expectedresults", "expected"])
            actual_result_val = find_col_val(row, ["actualresult", "actualresults", "actual"])
            status_val = find_col_val(row, ["status", "result"])
            post_condition_val = find_col_val(row, ["postconditions", "postcondition"])
            test_env_val = find_col_val(row, ["testenvironment", "environment", "env"])
            comments_val = find_col_val(row, ["notescomments", "notes", "comments"])
            priority_val = find_col_val(row, ["priority"])

            title_text = tc_title_val or tc_desc_val
            if not title_text:
                sp.rollback()
                continue

            # ── Find or create parent Scenario ───────────────────────────
            scen = None
            if scen_id_val:
                scen = db.query(TestScenario).filter(
                    TestScenario.project_id == project_id,
                    TestScenario.scenario_id == scen_id_val,
                    TestScenario.application_id == application_id,
                    TestScenario.release_id == release_id,
                    TestScenario.sprint_id == sprint_id
                ).first()
            if not scen and module_val:
                scen = db.query(TestScenario).filter(
                    TestScenario.project_id == project_id,
                    TestScenario.module == module_val,
                    TestScenario.application_id == application_id,
                    TestScenario.release_id == release_id,
                    TestScenario.sprint_id == sprint_id
                ).first()
            if not scen:
                scen_count += 1
                new_scen_id = scen_id_val or f"TS-{project.code.upper().replace(' ', '')}-{scen_count:03d}"
                
                while new_scen_id.lower() in used_scen_ids:
                    scen_count += 1
                    new_scen_id = f"TS-{project.code.upper().replace(' ', '')}-{scen_count:03d}"

                scen = TestScenario(
                    scenario_id=new_scen_id,
                    title=f"Scenario for {module_val or 'Imported Cases'}",
                    module=module_val,
                    description="Auto-generated scenario during bulk upload.",
                    project_id=project_id,
                    application_id=application_id,
                    release_id=release_id,
                    sprint_id=sprint_id,
                )
                db.add(scen)
                db.flush()
                used_scen_ids.add(new_scen_id.lower())
                scenarios_created += 1

            # ── Find or create Test Case ──────────────────────────────────
            tc = None
            if tc_id_val:
                tc = db.query(TestCase).filter(
                    TestCase.test_scenario_id == scen.id,
                    TestCase.test_case_id == tc_id_val
                ).first()
            if not tc:
                tc = db.query(TestCase).filter(
                    TestCase.test_scenario_id == scen.id,
                    TestCase.title == title_text[:200]
                ).first()

            if not tc:
                tc_count += 1
                new_tc_id = tc_id_val or f"TC-{project.code.upper().replace(' ', '')}-{tc_count:04d}"
                
                while new_tc_id.lower() in used_tc_ids:
                    tc_count += 1
                    new_tc_id = f"TC-{project.code.upper().replace(' ', '')}-{tc_count:04d}"

                tc = TestCase(
                    test_case_id=new_tc_id,
                    title=title_text[:200],
                    precondition=precondition_val,
                    steps=steps_val or "1. Execute test case steps",
                    test_data=test_data_val,
                    expected_result=expected_result_val or "Verify successful validation",
                    post_condition=post_condition_val,
                    priority=priority_val or "Medium",
                    status="Active",
                    test_scenario_id=scen.id
                )
                db.add(tc)
                db.flush()
                used_tc_ids.add(new_tc_id.lower())
                test_cases_created += 1

            # ── Log Execution if result data present ─────────────────────
            if status_val or actual_result_val or test_env_val or comments_val:
                exec_status = "Untested"
                s_clean = (status_val or "").lower()
                if "pass" in s_clean:     exec_status = "Passed"
                elif "fail" in s_clean:   exec_status = "Failed"
                elif "block" in s_clean:  exec_status = "Blocked"
                elif "skip" in s_clean:   exec_status = "Skipped"

                db_exec = ExecutionHistory(
                    test_case_id=tc.id,
                    status=exec_status,
                    actual_result=actual_result_val,
                    test_environment=test_env_val,
                    comments=comments_val,
                    executed_by_id=current_user.id,
                    run_type="Manual"
                )
                db.add(db_exec)
                db.flush()
                executions_logged += 1

            sp.commit()

        except Exception as row_err:
            sp.rollback()
            err_msg = str(row_err)
            row_num = int(index)  # type: ignore[arg-type]
            if "Duplicate entry" in err_msg:
                skipped_duplicates += 1
                errors.append(f"Row {row_num + 2}: Skipped — already exists (duplicate ID or title)")
            else:
                errors.append(f"Row {row_num + 2}: {err_msg}")

    db.commit()

    return {
        "message": "Test cases imported successfully",
        "scenarios_created": scenarios_created,
        "test_cases_created": test_cases_created,
        "executions_logged": executions_logged,
        "skipped_duplicates": skipped_duplicates,
        "errors": errors
    }
