from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.orm import Session

from database import get_db


router = APIRouter(
    prefix="/admin/analytics",
    tags=["Admin Analytics"]
)


@router.get("/")
def get_admin_analytics(
    db: Session = Depends(get_db)
):
    try:

        # ============================================================
        # 1. SUMMARY
        # ============================================================

        summary_row = db.execute(
            text("""
                SELECT
                    COUNT(*) AS total,

                    COALESCE(SUM(
                        CASE
                            WHEN LOWER(status) = 'resolved'
                            THEN 1
                            ELSE 0
                        END
                    ), 0) AS resolved,

                    COALESCE(SUM(
                        CASE
                            WHEN LOWER(status) IN ('pending', 'open')
                            THEN 1
                            ELSE 0
                        END
                    ), 0) AS pending,

                    COALESCE(SUM(
                        CASE
                            WHEN LOWER(status) IN (
                                'in_progress',
                                'in progress'
                            )
                            THEN 1
                            ELSE 0
                        END
                    ), 0) AS in_progress,

                    COALESCE(SUM(
                        CASE
                            WHEN LOWER(status) = 'rejected'
                            THEN 1
                            ELSE 0
                        END
                    ), 0) AS rejected

                FROM complaint
            """)
        ).mappings().one()

        total = int(summary_row["total"] or 0)
        resolved = int(summary_row["resolved"] or 0)
        pending = int(summary_row["pending"] or 0)
        in_progress = int(summary_row["in_progress"] or 0)
        rejected = int(summary_row["rejected"] or 0)


        # ============================================================
        # ACTIVE OFFICERS
        # ============================================================

        active_officers = db.execute(
            text("""
                SELECT COUNT(*)
                FROM officer
                WHERE LOWER(status) = 'active'
            """)
        ).scalar() or 0

        active_officers = int(active_officers)


        # ============================================================
        # RESOLUTION RATE
        # ============================================================

        resolution_rate = round(
            (resolved / total) * 100,
            1
        ) if total else 0


        # ============================================================
        # 2. MONTHLY TREND - LAST 6 MONTHS
        # ============================================================

        monthly_rows = db.execute(
            text("""
                SELECT
                    DATE_FORMAT(created_at, '%Y-%m') AS month,

                    COUNT(*) AS complaints,

                    SUM(
                        CASE
                            WHEN LOWER(status) = 'resolved'
                            THEN 1
                            ELSE 0
                        END
                    ) AS resolved

                FROM complaint

                WHERE created_at >= DATE_SUB(
                    CURDATE(),
                    INTERVAL 6 MONTH
                )

                GROUP BY
                    DATE_FORMAT(created_at, '%Y-%m')

                ORDER BY month ASC
            """)
        ).mappings().all()

        monthly_trend = []

        for row in monthly_rows:

            monthly_trend.append({
                "month": row["month"],
                "complaints": int(
                    row["complaints"] or 0
                ),
                "resolved": int(
                    row["resolved"] or 0
                )
            })


        # ============================================================
        # 3. DEPARTMENT PERFORMANCE
        # ============================================================

        department_rows = db.execute(
            text("""
                SELECT
                    department,

                    COUNT(*) AS complaints,

                    SUM(
                        CASE
                            WHEN LOWER(status) = 'resolved'
                            THEN 1
                            ELSE 0
                        END
                    ) AS resolved

                FROM complaint

                WHERE department IS NOT NULL
                AND TRIM(department) != ''

                GROUP BY department

                ORDER BY complaints DESC
            """)
        ).mappings().all()

        departments = []

        for row in department_rows:

            complaints_count = int(
                row["complaints"] or 0
            )

            resolved_count = int(
                row["resolved"] or 0
            )

            rate = round(
                (resolved_count / complaints_count) * 100,
                1
            ) if complaints_count else 0

            departments.append({
                "name": row["department"],
                "complaints": complaints_count,
                "resolved": resolved_count,
                "rate": rate
            })


        # ============================================================
        # 4. TOP PERFORMING DEPARTMENTS
        # ============================================================

        # Only consider departments that have complaints.
        top_departments = sorted(
            departments,
            key=lambda item: (
                item["rate"],
                item["resolved"]
            ),
            reverse=True
        )[:5]


        # ============================================================
        # 5. SEVERITY DISTRIBUTION
        # ============================================================

        severity = []

        try:

            severity_rows = db.execute(
                text("""
                    SELECT
                        severity,
                        COUNT(*) AS count

                    FROM complaint

                    WHERE severity IS NOT NULL
                    AND TRIM(severity) != ''

                    GROUP BY severity

                    ORDER BY count DESC
                """)
            ).mappings().all()

            for row in severity_rows:

                count = int(
                    row["count"] or 0
                )

                percentage = round(
                    (count / total) * 100,
                    1
                ) if total else 0

                severity.append({
                    "name": row["severity"],
                    "value": count,
                    "percentage": percentage
                })

        except Exception as severity_error:

            # If severity column doesn't exist,
            # analytics should still work.
            print(
                "Severity analytics skipped:",
                str(severity_error)
            )

            db.rollback()


        # ============================================================
        # 6. HOTSPOTS
        # ============================================================

        hotspots = []

        try:

            hotspot_rows = db.execute(
                text("""
                    SELECT
                        city,
                        department,
                        COUNT(*) AS complaints

                    FROM complaint

                    WHERE city IS NOT NULL
                    AND TRIM(city) != ''

                    GROUP BY
                        city,
                        department

                    ORDER BY complaints DESC

                    LIMIT 10
                """)
            ).mappings().all()

            for row in hotspot_rows:

                hotspots.append({
                    "area": row["city"],
                    "category": row["department"],
                    "complaints": int(
                        row["complaints"] or 0
                    )
                })

        except Exception as hotspot_error:

            print(
                "Hotspot analytics skipped:",
                str(hotspot_error)
            )

            db.rollback()


        # ============================================================
        # 7. OFFICER PERFORMANCE
        # ============================================================

        officer_performance = []

        try:

            officer_rows = db.execute(
                text("""
                    SELECT
                        o.id,
                        o.full_name,
                        o.department,

                        COUNT(c.id) AS assigned,

                        COALESCE(SUM(
                            CASE
                                WHEN LOWER(c.status) = 'resolved'
                                THEN 1
                                ELSE 0
                            END
                        ), 0) AS resolved

                    FROM officer o

                    LEFT JOIN complaint c
                        ON c.assigned_officer_id = o.id

                    GROUP BY
                        o.id,
                        o.full_name,
                        o.department

                    ORDER BY
                        resolved DESC,
                        assigned DESC

                    LIMIT 10
                """)
            ).mappings().all()

            for row in officer_rows:

                assigned = int(
                    row["assigned"] or 0
                )

                officer_resolved = int(
                    row["resolved"] or 0
                )

                rate = round(
                    (
                        officer_resolved /
                        assigned
                    ) * 100,
                    1
                ) if assigned else 0

                officer_performance.append({
                    "id": row["id"],
                    "name": row["full_name"],
                    "department": row["department"],
                    "assigned": assigned,
                    "resolved": officer_resolved,
                    "rate": rate
                })

        except Exception as officer_error:

            print(
                "Officer analytics skipped:",
                str(officer_error)
            )

            db.rollback()


        # ============================================================
        # 8. AI / ADMIN INSIGHTS
        # ============================================================

        insights = []


        # No complaints
        if total == 0:

            insights.append({
                "type": "info",
                "title": "No complaints available",
                "text": (
                    "There are currently no complaints "
                    "to analyse."
                )
            })

        else:

            # --------------------------------------------------------
            # Lowest performing department
            # --------------------------------------------------------

            if departments:

                lowest_department = min(
                    departments,
                    key=lambda item: item["rate"]
                )

                highest_department = max(
                    departments,
                    key=lambda item: (
                        item["rate"],
                        item["resolved"]
                    )
                )

                insights.append({
                    "type": "warning",
                    "title": (
                        f"{lowest_department['name']} "
                        "needs attention"
                    ),
                    "text": (
                        f"Resolution rate is "
                        f"{lowest_department['rate']}%."
                    )
                })

                insights.append({
                    "type": "success",
                    "title": (
                        f"{highest_department['name']} "
                        "is performing well"
                    ),
                    "text": (
                        f"Highest resolution rate is "
                        f"{highest_department['rate']}%."
                    )
                })


            # --------------------------------------------------------
            # Pending complaints
            # --------------------------------------------------------

            pending_percentage = round(
                (pending / total) * 100,
                1
            )

            if pending_percentage >= 40:

                insights.append({
                    "type": "critical",
                    "title": "High pending workload",
                    "text": (
                        f"{pending} complaints are pending, "
                        f"representing {pending_percentage}% "
                        "of all complaints."
                    )
                })

            elif pending > resolved:

                insights.append({
                    "type": "warning",
                    "title": "Pending complaints exceed resolved",
                    "text": (
                        f"{pending} pending compared with "
                        f"{resolved} resolved complaints."
                    )
                })

            else:

                insights.append({
                    "type": "success",
                    "title": "Resolution performance is healthy",
                    "text": (
                        f"{resolution_rate}% of complaints "
                        "have been resolved."
                    )
                })


        # ============================================================
        # 9. FINAL RESPONSE
        # ============================================================

        return {

            "success": True,

            "summary": {
                "total": total,
                "resolved": resolved,
                "pending": pending,
                "inProgress": in_progress,
                "rejected": rejected,
                "activeOfficers": active_officers,
                "resolutionRate": resolution_rate
            },

            "monthlyTrend": monthly_trend,

            "departments": departments,

            "topDepartments": top_departments,

            "severity": severity,

            "hotspots": hotspots,

            "officerPerformance": officer_performance,

            "insights": insights
        }


    except Exception as e:

        db.rollback()

        print(
            "Admin analytics error:",
            str(e)
        )

        raise HTTPException(
            status_code=500,
            detail="Unable to generate admin analytics"
        )