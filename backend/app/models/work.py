from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Date
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from app.core.database import Base

class Module(Base):
    __tablename__ = "modules"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    description = Column(String(255), nullable=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc).replace(tzinfo=None))

    # Relationships
    project = relationship("Project", back_populates="modules")
    sub_modules = relationship("SubModule", back_populates="module", cascade="all, delete-orphan")
    defects = relationship("Defect", back_populates="module")


class SubModule(Base):
    __tablename__ = "sub_modules"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    description = Column(String(255), nullable=True)
    module_id = Column(Integer, ForeignKey("modules.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc).replace(tzinfo=None))

    # Relationships
    module = relationship("Module", back_populates="sub_modules")
    defects = relationship("Defect", back_populates="sub_module")


class Release(Base):
    __tablename__ = "releases"

    id = Column(Integer, primary_key=True, index=True)
    version = Column(String(50), nullable=False) # e.g. v1.0.0
    description = Column(String(255), nullable=True)
    status = Column(String(50), nullable=False, default="Planning") # Planning, Testing, Go Live Approved, Released, Rolled Back
    release_date = Column(Date, nullable=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    application_id = Column(Integer, ForeignKey("applications.id", ondelete="CASCADE"), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc).replace(tzinfo=None))

    # Relationships
    project = relationship("Project", back_populates="releases")
    application = relationship("Application", back_populates="releases")
    defects = relationship("Defect", back_populates="release")


class Sprint(Base):
    __tablename__ = "sprints"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False) # e.g. Sprint 1
    description = Column(String(255), nullable=True)
    start_date = Column(Date, nullable=True)
    end_date = Column(Date, nullable=True)
    status = Column(String(50), nullable=False, default="Future") # Future, Active, Completed
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    application_id = Column(Integer, ForeignKey("applications.id", ondelete="CASCADE"), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc).replace(tzinfo=None))

    # Relationships
    project = relationship("Project", back_populates="sprints")
    application = relationship("Application", back_populates="sprints")
    defects = relationship("Defect", back_populates="sprint")

