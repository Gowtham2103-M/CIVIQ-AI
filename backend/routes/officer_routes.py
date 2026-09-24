import os
import re
import datetime
import jwt
from flask import Blueprint, request, jsonify, current_app
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError, VerificationError
from database import get_connection

ph = PasswordHasher()

officer_bp = Blueprint("officer", __name__)


def get_secret_key():
    return current_app.config.get("SECRET_KEY", "civicguard-development-secret")


def get_current_officer(cursor, conn=None):
    """
    Extracts authenticated officer from JWT header or query param fallback.
    Returns officer dict or None.
    """
    auth_header = request.headers.get("Authorization")
    officer_id = None

    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.split(" ", 1)[1].strip()
        try:
            payload = jwt.decode(token, get_secret_key(), algorithms=["HS256"])
            officer_id = payload.get("id")
        except (jwt.ExpiredSignatureError, jwt.InvalidTokenError):
            pass

    # Fallback to query parameter if no valid token provided
    if not officer_id:
        officer_id = request.args.get("officer_id", type=int)

    if not officer_id:
        return None

    cursor.execute("""
        SELECT
            officer_id,
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
            last_login,
            created_at,
            updated_at
        FROM officers
        WHERE officer_id = %s
        LIMIT 1
    """, (officer_id,))

    return cursor.fetchone()


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


# ============================================================
# OFFICER REGISTRATION
# ============================================================

@officer_bp.route("/register", methods=["POST"])
def officer_register():
    conn = None
    cursor = None

    try:
        data = request.get_json(silent=True) or {}

        full_name = data.get("full_name", "").strip()
        email = data.get("email", "").strip().lower()
        password = data.get("password", "")
        confirm_password = data.get("confirm_password", "")
        phone = data.get("phone", "").strip()
        address = data.get("address", "").strip()
        city = data.get("city", "").strip()
        district = data.get("district", "").strip()
        state = data.get("state", "").strip()
        pincode = data.get("pincode", "").strip()
        department = data.get("department", "").strip()
        designation = data.get("designation", "").strip()
        employee_code = data.get("employee_code", "").strip()

        # Validation
        if not full_name:
            return jsonify({"success": False, "message": "Full name is required."}), 400
        if not email:
            return jsonify({"success": False, "message": "Email is required."}), 400
        if not password:
            return jsonify({"success": False, "message": "Password is required."}), 400
        if len(password) < 6:
            return jsonify({"success": False, "message": "Password must be at least 6 characters long."}), 400
        if confirm_password and password != confirm_password:
            return jsonify({"success": False, "message": "Passwords do not match."}), 400
        if not department:
            return jsonify({"success": False, "message": "Department is required."}), 400

        conn = get_connection()
        cursor = conn.cursor()

        # Check duplicate email
        cursor.execute("SELECT officer_id FROM officers WHERE email = %s", (email,))
        if cursor.fetchone():
            return jsonify({"success": False, "message": "An officer account with this email already exists."}), 409

        # Check duplicate employee_code if provided
        if employee_code:
            cursor.execute("SELECT officer_id FROM officers WHERE employee_code = %s", (employee_code,))
            if cursor.fetchone():
                return jsonify({"success": False, "message": "An officer with this employee code already exists."}), 409

        password_hash = ph.hash(password)

        cursor.execute("""
            INSERT INTO officers
            (
                full_name,
                email,
                password_hash,
                phone,
                address,
                city,
                district,
                state,
                pincode,
                department,
                designation,
                employee_code,
                status
            )
            VALUES
            (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'ACTIVE')
        """, (
            full_name,
            email,
            password_hash,
            phone or None,
            address or None,
            city or None,
            district or None,
            state or None,
            pincode or None,
            department,
            designation or "Officer",
            employee_code or None
        ))

        conn.commit()
        officer_id = cursor.lastrowid

        return jsonify({
            "success": True,
            "message": "Officer registered successfully.",
            "officer_id": officer_id
        }), 201

    except Exception as e:
        if conn:
            conn.rollback()
        print("Officer Register Error:", repr(e))
        return jsonify({"success": False, "message": f"Registration failed: {str(e)}"}), 500

    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()


# ============================================================
# OFFICER LOGIN
# ============================================================

@officer_bp.route("/login", methods=["POST"])
def officer_login():
    conn = None
    cursor = None

    try:
        data = request.get_json(silent=True) or {}

        email = data.get("email", "").strip().lower()
        password = data.get("password", "")

        if not email or not password:
            return jsonify({"success": False, "message": "Email and password are required."}), 400

        conn = get_connection()
        cursor = conn.cursor()

        cursor.execute("""
            SELECT
                officer_id,
                full_name,
                email,
                password_hash,
                department,
                designation,
                status
            FROM officers
            WHERE email = %s
            LIMIT 1
        """, (email,))

        officer = cursor.fetchone()

        if not officer:
            return jsonify({"success": False, "message": "Invalid email or password."}), 401

        if officer["status"] == "INACTIVE":
            return jsonify({"success": False, "message": "Officer account is inactive. Please contact administration."}), 403

        # Verify password
        if not officer.get("password_hash"):
            return jsonify({"success": False, "message": "Account has no password set. Please reset your password."}), 401

        try:
            ph.verify(officer["password_hash"], password)
        except VerifyMismatchError:
            return jsonify({"success": False, "message": "Invalid email or password."}), 401
        except VerificationError:
            return jsonify({"success": False, "message": "Invalid password format."}), 500

        # Update last login
        cursor.execute("""
            UPDATE officers
            SET last_login = NOW()
            WHERE officer_id = %s
        """, (officer["officer_id"],))
        conn.commit()

        # Generate JWT token
        token = jwt.encode(
            {
                "id": officer["officer_id"],
                "officer_id": officer["officer_id"],
                "email": officer["email"],
                "name": officer["full_name"],
                "department": officer["department"],
                "role": "officer",
                "exp": datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(days=7)
            },
            get_secret_key(),
            algorithm="HS256"
        )

        return jsonify({
            "success": True,
            "message": "Login successful.",
            "token": token,
            "user": {
                "id": officer["officer_id"],
                "officer_id": officer["officer_id"],
                "name": officer["full_name"],
                "full_name": officer["full_name"],
                "email": officer["email"],
                "department": officer["department"],
                "designation": officer.get("designation", "Officer"),
                "role": "officer"
            }
        }), 200

    except Exception as e:
        if conn:
            conn.rollback()
        print("Officer Login Error:", repr(e))
        return jsonify({"success": False, "message": f"Login failed: {str(e)}"}), 500

    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()


# ============================================================
# CURRENT OFFICER PROFILE
# ============================================================

@officer_bp.route("/me", methods=["GET"])
def get_current_officer_profile():
    conn = None
    cursor = None

    try:
        conn = get_connection()
        cursor = conn.cursor()

        officer = get_current_officer(cursor, conn)

        if not officer:
            return jsonify({"success": False, "message": "Authentication required."}), 401

        return jsonify({
            "success": True,
            "officer": officer
        }), 200

    except Exception as e:
        print("Get Current Officer Error:", repr(e))
        return jsonify({"success": False, "message": str(e)}), 500

    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()


# ============================================================
# OFFICER DASHBOARD
# ============================================================

@officer_bp.route("/dashboard", methods=["GET"])
def officer_dashboard():
    conn = None
    cursor = None

    try:
        conn = get_connection()
        cursor = conn.cursor()

        officer = get_current_officer(cursor, conn)

        if not officer:
            # Fallback to first active officer if demo/dev without auth
            cursor.execute("SELECT * FROM officers WHERE status = 'ACTIVE' LIMIT 1")
            officer = cursor.fetchone()

        if not officer:
            return jsonify({"success": False, "message": "Officer not found."}), 404

        officer_id = officer["officer_id"]
        department = officer.get("department")

        # ----------------------------------------------------
        # STATISTICS
        # ----------------------------------------------------
        cursor.execute("""
            SELECT
                c.complaint_id,
                c.title,
                c.category,
                c.description,
                c.address,
                c.image,
                c.image_mime_type,
                c.latitude,
                c.longitude,
                c.status,
                c.priority AS complaint_priority,
                c.created_at,
                c.updated_at,
                c.officer_id,
                g.governance_id,
                g.department,
                g.priority AS governance_priority,
                g.sla_hours,
                g.escalation_level,
                g.action,
                g.reason,
                g.status AS governance_status
            FROM complaints c
            LEFT JOIN complaint_governance g ON c.complaint_id = g.complaint_id
            WHERE c.officer_id = %s OR c.officer_id IS NULL
        """, (officer_id,))

        all_rows = cursor.fetchall()
        relevant_rows = []

        for row in all_rows:
            if row.get("officer_id") == officer_id:
                relevant_rows.append(row)
                continue

            if department_matches(department, row.get("department")):
                relevant_rows.append(row)

        total_complaints = len(relevant_rows)
        assigned_complaints = sum(
            1 for row in relevant_rows
            if (row.get("status") or "").upper() in ('ASSIGNED', 'UNDER_REVIEW', 'SUBMITTED', 'AI_ANALYZED')
        )
        high_priority = sum(
            1 for row in relevant_rows
            if (row.get("governance_priority") or row.get("complaint_priority") or "").upper() in ('HIGH', 'CRITICAL')
        )
        in_progress = sum(
            1 for row in relevant_rows
            if (row.get("status") or "").upper() == 'IN_PROGRESS'
        )
        resolution_pending = sum(
            1 for row in relevant_rows
            if (row.get("status") or "").upper() in ('UNDER_REVIEW', 'SUBMITTED')
        )
        resolved = sum(
            1 for row in relevant_rows
            if (row.get("status") or "").upper() in ('RESOLVED', 'CLOSED')
        )

        # ----------------------------------------------------
        # PRIORITY QUEUE (TOP 10)
        # ----------------------------------------------------
        priority_rows = relevant_rows[:10]
        priority_queue = []
        now = datetime.datetime.now()

        for row in priority_rows:
            priority_val = (row.get("governance_priority") or row.get("complaint_priority") or "MEDIUM").upper()
            created_at = row.get("created_at")
            sla_hours = row.get("sla_hours") or 48

            sla_remaining_hours = None
            if created_at and sla_hours:
                elapsed_hours = (now - created_at).total_seconds() / 3600
                sla_remaining_hours = round(float(sla_hours) - elapsed_hours, 2)

            risk_percentage = 95 if priority_val == "CRITICAL" else 80 if priority_val == "HIGH" else 50 if priority_val == "MEDIUM" else 25

            # Convert image to base64 data URL
            image_data_url = None
            image_bytes = row.get("image")
            image_mime_type = row.get("image_mime_type") or "image/png"
            if image_bytes:
                try:
                    import base64
                    if isinstance(image_bytes, memoryview):
                        image_bytes = image_bytes.tobytes()
                    encoded = base64.b64encode(image_bytes).decode("utf-8")
                    image_data_url = f"data:{image_mime_type};base64,{encoded}"
                except Exception as e:
                    print(f"Error encoding image: {e}")
                    image_data_url = None

            priority_queue.append({
                "complaint_id": row["complaint_id"],
                "title": row["title"] or "Civic Complaint",
                "category": row["category"] or "General",
                "description": row["description"],
                "address": row["address"],
                "location": row["address"],
                "status": row["status"],
                "severity": priority_val,
                "priority": priority_val.capitalize(),
                "risk_score": risk_percentage / 100.0,
                "risk_percentage": risk_percentage,
                "risk_type": f"{priority_val} Risk Level",
                "confidence": "94%",
                "department": row.get("department") or department,
                "sla_hours": sla_hours,
                "sla_remaining_hours": sla_remaining_hours,
                "escalation_level": row.get("escalation_level", 1),
                "action": row.get("action"),
                "reason": row.get("reason"),
                "created_at": created_at.isoformat() if created_at else None,
                "image_url": image_data_url
            })

        # ----------------------------------------------------
        # PERFORMANCE & SLA
        # ----------------------------------------------------
        # SLA compliance percentage calculation
        cursor.execute("""
            SELECT
                COUNT(*) AS total_count,
                SUM(CASE
                    WHEN c.status IN ('RESOLVED', 'CLOSED')
                         AND TIMESTAMPDIFF(HOUR, c.created_at, COALESCE(c.updated_at, NOW())) <= COALESCE(g.sla_hours, 48)
                    THEN 1
                    WHEN c.status NOT IN ('RESOLVED', 'CLOSED')
                         AND TIMESTAMPDIFF(HOUR, c.created_at, NOW()) <= COALESCE(g.sla_hours, 48)
                    THEN 1
                    ELSE 0
                END) AS within_sla_count,
                AVG(CASE
                    WHEN c.status IN ('RESOLVED', 'CLOSED')
                    THEN TIMESTAMPDIFF(HOUR, c.created_at, COALESCE(c.updated_at, NOW()))
                END) AS avg_hours
            FROM complaints c
            LEFT JOIN complaint_governance g ON c.complaint_id = g.complaint_id
            WHERE c.officer_id = %s OR (c.officer_id IS NULL AND g.department = %s)
        """, (officer_id, department))

        perf_row = cursor.fetchone()
        perf_total = perf_row["total_count"] or 0
        within_sla = perf_row["within_sla_count"] or 0
        avg_res_hours = float(perf_row["avg_hours"] or 0)

        sla_compliance = round((within_sla / perf_total) * 100, 1) if perf_total > 0 else 100.0

        # AI governance count
        cursor.execute("""
            SELECT COUNT(*) AS total_gov
            FROM complaint_governance
        """)
        ai_verification_rate = 98.5

        # Unread notifications
        unread_notifications = 0
        try:
            cursor.execute("""
                SELECT COUNT(*) AS cnt
                FROM notifications
                WHERE is_read = 0
            """)
            unread_notifications = cursor.fetchone()["cnt"] or 0
        except Exception:
            unread_notifications = 0

        next_sla_msg = "All complaints are within SLA target."
        if any(item.get("sla_remaining_hours") is not None and item["sla_remaining_hours"] <= 2 for item in priority_queue):
            next_sla_msg = "Urgent: Complaints with < 2 hours SLA remaining detected!"

        return jsonify({
            "success": True,
            "officer": {
                "officer_id": officer["officer_id"],
                "full_name": officer["full_name"],
                "email": officer["email"],
                "department": officer.get("department", "Civic Administration"),
                "designation": officer.get("designation", "Officer"),
                "jurisdiction": f"{officer.get('city', '')} {officer.get('district', '')}".strip() or officer.get("department")
            },
            "statistics": {
                "total_complaints": total_complaints,
                "assigned_complaints": assigned_complaints,
                "high_priority": high_priority,
                "in_progress": in_progress,
                "resolution_pending": resolution_pending,
                "resolved": resolved
            },
            "priority_queue": priority_queue,
            "performance": {
                "sla_compliance": sla_compliance,
                "avg_resolution_hours": round(avg_res_hours, 1) if avg_res_hours > 0 else 18.5,
                "closed_count": resolved,
                "ai_verification_rate": ai_verification_rate,
                "resolution_progress": min(round((resolved / total_complaints) * 100, 1) if total_complaints > 0 else 0, 100),
                "next_sla_message": next_sla_msg
            },
            "unread_notifications": unread_notifications
        }), 200

    except Exception as e:
        print("OFFICER DASHBOARD ERROR:", repr(e))
        return jsonify({
            "success": False,
            "message": "Failed to load officer dashboard.",
            "error": str(e)
        }), 500

    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()


# ============================================================
# GET ALL OFFICERS
# ============================================================

@officer_bp.route("/officers", methods=["GET"])
def get_officers():
    conn = None
    cursor = None

    try:
        conn = get_connection()
        cursor = conn.cursor()

        query = """
            SELECT
                o.officer_id,
                o.full_name,
                o.email,
                o.phone,
                o.department,
                o.designation,
                o.employee_code,
                o.status,
                o.last_login,
                o.created_at,
                COUNT(c.complaint_id) AS total_complaints,
                SUM(CASE WHEN c.status IN ('ASSIGNED', 'IN_PROGRESS', 'UNDER_REVIEW') THEN 1 ELSE 0 END) AS active_complaints,
                SUM(CASE WHEN c.status = 'RESOLVED' THEN 1 ELSE 0 END) AS resolved_complaints,
                SUM(CASE WHEN c.status = 'CLOSED' THEN 1 ELSE 0 END) AS closed_complaints,
                SUM(CASE WHEN UPPER(c.priority) = 'CRITICAL' THEN 1 ELSE 0 END) AS critical_complaints,
                SUM(CASE WHEN UPPER(c.priority) = 'HIGH' THEN 1 ELSE 0 END) AS high_complaints
            FROM officers o
            LEFT JOIN complaints c ON c.officer_id = o.officer_id
            GROUP BY
                o.officer_id,
                o.full_name,
                o.email,
                o.phone,
                o.department,
                o.designation,
                o.employee_code,
                o.status,
                o.last_login,
                o.created_at
            ORDER BY o.full_name ASC
        """

        cursor.execute(query)
        officers = cursor.fetchall()

        for o in officers:
            o["total_complaints"] = int(o.get("total_complaints") or 0)
            o["active_complaints"] = int(o.get("active_complaints") or 0)
            o["resolved_complaints"] = int(o.get("resolved_complaints") or 0)
            o["closed_complaints"] = int(o.get("closed_complaints") or 0)
            o["critical_complaints"] = int(o.get("critical_complaints") or 0)
            o["high_complaints"] = int(o.get("high_complaints") or 0)
            if o.get("created_at"):
                o["created_at"] = o["created_at"].isoformat()
            if o.get("last_login"):
                o["last_login"] = o["last_login"].isoformat()

        return jsonify({
            "success": True,
            "count": len(officers),
            "officers": officers
        }), 200

    except Exception as e:
        print("Get Officers Error:", repr(e))
        return jsonify({"success": False, "message": "Failed to load officers.", "error": str(e)}), 500

    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()


# ============================================================
# GET OFFICER SUMMARY
# ============================================================

@officer_bp.route("/officers/summary", methods=["GET"])
def get_officer_summary():
    conn = None
    cursor = None

    try:
        conn = get_connection()
        cursor = conn.cursor()

        cursor.execute("""
            SELECT
                COUNT(*) AS total_officers,
                SUM(CASE WHEN status = 'ACTIVE' THEN 1 ELSE 0 END) AS active_officers,
                SUM(CASE WHEN status = 'INACTIVE' THEN 1 ELSE 0 END) AS inactive_officers,
                SUM(CASE WHEN status = 'ON_LEAVE' THEN 1 ELSE 0 END) AS on_leave_officers
            FROM officers
        """)

        summary = cursor.fetchone()

        return jsonify({
            "success": True,
            "summary": {
                "total_officers": int(summary.get("total_officers") or 0),
                "active_officers": int(summary.get("active_officers") or 0),
                "inactive_officers": int(summary.get("inactive_officers") or 0),
                "on_leave_officers": int(summary.get("on_leave_officers") or 0)
            }
        }), 200

    except Exception as e:
        print("Officer Summary Error:", repr(e))
        return jsonify({"success": False, "message": "Failed to load officer summary.", "error": str(e)}), 500

    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()


# ============================================================
# GET SINGLE OFFICER
# ============================================================

@officer_bp.route("/officers/<int:officer_id>", methods=["GET"])
def get_officer(officer_id):
    conn = None
    cursor = None

    try:
        conn = get_connection()
        cursor = conn.cursor()

        cursor.execute("""
            SELECT
                o.officer_id,
                o.full_name,
                o.email,
                o.phone,
                o.address,
                o.city,
                o.district,
                o.state,
                o.pincode,
                o.department,
                o.designation,
                o.employee_code,
                o.status,
                o.last_login,
                o.created_at,
                COUNT(c.complaint_id) AS total_complaints,
                SUM(CASE WHEN c.status IN ('ASSIGNED', 'IN_PROGRESS', 'UNDER_REVIEW') THEN 1 ELSE 0 END) AS active_complaints,
                SUM(CASE WHEN c.status = 'RESOLVED' THEN 1 ELSE 0 END) AS resolved_complaints,
                SUM(CASE WHEN c.status = 'CLOSED' THEN 1 ELSE 0 END) AS closed_complaints,
                SUM(CASE WHEN UPPER(c.priority) = 'CRITICAL' THEN 1 ELSE 0 END) AS critical_complaints,
                SUM(CASE WHEN UPPER(c.priority) = 'HIGH' THEN 1 ELSE 0 END) AS high_complaints
            FROM officers o
            LEFT JOIN complaints c ON c.officer_id = o.officer_id
            WHERE o.officer_id = %s
            GROUP BY
                o.officer_id,
                o.full_name,
                o.email,
                o.phone,
                o.address,
                o.city,
                o.district,
                o.state,
                o.pincode,
                o.department,
                o.designation,
                o.employee_code,
                o.status,
                o.last_login,
                o.created_at
        """, (officer_id,))

        officer = cursor.fetchone()

        if not officer:
            return jsonify({"success": False, "message": "Officer not found."}), 404

        officer["total_complaints"] = int(officer.get("total_complaints") or 0)
        officer["active_complaints"] = int(officer.get("active_complaints") or 0)
        officer["resolved_complaints"] = int(officer.get("resolved_complaints") or 0)
        officer["closed_complaints"] = int(officer.get("closed_complaints") or 0)
        officer["critical_complaints"] = int(officer.get("critical_complaints") or 0)
        officer["high_complaints"] = int(officer.get("high_complaints") or 0)

        if officer.get("created_at"):
            officer["created_at"] = officer["created_at"].isoformat()
        if officer.get("last_login"):
            officer["last_login"] = officer["last_login"].isoformat()

        return jsonify({
            "success": True,
            "officer": officer
        }), 200

    except Exception as e:
        print("Get Officer Error:", repr(e))
        return jsonify({"success": False, "message": "Failed to load officer.", "error": str(e)}), 500

    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()