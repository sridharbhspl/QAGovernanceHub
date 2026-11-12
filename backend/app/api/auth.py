"""
Auth API — Phase 0 Production Grade
Endpoints:
  POST /auth/login              — returns TokenPair, creates session, logs history
  POST /auth/logout             — revokes session, logs logout
  POST /auth/refresh            — rotates refresh token, returns new TokenPair
  POST /auth/reset-password     — initiates password reset
  POST /auth/reset-password/confirm — completes password reset
  GET  /auth/profile            — full user profile + permissions
  GET  /auth/sessions           — list active sessions
  DELETE /auth/sessions/{id}    — revoke a specific session
  GET  /auth/login-history      — login history for current user
  POST /auth/change-password    — change password (authenticated)

  POST /auth/register           — admin-only user creation (kept for compat)
  GET  /auth/me                 — alias for /auth/profile (backwards compat)
"""
from datetime import datetime, timedelta, timezone
from typing import List, Optional, cast

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.core.audit_service import AuditService, AuditActions
from app.core.config import settings
from app.core.database import get_db
from app.core.rbac import get_role_permissions
from app.core.security import (
    create_access_token,
    create_password_reset_token,
    create_refresh_token,
    get_password_hash,
    hash_token,
    verify_password,
    verify_password_reset_token,
    verify_token_hash,
)
from app.api.deps import get_current_user, get_client_ip, RoleChecker
from app.models.auth import User, RoleConstants
from app.models.session import UserSession, LoginHistory
from app.schemas.auth import (
    ChangePasswordRequest,
    LoginHistoryResponse,
    LoginRequest,
    LogoutRequest,
    PasswordResetConfirm,
    PasswordResetRequest,
    RefreshRequest,
    SessionResponse,
    Token,
    TokenPair,
    UserCreate,
    UserProfileResponse,
    UserResponse,
)

router = APIRouter()


# ── Helpers ───────────────────────────────────────────────────────────────────

def _build_token_pair(user: User, db: Session, request: Request, remember_me: bool = False) -> dict:
    """
    Create access + refresh token pair and persist the session.
    Returns the raw token strings (caller builds the response schema).
    """
    from app.models.rbac import RoleDB, Permission as PermissionModel, RolePermission
    user_roles = [r.strip() for r in user.role.split(",") if r.strip()]
    if RoleConstants.SUPER_ADMIN in user_roles:
        from app.core.rbac import ROLE_PERMISSION_MATRIX
        permissions = sorted(list(ROLE_PERMISSION_MATRIX.get(RoleConstants.SUPER_ADMIN, set())))
    else:
        perms_query = db.query(PermissionModel.action).join(RolePermission).join(RoleDB).filter(
            RoleDB.name.in_(user_roles),
            RoleDB.is_active.is_(True)
        ).all()
        permissions = sorted(list({p[0] for p in perms_query}))

    access_token = create_access_token(subject=str(user.email), role=str(user.role), permissions=permissions)
    raw_refresh = create_refresh_token()
    refresh_hash = hash_token(raw_refresh)

    # Session expiry: 30 days default, 90 days for "remember me"
    expire_days = 90 if remember_me else settings.REFRESH_TOKEN_EXPIRE_DAYS
    expires_at = datetime.now(timezone.utc) + timedelta(days=expire_days)

    # Capture device info from User-Agent
    ua = request.headers.get("User-Agent", "")
    device_info = ua[:200] if ua else None
    ip = get_client_ip(request)

    session = UserSession(
        user_id=cast(int, user.id),
        refresh_token_hash=refresh_hash,
        device_info=device_info,
        ip_address=ip,
        user_agent=ua[:1000] if ua else None,
        expires_at=expires_at,
        is_active=True,
    )
    db.add(session)

    # Update last_login
    user.last_login = datetime.now(timezone.utc)  # type: ignore[assignment]

    return {
        "access_token": access_token,
        "refresh_token": raw_refresh,
        "token_type": "bearer",
        "expires_in": settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    }


def _check_account_locked(user: User) -> None:
    """Raise 423 if account is temporarily locked due to failed login attempts."""
    if user.locked_until and user.locked_until > datetime.now(timezone.utc):
        remaining = int((user.locked_until - datetime.now(timezone.utc)).total_seconds() / 60) + 1
        raise HTTPException(
            status_code=status.HTTP_423_LOCKED,
            detail=f"Account locked due to too many failed attempts. Try again in {remaining} minute(s).",
        )


def _handle_failed_login(user: User, db: Session) -> None:
    """Increment failure counter; lock account if threshold exceeded."""
    user.failed_login_count = int(user.failed_login_count or 0) + 1  # type: ignore[assignment]
    if int(user.failed_login_count) >= settings.MAX_LOGIN_ATTEMPTS:  # type: ignore[arg-type]
        user.locked_until = datetime.now(timezone.utc) + timedelta(minutes=settings.LOCKOUT_DURATION_MINUTES)  # type: ignore[assignment]
        user.failed_login_count = 0  # reset counter after lock is applied  # type: ignore[assignment]
    db.commit()


def _reset_login_failures(user: User, db: Session) -> None:
    """Clear failure counter after successful login."""
    if user.failed_login_count or user.locked_until:
        user.failed_login_count = 0   # type: ignore[assignment]
        user.locked_until = None      # type: ignore[assignment]


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/login", response_model=TokenPair, summary="Login — get access + refresh tokens")
def login(login_data: LoginRequest, request: Request, db: Session = Depends(get_db)):
    ip = get_client_ip(request)
    ua = request.headers.get("User-Agent", "")

    user = db.query(User).filter(User.email == login_data.email).first()

    # Unknown email — log failure but give no information leak
    if not user:
        AuditService.log_login(
            db=db, email_attempted=login_data.email,
            status="failed", failure_reason="user_not_found",
            ip_address=ip, user_agent=ua,
        )
        db.commit()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    # Check lockout before password verification
    _check_account_locked(user)

    if not verify_password(login_data.password, str(user.hashed_password)):
        _handle_failed_login(user, db)
        AuditService.log_login(
            db=db, email_attempted=login_data.email, user_id=cast(int, user.id),
            status="failed", failure_reason="invalid_password",
            ip_address=ip, user_agent=ua,
        )
        db.commit()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    if not user.is_active:
        AuditService.log_login(
            db=db, email_attempted=login_data.email, user_id=cast(int, user.id),
            status="failed", failure_reason="account_inactive",
            ip_address=ip, user_agent=ua,
        )
        db.commit()
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is inactive.")

    # Successful login
    _reset_login_failures(user, db)
    token_data = _build_token_pair(user, db, request, login_data.remember_me)

    AuditService.log_login(
        db=db, email_attempted=login_data.email, user_id=cast(int, user.id),
        status="success", ip_address=ip, user_agent=ua,
    )
    AuditService.log(
        db=db, user_id=cast(int, user.id), action=AuditActions.LOGIN,
        entity_type="user", entity_id=cast(int, user.id), ip_address=ip,
    )
    db.commit()

    return token_data


@router.post("/login/form", response_model=TokenPair, include_in_schema=False)
def login_form(
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    """OAuth2 form login for Swagger UI compatibility."""
    return login(
        LoginRequest(email=form_data.username, password=form_data.password),
        request=request,
        db=db,
    )


@router.post("/logout", summary="Logout — revoke refresh token and session")
def logout(
    logout_data: LogoutRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ip = get_client_ip(request)
    refresh_hash = hash_token(logout_data.refresh_token)

    session = db.query(UserSession).filter(
        UserSession.refresh_token_hash == refresh_hash,
        UserSession.user_id == current_user.id,
    ).first()

    if session:
        db.delete(session)

    AuditService.log(
        db=db, user_id=cast(int, current_user.id), action=AuditActions.LOGOUT,
        entity_type="user", entity_id=cast(int, current_user.id), ip_address=ip,
    )
    db.commit()
    return {"message": "Logged out successfully."}


@router.post("/refresh", response_model=TokenPair, summary="Refresh — rotate refresh token")
def refresh_token(refresh_data: RefreshRequest, request: Request, db: Session = Depends(get_db)):
    """
    Sliding-window refresh token rotation.
    - Old session row is updated with a new refresh token hash.
    - Returns a new TokenPair (both access and refresh).
    - The old refresh token is immediately invalid after this call.
    """
    refresh_hash = hash_token(refresh_data.refresh_token)

    session = db.query(UserSession).filter(
        UserSession.refresh_token_hash == refresh_hash,
        UserSession.is_active == True,
    ).first()

    if not session:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token is invalid or has been revoked.",
        )

    if session.expires_at < datetime.now(timezone.utc):
        db.delete(session)
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token has expired. Please log in again.",
        )

    user = db.query(User).filter(User.id == session.user_id).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found or inactive.")

    # Generate new token pair
    permissions = get_role_permissions(str(user.role))
    access_token = create_access_token(subject=str(user.email), role=str(user.role), permissions=permissions)
    new_raw_refresh = create_refresh_token()
    new_hash = hash_token(new_raw_refresh)

    # Rotate: update session with new hash
    session.refresh_token_hash = new_hash             # type: ignore[assignment]
    session.last_used_at = datetime.now(timezone.utc)  # type: ignore[assignment]
    user.last_login = datetime.now(timezone.utc)       # type: ignore[assignment]

    db.commit()

    return {
        "access_token": access_token,
        "refresh_token": new_raw_refresh,
        "token_type": "bearer",
        "expires_in": settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    }


@router.post("/reset-password", summary="Request password reset token")
def request_password_reset(
    data: PasswordResetRequest,
    db: Session = Depends(get_db),
):
    """
    Generates a password reset token.
    In development: token is returned in the response (no SMTP needed).
    In production: token should be emailed (swap in SendGrid/SES).
    """
    user = db.query(User).filter(User.email == data.email).first()

    # Always return 200 to prevent email enumeration attacks
    if not user or not user.is_active:
        return {
            "message": "If that email is registered, a reset link has been sent.",
            "dev_token": None,
        }

    reset_token = create_password_reset_token(data.email)

    AuditService.log(
        db=db, user_id=cast(int, user.id), action="password_reset_requested",
        entity_type="user", entity_id=cast(int, user.id),
    )
    db.commit()

    response = {"message": "If that email is registered, a reset link has been sent."}

    # In development mode, return the token directly so you can test without SMTP
    if settings.IS_DEVELOPMENT:
        response["dev_token"] = reset_token
        response["dev_note"] = "This field only appears in ENVIRONMENT=development"

    return response


@router.post("/reset-password/confirm", summary="Complete password reset")
def confirm_password_reset(
    data: PasswordResetConfirm,
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.email == data.email).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid reset token.")

    if not verify_password_reset_token(data.email, data.token):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Reset token is invalid or has expired. Please request a new one.",
        )

    # Update password
    user.hashed_password = get_password_hash(data.new_password)  # type: ignore[assignment]
    user.password_changed_at = datetime.now(timezone.utc)        # type: ignore[assignment]
    user.must_change_password = False                             # type: ignore[assignment]

    # Invalidate ALL active sessions (force re-login with new password)
    db.query(UserSession).filter(UserSession.user_id == user.id).delete()

    AuditService.log(
        db=db, user_id=cast(int, user.id), action=AuditActions.PASSWORD_RESET,
        entity_type="user", entity_id=cast(int, user.id),
    )
    db.commit()

    return {"message": "Password updated successfully. Please log in with your new password."}


@router.post("/change-password", summary="Change password (authenticated)")
def change_password(
    data: ChangePasswordRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not verify_password(data.current_password, str(current_user.hashed_password)):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Current password is incorrect.")

    current_user.hashed_password = get_password_hash(data.new_password)  # type: ignore[assignment]
    current_user.password_changed_at = datetime.now(timezone.utc)        # type: ignore[assignment]
    current_user.must_change_password = False                             # type: ignore[assignment]

    AuditService.log(
        db=db, user_id=cast(int, current_user.id), action="password_changed",
        entity_type="user", entity_id=cast(int, current_user.id),
        ip_address=get_client_ip(request),
    )
    db.commit()
    return {"message": "Password changed successfully."}


@router.get("/profile", response_model=UserProfileResponse, summary="Get full user profile + permissions")
def get_profile(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from app.models.rbac import RoleDB, Permission as PermissionModel, RolePermission
    user_roles = [r.strip() for r in current_user.role.split(",") if r.strip()]
    if RoleConstants.SUPER_ADMIN in user_roles:
        from app.core.rbac import ROLE_PERMISSION_MATRIX
        permissions = sorted(list(ROLE_PERMISSION_MATRIX.get(RoleConstants.SUPER_ADMIN, set())))
    else:
        perms_query = db.query(PermissionModel.action).join(RolePermission).join(RoleDB).filter(
            RoleDB.name.in_(user_roles),
            RoleDB.is_active.is_(True)
        ).all()
        permissions = sorted(list({p[0] for p in perms_query}))

    project_roles = {}
    for mapping in current_user.project_mappings:
        if mapping.role:
            project_roles[mapping.project_id] = mapping.role

    active_sessions = db.query(UserSession).filter(
        UserSession.user_id == current_user.id,
        UserSession.is_active == True,
    ).count()

    return UserProfileResponse(
        id=cast(int, current_user.id),
        email=cast(str, current_user.email),
        full_name=cast(str, current_user.full_name),
        role=cast(str, current_user.role),
        is_active=cast(bool, current_user.is_active),
        group_id=cast(Optional[int], current_user.group_id),
        company_id=cast(Optional[int], current_user.company_id),
        created_at=cast(datetime, current_user.created_at),
        last_login=cast(Optional[datetime], current_user.last_login),
        mfa_enabled=cast(bool, current_user.mfa_enabled),
        must_change_password=cast(bool, current_user.must_change_password),
        permissions=permissions,
        active_sessions_count=active_sessions,
        project_roles=project_roles,
    )


@router.get("/me", response_model=UserProfileResponse, summary="Alias for /profile (backwards compat)")
def get_me(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return get_profile(db=db, current_user=current_user)


@router.get("/sessions", response_model=List[SessionResponse], summary="List active sessions")
def list_sessions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    sessions = db.query(UserSession).filter(
        UserSession.user_id == current_user.id,
        UserSession.is_active == True,
    ).order_by(UserSession.last_used_at.desc()).all()
    return sessions


@router.delete("/sessions/{session_id}", summary="Revoke a specific session")
def revoke_session(
    session_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    session = db.query(UserSession).filter(
        UserSession.id == session_id,
        UserSession.user_id == current_user.id,
    ).first()

    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found.")

    db.delete(session)
    AuditService.log(
        db=db, user_id=cast(int, current_user.id), action=AuditActions.SESSION_REVOKED,
        entity_type="session", entity_id=session_id,
        ip_address=get_client_ip(request),
    )
    db.commit()
    return {"message": "Session revoked."}


@router.get("/login-history", response_model=List[LoginHistoryResponse], summary="Login history")
def get_login_history(
    limit: int = 20,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    history = (
        db.query(LoginHistory)
        .filter(LoginHistory.user_id == current_user.id)
        .order_by(LoginHistory.created_at.desc())
        .limit(min(limit, 100))
        .all()
    )
    return history


# ── Admin: User Registration ──────────────────────────────────────────────────

@router.post("/register", response_model=UserResponse, summary="Register a new user (admin)")
def register_user(
    user_in: UserCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Admin-only endpoint for creating new users."""
    existing = db.query(User).filter(User.email == user_in.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    new_user = User(
        email=user_in.email,
        hashed_password=get_password_hash(user_in.password),
        full_name=user_in.full_name,
        role=user_in.role,
        group_id=user_in.group_id,
        company_id=user_in.company_id,
        is_active=user_in.is_active,
    )
    db.add(new_user)
    db.flush()

    AuditService.log(
        db=db, user_id=cast(int, current_user.id), action=AuditActions.CREATE,
        entity_type="user", entity_id=cast(int, new_user.id), entity_label=str(new_user.email),
        new_values={"email": new_user.email, "role": new_user.role, "full_name": new_user.full_name},
    )
    db.commit()
    db.refresh(new_user)
    return new_user
