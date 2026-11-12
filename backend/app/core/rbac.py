"""
RBAC Core — Permission Matrix & FastAPI Dependency
Defines the authoritative role→permission mapping and provides
a require_permission() dependency for route-level access control.
"""
from typing import List, Set
from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.auth import RoleConstants

# ── Canonical Permission Actions ──────────────────────────────────────────────
class Permissions:
    CREATE          = "create"
    READ            = "read"
    UPDATE          = "update"
    DELETE          = "delete"
    APPROVE         = "approve"
    EXPORT          = "export"
    MANAGE_USERS    = "manage_users"
    MANAGE_PROJECTS = "manage_projects"

    ALL = [CREATE, READ, UPDATE, DELETE, APPROVE, EXPORT, MANAGE_USERS, MANAGE_PROJECTS]


# ── Permission Descriptions (used for DB seeding) ─────────────────────────────
PERMISSION_DESCRIPTIONS = {
    Permissions.CREATE:          "Create new records (defects, test cases, projects, etc.)",
    Permissions.READ:            "View / read any record",
    Permissions.UPDATE:          "Edit / update existing records",
    Permissions.DELETE:          "Delete records",
    Permissions.APPROVE:         "Approve or reject items (defects, releases, test executions)",
    Permissions.EXPORT:          "Export data to Excel, PDF, or CSV",
    Permissions.MANAGE_USERS:    "Create, edit, deactivate user accounts",
    Permissions.MANAGE_PROJECTS: "Create, configure, and archive projects",
}


# ── Permission Matrix ─────────────────────────────────────────────────────────
# True = permission granted. Super Admin implicitly bypasses all checks.
ROLE_PERMISSION_MATRIX: dict[str, Set[str]] = {
    RoleConstants.SUPER_ADMIN: set(Permissions.ALL),   # full access

    RoleConstants.GROUP_ADMIN: {
        Permissions.CREATE, Permissions.READ, Permissions.UPDATE, Permissions.DELETE,
        Permissions.APPROVE, Permissions.EXPORT, Permissions.MANAGE_USERS, Permissions.MANAGE_PROJECTS,
    },

    RoleConstants.COMPANY_ADMIN: {
        Permissions.CREATE, Permissions.READ, Permissions.UPDATE, Permissions.DELETE,
        Permissions.APPROVE, Permissions.EXPORT, Permissions.MANAGE_USERS, Permissions.MANAGE_PROJECTS,
    },

    RoleConstants.PROJECT_MANAGER: {
        Permissions.CREATE, Permissions.READ, Permissions.UPDATE, Permissions.DELETE,
        Permissions.APPROVE, Permissions.EXPORT, Permissions.MANAGE_PROJECTS,
    },

    RoleConstants.QA_LEAD: {
        Permissions.CREATE, Permissions.READ, Permissions.UPDATE, Permissions.DELETE,
        Permissions.APPROVE, Permissions.EXPORT,
    },

    RoleConstants.QA_ENGINEER: {
        Permissions.CREATE, Permissions.READ, Permissions.UPDATE, Permissions.EXPORT,
    },

    RoleConstants.DEVELOPER: {
        Permissions.CREATE, Permissions.READ, Permissions.UPDATE,
    },

    RoleConstants.CLIENT: {
        Permissions.READ, Permissions.EXPORT,
    },

    RoleConstants.VIEWER: {
        Permissions.READ,
    },
}


def get_role_permissions(role: str) -> List[str]:
    """Return sorted list of permissions for a given role string."""
    return sorted(ROLE_PERMISSION_MATRIX.get(role, set()))


def has_permission(role: str, permission: str) -> bool:
    """
    Check if a role has a given permission.
    Super Admin always returns True.
    """
    if role == RoleConstants.SUPER_ADMIN:
        return True
    return permission in ROLE_PERMISSION_MATRIX.get(role, set())


def require_permission(permission: str):
    """
    FastAPI dependency factory.
    Usage:
        @router.post("/items", dependencies=[Depends(require_permission(Permissions.CREATE))])
    or:
        @router.get("/items")
        async def list_items(user = Depends(require_permission(Permissions.READ))): ...
    """
    def _checker(current_user=Depends(_get_current_user_for_rbac)):
        if current_user.role == RoleConstants.SUPER_ADMIN:
            return current_user  # bypass
        if not has_permission(current_user.role, permission):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permission denied. Required: '{permission}'. Your role: '{current_user.role}'.",
            )
        return current_user
    return _checker


def _get_current_user_for_rbac():
    """
    Deferred import to avoid circular dependency.
    The actual implementation is in api/deps.py.
    """
    from app.api.deps import get_current_user
    return get_current_user
