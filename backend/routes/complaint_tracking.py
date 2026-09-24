import os
import jwt

from flask import Blueprint, current_app, request, jsonify
from database import get_connection


complaint_tracking_bp = Blueprint(
    "complaint_tracking",
    __name__,
    url_prefix="/api/complaints"
)


# ============================================================
# GET LOGGED-IN USER
# ============================================================

def get_logged_in_user():
    authorization = request.headers.get("Authorization")

    if not authorization:
        return None

    if not authorization.startswith("Bearer "):
        return None

    token = authorization.split(" ", 1)[1].strip()

    if not token:
        return None

    secret_key = current_app.config.get("SECRET_KEY") or os.getenv("SECRET_KEY")

    if not secret_key:
        print("❌ SECRET_KEY is not configured")
        return None

    try:
        return jwt.decode(
            token,
            secret_key,
            algorithms=["HS256"]
        )

    except jwt.ExpiredSignatureError:
        return None

    except jwt.InvalidTokenError:
        return None


# ============================================================
# GET USER ID FROM TOKEN
# ============================================================

def get_logged_in_user_id():

    user = get_logged_in_user()

    if not user:
        return None

    user_id = user.get("id")

    if user_id is None:
        user_id = user.get("user_id")

    if user_id is None:
        return None

    try:
        return int(user_id)

    except (TypeError, ValueError):
        return None


# ============================================================
# GET COMPLAINT DETAILS + TRACKING HISTORY
# ============================================================

@complaint_tracking_bp.route(
    "/<int:complaint_id>",
    methods=["GET"]
)
def get_complaint_tracking(complaint_id):

    user_id = get_logged_in_user_id()

    # --------------------------------------------------------
    # AUTHENTICATION
    # --------------------------------------------------------

    if user_id is None:

        return jsonify({
            "success": False,
            "message": "Authentication required"
        }), 401

    conn = None
    cursor = None

    try:

        conn = get_connection()

        cursor = conn.cursor()

        # ----------------------------------------------------
        # GET COMPLAINT
        #
        # IMPORTANT:
        # user_id = %s ensures a citizen can only view
        # THEIR OWN complaint.
        # ----------------------------------------------------

        cursor.execute(
            """
            SELECT
                                c.complaint_id,
                                c.user_id,
                                c.title,
                                c.description,
                                c.image,
                                c.image_mime_type,
                                c.latitude,
                                c.longitude,
                                c.address,
                                c.category,
                                c.status,
                                c.priority,
                                c.created_at,
                                c.updated_at,
                                g.department
                        FROM complaints c
                        LEFT JOIN complaint_governance g
                                ON g.complaint_id = c.complaint_id
                        WHERE c.complaint_id = %s
                            AND c.user_id = %s
            LIMIT 1
            """,
            (
                complaint_id,
                user_id
            )
        )

        complaint = cursor.fetchone()

        if not complaint:
            return jsonify({
                "success": False,
                "message": "Complaint not found"
            }), 404

        complaint["created_at"] = str(complaint.get("created_at")) if complaint.get("created_at") else None
        complaint["updated_at"] = str(complaint.get("updated_at")) if complaint.get("updated_at") else None
        complaint["image_data_url"] = (
            f"data:{complaint.get('image_mime_type') or 'image/png'};base64,"
            + __import__("base64").b64encode(complaint.get("image") or b"").decode("utf-8")
            if complaint.get("image")
            else None
        )
        complaint["image_url"] = complaint.get("image_data_url")
        complaint["location"] = complaint.get("address")

        if complaint.get("image") is not None:
            complaint.pop("image", None)
        if complaint.get("image_mime_type") is not None:
            complaint.pop("image_mime_type", None)

        cursor.execute(
            """
            SELECT
                history_id,
                complaint_id,
                status,
                message,
                department,
                updated_by,
                created_at
            FROM complaint_status_history
            WHERE complaint_id = %s
            ORDER BY created_at ASC, history_id ASC
            """,
            (complaint_id,)
        )

        history = cursor.fetchall()
        for row in history:
            row["created_at"] = str(row.get("created_at")) if row.get("created_at") else None

        return jsonify({
            "success": True,
            "message": "Complaint tracking retrieved successfully",
            "complaint": complaint,
            "history": history
        }), 200


    except Exception as e:

        print(
            "❌ COMPLAINT TRACKING ERROR:",
            repr(e)
        )

        return jsonify({
            "success": False,
            "message": "Failed to retrieve complaint tracking"
        }), 500


    finally:

        if cursor:
            cursor.close()

        if conn:
            conn.close()


# ============================================================
# OPTIONAL:
# ADD A STATUS HISTORY RECORD
#
# You can use this later from admin/department routes.
# ============================================================

@complaint_tracking_bp.route(
    "/<int:complaint_id>/history",
    methods=["POST"]
)
def add_complaint_status_history(complaint_id):

    user_id = get_logged_in_user_id()

    if user_id is None:

        return jsonify({
            "success": False,
            "message": "Authentication required"
        }), 401

    data = request.get_json(
        silent=True
    )

    if not isinstance(data, dict):

        return jsonify({
            "success": False,
            "message": "Request body must be valid JSON"
        }), 400

    status = data.get("status")
    message = data.get("message")
    department = data.get("department")

    # --------------------------------------------------------
    # VALIDATE STATUS
    # --------------------------------------------------------

    valid_statuses = [
        "SUBMITTED",
        "AI_ANALYSIS",
        "CLASSIFIED",
        "FORWARDED",
        "ASSIGNED",
        "UNDER_REVIEW",
        "ACTION_IN_PROGRESS",
        "RESOLVED",
        "CLOSED"
    ]

    if not status:

        return jsonify({
            "success": False,
            "message": "Status is required"
        }), 400

    status = str(status).strip().upper()

    if status not in valid_statuses:

        return jsonify({
            "success": False,
            "message": "Invalid complaint status"
        }), 400

    conn = None
    cursor = None

    try:

        conn = get_connection()

        cursor = conn.cursor(
            dictionary=True
        )

        # ----------------------------------------------------
        # CHECK COMPLAINT EXISTS
        # ----------------------------------------------------

        cursor.execute(
            """
            SELECT
                complaint_id,
                user_id
            FROM complaints
            WHERE complaint_id = %s
            LIMIT 1
            """,
            (complaint_id,)
        )

        complaint = cursor.fetchone()

        if not complaint:

            return jsonify({
                "success": False,
                "message": "Complaint not found"
            }), 404

        # ----------------------------------------------------
        # INSERT HISTORY
        # ----------------------------------------------------

        cursor.execute(
            """
            INSERT INTO complaint_status_history
            (
                complaint_id,
                status,
                message,
                department,
                updated_by
            )
            VALUES
            (
                %s,
                %s,
                %s,
                %s,
                %s
            )
            """,
            (
                complaint_id,
                status,
                message.strip()
                if message else None,
                department.strip()
                if department else None,
                user_id
            )
        )

        # ----------------------------------------------------
        # UPDATE CURRENT COMPLAINT STATUS
        # ----------------------------------------------------

        cursor.execute(
            """
            UPDATE complaints
            SET
                status = %s,
                updated_at = CURRENT_TIMESTAMP
            WHERE complaint_id = %s
            """,
            (
                status,
                complaint_id
            )
        )

        # ----------------------------------------------------
        # INSERT NOTIFICATION
        # ----------------------------------------------------
        notif_user_id = complaint.get("user_id") if isinstance(complaint, dict) else complaint[1]
        if notif_user_id:
            dept_text = f" ({department.strip()})" if department and department.strip() else ""
            msg_text = message.strip() if message and message.strip() else f"Complaint status updated to {status}."
            cursor.execute(
                """
                INSERT INTO notifications
                (
                    user_id,
                    complaint_id,
                    type,
                    title,
                    message,
                    is_read
                )
                VALUES (%s, %s, %s, %s, %s, 0)
                """,
                (
                    notif_user_id,
                    complaint_id,
                    "STATUS_UPDATE",
                    f"Complaint #{complaint_id} Status Updated",
                    f"Status changed to {status}{dept_text}: {msg_text}"
                )
            )

        conn.commit()

        return jsonify({
            "success": True,
            "message": "Complaint status updated successfully"
        }), 201


    except Exception as e:

        print(
            "❌ STATUS UPDATE ERROR:",
            repr(e)
        )

        if conn:
            conn.rollback()

        return jsonify({
            "success": False,
            "message": "Failed to update complaint status"
        }), 500


    finally:

        if cursor:
            cursor.close()

        if conn:
            conn.close()