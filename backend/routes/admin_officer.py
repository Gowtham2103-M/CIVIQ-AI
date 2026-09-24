from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import text
from sqlalchemy.orm import Session
from pydantic import BaseModel

from database import get_db

router = APIRouter(
    prefix="/admin/officers",
    tags=["Admin Officers"]
)


# ============================================================
# REQUEST MODEL
# ============================================================

class OfficerStatusUpdate(BaseModel):
    status: str


# ============================================================
# GET OFFICERS
# ============================================================

@router.get("/")
def get_officers(
    search: Optional[str] = Query(None),
    department: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
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
        # SEARCH
        # ----------------------------------------------------

        if search:

            conditions.append("""
                (
                    full_name LIKE :search
                    OR email LIKE :search
                    OR phone LIKE :search
                    OR employee_code LIKE :search
                )
            """)

            params["search"] = f"%{search}%"

        # ----------------------------------------------------
        # DEPARTMENT FILTER
        # ----------------------------------------------------

        if department:

            conditions.append(
                "LOWER(department) = LOWER(:department)"
            )

            params["department"] = department

        # ----------------------------------------------------
        # STATUS FILTER
        # ----------------------------------------------------

        if status:

            conditions.append(
                "LOWER(status) = LOWER(:status)"
            )

            params["status"] = status

        # ----------------------------------------------------
        # WHERE CLAUSE
        # ----------------------------------------------------

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
                FROM officer
                {where_clause}
            """),
            params
        ).scalar() or 0

        # ----------------------------------------------------
        # OFFICERS
        # ----------------------------------------------------

        rows = db.execute(
            text(f"""
                SELECT
                    id,
                    full_name,
                    email,
                    phone,
                    city,
                    district,
                    state,
                    pincode,
                    department,
                    designation,
                    employee_code,
                    status,
                    last_login
                FROM officer
                {where_clause}
                ORDER BY full_name ASC
                LIMIT :limit
                OFFSET :offset
            """),
            params
        ).mappings().all()

        officers = []

        for row in rows:

            officers.append({
                "id": row["id"],
                "full_name": row["full_name"],
                "email": row["email"],
                "phone": row["phone"],
                "city": row["city"],
                "district": row["district"],
                "state": row["state"],
                "pincode": row["pincode"],
                "department": row["department"],
                "designation": row["designation"],
                "employee_code": row["employee_code"],
                "status": row["status"],
                "last_login": (
                    row["last_login"].isoformat()
                    if row["last_login"]
                    else None
                )
            })

        return {
            "success": True,
            "total": total,
            "page": page,
            "limit": limit,
            "officers": officers
        }

    except Exception as e:

        print(
            "Admin officers error:",
            str(e)
        )

        raise HTTPException(
            status_code=500,
            detail="Unable to load officers"
        )


# ============================================================
# GET SINGLE OFFICER
# ============================================================

@router.get("/{officer_id}")
def get_officer(
    officer_id: int,
    db: Session = Depends(get_db)
):

    try:

        row = db.execute(
            text("""
                SELECT
                    id,
                    full_name,
                    email,
                    phone,
                    address,
                    city,
                    district,
                    state,
                    pincode,
                    department,
                    designation,
                    employee_code,
                    status,
                    last_login
                FROM officer
                WHERE id = :id
            """),
            {
                "id": officer_id
            }
        ).mappings().first()

        if not row:

            raise HTTPException(
                status_code=404,
                detail="Officer not found"
            )

        officer = dict(row)

        if officer["last_login"]:

            officer["last_login"] = (
                officer["last_login"].isoformat()
            )

        return {
            "success": True,
            "officer": officer
        }

    except HTTPException:
        raise

    except Exception as e:

        print(
            "Officer details error:",
            str(e)
        )

        raise HTTPException(
            status_code=500,
            detail="Unable to load officer"
        )


# ============================================================
# UPDATE OFFICER STATUS
# ============================================================

@router.patch("/{officer_id}/status")
def update_officer_status(
    officer_id: int,
    data: OfficerStatusUpdate,
    db: Session = Depends(get_db)
):

    allowed_statuses = {
        "active",
        "inactive",
        "suspended"
    }

    new_status = data.status.lower().strip()

    if new_status not in allowed_statuses:

        raise HTTPException(
            status_code=400,
            detail="Invalid officer status"
        )

    try:

        result = db.execute(
            text("""
                UPDATE officer
                SET status = :status
                WHERE id = :id
            """),
            {
                "status": new_status,
                "id": officer_id
            }
        )

        if result.rowcount == 0:

            raise HTTPException(
                status_code=404,
                detail="Officer not found"
            )

        db.commit()

        return {
            "success": True,
            "message": "Officer status updated",
            "officer_id": officer_id,
            "status": new_status
        }

    except HTTPException:

        db.rollback()
        raise

    except Exception as e:

        db.rollback()

        print(
            "Officer status update error:",
            str(e)
        )

        raise HTTPException(
            status_code=500,
            detail="Unable to update officer status"
        )