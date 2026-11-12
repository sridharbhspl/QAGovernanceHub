"""
User Story & Epic Models
Defines the structure for Agile backlog management (Module 10).
"""
from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Text
from sqlalchemy.orm import relationship
from app.core.database import Base


def _utcnow() -> datetime:
    """Return timezone-aware UTC datetime."""
    return datetime.now(timezone.utc)


class Epic(Base):
    """
    Epics represent large bodies of work that can be broken down into User Stories.
    """
    __tablename__ = "epics"

    id = Column(Integer, primary_key=True, index=True)
    epic_id = Column(String(50), unique=True, index=True, nullable=False)  # e.g. EPIC-ANDB-001
    title = Column(String(150), nullable=False)
    description = Column(Text, nullable=True)
    status = Column(String(50), nullable=False, default="Backlog")  # Backlog, Active, Completed
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime(timezone=True), default=_utcnow)

    # Relationships
    project = relationship("Project")
    user_stories = relationship("UserStory", back_populates="epic", cascade="all, delete-orphan")


class UserStory(Base):
    """
    User Stories define requirements/features from an end-user perspective.
    """
    __tablename__ = "user_stories"

    id = Column(Integer, primary_key=True, index=True)
    story_id = Column(String(50), unique=True, index=True, nullable=False)  # e.g. US-ANDB-001
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)

    epic_id = Column(Integer, ForeignKey("epics.id", ondelete="SET NULL"), nullable=True)
    story_points = Column(Integer, nullable=True)
    acceptance_criteria = Column(Text, nullable=True)
    
    sprint_id = Column(Integer, ForeignKey("sprints.id", ondelete="SET NULL"), nullable=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    application_id = Column(Integer, ForeignKey("applications.id", ondelete="SET NULL"), nullable=True)

    status = Column(String(50), nullable=False, default="Backlog")  # Backlog, To Do, In Progress, Dev Complete, Testing, Done
    priority = Column(String(30), nullable=False, default="Medium")  # Low, Medium, High, Critical

    assigned_to_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    created_at = Column(DateTime(timezone=True), default=_utcnow)
    updated_at = Column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)

    # Relationships
    project = relationship("Project")
    application = relationship("Application")
    sprint = relationship("Sprint")
    epic = relationship("Epic", back_populates="user_stories")
    assigned_to = relationship("User", foreign_keys=[assigned_to_id])
    creator = relationship("User", foreign_keys=[created_by_id])
