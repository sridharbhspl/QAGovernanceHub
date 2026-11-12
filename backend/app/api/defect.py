import os
import io
import csv
import shutil
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from fastapi import Form as FastAPIForm
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, timezone
from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.auth import User
from app.models.org import Project
from app.models.defect import Defect, DefectComment, DefectAttachment, DefectAuditHistory
from app.schemas.defect import (
    DefectCreate, DefectUpdate, DefectResponse,
    DefectCommentCreate, DefectCommentResponse, DefectAttachmentResponse
)
import pandas as pd

def log_debug(msg: str):
    log_path = os.path.join(os.path.dirname(__file__), "debug_run.log")
    try:
        from datetime import datetime
        with open(log_path, "a", encoding="utf-8") as f:
            f.write(f"[{datetime.now()}] {msg}\n")
    except Exception:
        pass

def parse_date_safely(date_val) -> datetime:
    if not date_val:
        return datetime.now(timezone.utc).replace(tzinfo=None)
    
    # If already a datetime object (e.g. read from Excel Date format)
    if isinstance(date_val, datetime):
        return date_val.replace(tzinfo=None)
        
    # If it's a pandas Timestamp/other object with to_pydatetime()
    if hasattr(date_val, "to_pydatetime"):
        try:
            return date_val.to_pydatetime().replace(tzinfo=None)
        except Exception:
            pass
            
    # Normalize to string and attempt format parsing
    s = str(date_val).strip()
    for fmt in ("%d/%m/%Y", "%Y-%m-%d %H:%M:%S", "%Y-%m-%d", "%m/%d/%Y"):
        try:
            return datetime.strptime(s, fmt)
        except ValueError:
            continue
            
    # Ultimate fallback: pandas parse
    try:
        parsed = pd.to_datetime(s, dayfirst=True)
        if hasattr(parsed, "to_pydatetime"):
            return parsed.to_pydatetime().replace(tzinfo=None)
        elif isinstance(parsed, datetime):
            return parsed.replace(tzinfo=None)
    except Exception:
        pass
        
    log_debug(f"WARNING: date parsing failed for '{date_val}', falling back to current time.")
    return datetime.now(timezone.utc).replace(tzinfo=None)

router = APIRouter()
UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "uploads")
MAX_UPLOAD_BYTES = 10 * 1024 * 1024  # 10 MB

# ─────────────────────────────────────────────────────────────────────────────
# TEMPLATE DOWNLOAD  – exact Bug/CR Report column layout
# NOTE: Must be registered BEFORE /{defect_id_internal} to avoid route conflict
# ─────────────────────────────────────────────────────────────────────────────

DEFECT_TEMPLATE_HEADERS = [
    "Bug/CR ID", "Test Case ID", "Source Screen/URL", "Type of Bug/CR",
    "Bug/CR Description", "Screenshot URL", "Expected Behavior", "Actual Behavior",
    "Reproducible? (YES/NO)", "Steps to Reproduce", "Bug/CR Status",
    "Severity", "Priority", "Tester Name", "Date Found/Posted (DD/MM/YYYY)",
    "Status", "Age", "Developer Name", "Date of Fixing", "Developer Comments",
]

DEFECT_TEMPLATE_SAMPLE = [
    "BUG_SCM_0001", "TC-SCM-0001", "Procurement → RFQ", "Bug",
    "Vendor field not accepting multiple vendors in RFQ", "N/A",
    "User should be able to select multiple vendors while creating RFQ",
    "System allows only a single vendor selection",
    "YES", "Open RFQ → Select Vendor field → Attempt to add multiple vendors",
    "Open", "High", "High", "Venkata Gopi", "06/04/2026",
    "Open", "4", "", "", "",
]


@router.get("/templates/download")
def download_defect_template(format: str = "xlsx"):
    """Download the Bug/CR Report Excel/CSV template."""
    fmt = format.lower()
    if fmt == "xlsx":
        df = pd.DataFrame([DEFECT_TEMPLATE_SAMPLE], columns=DEFECT_TEMPLATE_HEADERS)
        output = io.BytesIO()
        with pd.ExcelWriter(output, engine="openpyxl") as writer:
            df.to_excel(writer, index=False, sheet_name="Bug_CR_Report")
            ws = writer.sheets["Bug_CR_Report"]
            for col in ws.columns:
                max_len = max(len(str(cell.value or "")) for cell in col) + 4
                ws.column_dimensions[col[0].column_letter].width = min(max_len, 42)
        data = output.getvalue()
        media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        filename = "Bug_CR_Report_Template.xlsx"
    elif fmt == "csv":
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(DEFECT_TEMPLATE_HEADERS)
        writer.writerow(DEFECT_TEMPLATE_SAMPLE)
        data = output.getvalue().encode("utf-8")
        media_type = "text/csv"
        filename = "Bug_CR_Report_Template.csv"
    else:
        raise HTTPException(status_code=400, detail="Invalid format. Use 'xlsx' or 'csv'.")

    return StreamingResponse(
        io.BytesIO(data), media_type=media_type,
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@router.post("/bulk-upload")
def bulk_upload_defects(
    project_id: int = FastAPIForm(...),
    build_number: str = FastAPIForm(""),
    application_id: Optional[int] = FastAPIForm(None),
    release_id: Optional[int] = FastAPIForm(None),
    sprint_id: Optional[int] = FastAPIForm(None),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Bulk import defects from an Excel (.xlsx/.xls) or CSV file matching
    the Bug/CR Report template.  Returns a summary of created / skipped rows.
    """
    try:
        log_debug(f"ENTERED bulk_upload_defects: project_id={project_id}, build_number={build_number}, application_id={application_id}, release_id={release_id}, sprint_id={sprint_id}")
        project = db.query(Project).filter(Project.id == project_id).first()
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")

        # ── 1. Read & size-check the upload ──────────────────────────────────────
        filename = (file.filename or "").lower()
        content = file.file.read()
        log_debug(f"File loaded: {filename}, size={len(content)}")
        if len(content) == 0:
            raise HTTPException(status_code=400, detail="Uploaded file is empty.")
        if len(content) > MAX_UPLOAD_BYTES:
            raise HTTPException(status_code=413, detail=f"File exceeds the 10 MB limit.")

        # ── 2. Parse into DataFrame ───────────────────────────────────────────────
        try:
            if filename.endswith((".xlsx", ".xls")):
                df = pd.read_excel(io.BytesIO(content), engine="openpyxl")
            elif filename.endswith(".csv"):
                try:
                    text = content.decode("utf-8")
                except UnicodeDecodeError:
                    text = content.decode("latin-1")
                df = pd.read_csv(io.StringIO(text))
            else:
                raise HTTPException(status_code=400, detail="Upload .xlsx or .csv only.")
        except HTTPException:
            raise
        except Exception as exc:
            raise HTTPException(status_code=400, detail=f"Failed to parse file: {exc}")

        log_debug(f"DataFrame parsed. Empty={df.empty}, rows={len(df)}")
        if df.empty:
            raise HTTPException(status_code=400, detail="The file contains no data rows.")

        # ── 3. Normalize column names ─────────────────────────────────────────────
        df.columns = [f"{c}".strip() for c in df.columns]

        # Build a lookup: normalised_key → original column name
        def _normalise(col: str) -> str:
            return (col.lower()
                       .replace(" ", "").replace("_", "").replace("/", "")
                       .replace("?", "").replace("(", "").replace(")", "")
                       .replace("-", "").replace("*", ""))

        col_map: dict[str, str] = {_normalise(c): c for c in df.columns if c and c.lower() != "nan"}

        def _find(row, *keywords) -> Optional[str]:
            """
            Return the first non-empty cell value whose column name contains
            any of the supplied keyword strings (after normalisation).
            Keywords are tried in order; the MOST specific keyword should come first.
            """
            for kw in keywords:
                for norm, orig in col_map.items():
                    if kw in norm:
                        val = row[orig]
                        if pd.notna(val):
                            s = str(val).strip()
                            if s and s.lower() not in ("nan", "none", "n/a"):
                                return s
            return None

        # ── 4. Determine "Bug/CR Status" vs "Status" columns unambiguously ───────
        # The template has BOTH "Bug/CR Status" and "Status".
        # We prefer Bug/CR Status; fall back to Status.
        def _get_status(row) -> str:
            val = _find(row, "bugcrstatus")           # matches "Bug/CR Status" exactly
            if val is None:
                val = _find(row, "status")            # fall back to plain "Status"
            return val or "New"

        # ── 5. Import rows ────────────────────────────────────────────────────────
        proj_code = project.code.upper().replace(" ", "")
        created = 0
        skipped = 0
        errors: list[str] = []

        status_map = {
            "open": "Open", "new": "New", "assigned": "Assigned",
            "fixed": "Fixed", "retest": "Retest", "reopened": "Reopened",
            "closed": "Closed", "deferred": "Deferred",
        }

        # Query existing count and track IDs in the current session batch
        defect_count = db.query(Defect).filter(Defect.project_id == project_id).count()
        used_defect_ids = set()

        # Prefetch existing defect IDs and titles in this project to prevent N+1 queries
        existing_defects = db.query(Defect.defect_id, Defect.title).filter(Defect.project_id == project_id).all()
        existing_ids = {d[0].lower().strip() for d in existing_defects if d[0]}
        existing_titles = {d[1].lower().strip() for d in existing_defects if d[1]}

        # Prefetch all defect IDs in database to prevent ID generation conflicts
        all_defect_ids = {d[0].lower().strip() for d in db.query(Defect.defect_id).all() if d[0]}

        # Prefetch all users in the system for tester/developer name lookup
        all_users = db.query(User.id, User.full_name, User.email).all()
        user_map = {}
        for uid, u_name, u_email in all_users:
            if u_name:
                user_map[u_name.lower().strip()] = uid
            if u_email:
                user_map[u_email.lower().strip()] = uid

        log_debug(f"Queries completed. existing_ids={len(existing_ids)}, existing_titles={len(existing_titles)}, all_defect_ids={len(all_defect_ids)}, user_map={len(user_map)}")

        for idx, row in df.iterrows():
            row_label = int(idx) + 2  # +2 because row 1 = header, idx is 0-based  # type: ignore[arg-type]
            try:
                log_debug(f"Starting processing for row {row_label}")
                # ── Required: description / title ─────────────────────────────────
                title = _find(
                    row,
                    "bugcrdescription", "bugcrdesc",   # "Bug/CR Description"
                    "description", "title", "summary"
                )
                log_debug(f"Row {row_label}: title={title}")
                if not title:
                    log_debug(f"Row {row_label}: Skipped because no title/description was found.")
                    skipped += 1
                    continue

                title = title[:150]  # DB column limit

                # ── Duplicate detection (using fast in-memory sets) ───────────────
                bug_id_ref = _find(row, "bugcrid", "defectid", "bugid")
                log_debug(f"Row {row_label}: bug_id_ref={bug_id_ref}")
                is_duplicate = False
                if bug_id_ref and bug_id_ref.lower().strip() in existing_ids:
                    is_duplicate = True
                elif title.lower().strip() in existing_titles:
                    is_duplicate = True

                if is_duplicate:
                    log_debug(f"Row {row_label}: Skipped as duplicate. bug_id_ref={bug_id_ref}, title={title}")
                    skipped += 1
                    continue

                # ── Field extraction ──────────────────────────────────────────────
                log_debug(f"Row {row_label}: extracting severity/priority")
                severity     = _find(row, "severity") or "Medium"
                priority     = _find(row, "priority") or "Medium"
                log_debug(f"Row {row_label}: severity={severity}, priority={priority}")
                
                log_debug(f"Row {row_label}: calling _get_status")
                raw_status   = _get_status(row)
                log_debug(f"Row {row_label}: raw_status={raw_status}")
                bug_status   = status_map.get(raw_status.lower(), "New")
                log_debug(f"Row {row_label}: bug_status={bug_status}")

                log_debug(f"Row {row_label}: extracting other fields")
                source_screen = _find(row, "sourcescreen", "sourcescreenurl", "screen")
                bug_type      = _find(row, "typeofbugcr", "typeofbug", "bugtype", "type") or "Bug"
                screenshot    = _find(row, "screenshoturl", "screenshot")
                expected      = _find(row, "expectedbehavior", "expected")
                actual        = _find(row, "actualbehavior", "actual")
                reproducible  = _find(row, "reproducible", "reproduceable") or "YES"
                
                log_debug(f"Row {row_label}: extracting steps to reproduce")
                # Be specific with "steps": prefer longer keys first
                steps         = _find(row, "stepstoreproducereproducible",
                                           "stepstoreproducerepro",
                                           "stepstoreproducce",
                                           "stepstoreproducce",
                                           "stepstoreproducerepro",
                                           "stepstoreproducereproducible",
                                           "stepstoreproduce",
                                           "stepstoreproducee",
                                           "stepsreproduce",
                                           "stepsto",
                                           "steps")
                log_debug(f"Row {row_label}: steps={steps}")
                
                tester_name   = _find(row, "testername", "tester", "foundby", "reportedby")
                dev_name      = _find(row, "developername", "developer")
                dev_comments  = _find(row, "developercomments", "devcomments", "comments")
                build_val     = _find(row, "buildversion", "buildno", "version") or build_number or ""
                date_found_raw = _find(row, "datefoundposted", "datefound", "dateposted", "datefound")
                date_of_fixing = _find(row, "dateoffixing", "fixdate", "fixingdate")
                log_debug(f"Row {row_label}: other fields extracted")

                # ── Tester → user lookup (using fast in-memory map) ───────────────
                reported_by_id = current_user.id
                if tester_name:
                    reported_by_id = user_map.get(tester_name.lower().strip(), current_user.id)
                log_debug(f"Row {row_label}: reported_by_id={reported_by_id}")

                # ── Date found ────────────────────────────────────────────────────
                created_at_val = parse_date_safely(date_found_raw)

                # ── Generate unique defect ID (using fast in-memory sets) ──────────
                log_debug(f"Row {row_label}: generating defect ID")
                if bug_id_ref:
                    new_defect_id = bug_id_ref
                else:
                    defect_count += 1
                    new_defect_id = f"BUG-{proj_code}-{defect_count:06d}"
                    
                    # Make sure it doesn't conflict with current batch or database
                    while (new_defect_id in used_defect_ids or
                           new_defect_id.lower().strip() in all_defect_ids):
                        defect_count += 1
                        new_defect_id = f"BUG-{proj_code}-{defect_count:06d}"

                log_debug(f"Row {row_label}: new_defect_id={new_defect_id}")
                used_defect_ids.add(new_defect_id)

                # ── Build composite description ───────────────────────────────────
                desc_parts = []
                if expected:      desc_parts.append(f"Expected Behavior:\n{expected}")
                if actual:        desc_parts.append(f"Actual Behavior:\n{actual}")
                if steps:         desc_parts.append(f"Steps to Reproduce:\n{steps}")
                if source_screen: desc_parts.append(f"Source Screen/URL: {source_screen}")
                if screenshot:    desc_parts.append(f"Screenshot URL: {screenshot}")
                full_desc = "\n\n".join(desc_parts) if desc_parts else None

                # ── Persist with savepoint ────────────────────────────────────────
                log_debug(f"Row {row_label}: beginning nested savepoint")
                sp = db.begin_nested()
                try:
                    db_defect = Defect(
                        defect_id=new_defect_id,
                        title=title,
                        description=full_desc,
                        project_id=project_id,
                        application_id=application_id,
                        release_id=release_id,
                        sprint_id=sprint_id,
                        environment=_find(row, "environment", "env") or "QA",
                        build_number=build_val,
                        severity=severity,
                        priority=priority,
                        status=bug_status,
                        assigned_to_id=None,
                        reported_by_id=reported_by_id,
                        source_screen=source_screen,
                        bug_type=bug_type,
                        screenshot_url=screenshot,
                        reproducible=reproducible,
                        steps_to_reproduce=steps,
                        expected_behavior=expected,
                        actual_behavior=actual,
                        developer_name=dev_name,
                        developer_comments=dev_comments,
                        date_of_fixing=date_of_fixing,
                        created_at=created_at_val,
                    )
                    db.add(db_defect)
                    log_debug(f"Row {row_label}: flushing db_defect")
                    db.flush()
                    log_debug(f"Row {row_label}: db_defect flushed. ID={db_defect.id}")

                    db.add(DefectAuditHistory(
                        defect_id=db_defect.id,
                        user_id=current_user.id,
                        field_name="defect",
                        old_value=None,
                        new_value=f"Bulk imported by {current_user.full_name}",
                    ))
                    log_debug(f"Row {row_label}: flushing audit history")
                    db.flush()
                    log_debug(f"Row {row_label}: committing nested transaction")
                    sp.commit()
                    created += 1
                    log_debug(f"Row {row_label}: successfully processed.")
                except Exception as row_err:
                    log_debug(f"Row {row_label}: inner row exception: {row_err}")
                    sp.rollback()
                    err_msg = str(row_err)
                    if "Duplicate entry" in err_msg or "UNIQUE constraint" in err_msg:
                        skipped += 1
                        errors.append(f"Row {row_label}: Skipped — duplicate ID or title.")
                    else:
                        errors.append(f"Row {row_label}: {err_msg}")

            except Exception as outer_err:
                log_debug(f"Row {row_label}: outer exception: {outer_err}")
                errors.append(f"Row {row_label}: Unexpected error — {outer_err}")

        log_debug(f"Row loop finished. total_created={created}, total_skipped={skipped}, errors_count={len(errors)}")
        try:
            log_debug("Committing database transaction...")
            db.commit()
            log_debug("Database transaction committed successfully.")
        except Exception as commit_err:
            log_debug(f"Error committing database transaction: {commit_err}")
            db.rollback()
            raise HTTPException(
                status_code=400,
                detail=f"Database commit failed: {commit_err}"
            )

        return {
            "message": "Bulk import complete",
            "created": created,
            "skipped_duplicates": skipped,
            "errors": errors,
            "total_rows_processed": created + skipped + len(errors),
        }

    except HTTPException:
        raise
    except Exception as e:
        import traceback
        tb = traceback.format_exc()
        log_debug(f"CRITICAL ERROR in bulk_upload_defects:\n{tb}")
        error_log_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "error_trace.log")
        try:
            with open(error_log_path, "w", encoding="utf-8") as f:
                f.write(tb)
        except Exception:
            pass
        try:
            db.rollback()
        except Exception:
            pass
        raise HTTPException(
            status_code=500,
            detail=f"Unexpected bulk import error: {str(e)}"
        )


# ----------------- Defect List & Create -----------------
@router.get("", response_model=List[DefectResponse])
def get_defects(
    project_id: Optional[int] = None,
    module_id: Optional[int] = None,
    release_id: Optional[int] = None,
    sprint_id: Optional[int] = None,
    severity: Optional[str] = None,
    priority: Optional[str] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(Defect)
    if project_id:
        query = query.filter(Defect.project_id == project_id)
    if module_id:
        query = query.filter(Defect.module_id == module_id)
    if release_id:
        query = query.filter(Defect.release_id == release_id)
    if sprint_id:
        query = query.filter(Defect.sprint_id == sprint_id)
    if severity:
        query = query.filter(Defect.severity == severity)
    if priority:
        query = query.filter(Defect.priority == priority)
    if status:
        query = query.filter(Defect.status == status)

    # Restrict to company if not super admin
    if current_user.company_id and current_user.role not in ["Super Admin", "Group Admin"]:
        query = query.join(Project).filter(Project.company_id == current_user.company_id)

    return query.all()

@router.post("", response_model=DefectResponse)
def create_defect(
    defect_in: DefectCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    project = db.query(Project).filter(Project.id == defect_in.project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Generate Custom Defect ID e.g. BUG-PROJ001-000001
    proj_code = project.code.upper().replace(" ", "").replace("-", "")
    defect_count = db.query(Defect).filter(Defect.project_id == project.id).count()
    while True:
        defect_id = f"BUG-{proj_code}-{(defect_count + 1):06d}"
        exists = db.query(Defect).filter(Defect.defect_id == defect_id).first()
        if not exists:
            break
        defect_count += 1

    # Build a rich structured description from template fields
    desc_parts = []
    if defect_in.description:       desc_parts.append(defect_in.description)
    if defect_in.expected_behavior: desc_parts.append(f"Expected Behavior:\n{defect_in.expected_behavior}")
    if defect_in.actual_behavior:   desc_parts.append(f"Actual Behavior:\n{defect_in.actual_behavior}")
    if defect_in.steps_to_reproduce: desc_parts.append(f"Steps to Reproduce:\n{defect_in.steps_to_reproduce}")
    if defect_in.source_screen:    desc_parts.append(f"Source Screen/URL: {defect_in.source_screen}")
    if defect_in.screenshot_url:   desc_parts.append(f"Screenshot URL: {defect_in.screenshot_url}")
    if defect_in.developer_comments: desc_parts.append(f"Developer Comments:\n{defect_in.developer_comments}")
    full_desc = "\n\n".join(desc_parts) if desc_parts else None

    db_defect = Defect(
        defect_id=defect_id,
        title=defect_in.title,
        description=full_desc,
        project_id=defect_in.project_id,
        module_id=defect_in.module_id,
        sub_module_id=defect_in.sub_module_id,
        release_id=defect_in.release_id,
        sprint_id=defect_in.sprint_id,
        environment=defect_in.environment,
        build_number=defect_in.build_number,
        severity=defect_in.severity,
        priority=defect_in.priority,
        status=defect_in.status or "New",
        assigned_to_id=defect_in.assigned_to_id,
        reported_by_id=current_user.id,
        # Extended fields
        source_screen=defect_in.source_screen,
        bug_type=defect_in.bug_type,
        screenshot_url=defect_in.screenshot_url,
        reproducible=defect_in.reproducible,
        steps_to_reproduce=defect_in.steps_to_reproduce,
        expected_behavior=defect_in.expected_behavior,
        actual_behavior=defect_in.actual_behavior,
        developer_name=defect_in.developer_name,
        developer_comments=defect_in.developer_comments,
        date_of_fixing=defect_in.date_of_fixing,
    )

    db.add(db_defect)
    db.commit()
    db.refresh(db_defect)

    # Audit trail creation
    db.add(DefectAuditHistory(
        defect_id=db_defect.id,
        user_id=current_user.id,
        field_name="defect",
        old_value=None,
        new_value=f"Defect created by {current_user.full_name}"
    ))
    db.commit()

    return db_defect


# ----------------- Defect Detail & Update -----------------
@router.get("/{defect_id_internal}", response_model=DefectResponse)
def get_defect_detail(
    defect_id_internal: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    defect = db.query(Defect).filter(Defect.id == defect_id_internal).first()
    if not defect:
        raise HTTPException(status_code=404, detail="Defect not found")
    return defect

@router.put("/{defect_id_internal}", response_model=DefectResponse)
def update_defect(
    defect_id_internal: int,
    defect_in: DefectUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    db_defect = db.query(Defect).filter(Defect.id == defect_id_internal).first()
    if not db_defect:
        raise HTTPException(status_code=404, detail="Defect not found")

    # Dynamic Audit Logs for changed fields only
    updated_fields = defect_in.model_dump(exclude_unset=True)
    audits = []

    for field, new_val in updated_fields.items():
        old_val = getattr(db_defect, field, None)
        if old_val != new_val:
            setattr(db_defect, field, new_val)
            audits.append(
                DefectAuditHistory(
                    defect_id=db_defect.id,
                    user_id=current_user.id,
                    field_name=field,
                    old_value=str(old_val) if old_val is not None else None,
                    new_value=str(new_val) if new_val is not None else None
                )
            )

    if audits:
        db_defect.updated_at = datetime.now(timezone.utc).replace(tzinfo=None)  # type: ignore[assignment]
        for audit in audits:
            db.add(audit)
        db.commit()
        db.refresh(db_defect)

    db.refresh(db_defect)
    return db_defect


@router.delete("/{defect_id_internal}", status_code=204)
def delete_defect(
    defect_id_internal: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    db_defect = db.query(Defect).filter(Defect.id == defect_id_internal).first()
    if not db_defect:
        raise HTTPException(status_code=404, detail="Defect not found")
    db.delete(db_defect)
    db.commit()
    return None


# ----------------- Defect Actions: Comments & Attachments -----------------
@router.post("/{defect_id_internal}/comments", response_model=DefectCommentResponse)
def create_defect_comment(
    defect_id_internal: int,
    comment_in: DefectCommentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    defect = db.query(Defect).filter(Defect.id == defect_id_internal).first()
    if not defect:
        raise HTTPException(status_code=404, detail="Defect not found")

    db_comment = DefectComment(
        defect_id=defect.id,
        user_id=current_user.id,
        comment=comment_in.comment
    )
    db.add(db_comment)
    db.commit()
    db.refresh(db_comment)
    return db_comment

@router.post("/{defect_id_internal}/attachments", response_model=DefectAttachmentResponse)
def upload_defect_attachment(
    defect_id_internal: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    defect = db.query(Defect).filter(Defect.id == defect_id_internal).first()
    if not defect:
        raise HTTPException(status_code=404, detail="Defect not found")

    os.makedirs(UPLOAD_DIR, exist_ok=True)
    safe_ts = int(datetime.now(timezone.utc).timestamp())
    file_path = os.path.join(UPLOAD_DIR, f"{defect.defect_id}_{safe_ts}_{file.filename}")

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    db_attach = DefectAttachment(
        defect_id=defect.id,
        filename=file.filename,
        filepath=file_path,
        file_type=file.content_type
    )
    db.add(db_attach)
    db.commit()
    db.refresh(db_attach)
    return db_attach
