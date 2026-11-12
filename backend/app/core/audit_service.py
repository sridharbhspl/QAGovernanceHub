"""
Audit Service — Shared service for writing to audit_logs and activity_logs.
All write operations in the platform call this service to ensure traceability.

Usage:
    from app.core.audit_service import AuditService, AuditActions

    AuditService.log(
        db=db, user_id=current_user.id, action=AuditActions.CREATE,
        entity_type="defect", entity_id=new_defect.id,
        entity_label=new_defect.bug_id,
        new_values={"title": new_defect.title, "severity": new_defect.severity},
        ip_address=request_ip,
    )
"""
from datetime import datetime
from typing import Any, Optional
from sqlalchemy.orm import Session

from app.models.audit import AuditLog, ActivityLog
from app.models.session import LoginHistory


class AuditActions:
    """Canonical action names — consistent across audit_logs and activity_logs."""
    # Auth events
    LOGIN           = "login"
    LOGOUT          = "logout"
    LOGIN_FAILED    = "login_failed"
    PASSWORD_RESET  = "password_reset"
    SESSION_REVOKED = "session_revoked"

    # CRUD events
    CREATE  = "create"
    READ    = "read"
    UPDATE  = "update"
    DELETE  = "delete"

    # Workflow events
    APPROVE = "approve"
    REJECT  = "reject"
    EXPORT  = "export"

    # Admin events
    ROLE_CHANGED      = "role_changed"
    USER_ACTIVATED    = "user_activated"
    USER_DEACTIVATED  = "user_deactivated"
    PERMISSION_CHANGED = "permission_changed"


class AuditService:
    """
    Shared audit writing service.
    All methods are @staticmethod so they can be called without instantiation.
    All methods commit their own transaction — they are fire-and-forget side effects.
    """

    @staticmethod
    def log(
        db: Session,
        action: str,
        user_id: Optional[int] = None,
        entity_type: Optional[str] = None,
        entity_id: Optional[int] = None,
        entity_label: Optional[str] = None,
        old_values: Optional[dict] = None,
        new_values: Optional[dict] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
        context: Optional[dict] = None,
    ) -> AuditLog:
        """
        Write an immutable audit log entry.
        Call this for all significant write operations.
        """
        entry = AuditLog(
            user_id=user_id,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            entity_label=entity_label,
            old_values=old_values,
            new_values=new_values,
            ip_address=ip_address,
            user_agent=user_agent,
            context=context,
        )
        db.add(entry)
        try:
            db.flush()  # get ID without full commit; caller controls transaction
        except Exception:
            db.rollback()
            # Audit failures must NEVER break the primary operation — swallow silently
        return entry

    @staticmethod
    def log_activity(
        db: Session,
        user_id: int,
        description: str,
        action: Optional[str] = None,
        entity_type: Optional[str] = None,
        entity_id: Optional[int] = None,
        metadata: Optional[dict] = None,
    ) -> ActivityLog:
        """
        Write a human-readable activity log entry.
        Used for the 'recent activity' feed in the UI.
        """
        entry = ActivityLog(
            user_id=user_id,
            description=description,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            activity_metadata=metadata,
        )
        db.add(entry)
        try:
            db.flush()
        except Exception:
            db.rollback()
        return entry

    @staticmethod
    def log_login(
        db: Session,
        email_attempted: str,
        status: str,
        user_id: Optional[int] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
        failure_reason: Optional[str] = None,
    ) -> LoginHistory:
        """
        Record a login attempt in login_history.
        status: 'success' | 'failed' | 'locked'
        """
        entry = LoginHistory(
            user_id=user_id,
            email_attempted=email_attempted,
            ip_address=ip_address,
            user_agent=user_agent,
            status=status,
            failure_reason=failure_reason,
        )
        db.add(entry)
        try:
            db.flush()
        except Exception:
            db.rollback()
        return entry
