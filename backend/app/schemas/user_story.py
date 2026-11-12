from pydantic import BaseModel
from datetime import datetime
from typing import Optional, List, Any
from app.schemas.auth import UserResponse
from app.schemas.work import SprintResponse


# ── Epic Schemas ─────────────────────────────────────────────────────────────
class EpicBase(BaseModel):
    epic_id: str
    title: str
    description: Optional[str] = None
    status: Optional[str] = "Backlog"  # Backlog, Active, Completed
    project_id: int


class EpicCreate(EpicBase):
    pass


class EpicUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    project_id: Optional[int] = None


class EpicResponse(EpicBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


# ── User Story Schemas ────────────────────────────────────────────────────────
class UserStoryBase(BaseModel):
    story_id: str
    title: str
    description: Optional[str] = None
    epic_id: Optional[int] = None
    story_points: Optional[int] = None
    acceptance_criteria: Optional[str] = None
    sprint_id: Optional[int] = None
    project_id: int
    application_id: Optional[int] = None
    status: Optional[str] = "Backlog"  # Backlog, To Do, In Progress, Dev Complete, Testing, Done
    priority: Optional[str] = "Medium"  # Low, Medium, High, Critical
    assigned_to_id: Optional[int] = None


class UserStoryCreate(UserStoryBase):
    pass


class UserStoryUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    epic_id: Optional[int] = None
    story_points: Optional[int] = None
    acceptance_criteria: Optional[str] = None
    sprint_id: Optional[int] = None
    project_id: Optional[int] = None
    application_id: Optional[int] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    assigned_to_id: Optional[int] = None


class UserStoryResponse(UserStoryBase):
    id: int
    created_by_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime

    # Embedded relationships for detailed views
    epic: Optional[EpicResponse] = None
    sprint: Optional[SprintResponse] = None
    assigned_to: Optional[UserResponse] = None
    creator: Optional[UserResponse] = None

    class Config:
        from_attributes = True
