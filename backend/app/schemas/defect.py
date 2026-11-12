from pydantic import BaseModel
from datetime import datetime
from typing import Optional, List
from app.schemas.auth import UserResponse

class DefectCommentBase(BaseModel):
    comment: str

class DefectCommentCreate(DefectCommentBase):
    pass

class DefectCommentResponse(DefectCommentBase):
    id: int
    defect_id: int
    user_id: int
    created_at: datetime
    user: Optional[UserResponse] = None

    class Config:
        from_attributes = True


class DefectAttachmentResponse(BaseModel):
    id: int
    defect_id: int
    filename: str
    filepath: str
    file_type: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class DefectAuditHistoryResponse(BaseModel):
    id: int
    defect_id: int
    field_name: str
    old_value: Optional[str] = None
    new_value: Optional[str] = None
    changed_at: datetime
    user: Optional[UserResponse] = None

    class Config:
        from_attributes = True


class DefectBase(BaseModel):
    title: str
    description: Optional[str] = None
    project_id: int
    module_id: Optional[int] = None
    sub_module_id: Optional[int] = None
    release_id: Optional[int] = None
    sprint_id: Optional[int] = None
    environment: Optional[str] = "QA"
    build_number: Optional[str] = None
    severity: Optional[str] = "Medium"
    priority: Optional[str] = "Medium"
    status: Optional[str] = "New"
    assigned_to_id: Optional[int] = None
    # ── Extended Bug/CR Report template fields (DB model has these columns) ──
    source_screen:      Optional[str] = None   # Source Screen/URL
    bug_type:           Optional[str] = "Bug"  # Bug | Change Request | Enhancement …
    screenshot_url:     Optional[str] = None   # Screenshot / evidence link
    reproducible:       Optional[str] = "YES"  # YES | NO | Intermittent
    steps_to_reproduce: Optional[str] = None   # Steps to Reproduce
    expected_behavior:  Optional[str] = None   # Expected Behavior
    actual_behavior:    Optional[str] = None   # Actual Behavior
    developer_name:     Optional[str] = None   # Developer Name
    developer_comments: Optional[str] = None   # Developer Comments / fix notes
    date_of_fixing:     Optional[str] = None   # Date of Fixing (DD/MM/YYYY free-text)

class DefectCreate(DefectBase):
    pass  # all fields including extended ones inherited from DefectBase

class DefectUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    module_id: Optional[int] = None
    sub_module_id: Optional[int] = None
    release_id: Optional[int] = None
    sprint_id: Optional[int] = None
    environment: Optional[str] = None
    build_number: Optional[str] = None
    severity: Optional[str] = None
    priority: Optional[str] = None
    status: Optional[str] = None
    assigned_to_id: Optional[int] = None
    # ── Extended Bug/CR Report template fields ───────────────────
    source_screen:      Optional[str] = None
    bug_type:           Optional[str] = None
    screenshot_url:     Optional[str] = None
    reproducible:       Optional[str] = None
    steps_to_reproduce: Optional[str] = None
    expected_behavior:  Optional[str] = None
    actual_behavior:    Optional[str] = None
    developer_name:     Optional[str] = None
    developer_comments: Optional[str] = None
    date_of_fixing:     Optional[str] = None

class DefectResponse(DefectBase):
    id: int
    defect_id: str
    reported_by_id: int
    created_at: datetime
    updated_at: datetime
    
    assigned_to: Optional[UserResponse] = None
    reported_by: Optional[UserResponse] = None
    comments: List[DefectCommentResponse] = []
    attachments: List[DefectAttachmentResponse] = []
    audit_history: List[DefectAuditHistoryResponse] = []

    class Config:
        from_attributes = True
