"""
FastAPI Dependencies — Phase 0 Production Grade
Provides: get_current_user, require_permission, get_client_ip
"""
from typing import Generator, List, Optional
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError
from pydantic import ValidationError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.rbac import has_permission, Permissions, ROLE_PERMISSION_MATRIX
from app.models.auth import User, RoleConstants
from app.schemas.auth import TokenData

oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl=f"{settings.API_V1_STR}/auth/login"
)


def get_client_ip(request: Request) -> Optional[str]:
    """Extract real client IP, respecting reverse proxy headers."""
    forwarded_for = request.headers.get("X-Forwarded-For")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()
    return request.client.host if request.client else None


def get_current_user(
    db: Session = Depends(get_db),
    token: str = Depends(oauth2_scheme),
) -> User:
    """
    Decode JWT access token and return the authenticated User.
    Checks: valid signature, not expired, user exists, user is active.
    NOTE: Does NOT validate refresh token — that's done in /auth/refresh.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        token_type = payload.get("type", "access")
        if token_type != "access":
            raise credentials_exception
        token_data = TokenData(
            email=payload.get("sub"),
            role=payload.get("role"),
            permissions=payload.get("permissions", []),
        )
        if token_data.email is None:
            raise credentials_exception
    except (JWTError, ValidationError):
        raise credentials_exception

    user = db.query(User).filter(User.email == token_data.email).first()
    if not user:
        raise credentials_exception
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is inactive. Contact your administrator.",
        )
    return user


def get_current_user_optional(
    db: Session = Depends(get_db),
    token: Optional[str] = Depends(oauth2_scheme),
) -> Optional[User]:
    """Like get_current_user but returns None instead of raising if not authenticated."""
    if token is None:
        return None
    try:
        return get_current_user(db=db, token=token)
    except HTTPException:
        return None


class RoleChecker:
    """
    Backwards-compatible role checker (kept for existing routes).
    Prefer require_permission() for new routes.
    """
    def __init__(self, allowed_roles: List[str]):
        self.allowed_roles = allowed_roles

    def __call__(self, current_user: User = Depends(get_current_user)):
        user_roles = [r.strip() for r in current_user.role.split(",") if r.strip()]
        if not any(r in self.allowed_roles for r in user_roles):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=(
                    f"User roles '{current_user.role}' are not authorized. "
                    f"Required one of: {self.allowed_roles}"
                ),
            )
        return current_user


def require_permission(permission: str):
    """
    FastAPI dependency factory for permission-based access control.
    Queries the database and resolves project context dynamically.
    """
    def _check(
        request: Request,
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db)
    ):
        from app.models.org import ProjectTeamMapping
        from app.models.rbac import RoleDB, Permission as PermissionModel, RolePermission

        user_roles = [r.strip() for r in current_user.role.split(",") if r.strip()]
        if RoleConstants.SUPER_ADMIN in user_roles:
            return current_user

        # 1. Resolve project context dynamically from query or path parameters
        project_id = None
        if "project_id" in request.query_params:
            try:
                project_id = int(request.query_params["project_id"])
            except ValueError:
                pass
        elif "project_id" in request.path_params:
            try:
                project_id = int(request.path_params["project_id"])
            except ValueError:
                pass

        roles_to_check = list(user_roles)
        if project_id:
            mapping = db.query(ProjectTeamMapping).filter(
                ProjectTeamMapping.project_id == project_id,
                ProjectTeamMapping.user_id == current_user.id
            ).first()
            if mapping and mapping.role:
                mapped_roles = [r.strip() for r in mapping.role.split(",") if r.strip()]
                roles_to_check.extend(mapped_roles)

        # 2. Query permissions from the database
        has_perm = db.query(RolePermission).join(RoleDB).join(PermissionModel).filter(
            RoleDB.name.in_(roles_to_check),
            PermissionModel.action == permission,
            RoleDB.is_active.is_(True)
        ).first() is not None

        if not has_perm:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=(
                    f"Permission denied. Required: '{permission}'. "
                    f"Your roles {roles_to_check} do not have this permission."
                ),
            )
        return current_user
    return _check


def require_any_permission(*permissions: str):
    """
    Allows access if user has ANY of the listed permissions.
    Queries the database and resolves project context dynamically.
    """
    def _check(
        request: Request,
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db)
    ):
        from app.models.org import ProjectTeamMapping
        from app.models.rbac import RoleDB, Permission as PermissionModel, RolePermission

        user_roles = [r.strip() for r in current_user.role.split(",") if r.strip()]
        if RoleConstants.SUPER_ADMIN in user_roles:
            return current_user

        project_id = None
        if "project_id" in request.query_params:
            try:
                project_id = int(request.query_params["project_id"])
            except ValueError:
                pass
        elif "project_id" in request.path_params:
            try:
                project_id = int(request.path_params["project_id"])
            except ValueError:
                pass

        roles_to_check = list(user_roles)
        if project_id:
            mapping = db.query(ProjectTeamMapping).filter(
                ProjectTeamMapping.project_id == project_id,
                ProjectTeamMapping.user_id == current_user.id
            ).first()
            if mapping and mapping.role:
                mapped_roles = [r.strip() for r in mapping.role.split(",") if r.strip()]
                roles_to_check.extend(mapped_roles)

        has_perm = db.query(RolePermission).join(RoleDB).join(PermissionModel).filter(
            RoleDB.name.in_(roles_to_check),
            PermissionModel.action.in_(permissions),
            RoleDB.is_active.is_(True)
        ).first() is not None

        if not has_perm:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=(
                    f"Permission denied. Required any of: {list(permissions)}. "
                    f"Your roles {roles_to_check} do not have this permission."
                ),
            )
        return current_user
    return _check


# ── Admin-only shortcut ───────────────────────────────────────────────────────
ADMIN_ROLES = [RoleConstants.SUPER_ADMIN, RoleConstants.GROUP_ADMIN, RoleConstants.COMPANY_ADMIN]

require_admin = RoleChecker(ADMIN_ROLES)
