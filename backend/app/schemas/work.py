from pydantic import BaseModel
from datetime import datetime, date
from typing import Optional, List

class SubModuleBase(BaseModel):
    name: str
    description: Optional[str] = None
    module_id: int

class SubModuleCreate(SubModuleBase):
    pass

class SubModuleResponse(SubModuleBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


class ModuleBase(BaseModel):
    name: str
    description: Optional[str] = None
    project_id: int

class ModuleCreate(ModuleBase):
    pass

class ModuleResponse(ModuleBase):
    id: int
    created_at: datetime
    sub_modules: List[SubModuleResponse] = []

    class Config:
        from_attributes = True


class ReleaseBase(BaseModel):
    version: str
    description: Optional[str] = None
    status: Optional[str] = "Planning"
    release_date: Optional[date] = None
    project_id: int
    application_id: Optional[int] = None

class ReleaseCreate(ReleaseBase):
    pass

class ReleaseResponse(ReleaseBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


class SprintBase(BaseModel):
    name: str
    description: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    status: Optional[str] = "Future"
    project_id: int
    application_id: Optional[int] = None

class SprintCreate(SprintBase):
    pass

class SprintResponse(SprintBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True

