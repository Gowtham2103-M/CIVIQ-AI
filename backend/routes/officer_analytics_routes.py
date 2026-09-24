import re
from flask import Blueprint, jsonify
from database import get_connection

officer_analytics_bp = Blueprint("officer_analytics", __name__)

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
# GET OFFICER ANALYTICS
# ============================================================

@officer_analytics_bp.route("/analytics", methods=["GET"])
def get_analytics():
    conn = None
    cursor = None

    try:
        conn = get_connection()
        cursor = conn.cursor()

        # Total Complaints
        cursor.execute("SELECT COUNT(*) AS total FROM complaints")
        total_complaints = cursor.fetchone()["total"]

        # Status Summary
        cursor.execute("""
            SELECT status, COUNT(*) AS count
            FROM complaints
            GROUP BY status
        """)
        status_rows = cursor.fetchall()
        status_summary = {
            "SUBMITTED": 0,
            "AI_ANALYZED": 0,
            "UNDER_REVIEW": 0,
            "ASSIGNED": 0,
            "IN_PROGRESS": 0,
            "RESOLVED": 0,
            "CLOSED": 0,
            "REJECTED": 0
        }
        for r in status_rows:
            if r["status"]:
                status_summary[r["status"].upper()] = int(r["count"])

        # Priority Summary (coalesce governance priority and complaint priority)
        cursor.execute("""
            SELECT
                UPPER(COALESCE(g.priority, c.priority, 'MEDIUM')) AS priority_level,
                COUNT(*) AS count
            FROM complaints c
            LEFT JOIN complaint_governance g ON c.complaint_id = g.complaint_id
            GROUP BY priority_level
        """)
        priority_rows = cursor.fetchall()
        priority_summary = {
            "LOW": 0,
            "MEDIUM": 0,
            "HIGH": 0,
            "CRITICAL": 0
        }
        for r in priority_rows:
            p = (r["priority_level"] or "MEDIUM").upper()
            if p in priority_summary:
                priority_summary[p] = int(r["count"])

        # Department Summary
        cursor.execute("""
            SELECT
                g.complaint_id,
                g.department,
                c.status,
                COALESCE(g.priority, c.priority) AS complaint_priority
            FROM complaint_governance g
            INNER JOIN complaints c ON c.complaint_id = g.complaint_id
            WHERE g.department IS NOT NULL AND TRIM(g.department) != ''
            ORDER BY g.department ASC, g.complaint_id ASC
        """)
        dept_rows = cursor.fetchall()

        grouped = {}
        for dept_name in ALL_DEPARTMENTS:
            grouped[dept_name] = {
                "department": dept_name,
                "total": 0,
                "assigned": 0,
                "in_progress": 0,
                "resolved": 0,
                "closed": 0,
                "complaint_ids": set(),
            }

        for row in dept_rows:
            raw_department = row.get("department") or "General Services"
            dept_name = canonical_department_name(raw_department)

            if dept_name not in grouped:
                grouped[dept_name] = {
                    "department": dept_name,
                    "total": 0,
                    "assigned": 0,
                    "in_progress": 0,
                    "resolved": 0,
                    "closed": 0,
                    "complaint_ids": set(),
                }

            complaint_id = row.get("complaint_id")
            bucket = grouped[dept_name]
            if complaint_id not in bucket["complaint_ids"]:
                bucket["complaint_ids"].add(complaint_id)
                bucket["total"] += 1

                status_value = str(row.get("status") or "").upper()
                if status_value in {"ASSIGNED", "SUBMITTED", "UNDER_REVIEW"}:
                    bucket["assigned"] += 1
                elif status_value == "IN_PROGRESS":
                    bucket["in_progress"] += 1
                elif status_value in {"RESOLVED"}:
                    bucket["resolved"] += 1
                elif status_value in {"CLOSED"}:
                    bucket["closed"] += 1

        department_summary = []
        for dept_name in ALL_DEPARTMENTS:
            data = grouped.get(dept_name, {
                "department": dept_name,
                "total": 0,
                "assigned": 0,
                "in_progress": 0,
                "resolved": 0,
                "closed": 0,
            })
            department_summary.append({
                "department": dept_name,
                "total": int(data["total"] or 0),
                "assigned": int(data["assigned"] or 0),
                "in_progress": int(data["in_progress"] or 0),
                "resolved": int(data["resolved"] or 0),
                "closed": int(data["closed"] or 0)
            })

        department_summary.sort(key=lambda item: (-item["total"], item["department"]))

        # Monthly Summary Trend (Last 6 Months)
        cursor.execute("""
            SELECT
                DATE_FORMAT(created_at, '%b %Y') AS month_name,
                COUNT(*) AS count
            FROM complaints
            WHERE created_at IS NOT NULL
            GROUP BY DATE_FORMAT(created_at, '%Y-%m'), DATE_FORMAT(created_at, '%b %Y')
            ORDER BY MIN(created_at) ASC
            LIMIT 12
        """)
        monthly_rows = cursor.fetchall()
        monthly_summary = [
            {"month": r["month_name"], "count": int(r["count"])}
            for r in monthly_rows
        ]

        if not monthly_summary:
            monthly_summary = [{"month": "Current", "count": total_complaints}]

        # Governance Totals
        cursor.execute("""
            SELECT
                COUNT(*) AS gov_total,
                SUM(CASE WHEN status = 'ASSIGNED' THEN 1 ELSE 0 END) AS gov_assigned,
                SUM(CASE WHEN escalation_level > 1 THEN 1 ELSE 0 END) AS gov_escalated
            FROM complaint_governance
        """)
        gov_row = cursor.fetchone()
        governance_total = int(gov_row["gov_total"] or 0)
        governance_assigned = int(gov_row["gov_assigned"] or 0)
        governance_escalated = int(gov_row["gov_escalated"] or 0)

        return jsonify({
            "success": True,
            "total_complaints": total_complaints,
            "status_summary": status_summary,
            "priority_summary": priority_summary,
            "department_summary": department_summary,
            "monthly_summary": monthly_summary,
            "governance_total": governance_total,
            "governance_assigned": governance_assigned,
            "governance_escalated": governance_escalated
        }), 200

    except Exception as e:
        print("Analytics API Error:", repr(e))
        return jsonify({
            "success": False,
            "message": "Failed to load analytics.",
            "error": str(e)
        }), 500

    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()
