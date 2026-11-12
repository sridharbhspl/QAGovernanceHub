from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import List, Dict, Any
from datetime import datetime, date
from pydantic import BaseModel

from app.core.database import get_db
from app.api.deps import RoleChecker
from app.models.auth import User, Role

router = APIRouter()

class QueryRequest(BaseModel):
    query: str

@router.get("/db/tables")
def get_db_tables(
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker([Role.SUPER_ADMIN]))
):
    """
    Get all table names in the database. Restricted to Super Admin.
    """
    try:
        result = db.execute(text("SHOW TABLES"))
        tables = [row[0] for row in result]
        return {"tables": tables}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch database tables: {str(e)}"
        )

@router.get("/db/schema/{table_name}")
def get_table_schema(
    table_name: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker([Role.SUPER_ADMIN]))
):
    """
    Get the columns and metadata schema for a specific table. Restricted to Super Admin.
    """
    try:
        # Prevent SQL injection by verifying table name against known tables first
        result = db.execute(text("SHOW TABLES"))
        tables = [row[0] for row in result]
        if table_name not in tables:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Table '{table_name}' does not exist in the database."
            )

        columns_res = db.execute(text(f"DESCRIBE `{table_name}`"))
        columns = []
        for row in columns_res:
            columns.append({
                "field": row[0],
                "type": str(row[1]),
                "null": row[2],
                "key": row[3],
                "default": str(row[4]) if row[4] is not None else None,
                "extra": row[5]
            })
        return {"table": table_name, "columns": columns}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch table schema for '{table_name}': {str(e)}"
        )

@router.post("/db/query")
def execute_db_query(
    req: QueryRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker([Role.SUPER_ADMIN]))
):
    """
    Execute read-only SQL queries dynamically and return data in tabular form. Restricted to Super Admin.
    """
    raw_sql = req.query.strip()
    if not raw_sql:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Query string cannot be empty."
        )

    # Safety Guard: Enforce SELECT, SHOW, or DESCRIBE statements only to prevent database modification/deletion
    query_lower = raw_sql.lower()
    allowed_starts = ["select", "show", "describe", "explain"]
    is_allowed = any(query_lower.startswith(start) for start in allowed_starts)

    if not is_allowed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Security Block: Only SELECT, SHOW, DESCRIBE, and EXPLAIN queries are allowed."
        )

    try:
        start_time = datetime.now()
        result = db.execute(text(raw_sql))
        duration_ms = int((datetime.now() - start_time).total_seconds() * 1000)

        if hasattr(result, "returns_rows") and getattr(result, "returns_rows"):
            columns = list(result.keys())
            rows = [list(row) for row in result]
            
            # Format row values (dates, times, decimals, etc.) to be JSON serializable
            formatted_rows = []
            for row in rows:
                formatted_row = []
                for val in row:
                    if isinstance(val, (datetime, date)):
                        formatted_row.append(val.isoformat())
                    elif val is None:
                        formatted_row.append(None)
                    elif type(val).__name__ == 'Decimal':
                        formatted_row.append(float(val))
                    elif isinstance(val, bytes):
                        formatted_row.append(val.decode('utf-8', errors='replace'))
                    else:
                        formatted_row.append(val)
                formatted_rows.append(formatted_row)

            return {
                "columns": columns,
                "rows": formatted_rows,
                "duration_ms": duration_ms,
                "row_count": len(formatted_rows)
            }
        else:
            db.commit()
            return {
                "message": "Query executed successfully. No rows returned.",
                "duration_ms": duration_ms,
                "row_count": 0
            }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"SQL Query Execution Error: {str(e)}"
        )


@router.get("/system/ports")
def get_system_ports(
    current_user: User = Depends(RoleChecker([Role.SUPER_ADMIN]))
):
    """
    Get active network ports on the server. Restricted to Super Admin.
    """
    import platform
    import subprocess

    system = platform.system()
    try:
        if system == "Windows":
            result = subprocess.run(["netstat", "-ano"], capture_output=True, text=True, check=True)
            output = result.stdout
        else:
            result = subprocess.run(["netstat", "-an"], capture_output=True, text=True, check=True)
            output = result.stdout

        lines = output.strip().split("\n")
        connections = []
        for line in lines:
            line_str = line.strip()
            if not line_str:
                continue
            parts = line_str.split()
            if len(parts) < 4:
                continue
            proto = parts[0].upper()
            if proto not in ("TCP", "UDP"):
                continue

            # Extract fields
            local_address = parts[1]
            foreign_address = parts[2]

            state = ""
            pid = ""
            if len(parts) == 5:
                state = parts[3]
                pid = parts[4]
            elif len(parts) == 4:
                if parts[3].isdigit():
                    pid = parts[3]
                else:
                    state = parts[3]

            connections.append({
                "proto": proto,
                "local_address": local_address,
                "foreign_address": foreign_address,
                "state": state,
                "pid": pid
            })
        return {"connections": connections}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch network ports: {str(e)}"
        )

