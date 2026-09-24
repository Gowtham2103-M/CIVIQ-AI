import re
from flask import Blueprint, jsonify
from database import get_connection

department_bp = Blueprint("department", __name__)


DEPARTMENT_GROUPS = {
    "roads": [
        "road", "roads", "street", "streets", "infrastructure",
        "public works", "works", "maintenance", "bridges", "pavement",
        "road maintenance", "roads and infrastructure"
    ],
    "electrical": [
        "electric", "electricity", "electrical", "power", "energy",
        "lighting", "street light", "wiring", "transformer", "grid",
        "electrical supply", "power and lighting"
    ],
    "water": [
        "water", "water supply", "water and sewer", "sewer", "sewerage",
        "pipe", "pipeline", "water line", "water management"
    ],
    "sanitation": [
        "sanitation", "waste", "garbage", "solid waste", "waste management",
        "sanitation and waste management", "cleanup", "refuse"
    ],
    "drainage": [
        "drainage", "drain", "storm water", "drains", "rainwater drainage"
    ],
    "parks": [
        "park", "parks", "public spaces", "green space", "landscaping",
        "parks and public spaces"
    ],
    "traffic": [
        "traffic", "transport", "transportation", "traffic and transport",
        "road safety", "mobility"
    ],
    "municipal_services": [
        "municipal", "municipal services", "civic services", "city services",
        "general administration", "public services", "service delivery"
    ],
    "public_health": [
        "public health", "health", "healthcare", "medical", "clinic"
    ],
    "fire": [
        "fire", "fire and emergency services", "emergency services", "rescue",
        "public safety", "safety", "police", "security"
    ],
    "building": [
        "building", "urban planning", "building and urban planning", "construction",
        "planning", "architecture"
    ],
    "environment": [
        "environment", "environmental", "ecology", "green", "air pollution",
        "hazardous waste", "tree cutting"
    ],
    "general": [
        "civic", "general", "administration", "services", "department"
    ]
}

ALL_DEPARTMENTS = [
    "Roads & Infrastructure",
    "Water Supply",
    "Electrical",
    "Sanitation & Waste Management",
    "Drainage",
    "Parks & Public Spaces",
    "Traffic & Transport",
    "Municipal Services",
    "Public Health",
    "Fire & Emergency Services",
    "Building & Urban Planning",
    "Environment",
]


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


def canonical_department_name(value):
    domain = department_domain(value)
    if domain == "roads":
        return "Roads & Infrastructure"
    if domain == "electrical":
        return "Electrical"
    if domain == "water":
        return "Water Supply"
    if domain == "sanitation":
        return "Sanitation & Waste Management"
    if domain == "drainage":
        return "Drainage"
    if domain == "parks":
        return "Parks & Public Spaces"
    if domain == "traffic":
        return "Traffic & Transport"
    if domain == "municipal_services":
        return "Municipal Services"
    if domain == "public_health":
        return "Public Health"
    if domain == "fire":
        return "Fire & Emergency Services"
    if domain == "building":
        return "Building & Urban Planning"
    if domain == "environment":
        return "Environment"
    return "Municipal Services"


# ============================================================
# GET DEPARTMENT SUMMARY
# ============================================================

@department_bp.route("/departments", methods=["GET"])
def get_departments():
    conn = None
    cursor = None

    try:
        conn = get_connection()
        cursor = conn.cursor()

        query = """
            SELECT
                g.complaint_id,
                g.department,
                g.priority,
                g.sla_hours,
                g.escalation_level,
                c.status
            FROM complaint_governance g
            INNER JOIN complaints c ON c.complaint_id = g.complaint_id
            WHERE g.department IS NOT NULL AND TRIM(g.department) != ''
            ORDER BY g.department ASC, g.complaint_id ASC
        """

        cursor.execute(query)
        rows = cursor.fetchall()

        grouped = {}
        for dept_name in ALL_DEPARTMENTS:
            grouped[dept_name] = {
                "department": dept_name,
                "total_complaints": 0,
                "critical_count": 0,
                "high_count": 0,
                "medium_count": 0,
                "low_count": 0,
                "pending_count": 0,
                "resolved_count": 0,
                "sla_total": 0,
                "escalation_max": 0,
                "complaint_ids": set(),
            }

        for row in rows:
            complaint_id = row.get("complaint_id")
            raw_department = row.get("department") or "General Services"
            dept_name = canonical_department_name(raw_department)

            if dept_name not in grouped:
                grouped[dept_name] = {
                    "department": dept_name,
                    "total_complaints": 0,
                    "critical_count": 0,
                    "high_count": 0,
                    "medium_count": 0,
                    "low_count": 0,
                    "pending_count": 0,
                    "resolved_count": 0,
                    "sla_total": 0,
                    "escalation_max": 0,
                    "complaint_ids": set(),
                }

            bucket = grouped[dept_name]
            if complaint_id not in bucket["complaint_ids"]:
                bucket["complaint_ids"].add(complaint_id)
                bucket["total_complaints"] += 1

                priority_value = str(row.get("priority") or "").upper()
                if priority_value == "CRITICAL":
                    bucket["critical_count"] += 1
                elif priority_value == "HIGH":
                    bucket["high_count"] += 1
                elif priority_value == "MEDIUM":
                    bucket["medium_count"] += 1
                elif priority_value == "LOW":
                    bucket["low_count"] += 1

                status_value = str(row.get("status") or "").upper()
                if status_value in {"SUBMITTED", "AI_ANALYZED", "UNDER_REVIEW", "ASSIGNED", "IN_PROGRESS"}:
                    bucket["pending_count"] += 1
                elif status_value in {"RESOLVED", "CLOSED"}:
                    bucket["resolved_count"] += 1

                sla_hours = row.get("sla_hours")
                if sla_hours is not None:
                    bucket["sla_total"] += float(sla_hours)

                escalation_level = row.get("escalation_level")
                if escalation_level is not None:
                    bucket["escalation_max"] = max(int(bucket["escalation_max"]), int(escalation_level))

        departments = []
        for dept_name in ALL_DEPARTMENTS:
            data = grouped.get(dept_name, {
                "department": dept_name,
                "total_complaints": 0,
                "critical_count": 0,
                "high_count": 0,
                "medium_count": 0,
                "low_count": 0,
                "pending_count": 0,
                "resolved_count": 0,
                "sla_total": 0,
                "escalation_max": 0,
            })
            total = data["total_complaints"]
            avg_sla_hours = (data["sla_total"] / total) if total else 48.0
            departments.append({
                "department": dept_name,
                "total_complaints": total,
                "critical_count": data["critical_count"],
                "high_count": data["high_count"],
                "medium_count": data["medium_count"],
                "low_count": data["low_count"],
                "pending_count": data["pending_count"],
                "resolved_count": data["resolved_count"],
                "avg_sla_hours": round(avg_sla_hours, 1),
                "max_escalation_level": data["escalation_max"] or 1,
            })

        departments.sort(key=lambda item: (-item["total_complaints"], item["department"]))

        return jsonify({
            "success": True,
            "count": len(departments),
            "departments": departments
        }), 200

    except Exception as e:
        print("Department API Error:", repr(e))
        return jsonify({
            "success": False,
            "message": "Failed to load department data.",
            "error": str(e)
        }), 500

    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()