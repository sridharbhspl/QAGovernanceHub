import io
from datetime import datetime, timezone
import pandas as pd
from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Optional
from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.auth import User
from app.models.defect import Defect
from app.models.org import Project
from app.models.test_case import Requirement, TestScenario, TestCase, ExecutionHistory
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors

router = APIRouter()

@router.get("/defects/excel")
def export_defects_excel(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
        
    defects = db.query(Defect).filter(Defect.project_id == project_id).all()
    
    data = []
    for d in defects:
        data.append({
            "Defect ID": d.defect_id,
            "Title": d.title,
            "Severity": d.severity,
            "Priority": d.priority,
            "Status": d.status,
            "Environment": d.environment,
            "Build Number": d.build_number or "",
            "Assigned To": d.assigned_to.full_name if d.assigned_to else "Unassigned",
            "Reported By": d.reported_by.full_name if d.reported_by else "",
            "Created Date": d.created_at.strftime("%Y-%m-%d %H:%M:%S")
        })
        
    df = pd.DataFrame(data)
    
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine="openpyxl") as writer:
        df.to_excel(writer, index=False, sheet_name="Defects List")
    output.seek(0)
    
    headers = {
        'Content-Disposition': f'attachment; filename="defects_{project.code}.xlsx"'
    }
    return StreamingResponse(output, headers=headers, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")


@router.get("/rtm/excel")
def export_rtm_excel(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
        
    requirements = db.query(Requirement).filter(Requirement.project_id == project_id).all()
    
    data = []
    for req in requirements:
        scenarios = db.query(TestScenario).filter(TestScenario.requirement_id == req.id).all()
        if not scenarios:
            data.append({
                "Requirement ID": req.requirement_id,
                "Requirement Title": req.title,
                "Test Scenario ID": "Untested",
                "Test Case ID": "",
                "Test Case Title": "",
                "Last Run Status": "Untested",
                "Defect ID": ""
            })
            continue
            
        for scen in scenarios:
            tcs = db.query(TestCase).filter(TestCase.test_scenario_id == scen.id).all()
            if not tcs:
                data.append({
                    "Requirement ID": req.requirement_id,
                    "Requirement Title": req.title,
                    "Test Scenario ID": scen.scenario_id,
                    "Test Case ID": "No Test Cases",
                    "Test Case Title": "",
                    "Last Run Status": "Untested",
                    "Defect ID": ""
                })
                continue
                
            for tc in tcs:
                latest_exec = db.query(ExecutionHistory).filter(ExecutionHistory.test_case_id == tc.id).order_by(ExecutionHistory.executed_at.desc()).first()
                exec_status = latest_exec.status if latest_exec else "Untested"
                defect_code = ""
                if latest_exec and latest_exec.defect_id:
                    defect = db.query(Defect).filter(Defect.id == latest_exec.defect_id).first()
                    if defect:
                        defect_code = defect.defect_id
                        
                data.append({
                    "Requirement ID": req.requirement_id,
                    "Requirement Title": req.title,
                    "Test Scenario ID": scen.scenario_id,
                    "Test Case ID": tc.test_case_id,
                    "Test Case Title": tc.title,
                    "Last Run Status": exec_status,
                    "Defect ID": defect_code
                })
                
    df = pd.DataFrame(data)
    
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine="openpyxl") as writer:
        df.to_excel(writer, index=False, sheet_name="RTM Matrix")
    output.seek(0)
    
    headers = {
        'Content-Disposition': f'attachment; filename="rtm_{project.code}.xlsx"'
    }
    return StreamingResponse(output, headers=headers, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")


@router.get("/project-health/pdf")
def export_project_health_pdf(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
        
    total_bugs = db.query(Defect).filter(Defect.project_id == project_id).count()
    open_bugs = db.query(Defect).filter(Defect.project_id == project_id, Defect.status.in_(["New", "Assigned", "Open", "Reopened"])).count()
    closed_bugs = total_bugs - open_bugs
    
    total_reqs = db.query(Requirement).filter(Requirement.project_id == project_id).count()
    total_tcs = db.query(TestCase).join(TestScenario).filter(TestScenario.project_id == project_id).count()
    
    passed_tcs = db.query(func.count(func.distinct(ExecutionHistory.test_case_id))).join(TestCase).join(TestScenario).filter(
        TestScenario.project_id == project_id,
        ExecutionHistory.status == "Passed"
    ).scalar() or 0
    
    coverage_pct = (passed_tcs / total_tcs * 100) if total_tcs > 0 else 0
    
    # PDF generation using ReportLab
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter, rightMargin=40, leftMargin=40, topMargin=40, bottomMargin=40)
    
    styles = getSampleStyleSheet()
    
    # Custom styles
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Heading1'],
        fontName='Helvetica-Bold',
        fontSize=24,
        textColor=colors.HexColor('#1E293B'),
        spaceAfter=15
    )
    
    subtitle_style = ParagraphStyle(
        'DocSubtitle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=12,
        textColor=colors.HexColor('#64748B'),
        spaceAfter=30
    )
    
    heading_style = ParagraphStyle(
        'SectionHeading',
        parent=styles['Heading2'],
        fontName='Helvetica-Bold',
        fontSize=16,
        textColor=colors.HexColor('#0F172A'),
        spaceBefore=15,
        spaceAfter=10
    )
    
    body_style = ParagraphStyle(
        'Body',
        parent=styles['BodyText'],
        fontName='Helvetica',
        fontSize=10,
        textColor=colors.HexColor('#334155'),
        spaceAfter=12
    )

    story = []
    
    # Title section
    story.append(Paragraph("QA & Governance Hub", title_style))
    story.append(Paragraph(f"Executive Project Health Report for: {project.name} ({project.code})", subtitle_style))
    story.append(Spacer(1, 10))
    
    # Executive Summary Paragraph
    story.append(Paragraph("Executive Summary", heading_style))
    summary_text = (
        f"This report presents a high-level overview of the testing metrics, "
        f"requirement coverage, and defect status for the project <b>{project.name}</b>. "
        f"As of {datetime.now(timezone.utc).strftime('%Y-%m-%d')}, the project has <b>{total_reqs}</b> documented requirements "
        f"associated with <b>{total_tcs}</b> test cases. The current testing coverage stands at "
        f"<b>{round(coverage_pct, 2)}%</b> based on passed runs."
    )
    story.append(Paragraph(summary_text, body_style))
    story.append(Spacer(1, 15))
    
    # Metrics Table
    story.append(Paragraph("Key QA Metrics", heading_style))
    table_data = [
        ["Metric Description", "Value"],
        ["Total Requirements Documented", str(total_reqs)],
        ["Total Test Cases Written", str(total_tcs)],
        ["Successful Test Cases (Passed)", str(passed_tcs)],
        ["QA Coverage Percentage", f"{round(coverage_pct, 2)}%"],
        ["Total Logged Defects", str(total_bugs)],
        ["Total Active (Open) Defects", str(open_bugs)],
        ["Total Resolved/Closed Defects", str(closed_bugs)],
    ]
    
    metrics_table = Table(table_data, colWidths=[300, 150])
    metrics_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (1, 0), colors.HexColor('#0F172A')),
        ('TEXTCOLOR', (0, 0), (1, 0), colors.whitesmoke),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 8),
        ('BACKGROUND', (0, 1), (-1, -1), colors.HexColor('#F8FAFC')),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#CBD5E1')),
        ('PADDING', (0, 0), (-1, -1), 8),
    ]))
    
    story.append(metrics_table)
    story.append(Spacer(1, 20))
    
    # Disclaimer / Footer Info
    story.append(Paragraph("Report Generated Authentically by QA Governance Engine.", body_style))
    
    doc.build(story)
    buffer.seek(0)
    
    headers = {
        'Content-Disposition': f'attachment; filename="health_{project.code}.pdf"'
    }
    return StreamingResponse(buffer, headers=headers, media_type="application/pdf")
