from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Text
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from app.core.database import Base

class Defect(Base):
    __tablename__ = "defects"

    id = Column(Integer, primary_key=True, index=True)
    defect_id = Column(String(50), unique=True, index=True, nullable=False) # e.g. BUG-PROJ001-000001
    title = Column(String(150), nullable=False)
    description = Column(Text, nullable=True)
    
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    application_id = Column(Integer, ForeignKey("applications.id", ondelete="SET NULL"), nullable=True)
    module_id = Column(Integer, ForeignKey("modules.id", ondelete="SET NULL"), nullable=True)
    sub_module_id = Column(Integer, ForeignKey("sub_modules.id", ondelete="SET NULL"), nullable=True)
    release_id = Column(Integer, ForeignKey("releases.id", ondelete="SET NULL"), nullable=True)
    sprint_id = Column(Integer, ForeignKey("sprints.id", ondelete="SET NULL"), nullable=True)
    
    environment = Column(String(50), nullable=False, default="QA") # Dev, QA, Staging, Production
    build_number = Column(String(50), nullable=True)
    severity = Column(String(30), nullable=False, default="Medium") # Low, Medium, High, Critical
    priority = Column(String(30), nullable=False, default="Medium") # Low, Medium, High, Urgent
    status = Column(String(30), nullable=False, default="New") # New, Assigned, Open, Fixed, Retest, Reopened, Closed, Deferred
    
    assigned_to_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    reported_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    # ── Extended Bug/CR Report template fields (v5 migration) ─────────
    source_screen       = Column(String(500), nullable=True)   # Source Screen/URL
    bug_type            = Column(String(100), nullable=True, default="Bug")  # Bug | CR | Enhancement…
    screenshot_url      = Column(String(500), nullable=True)   # Screenshot / evidence link
    reproducible        = Column(String(30),  nullable=True, default="YES")  # YES | NO | Intermittent
    steps_to_reproduce  = Column(Text,        nullable=True)
    expected_behavior   = Column(Text,        nullable=True)
    actual_behavior     = Column(Text,        nullable=True)
    developer_name      = Column(String(150), nullable=True)
    developer_comments  = Column(Text,        nullable=True)
    date_of_fixing      = Column(String(50),  nullable=True)   # free-text date e.g. DD/MM/YYYY

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # Relationships
    project = relationship("Project", back_populates="defects")
    application = relationship("Application")
    module = relationship("Module", back_populates="defects")
    sub_module = relationship("SubModule", back_populates="defects")
    release = relationship("Release", back_populates="defects")
    sprint = relationship("Sprint", back_populates="defects")
    
    assigned_to = relationship("User", foreign_keys=[assigned_to_id], back_populates="assigned_defects")
    reported_by = relationship("User", foreign_keys=[reported_by_id], back_populates="reported_defects")
    
    comments = relationship("DefectComment", back_populates="defect", cascade="all, delete-orphan")
    attachments = relationship("DefectAttachment", back_populates="defect", cascade="all, delete-orphan")
    audit_history = relationship("DefectAuditHistory", back_populates="defect", cascade="all, delete-orphan")
    test_executions = relationship("ExecutionHistory", back_populates="defect")


class DefectComment(Base):
    __tablename__ = "defect_comments"

    id = Column(Integer, primary_key=True, index=True)
    defect_id = Column(Integer, ForeignKey("defects.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    comment = Column(Text, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    # Relationships
    defect = relationship("Defect", back_populates="comments")
    user = relationship("User")


class DefectAttachment(Base):
    __tablename__ = "defect_attachments"

    id = Column(Integer, primary_key=True, index=True)
    defect_id = Column(Integer, ForeignKey("defects.id", ondelete="CASCADE"), nullable=False)
    filename = Column(String(255), nullable=False)
    filepath = Column(String(500), nullable=False)
    file_type = Column(String(100), nullable=True) # e.g. image/png, video/mp4, text/plain
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    # Relationships
    defect = relationship("Defect", back_populates="attachments")


class DefectAuditHistory(Base):
    __tablename__ = "defect_audit_histories"

    id = Column(Integer, primary_key=True, index=True)
    defect_id = Column(Integer, ForeignKey("defects.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    field_name = Column(String(100), nullable=False)
    old_value = Column(Text, nullable=True)
    new_value = Column(Text, nullable=True)
    changed_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    # Relationships
    defect = relationship("Defect", back_populates="audit_history")
    user = relationship("User")
