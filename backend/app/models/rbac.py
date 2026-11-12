"""
RBAC Models — roles, permissions, role_permissions
These tables store the authoritative permission matrix for the platform.
"""
from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, DateTime, UniqueConstraint
from sqlalchemy.orm import relationship
from app.core.database import Base


def _utcnow() -> datetime:
    """Return a timezone-aware UTC datetime (replaces deprecated utcnow)."""
    return datetime.now(timezone.utc)


class Permission(Base):
    """Atomic permission actions in the system."""
    __tablename__ = "permissions"

    id = Column(Integer, primary_key=True, index=True)
    action = Column(String(50), unique=True, nullable=False, index=True)
    description = Column(String(255), nullable=True)
    created_at = Column(DateTime(timezone=True), default=_utcnow)

    role_permissions = relationship("RolePermission", back_populates="permission", cascade="all, delete-orphan")


class RoleDB(Base):
    """Named roles with a set of permissions (DB representation)."""
    __tablename__ = "roles"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False, index=True)
    description = Column(String(255), nullable=True)
    is_system_role = Column(Boolean, default=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=_utcnow)

    role_permissions = relationship("RolePermission", back_populates="role", cascade="all, delete-orphan")


class RolePermission(Base):
    """Many-to-many join table: role → permission."""
    __tablename__ = "role_permissions"

    id = Column(Integer, primary_key=True, index=True)
    role_id = Column(Integer, ForeignKey("roles.id", ondelete="CASCADE"), nullable=False)
    permission_id = Column(Integer, ForeignKey("permissions.id", ondelete="CASCADE"), nullable=False)
    granted_at = Column(DateTime(timezone=True), default=_utcnow)

    __table_args__ = (UniqueConstraint("role_id", "permission_id", name="uq_role_permission"),)

    role = relationship("RoleDB", back_populates="role_permissions")
    permission = relationship("Permission", back_populates="role_permissions")
