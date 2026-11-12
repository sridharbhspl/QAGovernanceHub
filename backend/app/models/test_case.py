from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Text
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from app.core.database import Base

class Requirement(Base):
    __tablename__ = "requirements"

    id = Column(Integer, primary_key=True, index=True)
    requirement_id = Column(String(50), unique=True, index=True, nullable=False) # e.g. REQ-PROJ001-001
    title = Column(String(150), nullable=False)
    description = Column(Text, nullable=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    application_id = Column(Integer, ForeignKey("applications.id", ondelete="CASCADE"), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc).replace(tzinfo=None))

    # Relationships
    project = relationship("Project", back_populates="requirements")
    application = relationship("Application")
    test_scenarios = relationship("TestScenario", back_populates="requirement", cascade="all, delete-orphan")


class TestScenario(Base):
    __tablename__ = "test_scenarios"

    id = Column(Integer, primary_key=True, index=True)
    scenario_id = Column(String(50), index=True, nullable=False)  # e.g. TS-PROJ001-001
    title = Column(String(200), nullable=False)
    module = Column(String(100), nullable=True)         # Module / Feature Area
    description = Column(Text, nullable=True)           # Scenario Description
    objective = Column(Text, nullable=True)             # Objective / Scope — what is being validated
    precondition = Column(Text, nullable=True)          # Scenario-level Pre Conditions
    post_condition = Column(Text, nullable=True)        # Scenario-level Post Conditions
    priority = Column(String(20), nullable=True, default="Medium")  # Critical | High | Medium | Low
    test_type = Column(String(30), nullable=True, default="Functional")  # Functional | Regression | Smoke | UAT…
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    application_id = Column(Integer, ForeignKey("applications.id", ondelete="CASCADE"), nullable=True)
    requirement_id = Column(Integer, ForeignKey("requirements.id", ondelete="SET NULL"), nullable=True)
    release_id = Column(Integer, ForeignKey("releases.id", ondelete="SET NULL"), nullable=True)   # Version/Release tag
    sprint_id = Column(Integer, ForeignKey("sprints.id", ondelete="SET NULL"), nullable=True)     # Sprint tag
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc).replace(tzinfo=None))

    # Relationships
    requirement = relationship("Requirement", back_populates="test_scenarios")
    application = relationship("Application", back_populates="test_scenarios")
    test_cases = relationship("TestCase", back_populates="test_scenario", cascade="all, delete-orphan")


class TestCase(Base):
    __tablename__ = "test_cases"

    id = Column(Integer, primary_key=True, index=True)
    test_case_id = Column(String(50), index=True, nullable=False) # e.g. TC-PROJ001-001
    title = Column(String(200), nullable=False)
    precondition = Column(Text, nullable=True)         # Pre Conditions
    steps = Column(Text, nullable=False)               # Test Steps (numbered)
    test_data = Column(Text, nullable=True)            # Test Data (inputs/credentials/payloads)
    expected_result = Column(Text, nullable=False)     # Expected Result
    post_condition = Column(Text, nullable=True)       # Post Conditions (system state after test)
    priority = Column(String(20), nullable=False, default="Medium")  # Critical, High, Medium, Low
    test_type = Column(String(30), nullable=True, default="Functional") # Functional, Regression, Smoke, UAT, Integration
    status = Column(String(30), nullable=False, default="Active")    # Draft, Active, Obsolete
    test_scenario_id = Column(Integer, ForeignKey("test_scenarios.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc).replace(tzinfo=None))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc).replace(tzinfo=None), onupdate=lambda: datetime.now(timezone.utc).replace(tzinfo=None))

    # Relationships
    test_scenario = relationship("TestScenario", back_populates="test_cases")
    executions = relationship("ExecutionHistory", back_populates="test_case", cascade="all, delete-orphan")


class ExecutionHistory(Base):
    __tablename__ = "execution_histories"

    id = Column(Integer, primary_key=True, index=True)
    test_case_id = Column(Integer, ForeignKey("test_cases.id", ondelete="CASCADE"), nullable=False)
    status = Column(String(30), nullable=False, default="Untested")  # Passed, Failed, Blocked, Skipped
    actual_result = Column(Text, nullable=True)
    step_results = Column(Text, nullable=True)             # JSON details for stepwise execution
    test_environment = Column(String(100), nullable=True)  # e.g. "Chrome 124 / Windows 11 / Staging"
    comments = Column(Text, nullable=True)                 # Notes/Comments
    defect_id = Column(Integer, ForeignKey("defects.id", ondelete="SET NULL"), nullable=True)
    executed_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    executed_at = Column(DateTime, default=lambda: datetime.now(timezone.utc).replace(tzinfo=None))
    run_type = Column(String(30), nullable=False, default="Manual")  # Manual, Automation
    build_number = Column(String(50), nullable=True)

    # Relationships
    test_case = relationship("TestCase", back_populates="executions")
    defect = relationship("Defect", back_populates="test_executions")
    executed_by = relationship("User")
