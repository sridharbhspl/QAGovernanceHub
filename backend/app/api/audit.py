"""
Audit API — Query audit logs and activity feed.
Admins can see all logs; regular users see only their own activity.
"""
from typing import List, Optional
from datetime import datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy import desc
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.api.deps import get_current_user, RoleChecker
from app.models.auth import User, RoleConstants
from app.models.audit import AuditLog, ActivityLog
from app.models.session import LoginHistory
from app.schemas.audit import AuditLogResponse, ActivityLogResponse
from app.schemas.auth import LoginHistoryResponse

router = APIRouter()

_admin_roles = [RoleConstants.SUPER_ADMIN, RoleConstants.GROUP_ADMIN, RoleConstants.COMPANY_ADMIN]


def _enrich_audit_log(entry: AuditLog) -> AuditLogResponse:
    """Add user email/name to audit log response."""
    return AuditLogResponse(
        id=entry.id,                              # type: ignore[arg-type]
        user_id=entry.user_id,                    # type: ignore[arg-type]
        user_email=entry.user.email if entry.user else None,  # type: ignore[arg-type]
        user_name=entry.user.full_name if entry.user else None,  # type: ignore[arg-type]
        action=entry.action,                      # type: ignore[arg-type]
        entity_type=entry.entity_type,            # type: ignore[arg-type]
        entity_id=entry.entity_id,                # type: ignore[arg-type]
        entity_label=entry.entity_label,          # type: ignore[arg-type]
        old_values=entry.old_values,
        new_values=entry.new_values,
        ip_address=entry.ip_address,              # type: ignore[arg-type]
        context=entry.context,
        created_at=entry.created_at,              # type: ignore[arg-type]
    )


@router.get("/logs", response_model=List[AuditLogResponse], summary="Query audit logs (admin)")
def get_audit_logs(
    action: Optional[str] = Query(None, description="Filter by action type"),
    entity_type: Optional[str] = Query(None, description="Filter by entity type (defect, user, etc.)"),
    user_id: Optional[int] = Query(None, description="Filter by user ID"),
    from_date: Optional[datetime] = Query(None, description="Start date (ISO 8601)"),
    to_date: Optional[datetime] = Query(None, description="End date (ISO 8601)"),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker(_admin_roles)),
):
    query = db.query(AuditLog)

    if action:
        query = query.filter(AuditLog.action == action)
    if entity_type:
        query = query.filter(AuditLog.entity_type == entity_type)
    if user_id:
        query = query.filter(AuditLog.user_id == user_id)
    if from_date:
        query = query.filter(AuditLog.created_at >= from_date)
    if to_date:
        query = query.filter(AuditLog.created_at <= to_date)

    total = query.count()
    entries = (
        query
        .order_by(desc(AuditLog.created_at))
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    return [_enrich_audit_log(e) for e in entries]


@router.get("/logs/count", summary="Count audit logs with filters (admin)")
def count_audit_logs(
    action: Optional[str] = Query(None),
    entity_type: Optional[str] = Query(None),
    user_id: Optional[int] = Query(None),
    from_date: Optional[datetime] = Query(None),
    to_date: Optional[datetime] = Query(None),
    db: Session = Depends(get_db),
    _: User = Depends(RoleChecker(_admin_roles)),
):
    query = db.query(AuditLog)
    if action:
        query = query.filter(AuditLog.action == action)
    if entity_type:
        query = query.filter(AuditLog.entity_type == entity_type)
    if user_id:
        query = query.filter(AuditLog.user_id == user_id)
    if from_date:
        query = query.filter(AuditLog.created_at >= from_date)
    if to_date:
        query = query.filter(AuditLog.created_at <= to_date)
    return {"total": query.count()}


@router.get("/activity", response_model=List[ActivityLogResponse], summary="Activity feed")
def get_activity_feed(
    limit: int = Query(20, ge=1, le=100),
    entity_type: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Admins see all activity; regular users see only their own.
    """
    is_admin = current_user.role in _admin_roles
    query = db.query(ActivityLog)

    if not is_admin:
        query = query.filter(ActivityLog.user_id == current_user.id)
    if entity_type:
        query = query.filter(ActivityLog.entity_type == entity_type)

    entries = query.order_by(desc(ActivityLog.created_at)).limit(limit).all()

    return [
        ActivityLogResponse(
            id=e.id,                              # type: ignore[arg-type]
            user_id=e.user_id,                    # type: ignore[arg-type]
            user_name=e.user.full_name if e.user else None,  # type: ignore[arg-type]
            user_email=e.user.email if e.user else None,  # type: ignore[arg-type]
            description=e.description,            # type: ignore[arg-type]
            action=e.action,                      # type: ignore[arg-type]
            entity_type=e.entity_type,            # type: ignore[arg-type]
            entity_id=e.entity_id,                # type: ignore[arg-type]
            metadata=e.activity_metadata,
            created_at=e.created_at,              # type: ignore[arg-type]
        )
        for e in entries
    ]


@router.get("/login-history/all", response_model=List[LoginHistoryResponse], summary="All login history (admin)")
def get_all_login_history(
    limit: int = Query(50, ge=1, le=500),
    user_id: Optional[int] = Query(None),
    status: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    _: User = Depends(RoleChecker(_admin_roles)),
):
    query = db.query(LoginHistory)
    if user_id:
        query = query.filter(LoginHistory.user_id == user_id)
    if status:
        query = query.filter(LoginHistory.status == status)
    return query.order_by(desc(LoginHistory.created_at)).limit(limit).all()
