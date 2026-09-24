import os
import re
import datetime
import jwt
from flask import Blueprint, request, jsonify, current_app
from database import get_connection

priority_queue_bp = Blueprint("priority_queue", __name__)


def get_secret_key():
    return current_app.config.get("SECRET_KEY", "civicguard-development-secret")


DEPARTMENT_GROUPS = {
    "roads": [
        "road", "roads", "street", "streets", "infrastructure",
        "public works", "works", "transport", "traffic",
        "drainage", "drain", "maintenance", "bridges", "pavement"
    ],
    "electrical": [
        "electric", "electricity", "electrical", "power", "energy",
        "lighting", "street light", "wiring", "transformer", "grid"
    ],
    "water": [
        "water", "sewer", "sewerage", "waste", "garbage", "sanitation",
        "drainage", "drain", "solid waste", "cleanup"
    ],
    "public_safety": [
        "safety", "police", "security", "public safety", "fire"
    ],
    "general": [
        "civic", "municipal", "general", "administration", "services"
    ]
}


def normalize_department(value):
    if not value:
        return ""

    text = str(value).lower()
    text = re.sub(r"[^a-z0-9&+/\s]", " ", text)
    text = re.sub(r"\s+", " ", text).strip()

    ignored_words = {
        "and", "or", "the", "of", "for", "to", "with",
        "department", "dept", "board", "municipal", "corporation",
        "public", "civic", "services", "office", "authority",
        "administration", "division", "management", "service"
    }

    words = [word for word in text.split() if word not in ignored_words]
    return " ".join(words)


def department_domain(value):
    normalized = normalize_department(value)
    if not normalized:
        return "general"

    for domain, aliases in DEPARTMENT_GROUPS.items():
        for alias in aliases:
            if alias in normalized:
                return domain

    return "general"


def department_matches(officer_department, complaint_department):
    if not officer_department and not complaint_department:
        return True

    if not officer_department or not complaint_department:
        return False

    first = department_domain(officer_department)
    second = department_domain(complaint_department)

    if first == second:
        return True

    if normalize_department(officer_department) == normalize_department(complaint_department):
        return True

    officer_norm = normalize_department(officer_department)
    complaint_norm = normalize_department(complaint_department)

    return (
        officer_norm in complaint_norm
        or complaint_norm in officer_norm
        or bool(set(officer_norm.split()) & set(complaint_norm.split()))
    )


def get_authenticated_officer(cursor):
    auth_header = request.headers.get("Authorization")
    officer_id = None

    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.split(" ", 1)[1].strip()
        try:
            payload = jwt.decode(token, get_secret_key(), algorithms=["HS256"])
            officer_id = payload.get("id")
        except (jwt.ExpiredSignatureError, jwt.InvalidTokenError):
            pass

    if not officer_id:
        officer_id = request.args.get("officer_id", type=int)

    if not officer_id:
        cursor.execute("SELECT * FROM officers WHERE status = 'ACTIVE' LIMIT 1")
        return cursor.fetchone()

    cursor.execute("SELECT * FROM officers WHERE officer_id = %s LIMIT 1", (officer_id,))
    return cursor.fetchone()


# ============================================================
# GET OFFICER PRIORITY QUEUE
# ============================================================

@priority_queue_bp.route("/priority-queue", methods=["GET"])
def get_priority_queue():
    conn = None
    cursor = None

    try:
        conn = get_connection()
        cursor = conn.cursor()

        officer = get_authenticated_officer(cursor)
        if not officer:
            return jsonify({"success": False, "message": "Officer authentication required."}), 401

        officer_id = officer["officer_id"]
        department = officer.get("department")

        priority_filter = request.args.get("priority")
        status_filter = request.args.get("status")
        search = request.args.get("search", "").strip()

        conditions = []
        params = []

        # Only assigned complaints or unassigned complaints in the same department domain
        conditions.append("(c.officer_id = %s OR c.officer_id IS NULL)")
        params.append(officer_id)

        if priority_filter and priority_filter.upper() != "ALL":
            conditions.append("UPPER(COALESCE(g.priority, c.priority)) = %s")
            params.append(priority_filter.upper())

        if status_filter and status_filter.upper() != "ALL":
            conditions.append("c.status = %s")
            params.append(status_filter.upper().replace(" ", "_"))

        if search:
            conditions.append("""
                (
                    CAST(c.complaint_id AS CHAR) LIKE %s
                    OR c.title LIKE %s
                    OR c.description LIKE %s
                    OR c.address LIKE %s
                    OR c.category LIKE %s
                    OR g.department LIKE %s
                )
            """)
            search_val = f"%{search}%"
            params.extend([search_val] * 6)

        where_clause = " AND ".join(conditions)

        query = f"""
            SELECT
                c.complaint_id,
                c.user_id,
                c.officer_id,
                c.title,
                c.description,
                c.latitude,
                c.longitude,
                c.address,
                c.category,
                c.status AS complaint_status,
                c.priority AS complaint_priority,
                c.created_at AS complaint_created_at,
                c.updated_at AS complaint_updated_at,
                g.governance_id,
                g.department,
                g.priority AS governance_priority,
                g.sla_hours,
                g.escalation_level,
                g.action,
                g.reason,
                g.status AS governance_status,
                g.created_at AS governance_created_at
            FROM complaints c
            INNER JOIN complaint_governance g ON c.complaint_id = g.complaint_id
            WHERE {where_clause}
            ORDER BY
                CASE
                    WHEN UPPER(COALESCE(g.priority, c.priority)) = 'CRITICAL' THEN 1
                    WHEN UPPER(COALESCE(g.priority, c.priority)) = 'HIGH' THEN 2
                    WHEN UPPER(COALESCE(g.priority, c.priority)) = 'MEDIUM' THEN 3
                    ELSE 4
                END,
                COALESCE(g.escalation_level, 0) DESC,
                c.created_at ASC
        """

        cursor.execute(query, params)
        rows = cursor.fetchall()

        filtered_rows = []
        for row in rows:
            if row.get("officer_id") == officer_id:
                filtered_rows.append(row)
                continue

            complaint_dept = row.get("department")
            if complaint_dept and department_matches(department, complaint_dept):
                filtered_rows.append(row)

        now = datetime.datetime.now()
        complaints = []

        for row in filtered_rows:
            final_priority = (row.get("governance_priority") or row.get("complaint_priority") or "MEDIUM").upper()
            created_at = row.get("complaint_created_at")
            sla_hours = row.get("sla_hours") or 48

            sla_remaining_hours = None
            if created_at and sla_hours:
                elapsed_hours = (now - created_at).total_seconds() / 3600
                sla_remaining_hours = round(float(sla_hours) - elapsed_hours, 2)

            complaints.append({
                "complaint_id": row["complaint_id"],
                "user_id": row["user_id"],
                "officer_id": row.get("officer_id"),
                "assigned_officer_id": row.get("officer_id"),
                "title": row.get("title") or "Civic Complaint",
                "description": row.get("description"),
                "latitude": float(row["latitude"]) if row.get("latitude") is not None else None,
                "longitude": float(row["longitude"]) if row.get("longitude") is not None else None,
                "address": row.get("address"),
                "location": row.get("address"),
                "category": row.get("category") or "General",
                "status": row.get("complaint_status"),
                "priority": final_priority,
                "created_at": created_at.isoformat() if created_at else None,
                "updated_at": row["complaint_updated_at"].isoformat() if row.get("complaint_updated_at") else None,
                "governance_id": row.get("governance_id"),
                "department": row.get("department") or department,
                "sla_hours": sla_hours,
                "sla_remaining_hours": sla_remaining_hours,
                "escalation_level": row.get("escalation_level", 1),
                "action": row.get("action"),
                "reason": row.get("reason"),
                "governance_status": row.get("governance_status"),
                "governance_created_at": row["governance_created_at"].isoformat() if row.get("governance_created_at") else None
            })

        return jsonify({
            "success": True,
            "count": len(complaints),
            "complaints": complaints
        }), 200

    except Exception as e:
        print("Priority Queue Error:", repr(e))
        return jsonify({
            "success": False,
            "message": "Failed to load priority queue.",
            "error": str(e)
        }), 500

    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()