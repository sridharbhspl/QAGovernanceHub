from pydantic import BaseModel
from datetime import datetime
from typing import Optional, List
from app.schemas.auth import UserResponse

class GroupBase(BaseModel):
    name: str
    description: Optional[str] = None
    is_active: Optional[bool] = True

class GroupCreate(GroupBase):
    pass

class GroupResponse(GroupBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


class CompanyBase(BaseModel):
    name: str
    description: Optional[str] = None
    group_id: int
    is_active: Optional[bool] = True
    settings: Optional[str] = "{}"

class CompanyCreate(CompanyBase):
    pass

class CompanyResponse(CompanyBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


class ProjectBase(BaseModel):
    name: str
    code: str
    description: Optional[str] = None
    company_id: int
    is_active: Optional[bool] = True

class ProjectCreate(ProjectBase):
    pass

class ProjectResponse(ProjectBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


class ProjectTeamMappingBase(BaseModel):
    project_id: int
    user_id: int
    role: Optional[str] = None

class ProjectTeamMappingCreate(ProjectTeamMappingBase):
    pass

class ProjectTeamMappingUpdate(BaseModel):
    role: str

class ProjectTeamMappingResponse(ProjectTeamMappingBase):
    id: int
    created_at: datetime
    user: Optional[UserResponse] = None

    class Config:
        from_attributes = True


class ApplicationBase(BaseModel):
    name: str
    code: str
    description: Optional[str] = None
    project_id: int
    is_active: Optional[bool] = True

class ApplicationCreate(ApplicationBase):
    pass

class ApplicationResponse(ApplicationBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True

