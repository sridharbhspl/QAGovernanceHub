from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from app.core.database import get_db
from app.api.deps import get_current_user, RoleChecker
from app.models.auth import User, Role
from app.models.org import Group, Company, Project, ProjectTeamMapping, Application
from app.schemas.org import (
    GroupCreate, GroupResponse,
    CompanyCreate, CompanyResponse,
    ProjectCreate, ProjectResponse,
    ProjectTeamMappingCreate, ProjectTeamMappingResponse, ProjectTeamMappingUpdate,
    ApplicationCreate, ApplicationResponse
)
from app.schemas.auth import UserResponse, UserUpdate

router = APIRouter()

# ----------------- Groups -----------------
@router.get("/groups", response_model=List[GroupResponse])
def get_groups(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    # Group Admins and Company Admins can see groups
    return db.query(Group).all()

@router.post("/groups", response_model=GroupResponse)
def create_group(
    group_in: GroupCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker([Role.SUPER_ADMIN]))
):
    db_group = Group(name=group_in.name, description=group_in.description, is_active=group_in.is_active)
    db.add(db_group)
    db.commit()
    db.refresh(db_group)
    return db_group

@router.put("/groups/{group_id}", response_model=GroupResponse)
def update_group(
    group_id: int,
    group_in: GroupCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker([Role.SUPER_ADMIN]))
):
    db_group = db.query(Group).filter(Group.id == group_id).first()
    if not db_group:
        raise HTTPException(status_code=404, detail="Group not found")
    db_group.name = group_in.name  # type: ignore
    db_group.description = group_in.description  # type: ignore
    db_group.is_active = group_in.is_active  # type: ignore
    db.commit()
    db.refresh(db_group)
    return db_group


# ----------------- Companies -----------------
@router.get("/companies", response_model=List[CompanyResponse])
def get_companies(
    group_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(Company)
    if group_id:
        # Explicit group context — return all companies in that group visible to the user.
        # (A non-admin user can only see their own company, but within the correct group.)
        query = query.filter(Company.group_id == group_id)
        if current_user.role not in [Role.SUPER_ADMIN, Role.GROUP_ADMIN] and current_user.company_id:
            query = query.filter(Company.id == current_user.company_id)
    else:
        # No group filter — restrict non-admins to their own company only
        if current_user.role not in [Role.SUPER_ADMIN, Role.GROUP_ADMIN] and current_user.company_id:
            query = query.filter(Company.id == current_user.company_id)
    return query.all()

@router.post("/companies", response_model=CompanyResponse)
def create_company(
    company_in: CompanyCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker([Role.SUPER_ADMIN, Role.GROUP_ADMIN]))
):
    db_company = Company(
        name=company_in.name,
        description=company_in.description,
        group_id=company_in.group_id,
        is_active=company_in.is_active,
        settings=company_in.settings
    )
    db.add(db_company)
    db.commit()
    db.refresh(db_company)
    return db_company

@router.put("/companies/{company_id}", response_model=CompanyResponse)
def update_company(
    company_id: int,
    company_in: CompanyCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker([Role.SUPER_ADMIN, Role.GROUP_ADMIN, Role.COMPANY_ADMIN]))
):
    db_company = db.query(Company).filter(Company.id == company_id).first()
    if not db_company:
        raise HTTPException(status_code=404, detail="Company not found")
    db_company.name = company_in.name  # type: ignore
    db_company.description = company_in.description  # type: ignore
    db_company.group_id = company_in.group_id  # type: ignore
    db_company.is_active = company_in.is_active  # type: ignore
    db_company.settings = company_in.settings  # type: ignore
    db.commit()
    db.refresh(db_company)
    return db_company


# ----------------- Projects -----------------
@router.get("/projects", response_model=List[ProjectResponse])
def get_projects(
    company_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(Project)
    if company_id:
        query = query.filter(Project.company_id == company_id)
    elif current_user.company_id:
        query = query.filter(Project.company_id == current_user.company_id)
    
    # If the user is a PM/QA/Dev, they might only see mapped projects, but let's allow read for simplicity
    return query.all()

@router.post("/projects", response_model=ProjectResponse)
def create_project(
    project_in: ProjectCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker([Role.SUPER_ADMIN, Role.GROUP_ADMIN, Role.COMPANY_ADMIN]))
):
    db_project = Project(
        name=project_in.name,
        code=project_in.code,
        description=project_in.description,
        company_id=project_in.company_id,
        is_active=project_in.is_active
    )
    db.add(db_project)
    db.commit()
    db.refresh(db_project)
    return db_project


# ----------------- Team Mappings -----------------
@router.get("/team-mappings", response_model=List[ProjectTeamMappingResponse])
def get_team_mappings(
    project_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(ProjectTeamMapping)
    if project_id:
        query = query.filter(ProjectTeamMapping.project_id == project_id)
    return query.all()

@router.post("/team-mappings", response_model=ProjectTeamMappingResponse)
def create_team_mapping(
    mapping_in: ProjectTeamMappingCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker([Role.SUPER_ADMIN, Role.GROUP_ADMIN, Role.COMPANY_ADMIN, Role.PROJECT_MANAGER]))
):
    # Check if duplicate
    dup = db.query(ProjectTeamMapping).filter(
        ProjectTeamMapping.project_id == mapping_in.project_id,
        ProjectTeamMapping.user_id == mapping_in.user_id
    ).first()
    if dup:
        dup.role = mapping_in.role  # type: ignore
        db.commit()
        db.refresh(dup)
        return dup
    
    db_mapping = ProjectTeamMapping(
        project_id=mapping_in.project_id,
        user_id=mapping_in.user_id,
        role=mapping_in.role
    )
    db.add(db_mapping)
    db.commit()
    db.refresh(db_mapping)
    return db_mapping

@router.put("/team-mappings/{mapping_id}", response_model=ProjectTeamMappingResponse)
def update_team_mapping(
    mapping_id: int,
    mapping_in: ProjectTeamMappingUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker([Role.SUPER_ADMIN, Role.GROUP_ADMIN, Role.COMPANY_ADMIN, Role.PROJECT_MANAGER]))
):
    mapping = db.query(ProjectTeamMapping).filter(ProjectTeamMapping.id == mapping_id).first()
    if not mapping:
        raise HTTPException(status_code=404, detail="Mapping not found")
    mapping.role = mapping_in.role  # type: ignore
    db.commit()
    db.refresh(mapping)
    return mapping

@router.delete("/team-mappings/{mapping_id}")
def delete_team_mapping(
    mapping_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker([Role.SUPER_ADMIN, Role.GROUP_ADMIN, Role.COMPANY_ADMIN, Role.PROJECT_MANAGER]))
):
    db_mapping = db.query(ProjectTeamMapping).filter(ProjectTeamMapping.id == mapping_id).first()
    if not db_mapping:
        raise HTTPException(status_code=404, detail="Mapping not found")
    db.delete(db_mapping)
    db.commit()
    return {"detail": "Team member unmapped successfully"}


# ----------------- User Master Management -----------------
@router.get("/users", response_model=List[UserResponse])
def get_users(
    company_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(User)
    if company_id:
        query = query.filter(User.company_id == company_id)
    elif current_user.company_id and current_user.role not in [Role.SUPER_ADMIN, Role.GROUP_ADMIN]:
        query = query.filter(User.company_id == current_user.company_id)
    return query.all()

@router.put("/users/{user_id}", response_model=UserResponse)
def update_user(
    user_id: int,
    user_in: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker([Role.SUPER_ADMIN, Role.GROUP_ADMIN, Role.COMPANY_ADMIN]))
):
    db_user = db.query(User).filter(User.id == user_id).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if user_in.email is not None:
        dup = db.query(User).filter(User.email == user_in.email, User.id != user_id).first()
        if dup:
            raise HTTPException(status_code=400, detail="Email already taken")
        db_user.email = user_in.email  # type: ignore
    if user_in.full_name is not None:
        db_user.full_name = user_in.full_name  # type: ignore
    if user_in.role is not None:
        db_user.role = user_in.role  # type: ignore
    if user_in.is_active is not None:
        db_user.is_active = user_in.is_active  # type: ignore
    if user_in.group_id is not None:
        db_user.group_id = user_in.group_id if user_in.group_id != 0 else None  # type: ignore
    if user_in.company_id is not None:
        db_user.company_id = user_in.company_id if user_in.company_id != 0 else None  # type: ignore
    if user_in.password is not None and user_in.password.strip() != "":
        from app.core.security import get_password_hash
        db_user.hashed_password = get_password_hash(user_in.password)  # type: ignore
        
    db.commit()
    db.refresh(db_user)
    return db_user


# ----------------- Applications -----------------
@router.get("/applications", response_model=List[ApplicationResponse])
def get_applications(
    project_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(Application)
    if project_id:
        query = query.filter(Application.project_id == project_id)
    return query.all()

@router.post("/applications", response_model=ApplicationResponse)
def create_application(
    app_in: ApplicationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker([Role.SUPER_ADMIN, Role.GROUP_ADMIN, Role.COMPANY_ADMIN]))
):
    # Check if duplicate code
    dup = db.query(Application).filter(Application.code == app_in.code).first()
    if dup:
        raise HTTPException(status_code=400, detail="Application with this code already exists.")

    db_app = Application(
        name=app_in.name,
        code=app_in.code,
        description=app_in.description,
        project_id=app_in.project_id,
        is_active=app_in.is_active
    )
    db.add(db_app)
    db.commit()
    db.refresh(db_app)
    return db_app

