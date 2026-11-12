"""
Pydantic Schemas for Change Request Management — Module 11
"""
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


# ── Nested user mini-schema ────────────────────────────────────────────────────
class UserMini(BaseModel):
    id: int
    full_name: str
    email: str
    role: str

    model_config = {"from_attributes": True}


# ── Comment schemas ────────────────────────────────────────────────────────────
class CRCommentCreate(BaseModel):
    cr_db_id: int
    comment: str
    stage: Optional[str] = None


class CRCommentResponse(BaseModel):
    id: int
    cr_db_id: int
    user_id: int
    comment: str
    stage: Optional[str] = None
    created_at: datetime
    user: Optional[UserMini] = None

    model_config = {"from_attributes": True}


# ── Audit History ──────────────────────────────────────────────────────────────
class CRAuditResponse(BaseModel):
    id: int
    cr_db_id: int
    user_id: int
    from_status: Optional[str] = None
    to_status: Optional[str] = None
    field_name: Optional[str] = None
    old_value: Optional[str] = None
    new_value: Optional[str] = None
    notes: Optional[str] = None
    changed_at: datetime
    user: Optional[UserMini] = None

    model_config = {"from_attributes": True}


# ── Change Request schemas ─────────────────────────────────────────────────────
class ChangeRequestCreate(BaseModel):
    cr_id: str = Field(..., min_length=1, max_length=50)
    title: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = None
    justification: Optional[str] = None
    impact_analysis: Optional[str] = None
    implementation_plan: Optional[str] = None
    rollback_plan: Optional[str] = None
    test_plan: Optional[str] = None

    category: str = "Functional"
    priority: str = "Medium"
    change_type: str = "Enhancement"
    risk_level: str = "Low"
    estimated_effort: Optional[str] = None
    target_version: Optional[str] = None

    project_id: int
    application_id: Optional[int] = None
    sprint_id: Optional[int] = None
    release_id: Optional[int] = None

    assigned_to_id: Optional[int] = None
    target_date: Optional[datetime] = None


class ChangeRequestUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    justification: Optional[str] = None
    impact_analysis: Optional[str] = None
    implementation_plan: Optional[str] = None
    rollback_plan: Optional[str] = None
    test_plan: Optional[str] = None

    category: Optional[str] = None
    priority: Optional[str] = None
    change_type: Optional[str] = None
    risk_level: Optional[str] = None
    status: Optional[str] = None
    rejection_reason: Optional[str] = None
    estimated_effort: Optional[str] = None
    target_version: Optional[str] = None

    application_id: Optional[int] = None
    sprint_id: Optional[int] = None
    release_id: Optional[int] = None
    assigned_to_id: Optional[int] = None
    target_date: Optional[datetime] = None


class WorkflowTransitionRequest(BaseModel):
    """Body for explicit workflow transitions."""
    to_status: str
    notes: Optional[str] = None
    rejection_reason: Optional[str] = None


class ChangeRequestResponse(BaseModel):
    id: int
    cr_id: str
    title: str
    description: Optional[str] = None
    justification: Optional[str] = None
    impact_analysis: Optional[str] = None
    implementation_plan: Optional[str] = None
    rollback_plan: Optional[str] = None
    test_plan: Optional[str] = None

    category: str
    priority: str
    change_type: str
    risk_level: str
    status: str
    rejection_reason: Optional[str] = None
    estimated_effort: Optional[str] = None
    target_version: Optional[str] = None

    project_id: int
    application_id: Optional[int] = None
    sprint_id: Optional[int] = None
    release_id: Optional[int] = None

    requested_by_id: Optional[int] = None
    assigned_to_id: Optional[int] = None
    reviewed_by_id: Optional[int] = None
    approved_by_id: Optional[int] = None
    implemented_by_id: Optional[int] = None
    verified_by_id: Optional[int] = None

    requested_date: Optional[datetime] = None
    reviewed_date: Optional[datetime] = None
    approved_date: Optional[datetime] = None
    implemented_date: Optional[datetime] = None
    verified_date: Optional[datetime] = None
    target_date: Optional[datetime] = None

    created_at: datetime
    updated_at: datetime

    # Nested objects
    requested_by: Optional[UserMini] = None
    assigned_to: Optional[UserMini] = None
    reviewed_by: Optional[UserMini] = None
    approved_by: Optional[UserMini] = None
    implemented_by: Optional[UserMini] = None
    verified_by: Optional[UserMini] = None

    comments: List[CRCommentResponse] = []
    audit_history: List[CRAuditResponse] = []

    model_config = {"from_attributes": True}
