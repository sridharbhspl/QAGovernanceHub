from pydantic import BaseModel
from datetime import datetime
from typing import List, Optional


class PermissionResponse(BaseModel):
    id: int
    action: str
    description: Optional[str] = None

    class Config:
        from_attributes = True


class RoleResponse(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    is_system_role: bool
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class RoleWithPermissions(RoleResponse):
    permissions: List[PermissionResponse] = []


class AssignPermissionsRequest(BaseModel):
    permission_ids: List[int]


class CreateRoleRequest(BaseModel):
    name: str
    description: Optional[str] = None
    permission_ids: List[int] = []
