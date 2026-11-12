from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from app.core.database import get_db
from app.api.deps import get_current_user, RoleChecker
from app.models.auth import User, Role
from app.models.work import Module, SubModule, Release, Sprint
from app.models.org import Application
from app.schemas.work import (
    ModuleCreate, ModuleResponse,
    SubModuleCreate, SubModuleResponse,
    ReleaseCreate, ReleaseResponse,
    SprintCreate, SprintResponse
)

router = APIRouter()

# ----------------- Modules & Sub-modules -----------------
@router.get("/modules", response_model=List[ModuleResponse])
def get_modules(project_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return db.query(Module).filter(Module.project_id == project_id).all()

@router.post("/modules", response_model=ModuleResponse)
def create_module(
    module_in: ModuleCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker([Role.SUPER_ADMIN, Role.GROUP_ADMIN, Role.COMPANY_ADMIN, Role.PROJECT_MANAGER, Role.QA_LEAD]))
):
    db_module = Module(name=module_in.name, description=module_in.description, project_id=module_in.project_id)
    db.add(db_module)
    db.commit()
    db.refresh(db_module)
    return db_module

@router.post("/sub-modules", response_model=SubModuleResponse)
def create_sub_module(
    sub_in: SubModuleCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker([Role.SUPER_ADMIN, Role.GROUP_ADMIN, Role.COMPANY_ADMIN, Role.PROJECT_MANAGER, Role.QA_LEAD]))
):
    db_sub = SubModule(name=sub_in.name, description=sub_in.description, module_id=sub_in.module_id)
    db.add(db_sub)
    db.commit()
    db.refresh(db_sub)
    return db_sub


# ----------------- Releases -----------------
@router.get("/releases", response_model=List[ReleaseResponse])
def get_releases(
    project_id: int,
    application_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(Release).filter(Release.project_id == project_id)
    if application_id:
        from sqlalchemy import or_
        query = query.filter(or_(Release.application_id == application_id, Release.application_id.is_(None)))
    return query.all()

@router.post("/releases", response_model=ReleaseResponse)
def create_release(
    release_in: ReleaseCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker([Role.SUPER_ADMIN, Role.GROUP_ADMIN, Role.COMPANY_ADMIN, Role.PROJECT_MANAGER, Role.QA_LEAD]))
):
    db_release = Release(
        version=release_in.version,
        description=release_in.description,
        status=release_in.status,
        release_date=release_in.release_date,
        project_id=release_in.project_id,
        application_id=release_in.application_id
    )
    db.add(db_release)
    db.commit()
    db.refresh(db_release)
    return db_release

@router.put("/releases/{release_id}", response_model=ReleaseResponse)
def update_release(
    release_id: int,
    release_in: ReleaseCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker([Role.SUPER_ADMIN, Role.GROUP_ADMIN, Role.COMPANY_ADMIN, Role.PROJECT_MANAGER, Role.QA_LEAD]))
):
    db_release = db.query(Release).filter(Release.id == release_id).first()
    if not db_release:
        raise HTTPException(status_code=404, detail="Release not found")
    db_release.version = release_in.version
    db_release.description = release_in.description
    db_release.status = release_in.status
    db_release.release_date = release_in.release_date
    db.commit()
    db.refresh(db_release)
    return db_release


# ----------------- Sprints -----------------
@router.get("/sprints", response_model=List[SprintResponse])
def get_sprints(
    project_id: int,
    application_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(Sprint).filter(Sprint.project_id == project_id)
    if application_id:
        from sqlalchemy import or_
        query = query.filter(or_(Sprint.application_id == application_id, Sprint.application_id.is_(None)))
    return query.all()

@router.post("/sprints", response_model=SprintResponse)
def create_sprint(
    sprint_in: SprintCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker([Role.SUPER_ADMIN, Role.GROUP_ADMIN, Role.COMPANY_ADMIN, Role.PROJECT_MANAGER, Role.QA_LEAD]))
):
    db_sprint = Sprint(
        name=sprint_in.name,
        description=sprint_in.description,
        start_date=sprint_in.start_date,
        end_date=sprint_in.end_date,
        status=sprint_in.status,
        project_id=sprint_in.project_id,
        application_id=sprint_in.application_id
    )
    db.add(db_sprint)
    db.commit()
    db.refresh(db_sprint)
    return db_sprint

@router.put("/sprints/{sprint_id}", response_model=SprintResponse)
def update_sprint(
    sprint_id: int,
    sprint_in: SprintCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker([Role.SUPER_ADMIN, Role.GROUP_ADMIN, Role.COMPANY_ADMIN, Role.PROJECT_MANAGER, Role.QA_LEAD]))
):
    db_sprint = db.query(Sprint).filter(Sprint.id == sprint_id).first()
    if not db_sprint:
        raise HTTPException(status_code=404, detail="Sprint not found")
    db_sprint.name = sprint_in.name
    db_sprint.description = sprint_in.description
    db_sprint.start_date = sprint_in.start_date
    db_sprint.end_date = sprint_in.end_date
    db_sprint.status = sprint_in.status
    db.commit()
    db.refresh(db_sprint)
    return db_sprint
