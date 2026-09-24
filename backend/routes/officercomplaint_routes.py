import os
import re
import datetime
import jwt
import base64
import threading
from flask import Blueprint, request, jsonify, current_app
from database import get_connection
from agent.agent3 import MODEL_NAME, verify_resolution, _normalize_bytes

officercomplaint_bp = Blueprint("officercomplaint", __name__)


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
    """
    Extracts authenticated officer from JWT Authorization header or query param.
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

    if not officer_id:
        officer_id = request.args.get("officer_id", type=int)

    if not officer_id:
        # Fallback to first active officer if no auth provided
        cursor.execute("SELECT * FROM officers WHERE status = 'ACTIVE' LIMIT 1")
        return cursor.fetchone()

    cursor.execute("SELECT * FROM officers WHERE officer_id = %s LIMIT 1", (officer_id,))
    return cursor.fetchone()


# ============================================================
# GET OFFICER COMPLAINTS
# ============================================================

@officercomplaint_bp.route("/complaints", methods=["GET"])
def get_officer_complaints():
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

        # Pagination
        page = request.args.get("page", default=1, type=int)
        limit = request.args.get("limit", default=10, type=int)
        if page < 1:
            page = 1
        if limit < 1 or limit > 100:
            limit = 10
        offset = (page - 1) * limit

        # Filters
        search = request.args.get("search", "").strip()
        status = request.args.get("status")
        priority = request.args.get("priority")
        category = request.args.get("category")
        sort = request.args.get("sort", "priority")

        conditions = []
        params = []

        # Assigned to officer or unassigned - NO department filter in SQL yet
        # We'll filter by department in Python using semantic matching
        conditions.append("(c.officer_id = %s OR c.officer_id IS NULL)")
        params.append(officer_id)

        # Search
        if search:
            conditions.append("""
                (
                    CAST(c.complaint_id AS CHAR) LIKE %s
                    OR c.title LIKE %s
                    OR c.description LIKE %s
                    OR c.address LIKE %s
                    OR c.category LIKE %s
                )
            """)
            search_val = f"%{search}%"
            params.extend([search_val] * 5)

        # Status filter
        if status and status.upper() != "ALL":
            status_clean = status.upper().replace(" ", "_")
            conditions.append("c.status = %s")
            params.append(status_clean)

        # Category filter
        if category and category.upper() != "ALL":
            conditions.append("c.category = %s")
            params.append(category)

        requested_department = request.args.get("department", "").strip()

        # Priority filter
        if priority and priority.upper() != "ALL":
            conditions.append("UPPER(COALESCE(g.priority, c.priority)) = %s")
            params.append(priority.upper())

        where_clause = " AND ".join(conditions)

        # Sorting
        if sort == "newest":
            order_clause = "c.created_at DESC"
        elif sort == "oldest":
            order_clause = "c.created_at ASC"
        elif sort == "risk":
            order_clause = """
                CASE
                    WHEN UPPER(COALESCE(g.priority, c.priority)) = 'CRITICAL' THEN 1
                    WHEN UPPER(COALESCE(g.priority, c.priority)) = 'HIGH' THEN 2
                    WHEN UPPER(COALESCE(g.priority, c.priority)) = 'MEDIUM' THEN 3
                    ELSE 4
                END, c.created_at ASC
            """
        else:
            order_clause = """
                CASE
                    WHEN UPPER(COALESCE(g.priority, c.priority)) = 'CRITICAL' THEN 1
                    WHEN UPPER(COALESCE(g.priority, c.priority)) = 'HIGH' THEN 2
                    WHEN UPPER(COALESCE(g.priority, c.priority)) = 'MEDIUM' THEN 3
                    ELSE 4
                END,
                COALESCE(g.escalation_level, 0) DESC,
                c.created_at ASC
            """

        # Fetch complaints (without limit/offset initially for department filtering)
        query = f"""
            SELECT
                c.complaint_id,
                c.user_id,
                c.officer_id,
                c.title,
                c.category,
                c.description,
                c.image,
                c.image_mime_type,
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
                g.status AS governance_status
            FROM complaints c
            LEFT JOIN complaint_governance g ON c.complaint_id = g.complaint_id
            WHERE {where_clause}
            ORDER BY {order_clause}
        """
        cursor.execute(query, params)
        all_rows = cursor.fetchall()

        # Filter by department using semantic matching
        department = officer.get("department")
        filtered_rows = []
        for row in all_rows:
            # First, allow assigned complaints to the officer automatically
            if row.get("officer_id") == officer_id:
                filtered_rows.append(row)
                continue

            complaint_dept = row.get("department")
            if requested_department:
                if complaint_dept and department_matches(requested_department, complaint_dept):
                    filtered_rows.append(row)
                continue

            if complaint_dept and department_matches(department, complaint_dept):
                filtered_rows.append(row)

        # Now apply pagination
        total = len(filtered_rows)
        paginated_rows = filtered_rows[offset:offset + limit]

        now = datetime.datetime.now()
        complaints = []

        for row in paginated_rows:
            priority_val = (row.get("governance_priority") or row.get("complaint_priority") or "MEDIUM").upper()
            created_at = row.get("created_at")
            sla_hours = row.get("sla_hours") or 48

            sla_remaining_hours = None
            if created_at and sla_hours:
                elapsed_hours = (now - created_at).total_seconds() / 3600
                sla_remaining_hours = round(float(sla_hours) - elapsed_hours, 2)

            risk_percentage = 95 if priority_val == "CRITICAL" else 80 if priority_val == "HIGH" else 50 if priority_val == "MEDIUM" else 25

            image_bytes = row.get("image")
            if isinstance(image_bytes, memoryview):
                image_bytes = image_bytes.tobytes()
            image_url = (
                f"data:{row.get('image_mime_type') or 'image/jpeg'};base64,"
                + base64.b64encode(image_bytes).decode("utf-8")
                if image_bytes
                else None
            )

            complaints.append({
                "complaint_id": row["complaint_id"],
                "user_id": row["user_id"],
                "officer_id": row.get("officer_id"),
                "assigned_officer_id": row.get("officer_id"),
                "title": row.get("title") or "Civic Complaint",
                "category": row.get("category") or "General",
                "description": row.get("description"),
                "address": row.get("address"),
                "location": row.get("address"),
                "latitude": float(row["latitude"]) if row.get("latitude") is not None else None,
                "longitude": float(row["longitude"]) if row.get("longitude") is not None else None,
                "status": row.get("status"),
                "priority": priority_val.capitalize(),
                "severity": priority_val,
                "risk_score": risk_percentage / 100.0,
                "risk_percentage": risk_percentage,
                "risk_type": f"{priority_val} Risk",
                "confidence": "92%",
                "department": row.get("department") or department,
                "sla_hours": sla_hours,
                "sla_remaining_hours": sla_remaining_hours,
                "escalation_level": row.get("escalation_level", 1),
                "action": row.get("action"),
                "reason": row.get("reason"),
                "governance_status": row.get("governance_status"),
                "image_url": image_url,
                "created_at": created_at.isoformat() if created_at else None,
                "updated_at": row["updated_at"].isoformat() if row.get("updated_at") else None
            })

        # Distinct categories from filtered complaints
        categories = []
        seen = set()
        for row in filtered_rows:
            category = row.get("category")
            if category and category.strip() and category not in seen:
                categories.append(category)
                seen.add(category)
        categories.sort()

        total_pages = (total + limit - 1) // limit if total > 0 else 1

        return jsonify({
            "success": True,
            "complaints": complaints,
            "categories": categories,
            "pagination": {
                "page": page,
                "limit": limit,
                "total": total,
                "pages": total_pages
            }
        }), 200

    except Exception as e:
        print("Officer Complaints Error:", repr(e))
        return jsonify({
            "success": False,
            "message": "Failed to load officer complaints.",
            "error": str(e)
        }), 500

    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()


# ============================================================
# GET SINGLE COMPLAINT DETAILS
# ============================================================

@officercomplaint_bp.route("/complaints/<int:complaint_id>", methods=["GET"])
def get_single_officer_complaint(complaint_id):
    conn = None
    cursor = None

    try:
        conn = get_connection()
        cursor = conn.cursor()

        officer = get_authenticated_officer(cursor)
        if not officer:
            return jsonify({"success": False, "message": "Officer authentication required."}), 401

        cursor.execute("""
            SELECT
                c.complaint_id,
                c.user_id,
                c.officer_id,
                c.title,
                c.category,
                c.description,
                c.image,
                c.image_mime_type,
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
                c.resolution_reason,
                c.resolution_details,
                c.resolution_image,
                c.resolved_at,
                c.closed_at,
                o.full_name AS officer_name,
                o.email AS officer_email,
                o.designation AS officer_designation
            FROM complaints c
            LEFT JOIN complaint_governance g ON c.complaint_id = g.complaint_id
            LEFT JOIN officers o ON c.officer_id = o.officer_id
            WHERE c.complaint_id = %s
            LIMIT 1
        """, (complaint_id,))

        complaint = cursor.fetchone()

        if not complaint:
            return jsonify({"success": False, "message": "Complaint not found."}), 404

        current_assigned_officer = complaint.get("officer_id")
        complaint_department = complaint.get("department")
        if current_assigned_officer and current_assigned_officer != officer["officer_id"]:
            return jsonify({"success": False, "message": "You are not authorized to view this complaint."}), 403
        if not current_assigned_officer and not department_matches(
            officer.get("department"),
            complaint_department,
        ):
            return jsonify({"success": False, "message": "This complaint is outside your department."}), 403

        # Fetch status history
        cursor.execute("""
            SELECT
                history_id,
                status,
                message,
                department,
                status_image,
                created_at
            FROM complaint_status_history
            WHERE complaint_id = %s
            ORDER BY created_at ASC
        """, (complaint_id,))

        history = cursor.fetchall()
        for h in history:
            if h.get("created_at"):
                h["created_at"] = h["created_at"].isoformat()
            if h.get("status_image"):
                image_bytes = h["status_image"]
                if isinstance(image_bytes, memoryview):
                    image_bytes = image_bytes.tobytes()
                h["status_image_url"] = (
                    "data:image/jpeg;base64,"
                    + base64.b64encode(image_bytes).decode("utf-8")
                )
                h.pop("status_image", None)

        cursor.execute("""
            SELECT verification_id, decision, confidence, before_issue_detected,
                   after_issue_detected, reason, model_name, verified_at
            FROM complaint_verification
            WHERE complaint_id = %s
            ORDER BY verified_at DESC, verification_id DESC
            LIMIT 1
        """, (complaint_id,))
        verification = cursor.fetchone()

        priority_val = (complaint.get("governance_priority") or complaint.get("complaint_priority") or "MEDIUM").upper()
        sla_hours = complaint.get("sla_hours") or 48
        created_at = complaint.get("created_at")

        sla_remaining_hours = None
        if created_at and sla_hours:
            elapsed_hours = (datetime.datetime.now() - created_at).total_seconds() / 3600
            sla_remaining_hours = round(float(sla_hours) - elapsed_hours, 2)

        formatted_complaint = {
            "complaint_id": complaint["complaint_id"],
            "user_id": complaint["user_id"],
            "officer_id": complaint.get("officer_id"),
            "assigned_officer_id": complaint.get("officer_id"),
            "officer_name": complaint.get("officer_name"),
            "officer_designation": complaint.get("officer_designation"),
            "title": complaint.get("title") or "Civic Complaint",
            "category": complaint.get("category") or "General",
            "description": complaint.get("description"),
            "image_url": (
                f"data:{complaint.get('image_mime_type') or 'image/jpeg'};base64,"
                + base64.b64encode(
                    complaint["image"].tobytes()
                    if isinstance(complaint.get("image"), memoryview)
                    else complaint["image"]
                ).decode("utf-8")
                if complaint.get("image")
                else None
            ),
            "address": complaint.get("address"),
            "location": complaint.get("address"),
            "latitude": float(complaint["latitude"]) if complaint.get("latitude") is not None else None,
            "longitude": float(complaint["longitude"]) if complaint.get("longitude") is not None else None,
            "status": complaint.get("status"),
            "priority": priority_val.capitalize(),
            "severity": priority_val,
            "department": complaint.get("department"),
            "sla_hours": sla_hours,
            "sla_remaining_hours": sla_remaining_hours,
            "escalation_level": complaint.get("escalation_level", 1),
            "action": complaint.get("action"),
            "reason": complaint.get("reason"),
            "resolution_reason": complaint.get("resolution_reason"),
            "resolution_details": complaint.get("resolution_details"),
            "has_resolution_image": bool(complaint.get("resolution_image")),
            "resolution_image_url": (
                "data:image/jpeg;base64,"
                + base64.b64encode(
                    complaint["resolution_image"].tobytes()
                    if isinstance(complaint.get("resolution_image"), memoryview)
                    else complaint["resolution_image"]
                ).decode("utf-8")
                if complaint.get("resolution_image")
                else None
            ),
            "verification": {
                "verification_id": verification.get("verification_id"),
                "decision": verification.get("decision"),
                "confidence": int(verification.get("confidence") or 0),
                "before_issue_detected": bool(verification.get("before_issue_detected")),
                "after_issue_detected": bool(verification.get("after_issue_detected")),
                "reason": verification.get("reason"),
                "model_name": verification.get("model_name"),
                "verified_at": verification["verified_at"].isoformat() if hasattr(verification.get("verified_at"), "isoformat") else verification.get("verified_at"),
            } if verification else None,
            "resolved_at": complaint["resolved_at"].isoformat() if complaint.get("resolved_at") else None,
            "closed_at": complaint["closed_at"].isoformat() if complaint.get("closed_at") else None,
            "created_at": created_at.isoformat() if created_at else None,
            "updated_at": complaint["updated_at"].isoformat() if complaint.get("updated_at") else None,
            "history": history
        }

        return jsonify({
            "success": True,
            "complaint": formatted_complaint
        }), 200

    except Exception as e:
        print("Get Single Complaint Error:", repr(e))
        return jsonify({"success": False, "message": "Failed to load complaint.", "error": str(e)}), 500

    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()


# ============================================================
# AGENT 3 BACKGROUND VERIFICATION HANDLERS
# ============================================================

_ACTIVE_AGENT3_IDS = set()
_AGENT3_LOCK = threading.Lock()


def run_agent3_verification(complaint_id: int, officer_id: int = None) -> dict:
    """
    Executes Agent 3 Resolution Verification for a complaint.
    Can be run asynchronously in a background thread or synchronously when triggered.
    """
    conn = None
    cursor = None
    try:
        conn = get_connection()
        cursor = conn.cursor()

        cursor.execute("""
            SELECT c.*, g.department AS governance_department, g.sla_hours
            FROM complaints c
            LEFT JOIN complaint_governance g ON g.complaint_id = c.complaint_id
            WHERE c.complaint_id = %s
            LIMIT 1
            FOR UPDATE
        """, (complaint_id,))
        complaint = cursor.fetchone()

        if not complaint:
            print(f"[Agent 3 Error] Complaint #{complaint_id} not found.")
            return {"success": False, "message": f"Complaint #{complaint_id} not found."}

        res_img = complaint.get("resolution_image")
        if not res_img:
            print(f"[Agent 3 Error] Complaint #{complaint_id} has no resolution proof image.")
            return {"success": False, "message": "No resolution proof image found."}

        # Run Agent 3 verification
        print(f"[Agent 3] Running resolution verification on complaint #{complaint_id}...")
        verification = verify_resolution(
            complaint,
            {
                "department": complaint.get("governance_department") or complaint.get("category"),
                "sla_hours": complaint.get("sla_hours"),
            }
        )
        decision = verification.get("decision", "FAILED")
        confidence = verification.get("confidence", 50)
        reason = verification.get("reason", "Visual audit completed.")
        model_name = verification.get("model_name") or MODEL_NAME

        # Determine status based on decision
        if decision == "VERIFIED":
            final_status = "CLOSED"
            status_msg = (
                f"Resolution verification passed ({confidence}% confidence): {reason}. "
                f"Complaint verified and closed."
            )
        elif decision == "RETRY_PENDING":
            final_status = "UNDER_REVIEW"
            status_msg = (
                f"Resolution verification is pending ({reason}). "
                "Agent 3 will retry the automated vision check."
            )
        elif decision == "FAILED":
            final_status = "ASSIGNED"
            status_msg = (
                f"Resolution verification failed ({confidence}% confidence): {reason}. "
                f"Complaint status changed to Assigned for rework."
            )
        else:
            decision = "FAILED"
            final_status = "ASSIGNED"
            status_msg = (
                f"Resolution verification failed ({confidence}% confidence): {reason}. "
                f"Complaint status changed to Assigned for rework."
            )

        # Update complaints table
        update_fields = ["status = %s", "updated_at = NOW()"]
        update_params = [final_status]
        if final_status in ["RESOLVED", "CLOSED"]:
            update_fields.extend(["resolved_at = NOW()", "closed_at = NOW()"])
        else:
            update_fields.extend(["resolved_at = NULL", "closed_at = NULL"])
        update_params.append(complaint_id)

        cursor.execute(
            f"UPDATE complaints SET {', '.join(update_fields)} WHERE complaint_id = %s",
            update_params
        )

        # Leave retryable provider failures without a terminal verification record.
        if decision != "RETRY_PENDING":
            cursor.execute("""
                INSERT INTO complaint_verification
                (complaint_id, decision, confidence, before_issue_detected,
                 after_issue_detected, reason, model_name, verified_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, NOW())
            """, (
                complaint_id,
                decision,
                confidence,
                verification.get("before_issue_detected", False),
                verification.get("after_issue_detected", False),
                reason,
                model_name,
            ))

        # Insert status history entry
        cursor.execute("""
            INSERT INTO complaint_status_history
            (complaint_id, status, message, department, updated_by, status_image)
            VALUES (%s, %s, %s, %s, %s, %s)
        """, (
            complaint_id,
            final_status,
            status_msg[:500],
            complaint.get("governance_department") or "Civic Operations",
            officer_id or complaint.get("officer_id"),
            res_img,
        ))

        # Citizen Notification
        citizen_user_id = complaint.get("user_id")
        if citizen_user_id:
            if final_status in ["RESOLVED", "CLOSED"]:
                notif_title = f"Complaint #{complaint_id} Verified & Closed"
                notif_msg = f"Your complaint resolution has been verified by AI and officially Closed: {reason}"
            elif final_status == "ASSIGNED":
                notif_title = f"Complaint #{complaint_id} Returned to Assigned for Rework"
                notif_msg = f"Resolution verification failed ({confidence}% confidence): {reason}. Complaint has been assigned back for rework."
            else:
                notif_title = f"Complaint #{complaint_id} Under Review"
                notif_msg = f"Resolution proof is undergoing manual review: {reason}."

            cursor.execute("""
                INSERT INTO notifications
                (user_id, complaint_id, type, title, message, is_read)
                VALUES (%s, %s, 'STATUS_UPDATE', %s, %s, 0)
            """, (citizen_user_id, complaint_id, notif_title, notif_msg))

        conn.commit()
        print(f"[Agent 3] Verification complete for complaint #{complaint_id}: decision={decision}, final_status={final_status}")

        verification["status"] = final_status
        return {
            "success": True,
            "complaint_id": complaint_id,
            "status": final_status,
            "verification": verification,
        }

    except Exception as e:
        if conn:
            conn.rollback()
        print(f"[Agent 3 Error] Exception verifying complaint #{complaint_id}: {repr(e)}")
        return {"success": False, "error": str(e)}

    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()


def trigger_agent3_async(complaint_id: int, officer_id: int = None):
    """Spawns a background thread to run Agent 3 verification asynchronously."""
    def _worker():
        with _AGENT3_LOCK:
            if complaint_id in _ACTIVE_AGENT3_IDS:
                print(f"[Agent 3 Trigger] Complaint #{complaint_id} is already being verified.")
                return
            _ACTIVE_AGENT3_IDS.add(complaint_id)

        try:
            print(f"[Agent 3 Async Trigger] Starting background verification for complaint #{complaint_id}...")
            run_agent3_verification(complaint_id, officer_id)
        except Exception as err:
            print(f"[Agent 3 Async Trigger Error] for complaint #{complaint_id}: {repr(err)}")
        finally:
            with _AGENT3_LOCK:
                _ACTIVE_AGENT3_IDS.discard(complaint_id)

    thread = threading.Thread(target=_worker, daemon=True)
    thread.start()
    return thread


# ============================================================
# UPDATE COMPLAINT STATUS (ACTION HANDLER)
# ============================================================

@officercomplaint_bp.route("/complaints/<int:complaint_id>/status", methods=["PUT"])
def update_complaint_status(complaint_id):
    conn = None
    cursor = None

    try:
        conn = get_connection()
        cursor = conn.cursor()

        officer = get_authenticated_officer(cursor)
        if not officer:
            return jsonify({"success": False, "message": "Officer authentication required."}), 401

        officer_id = officer["officer_id"]
        officer_name = officer["full_name"]
        department = officer.get("department", "Civic Administration")

        data = request.form.to_dict() if (request.form or request.files) else (request.get_json(silent=True) or {})
        new_status_raw = str(data.get("status", "")).strip()

        if not new_status_raw:
            return jsonify({"success": False, "message": "Status is required."}), 400

        # Normalize status to MySQL enum
        status_map = {
            "ASSIGNED": "ASSIGNED",
            "ACCEPTED": "IN_PROGRESS",
            "START WORK": "IN_PROGRESS",
            "START_WORK": "IN_PROGRESS",
            "IN PROGRESS": "IN_PROGRESS",
            "IN_PROGRESS": "IN_PROGRESS",
            "RESOLUTION SUBMITTED": "UNDER_REVIEW",
            "RESOLUTION_SUBMITTED": "UNDER_REVIEW",
            "UNDER REVIEW": "UNDER_REVIEW",
            "UNDER_REVIEW": "UNDER_REVIEW",
            "RESOLVED": "RESOLVED",
            "CLOSED": "CLOSED",
            "REJECTED": "REJECTED"
        }

        new_status = status_map.get(new_status_raw.upper())
        if not new_status:
            return jsonify({"success": False, "message": "Invalid complaint status."}), 400

        is_resolution_submission = new_status == "RESOLVED"

        reason = str(data.get("reason") or data.get("message") or "").strip()
        details = str(data.get("details") or "").strip()
        # Extract resolution proof image from multipart files or JSON data
        resolution_image_file = (
            request.files.get("resolution_image")
            or request.files.get("image")
            or request.files.get("resolution_proof")
            or request.files.get("proof")
            or request.files.get("file")
        )
        resolution_image_data = None
        if resolution_image_file:
            resolution_image_data = resolution_image_file.read()
        elif data.get("resolution_image") or data.get("image") or data.get("resolution_proof") or data.get("resolution_image_url"):
            raw_img = (
                data.get("resolution_image")
                or data.get("image")
                or data.get("resolution_proof")
                or data.get("resolution_image_url")
            )
            resolution_image_data = _normalize_bytes(raw_img)

        cursor.execute("""
            SELECT c.*, g.department AS governance_department
            FROM complaints c
            LEFT JOIN complaint_governance g ON g.complaint_id = c.complaint_id
            WHERE c.complaint_id = %s
            LIMIT 1
            FOR UPDATE
        """, (complaint_id,))
        complaint = cursor.fetchone()

        if not complaint:
            return jsonify({"success": False, "message": "Complaint not found."}), 404

        current_assigned_officer = complaint.get("officer_id")
        if current_assigned_officer and current_assigned_officer != officer_id:
            return jsonify({"success": False, "message": "You are not authorized to update this complaint."}), 403

        if not current_assigned_officer and not department_matches(
            department,
            complaint.get("governance_department")
        ):
            return jsonify({"success": False, "message": "This complaint is outside your department."}), 403

        current_status = str(complaint.get("status") or "").upper()
        if current_status == new_status:
            return jsonify({"success": False, "message": f"Complaint is already {current_status.lower()}."}), 409
        if current_status == "CLOSED":
            return jsonify({"success": False, "message": "Complaint is already closed."}), 409
        if current_status == "RESOLVED" and new_status != "CLOSED":
            return jsonify({"success": False, "message": "Complaint is already resolved."}), 409

        # Handle Resolution Submission: Save immediately and trigger Agent 3 asynchronously
        if is_resolution_submission:
            if current_status not in {"ASSIGNED", "UNDER_REVIEW", "IN_PROGRESS"}:
                return jsonify({"success": False, "message": "Complaint must be assigned or in progress before it can be resolved."}), 409
            if not reason and not details:
                return jsonify({"success": False, "message": "Resolution reason or details are required."}), 400
            if not resolution_image_data and complaint.get("resolution_image"):
                resolution_image_data = _normalize_bytes(complaint["resolution_image"])
            if not resolution_image_data:
                return jsonify({"success": False, "message": "A resolution proof image is required to resolve this complaint."}), 400

            target_status = "UNDER_REVIEW"
            cursor.execute("""
                UPDATE complaints
                SET status = %s,
                    officer_id = %s,
                    resolution_reason = %s,
                    resolution_details = %s,
                    resolution_image = %s,
                    updated_at = NOW()
                WHERE complaint_id = %s
            """, (
                target_status,
                officer_id,
                reason or None,
                details or None,
                resolution_image_data,
                complaint_id,
            ))

            status_message = (
                f"Officer {officer_name} submitted resolution proof and details. "
                f"AI Agent 3 verification in progress."
            )
            cursor.execute("""
                INSERT INTO complaint_status_history
                (complaint_id, status, message, department, updated_by, status_image)
                VALUES (%s, %s, %s, %s, %s, %s)
            """, (
                complaint_id,
                target_status,
                status_message[:500],
                department,
                officer_id,
                resolution_image_data,
            ))

            # Citizen notification
            citizen_user_id = complaint.get("user_id")
            if citizen_user_id:
                notif_title = f"Complaint #{complaint_id} Resolution Submitted"
                notif_msg = f"Officer {officer_name} ({department}) has submitted resolution proof. AI Agent 3 verification is in progress."
                cursor.execute("""
                    INSERT INTO notifications
                    (user_id, complaint_id, type, title, message, is_read)
                    VALUES (%s, %s, 'STATUS_UPDATE', %s, %s, 0)
                """, (citizen_user_id, complaint_id, notif_title, notif_msg))

            conn.commit()

            # Trigger Agent 3 in background after submit
            trigger_agent3_async(complaint_id, officer_id)

            return jsonify({
                "success": True,
                "message": f"Resolution for complaint #{complaint_id} submitted successfully. AI Agent 3 verification started.",
                "complaint_id": complaint_id,
                "status": target_status,
                "assigned_officer_id": officer_id,
                "verification_pending": True,
            }), 200

        if new_status == "CLOSED":
            if current_status != "RESOLVED":
                return jsonify({"success": False, "message": "Only resolved complaints can be closed."}), 409
            if not reason and not details:
                return jsonify({"success": False, "message": "Closure reason or details are required."}), 400

        update_fields = ["status = %s", "officer_id = %s", "updated_at = NOW()"]
        update_values = [new_status, officer_id]
        if new_status == "CLOSED":
            update_fields.append("closed_at = NOW()")

        update_values.append(complaint_id)
        cursor.execute(
            f"UPDATE complaints SET {', '.join(update_fields)} WHERE complaint_id = %s",
            update_values,
        )

        status_message = reason or details or f"Officer {officer_name} updated status to {new_status}."
        if new_status_raw.upper() in ["ACCEPTED", "START WORK"]:
            status_message = f"Officer {officer_name} accepted the complaint and started work."
        elif new_status == "CLOSED":
            status_message = f"{status_message} (Closed by Officer {officer_name}.)"

        cursor.execute("""
            INSERT INTO complaint_status_history
            (complaint_id, status, message, department, updated_by, status_image)
            VALUES (%s, %s, %s, %s, %s, %s)
        """, (
            complaint_id,
            new_status,
            status_message[:500],
            department,
            officer_id,
            None,
        ))

        # Create citizen notification
        citizen_user_id = complaint.get("user_id")
        if citizen_user_id:
            notif_title = f"Complaint #{complaint_id} Status Updated"
            notif_msg = f"Your complaint status has been updated to '{new_status}' by {officer_name} ({department})."
            cursor.execute("""
                INSERT INTO notifications
                (user_id, complaint_id, type, title, message, is_read)
                VALUES (%s, %s, 'STATUS_UPDATE', %s, %s, 0)
            """, (citizen_user_id, complaint_id, notif_title, notif_msg))

        conn.commit()

        return jsonify({
            "success": True,
            "message": f"Complaint #{complaint_id} updated to {new_status}.",
            "complaint_id": complaint_id,
            "status": new_status,
            "assigned_officer_id": officer_id,
        }), 200

    except Exception as e:
        if conn:
            conn.rollback()
        print("Update Complaint Status Error:", repr(e))
        return jsonify({"success": False, "message": "Failed to update complaint status.", "error": str(e)}), 500

    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()


# ============================================================
# TRIGGER AGENT 3 VERIFICATION ENDPOINT (MANUAL / EXPLICIT TRIGGER)
# ============================================================

@officercomplaint_bp.route("/complaints/<int:complaint_id>/verify-agent3", methods=["POST"])
def trigger_agent3_endpoint(complaint_id):
    conn = None
    cursor = None
    try:
        conn = get_connection()
        cursor = conn.cursor()

        officer = get_authenticated_officer(cursor)
        if not officer:
            return jsonify({"success": False, "message": "Officer authentication required."}), 401

        cursor.execute("SELECT complaint_id, resolution_image, status FROM complaints WHERE complaint_id = %s", (complaint_id,))
        complaint = cursor.fetchone()
        if not complaint:
            return jsonify({"success": False, "message": "Complaint not found."}), 404

        if not complaint.get("resolution_image"):
            return jsonify({"success": False, "message": "No resolution proof image found for this complaint."}), 400

        is_sync = request.args.get("sync", "").lower() in ["true", "1", "yes"]
        if is_sync:
            result = run_agent3_verification(complaint_id, officer["officer_id"])
            return jsonify(result), 200
        else:
            trigger_agent3_async(complaint_id, officer["officer_id"])
            return jsonify({
                "success": True,
                "message": f"AI Agent 3 verification triggered for complaint #{complaint_id}.",
                "complaint_id": complaint_id,
                "verification_pending": True
            }), 200

    except Exception as e:
        print("Trigger Agent 3 Endpoint Error:", repr(e))
        return jsonify({"success": False, "message": "Failed to trigger Agent 3 verification.", "error": str(e)}), 500

    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()