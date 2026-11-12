"""
Session Models — user_sessions, login_history
Enables server-side session management (true logout, refresh token rotation).
"""
from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, DateTime, Text
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from app.core.database import Base


def _utcnow() -> datetime:
    """Return a timezone-aware UTC datetime (replaces deprecated utcnow)."""
    return datetime.now(timezone.utc)


class UserSession(Base):
    """
    Stores hashed refresh tokens for each active session.
    On logout: row is deleted → refresh token instantly dead.
    On refresh: token rotated (old row updated with new hash).
    """
    __tablename__ = "user_sessions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    # Never store the raw token — only a SHA-256 hash
    refresh_token_hash = Column(String(255), nullable=False, unique=True, index=True)

    # Device / origin metadata (informational)
    device_info = Column(String(255), nullable=True)   # e.g. "Chrome 125 / Windows"
    ip_address = Column(String(45), nullable=True)     # IPv4 or IPv6
    user_agent = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), default=_utcnow)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    last_used_at = Column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)
    is_active = Column(Boolean, default=True)

    # Relationships
    user = relationship("User", back_populates="sessions")


class LoginHistory(Base):
    """
    Immutable record of every login attempt (success or failure).
    Used for security auditing and account lock-out decisions.
    """
    __tablename__ = "login_history"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)
    # nullable because failed logins for non-existent emails still get recorded

    email_attempted = Column(String(150), nullable=False)
    ip_address = Column(String(45), nullable=True)
    user_agent = Column(Text, nullable=True)

    status = Column(String(20), nullable=False)      # 'success' | 'failed' | 'locked'
    failure_reason = Column(String(255), nullable=True)  # 'invalid_password' | 'account_inactive' | etc.

    created_at = Column(DateTime(timezone=True), default=_utcnow)

    # Relationships
    user = relationship("User", back_populates="login_history")
