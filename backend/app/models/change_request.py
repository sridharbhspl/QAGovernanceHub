"""
Change Request Management Model — Module 11
Workflow: Requested → Reviewed → Approved → Implemented → Verified
"""
from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Text, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from app.core.database import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class ChangeRequest(Base):
    __tablename__ = "change_requests"

    id = Column(Integer, primary_key=True, index=True)
    cr_id = Column(String(50), unique=True, index=True, nullable=False)  # e.g. CR-PROJ-001

    # Core fields
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    justification = Column(Text, nullable=True)          # Business justification
    impact_analysis = Column(Text, nullable=True)        # Impact on system/users
    implementation_plan = Column(Text, nullable=True)    # How to implement
    rollback_plan = Column(Text, nullable=True)          # How to rollback if fails
    test_plan = Column(Text, nullable=True)              # Test strategy for CR

    # Classification
    category = Column(String(80), nullable=False, default="Functional")
    # Functional | Non-Functional | UI/UX | Performance | Security | Infrastructure | Regulatory

    priority = Column(String(30), nullable=False, default="Medium")
    # Low | Medium | High | Critical

    change_type = Column(String(50), nullable=False, default="Enhancement")
    # Enhancement | Bug Fix | New Feature | Configuration | Process | Regulatory

    risk_level = Column(String(30), nullable=False, default="Low")
    # Low | Medium | High | Critical

    # Workflow Status
    status = Column(String(50), nullable=False, default="Requested")
    # Requested → Reviewed → Approved → Implemented → Verified
    # Also: Rejected | On Hold | Cancelled

    # Rejected/On Hold reason
    rejection_reason = Column(Text, nullable=True)

    # Estimated effort (story points / days)
    estimated_effort = Column(String(50), nullable=True)

    # Target version / release
    target_version = Column(String(100), nullable=True)

    # Org scoping
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    application_id = Column(Integer, ForeignKey("applications.id", ondelete="SET NULL"), nullable=True)
    sprint_id = Column(Integer, ForeignKey("sprints.id", ondelete="SET NULL"), nullable=True)
    release_id = Column(Integer, ForeignKey("releases.id", ondelete="SET NULL"), nullable=True)

    # People
    requested_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    assigned_to_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    reviewed_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    approved_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    implemented_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    verified_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    # Key dates
    requested_date = Column(DateTime, nullable=True)
    reviewed_date = Column(DateTime, nullable=True)
    approved_date = Column(DateTime, nullable=True)
    implemented_date = Column(DateTime, nullable=True)
    verified_date = Column(DateTime, nullable=True)
    target_date = Column(DateTime, nullable=True)        # Desired completion date

    # Created / updated
    created_at = Column(DateTime, default=_utcnow)
    updated_at = Column(DateTime, default=_utcnow, onupdate=_utcnow)

    # Relationships
    project = relationship("Project", back_populates="change_requests")
    application = relationship("Application")
    sprint = relationship("Sprint")
    release = relationship("Release")

    requested_by = relationship("User", foreign_keys=[requested_by_id])
    assigned_to = relationship("User", foreign_keys=[assigned_to_id])
    reviewed_by = relationship("User", foreign_keys=[reviewed_by_id])
    approved_by = relationship("User", foreign_keys=[approved_by_id])
    implemented_by = relationship("User", foreign_keys=[implemented_by_id])
    verified_by = relationship("User", foreign_keys=[verified_by_id])

    comments = relationship("ChangeRequestComment", back_populates="cr", cascade="all, delete-orphan")
    audit_history = relationship("ChangeRequestAuditHistory", back_populates="cr", cascade="all, delete-orphan")


class ChangeRequestComment(Base):
    __tablename__ = "cr_comments"

    id = Column(Integer, primary_key=True, index=True)
    cr_db_id = Column(Integer, ForeignKey("change_requests.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    comment = Column(Text, nullable=False)
    # Stage at which the comment was made (for workflow context)
    stage = Column(String(50), nullable=True)
    created_at = Column(DateTime, default=_utcnow)

    cr = relationship("ChangeRequest", back_populates="comments")
    user = relationship("User")


class ChangeRequestAuditHistory(Base):
    __tablename__ = "cr_audit_histories"

    id = Column(Integer, primary_key=True, index=True)
    cr_db_id = Column(Integer, ForeignKey("change_requests.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    from_status = Column(String(50), nullable=True)
    to_status = Column(String(50), nullable=True)
    field_name = Column(String(100), nullable=True)
    old_value = Column(Text, nullable=True)
    new_value = Column(Text, nullable=True)
    notes = Column(Text, nullable=True)
    changed_at = Column(DateTime, default=_utcnow)

    cr = relationship("ChangeRequest", back_populates="audit_history")
    user = relationship("User")
