from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.orm import Session

from database import get_db

router = APIRouter(
    prefix="/admin/dashboard",
    tags=["Admin Dashboard"]
)


# ============================================================
# ADMIN DASHBOARD
# ============================================================

@router.get("/")
def get_admin_dashboard(
    db: Session = Depends(get_db)
):
    try:

        # ----------------------------------------------------
        # TOTAL COMPLAINTS
        # ----------------------------------------------------

        total_complaints = db.execute(
            text("""
                SELECT COUNT(*)
                FROM complaint
            """)
        ).scalar() or 0


        # ----------------------------------------------------
        # COMPLAINT STATUS
        # ----------------------------------------------------

        status_rows = db.execute(
            text("""
                SELECT
                    status,
                    COUNT(*) AS count
                FROM complaint
                GROUP BY status
            """)
        ).fetchall()

        status = {
            "pending": 0,
            "in_progress": 0,
            "resolved": 0,
            "rejected": 0
        }

        for row in status_rows:

            value = (row.status or "").lower().replace(" ", "_")

            if value in status:
                status[value] = row.count


        # ----------------------------------------------------
        # TOTAL OFFICERS
        # ----------------------------------------------------

        total_officers = db.execute(
            text("""
                SELECT COUNT(*)
                FROM officer
            """)
        ).scalar() or 0


        # ----------------------------------------------------
        # ACTIVE OFFICERS
        # ----------------------------------------------------

        active_officers = db.execute(
            text("""
                SELECT COUNT(*)
                FROM officer
                WHERE LOWER(status) = 'active'
            """)
        ).scalar() or 0


        # ----------------------------------------------------
        # PENDING COMPLAINTS
        # ----------------------------------------------------

        pending_complaints = (
            status["pending"]
            + status["in_progress"]
        )


        # ----------------------------------------------------
        # RESOLUTION RATE
        # ----------------------------------------------------

        if total_complaints > 0:

            resolution_rate = round(
                (
                    status["resolved"]
                    / total_complaints
                ) * 100,
                1
            )

        else:
            resolution_rate = 0


        # ----------------------------------------------------
        # RECENT COMPLAINTS
        # ----------------------------------------------------

        recent_rows = db.execute(
            text("""
                SELECT
                    id,
                    status,
                    created_at
                FROM complaint
                ORDER BY created_at DESC
                LIMIT 5
            """)
        ).fetchall()

        recent_complaints = []

        for row in recent_rows:

            recent_complaints.append({
                "id": row.id,
                "status": row.status,
                "created_at": (
                    row.created_at.isoformat()
                    if row.created_at
                    else None
                )
            })


        # ----------------------------------------------------
        # DEPARTMENT SUMMARY
        # ----------------------------------------------------

        department_rows = db.execute(
            text("""
                SELECT
                    department,
                    COUNT(*) AS complaints
                FROM complaint
                WHERE department IS NOT NULL
                AND department != ''
                GROUP BY department
                ORDER BY complaints DESC
                LIMIT 5
            """)
        ).fetchall()

        departments = []

        for row in department_rows:

            departments.append({
                "department": row.department,
                "complaints": row.complaints
            })


        # ----------------------------------------------------
        # RESPONSE
        # ----------------------------------------------------

        return {
            "success": True,

            "summary": {
                "total_complaints": total_complaints,
                "pending_complaints": pending_complaints,
                "resolved_complaints": status["resolved"],
                "in_progress_complaints": status["in_progress"],
                "rejected_complaints": status["rejected"],
                "resolution_rate": resolution_rate,

                "total_officers": total_officers,
                "active_officers": active_officers
            },

            "recent_complaints": recent_complaints,

            "departments": departments
        }


    except Exception as e:

        print(
            "Admin dashboard error:",
            str(e)
        )

        raise HTTPException(
            status_code=500,
            detail="Unable to load admin dashboard"
        )