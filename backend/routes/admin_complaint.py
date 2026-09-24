from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import text
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional

from database import get_db

router = APIRouter(
    prefix="/admin/complaints",
    tags=["Admin Complaints"]
)


# ============================================================
# UPDATE MODEL
# ============================================================

class ComplaintStatusUpdate(BaseModel):
    status: str


# ============================================================
# GET COMPLAINTS
# ============================================================

@router.get("/")
def get_complaints(
    status: Optional[str] = Query(None),
    department: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db)
):
    try:

        offset = (page - 1) * limit

        conditions = []
        params = {
            "limit": limit,
            "offset": offset
        }

        # ----------------------------------------------------
        # FILTERS
        # ----------------------------------------------------

        if status:
            conditions.append(
                "LOWER(status) = LOWER(:status)"
            )
            params["status"] = status

        if department:
            conditions.append(
                "LOWER(department) = LOWER(:department)"
            )
            params["department"] = department

        if search:
            conditions.append(
                "CAST(id AS CHAR) LIKE :search"
            )
            params["search"] = f"%{search}%"

        where_clause = ""

        if conditions:
            where_clause = (
                "WHERE " +
                " AND ".join(conditions)
            )

        # ----------------------------------------------------
        # TOTAL
        # ----------------------------------------------------

        total = db.execute(
            text(f"""
                SELECT COUNT(*)
                FROM complaint
                {where_clause}
            """),
            params
        ).scalar() or 0

        # ----------------------------------------------------
        # COMPLAINTS
        # ----------------------------------------------------

        rows = db.execute(
            text(f"""
                SELECT
                    id,
                    status,
                    department,
                    created_at
                FROM complaint
                {where_clause}
                ORDER BY created_at DESC
                LIMIT :limit
                OFFSET :offset
            """),
            params
        ).fetchall()

        complaints = []

        for row in rows:

            complaints.append({
                "id": row.id,
                "status": row.status,
                "department": row.department,
                "created_at": (
                    row.created_at.isoformat()
                    if row.created_at
                    else None
                )
            })

        return {
            "success": True,
            "total": total,
            "page": page,
            "limit": limit,
            "complaints": complaints
        }

    except Exception as e:

        print(
            "Admin complaints error:",
            str(e)
        )

        raise HTTPException(
            status_code=500,
            detail="Unable to load complaints"
        )


# ============================================================
# GET SINGLE COMPLAINT
# ============================================================

@router.get("/{complaint_id}")
def get_complaint(
    complaint_id: int,
    db: Session = Depends(get_db)
):

    try:

        row = db.execute(
            text("""
                SELECT
                    *
                FROM complaint
                WHERE id = :id
            """),
            {
                "id": complaint_id
            }
        ).mappings().first()

        if not row:
            raise HTTPException(
                status_code=404,
                detail="Complaint not found"
            )

        return {
            "success": True,
            "complaint": dict(row)
        }

    except HTTPException:
        raise

    except Exception as e:

        print(
            "Complaint details error:",
            str(e)
        )

        raise HTTPException(
            status_code=500,
            detail="Unable to load complaint"
        )


# ============================================================
# UPDATE COMPLAINT STATUS
# ============================================================

@router.patch("/{complaint_id}/status")
def update_complaint_status(
    complaint_id: int,
    data: ComplaintStatusUpdate,
    db: Session = Depends(get_db)
):

    allowed_statuses = {
        "pending",
        "in_progress",
        "resolved",
        "rejected"
    }

    new_status = data.status.lower().strip()

    if new_status not in allowed_statuses:
        raise HTTPException(
            status_code=400,
            detail="Invalid complaint status"
        )

    try:

        result = db.execute(
            text("""
                UPDATE complaint
                SET status = :status
                WHERE id = :id
            """),
            {
                "status": new_status,
                "id": complaint_id
            }
        )

        if result.rowcount == 0:
            raise HTTPException(
                status_code=404,
                detail="Complaint not found"
            )

        db.commit()

        return {
            "success": True,
            "message": "Complaint status updated",
            "complaint_id": complaint_id,
            "status": new_status
        }

    except HTTPException:
        db.rollback()
        raise

    except Exception as e:

        db.rollback()

        print(
            "Status update error:",
            str(e)
        )

        raise HTTPException(
            status_code=500,
            detail="Unable to update complaint"
        )