"""
Change Request Management API — Module 11
Full CRUD + Workflow Transition endpoints with RBAC & Audit trails.

Workflow:
  Requested → Reviewed → Approved → Implemented → Verified
  Any stage → Rejected | On Hold | Cancelled (with APPROVE permission)
"""
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from typing import List, Optional, cast
from datetime import datetime, timezone

from app.core.database import get_db
from app.api.deps import get_current_user
from app.core.rbac import has_permission, Permissions
from app.core.audit_service import AuditService, AuditActions
from app.models.auth import User
from app.models.change_request import ChangeRequest, ChangeRequestComment, ChangeRequestAuditHistory
from app.schemas.change_request import (
    ChangeRequestCreate, ChangeRequestUpdate, ChangeRequestResponse,
    CRCommentCreate, CRCommentResponse, WorkflowTransitionRequest,
)

router = APIRouter()

# ── Workflow transition rules ──────────────────────────────────────────────────
# Maps current_status → list of valid next statuses
WORKFLOW_TRANSITIONS: dict[str, list[str]] = {
    "Requested":    ["Reviewed", "On Hold", "Rejected", "Cancelled"],
    "Reviewed":     ["Approved", "Rejected", "On Hold", "Requested"],
    "Approved":     ["Implemented", "On Hold", "Cancelled"],
    "Implemented":  ["Verified", "Approved"],   # Approved = re-open for fix
    "Verified":     [],                          # Terminal — no further transitions
    "Rejected":     ["Requested"],               # Can re-open
    "On Hold":      ["Requested", "Cancelled"],
    "Cancelled":    [],                          # Terminal
}

# Stages that require APPROVE permission
APPROVE_REQUIRED_TRANSITIONS = {"Approved", "Rejected", "Verified", "Cancelled"}


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _diff(old_obj, new_data: dict) -> tuple[dict, dict]:
    old_vals, new_vals = {}, {}
    for k, v in new_data.items():
        old_v = getattr(old_obj, k, None)
        if old_v != v:
            old_vals[k] = old_v
            new_vals[k] = v
    return old_vals, new_vals


# ── LIST ───────────────────────────────────────────────────────────────────────
@router.get("", response_model=List[ChangeRequestResponse], summary="List Change Requests")
def list_change_requests(
    project_id: int = Query(..., description="Project scope"),
    status_filter: Optional[str] = Query(None, alias="status"),
    priority: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    change_type: Optional[str] = Query(None),
    risk_level: Optional[str] = Query(None),
    assigned_to_id: Optional[int] = Query(None),
    application_id: Optional[int] = Query(None),
    sprint_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = db.query(ChangeRequest).filter(ChangeRequest.project_id == project_id)
    if status_filter:
        q = q.filter(ChangeRequest.status == status_filter)
    if priority:
        q = q.filter(ChangeRequest.priority == priority)
    if category:
        q = q.filter(ChangeRequest.category == category)
    if change_type:
        q = q.filter(ChangeRequest.change_type == change_type)
    if risk_level:
        q = q.filter(ChangeRequest.risk_level == risk_level)
    if assigned_to_id:
        q = q.filter(ChangeRequest.assigned_to_id == assigned_to_id)
    if application_id:
        q = q.filter(ChangeRequest.application_id == application_id)
    if sprint_id:
        q = q.filter(ChangeRequest.sprint_id == sprint_id)
    return q.order_by(ChangeRequest.created_at.desc()).all()


# ── GET SINGLE ─────────────────────────────────────────────────────────────────
@router.get("/{id}", response_model=ChangeRequestResponse, summary="Get Change Request detail")
def get_change_request(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    cr = db.query(ChangeRequest).filter(ChangeRequest.id == id).first()
    if not cr:
        raise HTTPException(status_code=404, detail="Change Request not found")
    return cr


# ── CREATE ─────────────────────────────────────────────────────────────────────
@router.post("", response_model=ChangeRequestResponse, status_code=201, summary="Create Change Request")
def create_change_request(
    cr_in: ChangeRequestCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not has_permission(cast(str, current_user.role), Permissions.CREATE):
        raise HTTPException(status_code=403, detail="Permission denied: CREATE required.")

    dup = db.query(ChangeRequest).filter(ChangeRequest.cr_id == cr_in.cr_id).first()
    if dup:
        raise HTTPException(status_code=400, detail=f"CR ID '{cr_in.cr_id}' already exists.")

    data = cr_in.model_dump()
    cr = ChangeRequest(
        **data,
        status="Requested",
        requested_by_id=current_user.id,
        requested_date=_utcnow(),
    )
    db.add(cr)
    db.flush()

    AuditService.log(
        db=db, user_id=cast(int, current_user.id), action=AuditActions.CREATE,
        entity_type="change_request", entity_id=cast(int, cr.id), entity_label=str(cr.cr_id),
        new_values=data,
    )
    AuditService.log_activity(
        db=db, user_id=cast(int, current_user.id), action=AuditActions.CREATE,
        entity_type="change_request", entity_id=cast(int, cr.id),
        description=f"Raised Change Request '{cr.cr_id}': {cr.title}",
    )
    db.commit()
    db.refresh(cr)
    return cr


# ── UPDATE (general fields) ────────────────────────────────────────────────────
@router.put("/{id}", response_model=ChangeRequestResponse, summary="Update Change Request")
def update_change_request(
    id: int,
    cr_in: ChangeRequestUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    cr = db.query(ChangeRequest).filter(ChangeRequest.id == id).first()
    if not cr:
        raise HTTPException(status_code=404, detail="Change Request not found")

    has_full = has_permission(cast(str, current_user.role), Permissions.UPDATE)
    update_data = cr_in.model_dump(exclude_unset=True)

    if not has_full:
        restricted = {"title", "description", "justification", "impact_analysis",
                      "implementation_plan", "rollback_plan", "test_plan",
                      "category", "priority", "change_type", "risk_level"}
        attempted = restricted.intersection(update_data.keys())
        if attempted:
            raise HTTPException(
                status_code=403,
                detail=f"Permission denied. Fields {list(attempted)} require UPDATE permission.",
            )

    old_vals, new_vals = _diff(cr, update_data)
    if not new_vals:
        return cr

    for k, v in update_data.items():
        setattr(cr, k, v)

    db.add(cr)
    db.flush()

    AuditService.log(
        db=db, user_id=cast(int, current_user.id), action=AuditActions.UPDATE,
        entity_type="change_request", entity_id=cast(int, cr.id), entity_label=str(cr.cr_id),
        old_values=old_vals, new_values=new_vals,
    )
    AuditService.log_activity(
        db=db, user_id=cast(int, current_user.id), action=AuditActions.UPDATE,
        entity_type="change_request", entity_id=cast(int, cr.id),
        description=f"Updated CR '{cr.cr_id}' details",
    )
    db.commit()
    db.refresh(cr)
    return cr


# ── WORKFLOW TRANSITION ────────────────────────────────────────────────────────
@router.post("/{id}/transition", response_model=ChangeRequestResponse, summary="Transition CR workflow")
def transition_cr_status(
    id: int,
    body: WorkflowTransitionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Move a Change Request through its lifecycle.
    - Approved / Rejected / Verified / Cancelled require APPROVE permission.
    - All others require UPDATE permission.
    """
    cr = db.query(ChangeRequest).filter(ChangeRequest.id == id).first()
    if not cr:
        raise HTTPException(status_code=404, detail="Change Request not found")

    to_status = body.to_status
    current_status = cr.status

    # Validate transition legality
    valid_next = WORKFLOW_TRANSITIONS.get(str(current_status), [])
    if to_status not in valid_next:
        raise HTTPException(
            status_code=422,
            detail=(
                f"Invalid transition: '{current_status}' → '{to_status}'. "
                f"Allowed transitions: {valid_next or ['none (terminal state)']}"
            ),
        )

    # Check permissions
    if to_status in APPROVE_REQUIRED_TRANSITIONS:
        if not has_permission(cast(str, current_user.role), Permissions.APPROVE):
            raise HTTPException(status_code=403, detail=f"Permission denied: APPROVE required to set status '{to_status}'.")
    else:
        if not has_permission(cast(str, current_user.role), Permissions.UPDATE):
            raise HTTPException(status_code=403, detail="Permission denied: UPDATE required.")

    from_status = str(cr.status)
    setattr(cr, 'status', to_status)
    now = _utcnow()

    # Set stage-specific actor & timestamp
    if to_status == "Reviewed":
        setattr(cr, 'reviewed_by_id', current_user.id)
        setattr(cr, 'reviewed_date', now)
    elif to_status == "Approved":
        setattr(cr, 'approved_by_id', current_user.id)
        setattr(cr, 'approved_date', now)
    elif to_status == "Implemented":
        setattr(cr, 'implemented_by_id', current_user.id)
        setattr(cr, 'implemented_date', now)
    elif to_status == "Verified":
        setattr(cr, 'verified_by_id', current_user.id)
        setattr(cr, 'verified_date', now)
    elif to_status == "Rejected" and body.rejection_reason:
        setattr(cr, 'rejection_reason', body.rejection_reason)

    db.add(cr)

    # Record CR audit history entry
    hist = ChangeRequestAuditHistory(
        cr_db_id=cr.id,
        user_id=current_user.id,
        from_status=from_status,
        to_status=to_status,
        notes=body.notes,
        changed_at=now,
    )
    db.add(hist)
    db.flush()

    AuditService.log_activity(
        db=db, user_id=cast(int, current_user.id), action=AuditActions.UPDATE,
        entity_type="change_request", entity_id=cast(int, cr.id),
        description=f"CR '{cr.cr_id}' moved from '{from_status}' → '{to_status}'",
    )
    db.commit()
    db.refresh(cr)
    return cr


# ── DELETE ─────────────────────────────────────────────────────────────────────
@router.delete("/{id}", summary="Delete Change Request")
def delete_change_request(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not has_permission(cast(str, current_user.role), Permissions.DELETE):
        raise HTTPException(status_code=403, detail="Permission denied: DELETE required.")

    cr = db.query(ChangeRequest).filter(ChangeRequest.id == id).first()
    if not cr:
        raise HTTPException(status_code=404, detail="Change Request not found")

    cr_id_val = cr.cr_id
    old_vals = {"cr_id": cr.cr_id, "title": cr.title, "status": cr.status}
    db.delete(cr)
    db.flush()

    AuditService.log(
        db=db, user_id=cast(int, current_user.id), action=AuditActions.DELETE,
        entity_type="change_request", entity_id=id, entity_label=str(cr_id_val),
        old_values=old_vals,
    )
    AuditService.log_activity(
        db=db, user_id=cast(int, current_user.id), action=AuditActions.DELETE,
        entity_type="change_request", entity_id=id,
        description=f"Deleted CR '{cr_id_val}'",
    )
    db.commit()
    return {"message": f"Change Request '{cr_id_val}' deleted successfully."}


# ── COMMENTS ──────────────────────────────────────────────────────────────────
@router.post("/{id}/comments", response_model=CRCommentResponse, status_code=201, summary="Add comment")
def add_comment(
    id: int,
    body: CRCommentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    cr = db.query(ChangeRequest).filter(ChangeRequest.id == id).first()
    if not cr:
        raise HTTPException(status_code=404, detail="Change Request not found")

    cmt = ChangeRequestComment(
        cr_db_id=id,
        user_id=current_user.id,
        comment=body.comment,
        stage=body.stage or cr.status,
    )
    db.add(cmt)
    db.commit()
    db.refresh(cmt)
    return cmt


@router.delete("/comments/{comment_id}", summary="Delete comment")
def delete_comment(
    comment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    cmt = db.query(ChangeRequestComment).filter(ChangeRequestComment.id == comment_id).first()
    if not cmt:
        raise HTTPException(status_code=404, detail="Comment not found")
    if cmt.user_id != current_user.id and not has_permission(cast(str, current_user.role), Permissions.DELETE):
        raise HTTPException(status_code=403, detail="You can only delete your own comments.")
    db.delete(cmt)
    db.commit()
    return {"message": "Comment deleted."}
