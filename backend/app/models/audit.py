"""
Audit Models — audit_logs, activity_logs
Provides immutable audit trail for all significant system events.
"""
from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Text, JSON
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from app.core.database import Base


def _utcnow() -> datetime:
    """Return a timezone-aware UTC datetime (replaces deprecated utcnow)."""
    return datetime.now(timezone.utc)


class AuditLog(Base):
    """
    Immutable record of every write action in the system.
    Contains old_values/new_values diffs for full traceability.

    Actions: login, logout, create, update, delete, approve, reject,
             password_reset, session_revoked, role_changed
    """
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)

    action = Column(String(50), nullable=False, index=True)
    # Entity context
    entity_type = Column(String(100), nullable=True)   # e.g. "defect", "user", "test_case"
    entity_id = Column(Integer, nullable=True)
    entity_label = Column(String(255), nullable=True)  # human-readable ref (e.g. bug ID string)

    # Full diff — stored as JSON for flexibility
    old_values = Column(JSON, nullable=True)
    new_values = Column(JSON, nullable=True)

    # Request metadata
    ip_address = Column(String(45), nullable=True)
    user_agent = Column(Text, nullable=True)

    # Additional context (e.g. project_id, company_id for scoping)
    context = Column(JSON, nullable=True)

    created_at = Column(DateTime(timezone=True), default=_utcnow, index=True)

    # Relationships
    user = relationship("User", back_populates="audit_logs")


class ActivityLog(Base):
    """
    Human-readable activity feed (lighter than audit_logs).
    Used for "recent activity" panels in the UI.
    Complements AuditLog — AuditLog is for compliance, ActivityLog is for UX.
    """
    __tablename__ = "activity_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    description = Column(String(500), nullable=False)  # e.g. "Created defect BUG_0042"
    action = Column(String(50), nullable=True)         # same enum as audit_logs
    entity_type = Column(String(100), nullable=True)
    entity_id = Column(Integer, nullable=True)

    activity_metadata = Column("metadata", JSON, nullable=True)  # arbitrary extra data
    created_at = Column(DateTime(timezone=True), default=_utcnow, index=True)

    # Relationships
    user = relationship("User", back_populates="activity_logs")
