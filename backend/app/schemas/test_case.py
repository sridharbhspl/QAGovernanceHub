from pydantic import BaseModel
from datetime import datetime
from typing import Optional, List
from app.schemas.auth import UserResponse


# ─────────────────────────────────────────────────────────────────
# Execution History   (maps to: Actual Result | Status | Test Env
#                               Notes/Comments | Tested By | Test Date)
# ─────────────────────────────────────────────────────────────────
class ExecutionHistoryBase(BaseModel):
    status: str                            # Passed | Failed | Blocked | Skipped
    actual_result: Optional[str] = None    # What actually happened
    step_results: Optional[str] = None     # JSON stepwise execution results
    test_environment: Optional[str] = None # Browser / OS / Env (e.g. "Chrome 124 / Win11 / Staging")
    comments: Optional[str] = None         # Notes / observations
    defect_id: Optional[int] = None
    run_type: Optional[str] = "Manual"     # Manual | Automation
    build_number: Optional[str] = None

class ExecutionHistoryCreate(ExecutionHistoryBase):
    test_case_id: int

class ExecutionHistoryResponse(ExecutionHistoryBase):
    id: int
    test_case_id: int
    executed_by_id: Optional[int] = None
    executed_at: datetime
    executed_by: Optional[UserResponse] = None

    class Config:
        from_attributes = True


# ─────────────────────────────────────────────────────────────────
# Test Case  (maps to: Test Case | Description | Pre Conditions |
#             Test Steps | Test Data | Expected Result | Post Conditions
#             Priority | Test Type | Status)
# ─────────────────────────────────────────────────────────────────
class TestCaseBase(BaseModel):
    title: str                                      # Test Case Description
    precondition: Optional[str] = None              # Pre Conditions
    steps: str                                      # Test Steps
    test_data: Optional[str] = None                 # Test Data (inputs / sample data)
    expected_result: str                            # Expected Result
    post_condition: Optional[str] = None            # Post Conditions
    priority: Optional[str] = "Medium"              # Critical | High | Medium | Low
    test_type: Optional[str] = "Functional"         # Functional | Regression | Smoke | UAT | Integration | Performance
    status: Optional[str] = "Active"               # Draft | Active | Obsolete
    test_scenario_id: int

class TestCaseCreate(TestCaseBase):
    log_execution: Optional[bool] = False
    exec_status: Optional[str] = None
    exec_actual_result: Optional[str] = None
    exec_environment: Optional[str] = None
    exec_comments: Optional[str] = None

class TestCaseUpdate(BaseModel):
    title: Optional[str] = None
    precondition: Optional[str] = None
    steps: Optional[str] = None
    test_data: Optional[str] = None
    expected_result: Optional[str] = None
    post_condition: Optional[str] = None
    priority: Optional[str] = None
    test_type: Optional[str] = None
    status: Optional[str] = None

class TestCaseResponse(TestCaseBase):
    id: int
    test_case_id: str
    created_at: datetime
    updated_at: datetime
    executions: List[ExecutionHistoryResponse] = []

    class Config:
        from_attributes = True


# ─────────────────────────────────────────────────────────────────
# Test Scenario  (maps to: Module | Scenario ID | Description |
#                 Objective | Pre Conditions | Post Conditions |
#                 Priority | Test Type | Requirement link)
# ─────────────────────────────────────────────────────────────────
class TestScenarioBase(BaseModel):
    title: str
    module: Optional[str] = None                      # Module / Feature Area
    description: Optional[str] = None                # Scenario Description
    objective: Optional[str] = None                  # Objective / Scope of testing
    precondition: Optional[str] = None               # Scenario-level Pre Conditions
    post_condition: Optional[str] = None             # Scenario-level Post Conditions
    priority: Optional[str] = "Medium"               # Critical | High | Medium | Low
    test_type: Optional[str] = "Functional"          # Functional | Regression | Smoke | UAT | Integration
    project_id: int
    application_id: Optional[int] = None
    requirement_id: Optional[int] = None
    release_id: Optional[int] = None              # Version/Release link
    sprint_id: Optional[int] = None               # Sprint link

class TestScenarioCreate(TestScenarioBase):
    create_test_case: Optional[bool] = False
    tc_steps: Optional[str] = None
    tc_expected_result: Optional[str] = None
    tc_test_data: Optional[str] = None
    log_execution: Optional[bool] = False
    exec_status: Optional[str] = None
    exec_actual_result: Optional[str] = None
    exec_environment: Optional[str] = None
    exec_comments: Optional[str] = None


class TestScenarioUpdate(BaseModel):
    title: Optional[str] = None
    module: Optional[str] = None
    description: Optional[str] = None
    objective: Optional[str] = None
    precondition: Optional[str] = None
    post_condition: Optional[str] = None
    priority: Optional[str] = None
    test_type: Optional[str] = None
    release_id: Optional[int] = None
    sprint_id: Optional[int] = None

class TestScenarioResponse(TestScenarioBase):
    id: int
    scenario_id: str
    created_at: datetime
    test_cases: List[TestCaseResponse] = []

    class Config:
        from_attributes = True


# ─────────────────────────────────────────────────────────────────
# Requirement
# ─────────────────────────────────────────────────────────────────
class RequirementBase(BaseModel):
    requirement_id: str
    title: str
    description: Optional[str] = None
    project_id: int
    application_id: Optional[int] = None

class RequirementCreate(RequirementBase):
    pass

class RequirementResponse(RequirementBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True
