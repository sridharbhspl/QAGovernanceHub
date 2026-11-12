from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional, cast, Any

from app.core.database import get_db
from app.api.deps import get_current_user
from app.core.rbac import has_permission, Permissions
from app.core.audit_service import AuditService, AuditActions
from app.models.auth import User
from app.models.user_story import Epic, UserStory
from app.schemas.user_story import (
    EpicCreate, EpicUpdate, EpicResponse,
    UserStoryCreate, UserStoryUpdate, UserStoryResponse
)

router = APIRouter()


# ── Helper for serialization changes ──────────────────────────────────────────
def _get_diff(old_obj: Any, new_data: dict) -> tuple[dict, dict]:
    """Calculate old and new values for audit diffs."""
    old_values = {}
    new_values = {}
    for key, val in new_data.items():
        old_val = getattr(old_obj, key, None)
        if old_val != val:
            old_values[key] = old_val
            new_values[key] = val
    return old_values, new_values


# ── Epics API ────────────────────────────────────────────────────────────────
@router.get("/epics", response_model=List[EpicResponse], summary="List Epics for a Project")
def get_epics(
    project_id: int = Query(..., description="ID of the project to scope epics"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Fetch all Epics for the specified project."""
    return db.query(Epic).filter(Epic.project_id == project_id).all()


@router.post("/epics", response_model=EpicResponse, status_code=status.HTTP_201_CREATED, summary="Create a new Epic")
def create_epic(
    epic_in: EpicCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new Epic. Requires CREATE permission."""
    if not has_permission(cast(str, current_user.role), Permissions.CREATE):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Permission denied. You do not have permission to create epics."
        )

    # Check for duplicate epic_id
    dup = db.query(Epic).filter(Epic.epic_id == epic_in.epic_id).first()
    if dup:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Epic ID '{epic_in.epic_id}' already exists."
        )

    db_epic = Epic(**epic_in.model_dump())
    db.add(db_epic)
    db.flush()

    # Log audit trails
    AuditService.log(
        db=db, user_id=cast(int, current_user.id), action=AuditActions.CREATE,
        entity_type="epic", entity_id=cast(int, db_epic.id), entity_label=str(db_epic.epic_id),
        new_values=epic_in.model_dump(),
    )
    AuditService.log_activity(
        db=db, user_id=cast(int, current_user.id), action=AuditActions.CREATE,
        entity_type="epic", entity_id=cast(int, db_epic.id),
        description=f"Created Epic '{db_epic.epic_id}': {db_epic.title}"
    )
    db.commit()
    db.refresh(db_epic)
    return db_epic


@router.put("/epics/{id}", response_model=EpicResponse, summary="Update an Epic")
def update_epic(
    id: int,
    epic_in: EpicUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update an Epic. Requires UPDATE permission."""
    if not has_permission(cast(str, current_user.role), Permissions.UPDATE):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Permission denied. You do not have permission to update epics."
        )

    db_epic = db.query(Epic).filter(Epic.id == id).first()
    if not db_epic:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Epic not found"
        )

    update_data = epic_in.model_dump(exclude_unset=True)
    old_values, new_values = _get_diff(db_epic, update_data)

    if not new_values:
        return db_epic

    for key, val in update_data.items():
        setattr(db_epic, key, val)

    db.add(db_epic)
    db.flush()

    # Log audit trails
    AuditService.log(
        db=db, user_id=cast(int, current_user.id), action=AuditActions.UPDATE,
        entity_type="epic", entity_id=cast(int, db_epic.id), entity_label=str(db_epic.epic_id),
        old_values=old_values, new_values=new_values
    )
    AuditService.log_activity(
        db=db, user_id=cast(int, current_user.id), action=AuditActions.UPDATE,
        entity_type="epic", entity_id=cast(int, db_epic.id),
        description=f"Updated Epic '{db_epic.epic_id}' details"
    )
    db.commit()
    db.refresh(db_epic)
    return db_epic


@router.delete("/epics/{id}", summary="Delete an Epic")
def delete_epic(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete an Epic and its cascade references. Requires DELETE permission."""
    if not has_permission(cast(str, current_user.role), Permissions.DELETE):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Permission denied. You do not have permission to delete epics."
        )

    db_epic = db.query(Epic).filter(Epic.id == id).first()
    if not db_epic:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Epic not found"
        )

    # Cache details for audit
    epic_id_val = db_epic.epic_id
    old_values = {"epic_id": db_epic.epic_id, "title": db_epic.title}

    db.delete(db_epic)
    db.flush()

    # Log audit trails
    AuditService.log(
        db=db, user_id=cast(int, current_user.id), action=AuditActions.DELETE,
        entity_type="epic", entity_id=id, entity_label=str(epic_id_val),
        old_values=old_values
    )
    AuditService.log_activity(
        db=db, user_id=cast(int, current_user.id), action=AuditActions.DELETE,
        entity_type="epic", entity_id=id,
        description=f"Deleted Epic '{epic_id_val}'"
    )
    db.commit()
    return {"message": f"Epic '{epic_id_val}' and all its associated stories deleted successfully."}


# ── User Stories API ─────────────────────────────────────────────────────────
@router.get("", response_model=List[UserStoryResponse], summary="List and Filter User Stories")
def get_user_stories(
    project_id: int = Query(..., description="ID of the project to scope stories"),
    sprint_id: Optional[int] = Query(None, description="Filter by sprint"),
    epic_id: Optional[int] = Query(None, description="Filter by epic"),
    status_filter: Optional[str] = Query(None, alias="status", description="Filter by story status"),
    assigned_to_id: Optional[int] = Query(None, description="Filter by assignee user ID"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List User Stories with optional Agile scoped filters."""
    query = db.query(UserStory).filter(UserStory.project_id == project_id)
    if sprint_id is not None:
        query = query.filter(UserStory.sprint_id == sprint_id)
    if epic_id is not None:
        query = query.filter(UserStory.epic_id == epic_id)
    if status_filter is not None:
        query = query.filter(UserStory.status == status_filter)
    if assigned_to_id is not None:
        query = query.filter(UserStory.assigned_to_id == assigned_to_id)
    return query.all()


@router.get("/{id}", response_model=UserStoryResponse, summary="Get details of a single User Story")
def get_user_story(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Retrieve details for a single User Story."""
    story = db.query(UserStory).filter(UserStory.id == id).first()
    if not story:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User Story not found"
        )
    return story


@router.post("", response_model=UserStoryResponse, status_code=status.HTTP_201_CREATED, summary="Create a new User Story")
def create_user_story(
    story_in: UserStoryCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new User Story. Requires CREATE permission."""
    if not has_permission(cast(str, current_user.role), Permissions.CREATE):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Permission denied. You do not have permission to create user stories."
        )

    # Check for duplicate story_id
    dup = db.query(UserStory).filter(UserStory.story_id == story_in.story_id).first()
    if dup:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"User Story ID '{story_in.story_id}' already exists."
        )

    story_data = story_in.model_dump()
    db_story = UserStory(**story_data, created_by_id=current_user.id)
    db.add(db_story)
    db.flush()

    # Log audit trails
    AuditService.log(
        db=db, user_id=cast(int, current_user.id), action=AuditActions.CREATE,
        entity_type="user_story", entity_id=cast(int, db_story.id), entity_label=str(db_story.story_id),
        new_values=story_data,
    )
    AuditService.log_activity(
        db=db, user_id=cast(int, current_user.id), action=AuditActions.CREATE,
        entity_type="user_story", entity_id=cast(int, db_story.id),
        description=f"Created User Story '{db_story.story_id}': {db_story.title}"
    )
    db.commit()
    db.refresh(db_story)
    return db_story


@router.put("/{id}", response_model=UserStoryResponse, summary="Update a User Story")
def update_user_story(
    id: int,
    story_in: UserStoryUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Update a User Story.
    - Full updates require UPDATE permission.
    - Developers & QA roles without full UPDATE can modify 'status' and 'assigned_to_id' only.
    """
    db_story = db.query(UserStory).filter(UserStory.id == id).first()
    if not db_story:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User Story not found"
        )

    # Check permissions
    has_full_update = has_permission(cast(str, current_user.role), Permissions.UPDATE)
    update_data = story_in.model_dump(exclude_unset=True)

    if not has_full_update:
        # Check if they are attempting to update restricted fields
        restricted_fields = {
            "title", "description", "epic_id", "story_points",
            "acceptance_criteria", "project_id", "application_id", "priority"
        }
        attempted_restricted = restricted_fields.intersection(update_data.keys())
        if attempted_restricted:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permission denied. Your role '{current_user.role}' is not authorized to edit fields: {list(attempted_restricted)}."
            )

    old_values, new_values = _get_diff(db_story, update_data)
    if not new_values:
        return db_story

    for key, val in update_data.items():
        setattr(db_story, key, val)

    db.add(db_story)
    db.flush()

    # Log audit trails
    AuditService.log(
        db=db, user_id=cast(int, current_user.id), action=AuditActions.UPDATE,
        entity_type="user_story", entity_id=cast(int, db_story.id), entity_label=str(db_story.story_id),
        old_values=old_values, new_values=new_values
    )
    
    # Custom activity description depending on what changed
    if "status" in new_values and len(new_values) == 1:
        desc = f"Moved User Story '{db_story.story_id}' status to '{db_story.status}'"
    else:
        desc = f"Updated User Story '{db_story.story_id}' details"

    AuditService.log_activity(
        db=db, user_id=cast(int, current_user.id), action=AuditActions.UPDATE,
        entity_type="user_story", entity_id=cast(int, db_story.id),
        description=desc
    )
    db.commit()
    db.refresh(db_story)
    return db_story


@router.delete("/{id}", summary="Delete a User Story")
def delete_user_story(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete a User Story. Requires DELETE permission."""
    if not has_permission(cast(str, current_user.role), Permissions.DELETE):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Permission denied. You do not have permission to delete user stories."
        )

    db_story = db.query(UserStory).filter(UserStory.id == id).first()
    if not db_story:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User Story not found"
        )

    story_id_val = db_story.story_id
    old_values = {"story_id": db_story.story_id, "title": db_story.title}

    db.delete(db_story)
    db.flush()

    # Log audit trails
    AuditService.log(
        db=db, user_id=cast(int, current_user.id), action=AuditActions.DELETE,
        entity_type="user_story", entity_id=id, entity_label=str(story_id_val),
        old_values=old_values
    )
    AuditService.log_activity(
        db=db, user_id=cast(int, current_user.id), action=AuditActions.DELETE,
        entity_type="user_story", entity_id=id,
        description=f"Deleted User Story '{story_id_val}'"
    )
    db.commit()
    return {"message": f"User Story '{story_id_val}' deleted successfully."}
