"""
Models package — import order matters for SQLAlchemy relationship resolution.
All models must be imported before Base.metadata.create_all() is called.
"""
from app.core.database import Base

# 1. Auth (User) — imported first; uses string refs for Phase 0 relationships
from app.models.auth import User, Role, RoleConstants

# 2. Org hierarchy
from app.models.org import Group, Company, Project, ProjectTeamMapping

# 3. Work setup
from app.models.work import Module, SubModule, Release, Sprint

# 4. Defects
from app.models.defect import Defect, DefectComment, DefectAttachment, DefectAuditHistory

# 5. Test Cases
from app.models.test_case import Requirement, TestScenario, TestCase, ExecutionHistory

# 6. Phase 0 — Foundation (must be imported AFTER User so string refs resolve)
from app.models.rbac import RoleDB, Permission, RolePermission
from app.models.session import UserSession, LoginHistory
from app.models.audit import AuditLog, ActivityLog

# 7. Phase 1 — User Stories
from app.models.user_story import Epic, UserStory

# 8. Phase 2 — Change Request Management
from app.models.change_request import ChangeRequest, ChangeRequestComment, ChangeRequestAuditHistory
