from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import text
from sqlalchemy.orm import Session

from database import get_db

router = APIRouter(
    prefix="/admin/live-map",
    tags=["Admin Live Map"]
)


# ============================================================
# GET LIVE MAP DATA
# ============================================================

@router.get("/")
def get_live_map(
    status: Optional[str] = Query(None),
    department: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    try:

        conditions = [
            "latitude IS NOT NULL",
            "longitude IS NOT NULL"
        ]

        params = {}

        # ----------------------------------------------------
        # STATUS FILTER
        # ----------------------------------------------------

        if status:

            conditions.append(
                "LOWER(status) = LOWER(:status)"
            )

            params["status"] = status

        # ----------------------------------------------------
        # DEPARTMENT FILTER
        # ----------------------------------------------------

        if department:

            conditions.append(
                "LOWER(department) = LOWER(:department)"
            )

            params["department"] = department

        where_clause = (
            "WHERE " +
            " AND ".join(conditions)
        )

        # ====================================================
        # COMPLAINT LOCATIONS
        # ====================================================

        complaint_rows = db.execute(
            text(f"""
                SELECT
                    id,
                    latitude,
                    longitude,
                    status,
                    department,
                    created_at
                FROM complaint
                {where_clause}
                ORDER BY created_at DESC
            """),
            params
        ).mappings().all()

        complaints = []

        for row in complaint_rows:

            complaints.append({
                "id": row["id"],
                "latitude": float(row["latitude"]),
                "longitude": float(row["longitude"]),
                "status": row["status"],
                "department": row["department"],
                "created_at": (
                    row["created_at"].isoformat()
                    if row["created_at"]
                    else None
                )
            })

        # ====================================================
        # OFFICER LOCATIONS
        # ====================================================
        #
        # This section only works if officer table contains
        # latitude and longitude columns.
        #
        # If your officer table doesn't have these columns,
        # remove this query for now.
        # ====================================================

        officer_rows = db.execute(
            text("""
                SELECT
                    id,
                    full_name,
                    department,
                    designation,
                    status,
                    latitude,
                    longitude
                FROM officer
                WHERE latitude IS NOT NULL
                AND longitude IS NOT NULL
                AND LOWER(status) = 'active'
            """)
        ).mappings().all()

        officers = []

        for row in officer_rows:

            officers.append({
                "id": row["id"],
                "full_name": row["full_name"],
                "department": row["department"],
                "designation": row["designation"],
                "status": row["status"],
                "latitude": float(row["latitude"]),
                "longitude": float(row["longitude"])
            })

        # ====================================================
        # MAP STATISTICS
        # ====================================================

        total = len(complaints)

        pending = sum(
            1
            for c in complaints
            if str(c["status"]).lower()
            in ["pending", "open"]
        )

        in_progress = sum(
            1
            for c in complaints
            if str(c["status"]).lower()
            in [
                "in_progress",
                "in progress"
            ]
        )

        resolved = sum(
            1
            for c in complaints
            if str(c["status"]).lower()
            == "resolved"
        )

        return {
            "success": True,

            "statistics": {
                "total": total,
                "pending": pending,
                "in_progress": in_progress,
                "resolved": resolved,
                "active_officers": len(officers)
            },

            "complaints": complaints,

            "officers": officers
        }

    except Exception as e:

        print(
            "Admin live map error:",
            str(e)
        )

        raise HTTPException(
            status_code=500,
            detail="Unable to load live map data"
        )