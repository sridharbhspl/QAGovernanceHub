"""
Auth Models — User and role constants.
The User model has been extended with MFA scaffolding, security hardening,
and relationships to Phase 0 tables (sessions, audit_logs, activity_logs).
"""
from typing import Any
from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, DateTime, Text
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from app.core.database import Base


def _utcnow() -> datetime:
    """Return a timezone-aware UTC datetime (replaces deprecated utcnow)."""
    return datetime.now(timezone.utc)


class RoleConstants:
    """
    String constants for the 9 platform roles.
    Match the 'name' column in the roles table.
    """
    SUPER_ADMIN = "Super Admin"
    GROUP_ADMIN = "Group Admin"
    COMPANY_ADMIN = "Company Admin"
    PROJECT_MANAGER = "Project Manager"
    QA_LEAD = "QA Lead"
    QA_ENGINEER = "QA Engineer"
    DEVELOPER = "Developer"
    CLIENT = "Client"
    VIEWER = "Viewer"

    ALL = [
        SUPER_ADMIN, GROUP_ADMIN, COMPANY_ADMIN, PROJECT_MANAGER,
        QA_LEAD, QA_ENGINEER, DEVELOPER, CLIENT, VIEWER,
    ]


# Backwards compatibility alias
Role = RoleConstants


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email: Any = Column(String(150), unique=True, index=True, nullable=False)
    hashed_password: Any = Column(String(255), nullable=False)
    full_name: Any = Column(String(100), nullable=False)

    # Role stored as denormalized string for backwards compat.
    role: Any = Column(String(50), nullable=False, default=RoleConstants.VIEWER)

    is_active: Any = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=_utcnow)
    last_login = Column(DateTime, nullable=True)

    # ── Security hardening ──
    failed_login_count = Column(Integer, default=0, nullable=False)
    locked_until = Column(DateTime, nullable=True)
    password_changed_at = Column(DateTime, nullable=True)
    must_change_password = Column(Boolean, default=False)

    # ── MFA scaffolding (Phase 1) ──
    mfa_enabled = Column(Boolean, default=False)
    mfa_secret = Column(String(255), nullable=True)

    # ── Org hierarchy ──
    group_id: Any = Column(Integer, ForeignKey("groups.id", ondelete="SET NULL"), nullable=True)
    company_id: Any = Column(Integer, ForeignKey("companies.id", ondelete="SET NULL"), nullable=True)

    # ── Org relationships ──
    group = relationship("Group", back_populates="users")
    company = relationship("Company", back_populates="users")
    project_mappings = relationship("ProjectTeamMapping", back_populates="user", cascade="all, delete-orphan")
    reported_defects = relationship("Defect", foreign_keys="[Defect.reported_by_id]", back_populates="reported_by")
    assigned_defects = relationship("Defect", foreign_keys="[Defect.assigned_to_id]", back_populates="assigned_to")

    # ── Phase 0 relationships — use string refs to avoid circular import ──
    sessions = relationship("UserSession", back_populates="user", cascade="all, delete-orphan")
    login_history = relationship("LoginHistory", back_populates="user", cascade="all, delete-orphan")
    audit_logs = relationship("AuditLog", back_populates="user")
    activity_logs = relationship("ActivityLog", back_populates="user", cascade="all, delete-orphan")
