"""
RBAC API — Role and Permission Management
Admin-only endpoints for viewing and managing the permission matrix.
"""
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.api.deps import get_current_user, RoleChecker
from app.core.rbac import ROLE_PERMISSION_MATRIX, Permissions, PERMISSION_DESCRIPTIONS, get_role_permissions
from app.models.auth import User, RoleConstants
from app.models.rbac import RoleDB, Permission, RolePermission
from app.schemas.rbac import (
    RoleResponse,
    RoleWithPermissions,
    PermissionResponse,
    AssignPermissionsRequest,
    CreateRoleRequest,
)

router = APIRouter()

# Only admins can manage RBAC
_admin_roles = [RoleConstants.SUPER_ADMIN, RoleConstants.GROUP_ADMIN, RoleConstants.COMPANY_ADMIN]
require_admin = RoleChecker(_admin_roles)


# ── Helpers ────────────────────────────────────────────────────────────────────

def _role_to_schema(role: RoleDB) -> RoleWithPermissions:
    """
    Convert a RoleDB ORM instance to a RoleWithPermissions schema.
    Explicit field extraction avoids Pyright Column-type complaints.
    """
    perms = [
        PermissionResponse(
            id=int(rp.permission.id),
            action=str(rp.permission.action),
            description=str(rp.permission.description) if rp.permission.description else None,
        )
        for rp in role.role_permissions
        if rp.permission
    ]
    return RoleWithPermissions(
        id=int(role.id),                              # type: ignore[arg-type]
        name=str(role.name),                          # type: ignore[arg-type]
        description=str(role.description) if role.description else None,
        is_system_role=bool(role.is_system_role),     # type: ignore[arg-type]
        is_active=bool(role.is_active),               # type: ignore[arg-type]
        created_at=role.created_at,                   # type: ignore[arg-type]
        permissions=perms,
    )


def _perm_to_schema(perm: Permission) -> PermissionResponse:
    return PermissionResponse(
        id=int(perm.id),                              # type: ignore[arg-type]
        action=str(perm.action),                      # type: ignore[arg-type]
        description=str(perm.description) if perm.description else None,
    )


# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.get("/roles", response_model=List[RoleWithPermissions], summary="List all roles with permissions")
def list_roles(
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    roles = db.query(RoleDB).filter(RoleDB.is_active.is_(True)).order_by(RoleDB.id).all()
    return [_role_to_schema(r) for r in roles]


@router.get("/permissions", response_model=List[PermissionResponse], summary="List all permissions")
def list_permissions(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    perms = db.query(Permission).order_by(Permission.id).all()
    return [_perm_to_schema(p) for p in perms]


@router.get("/matrix", summary="Get permission matrix (role → permissions)")
def get_matrix(_: User = Depends(get_current_user)):
    """Returns the in-memory permission matrix for UI display."""
    return {
        role: sorted(list(perms))
        for role, perms in ROLE_PERMISSION_MATRIX.items()
    }


@router.get("/my-permissions", summary="Get current user's permissions")
def get_my_permissions(current_user: User = Depends(get_current_user)):
    return {
        "role": str(current_user.role),
        "permissions": get_role_permissions(str(current_user.role)),
    }


@router.post("/roles", response_model=RoleResponse, summary="Create a custom role")
def create_role(
    data: CreateRoleRequest,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    existing = db.query(RoleDB).filter(RoleDB.name == data.name).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Role '{data.name}' already exists.")

    role = RoleDB(name=data.name, description=data.description, is_system_role=False)
    db.add(role)
    db.flush()

    if data.permission_ids:
        for perm_id in data.permission_ids:
            perm = db.query(Permission).filter(Permission.id == perm_id).first()
            if perm:
                db.add(RolePermission(role_id=role.id, permission_id=perm.id))

    db.commit()
    db.refresh(role)
    return RoleResponse(
        id=int(role.id),                              # type: ignore[arg-type]
        name=str(role.name),                          # type: ignore[arg-type]
        description=str(role.description) if role.description else None,
        is_system_role=bool(role.is_system_role),     # type: ignore[arg-type]
        is_active=bool(role.is_active),               # type: ignore[arg-type]
        created_at=role.created_at,                   # type: ignore[arg-type]
    )


@router.put("/roles/{role_id}/permissions", response_model=RoleWithPermissions, summary="Update role permissions")
def update_role_permissions(
    role_id: int,
    data: AssignPermissionsRequest,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    role = db.query(RoleDB).filter(RoleDB.id == role_id).first()
    if not role:
        raise HTTPException(status_code=404, detail="Role not found.")

    # Clear existing permissions
    db.query(RolePermission).filter(RolePermission.role_id == role_id).delete()

    # Assign new permissions
    for perm_id in data.permission_ids:
        perm = db.query(Permission).filter(Permission.id == perm_id).first()
        if perm:
            db.add(RolePermission(role_id=role_id, permission_id=perm_id))

    db.commit()
    db.refresh(role)
    return _role_to_schema(role)
