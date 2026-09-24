import os
import re
import datetime
import jwt
from flask import Blueprint, request, jsonify, current_app
from database import get_connection

ai_analysis_bp = Blueprint("ai_analysis", __name__)


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
# GET AI ANALYSIS
# ============================================================

@ai_analysis_bp.route("/ai-analysis", methods=["GET"])
def get_ai_analysis():
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

        complaint_id = request.args.get("complaint_id", type=int)
        search = request.args.get("search", "").strip()
        severity = request.args.get("severity")

        conditions = []
        params = []

        # Only show assigned complaints or unassigned complaints in officer's department
        conditions.append("(c.officer_id = %s OR c.officer_id IS NULL)")
        params.append(officer_id)

        if complaint_id:
            conditions.append("c.complaint_id = %s")
            params.append(complaint_id)

        if search:
            conditions.append("""
                (
                    CAST(c.complaint_id AS CHAR) LIKE %s
                    OR c.title LIKE %s
                    OR c.description LIKE %s
                    OR c.category LIKE %s
                    OR c.address LIKE %s
                )
            """)
            search_val = f"%{search}%"
            params.extend([search_val] * 5)

        if severity and severity.upper() != "ALL":
            conditions.append("UPPER(COALESCE(g.priority, c.priority)) = %s")
            params.append(severity.upper())

        where_clause = " AND ".join(conditions)

        query = f"""
            SELECT
                c.complaint_id,
                c.user_id,
                c.officer_id,
                c.title,
                c.category,
                c.description,
                c.address,
                c.latitude,
                c.longitude,
                c.status,
                c.priority AS complaint_priority,
                c.created_at,
                c.updated_at,
                g.governance_id,
                g.department,
                g.priority AS governance_priority,
                g.sla_hours,
                g.escalation_level,
                g.action,
                g.reason,
                g.status AS governance_status,
                g.created_at AS analysis_created_at
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
                c.created_at DESC
        """

        cursor.execute(query, params)
        all_rows = cursor.fetchall()

        # Filter by department using semantic matching
        filtered_rows = []
        for row in all_rows:
            # If assigned to officer, include it
            if row.get("officer_id") == officer_id:
                filtered_rows.append(row)
                continue
            
            # If not assigned, check department match
            complaint_dept = row.get("department")
            if complaint_dept and department_matches(department, complaint_dept):
                filtered_rows.append(row)

        analyses = []
        for row in filtered_rows:
            priority_val = (row.get("governance_priority") or row.get("complaint_priority") or "MEDIUM").upper()
            risk_pct = 95 if priority_val == "CRITICAL" else 80 if priority_val == "HIGH" else 50 if priority_val == "MEDIUM" else 25

            # Synthesize smart keyword list based on category & description
            desc = (row.get("description") or "").lower()
            cat = (row.get("category") or "").lower()
            keywords = []
            if "road" in desc or "pothole" in desc or "road" in cat:
                keywords.extend(["Road Damage", "Traffic Safety", "Infrastructure"])
            if "water" in desc or "pipe" in desc or "water" in cat:
                keywords.extend(["Water Supply", "Pipe Leakage", "Public Utility"])
            if "electric" in desc or "wire" in desc or "pole" in desc or "light" in desc:
                keywords.extend(["Electrical Hazard", "Public Safety", "High Voltage"])
            if "garbage" in desc or "waste" in desc or "sanitation" in cat:
                keywords.extend(["Sanitation", "Waste Management", "Public Health"])
            if not keywords:
                keywords = [row.get("category", "Civic Issue"), f"Priority {priority_val.capitalize()}", "Governance Routed"]

            analyses.append({
                "complaint_id": row["complaint_id"],
                "user_id": row["user_id"],
                "officer_id": row.get("officer_id"),
                "assigned_officer_id": row.get("officer_id"),
                "title": row.get("title") or f"{row.get('category', 'Civic')} Complaint",
                "category": row.get("category") or "General",
                "description": row.get("description"),
                "location": row.get("address"),
                "address": row.get("address"),
                "latitude": float(row["latitude"]) if row.get("latitude") is not None else None,
                "longitude": float(row["longitude"]) if row.get("longitude") is not None else None,
                "status": row.get("status"),
                "severity": priority_val,
                "priority": priority_val.capitalize(),
                "risk_score": risk_pct / 100.0,
                "risk_percentage": risk_pct,
                "risk_type": f"{priority_val} Severity Risk Assessment",
                "confidence": "95%",
                "keywords": keywords,
                "risk_assessment": f"AI identified this as a {priority_val} severity issue. {row.get('reason', '')}",
                "analysis": f"Automated governance review by Agent 2 assigned to {row.get('department', 'Department')}. Recommended SLA: {row.get('sla_hours', 48)} hours.",
                "recommendation": row.get("action") or "Field inspection and priority resolution.",
                "governance_recommendation": row.get("action"),
                "suggested_action": row.get("action"),
                "ai_analysis": row.get("reason"),
                "department": row.get("department"),
                "sla_hours": row.get("sla_hours"),
                "escalation_level": row.get("escalation_level"),
                "created_at": row["created_at"].isoformat() if row.get("created_at") else None,
                "updated_at": row["updated_at"].isoformat() if row.get("updated_at") else None,
                "analysis_created_at": row["analysis_created_at"].isoformat() if row.get("analysis_created_at") else None
            })

        return jsonify({
            "success": True,
            "count": len(analyses),
            "analyses": analyses
        }), 200

    except Exception as e:
        print("AI Analysis API Error:", repr(e))
        return jsonify({
            "success": False,
            "message": "Failed to load AI analysis.",
            "error": str(e)
        }), 500

    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()