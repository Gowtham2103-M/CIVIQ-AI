import os
import base64
import jwt
import pymysql
import threading

from flask import (
    Blueprint,
    request,
    jsonify,
)

from database import get_connection
from agent.pipeline import process_complaint


complaint_bp = Blueprint(
    "complaints",
    __name__,
    url_prefix="/api/complaints"
)


ALLOWED_MIMETYPES = {
    "image/jpeg",
    "image/png",
    "image/webp"
}

ALLOWED_EXTENSIONS = {
    "jpg",
    "jpeg",
    "png",
    "webp"
}


def serialize_datetime(value):
    if value is None:
        return None

    if hasattr(value, "isoformat"):
        return value.isoformat()

    return str(value)


def serialize_image_to_data_url(image_bytes, mime_type):
    if not image_bytes:
        return None

    if isinstance(image_bytes, memoryview):
        image_bytes = image_bytes.tobytes()

    if isinstance(image_bytes, bytes):
        encoded = base64.b64encode(image_bytes).decode("utf-8")
        mime = mime_type or "image/png"
        return f"data:{mime};base64,{encoded}"

    if isinstance(image_bytes, str):
        try:
            image_bytes = image_bytes.encode("latin-1")
            encoded = base64.b64encode(image_bytes).decode("utf-8")
            mime = mime_type or "image/png"
            return f"data:{mime};base64,{encoded}"
        except Exception:
            return None

    return None


def allowed_file(filename, mimetype):
    if not filename:
        return False

    if "." not in filename:
        return False

    extension = filename.rsplit(".", 1)[1].lower()
    return extension in ALLOWED_EXTENSIONS and mimetype in ALLOWED_MIMETYPES


def get_logged_in_user():
    authorization = request.headers.get("Authorization")

    if not authorization or not authorization.startswith("Bearer "):
        return None

    token = authorization.split(" ", 1)[1]
    secret_key = os.getenv("SECRET_KEY")

    if not secret_key:
        print("? SECRET_KEY is not configured")
        return None

    try:
        payload = jwt.decode(token, secret_key, algorithms=["HS256"])
        if not payload.get("id"):
            return None
        return payload
    except jwt.ExpiredSignatureError:
        print("? JWT expired")
        return None
    except jwt.InvalidTokenError as e:
        print("? Invalid JWT:", repr(e))
        return None


@complaint_bp.route("", methods=["POST"])
def create_complaint():
    user = get_logged_in_user()

    if not user:
        return jsonify({"message": "Authentication required"}), 401

    user_id = user.get("id")

    image = request.files.get("complaint_image")
    title = request.form.get("title", "").strip()
    description = request.form.get("description", "").strip()
    latitude = request.form.get("latitude")
    longitude = request.form.get("longitude")

    # Suspended users must resolve the penalty before submitting again.
    conn = None
    cursor = None
    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute(
            "SELECT account_status FROM users WHERE user_id = %s",
            (user_id,),
        )
        account = cursor.fetchone()
        if account and str(account.get("account_status") or "ACTIVE").upper() == "SUSPENDED":
            return jsonify({
                "message": "Account suspended. Complete the required penalty payment before submitting complaints.",
                "account_status": "SUSPENDED",
            }), 403
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()

    if latitude is None or longitude is None:
        return jsonify({"message": "Location is required"}), 400

    try:
        latitude = float(latitude)
        longitude = float(longitude)
    except (ValueError, TypeError):
        return jsonify({"message": "Invalid location coordinates"}), 400

    if not -90 <= latitude <= 90:
        return jsonify({"message": "Invalid latitude"}), 400

    if not -180 <= longitude <= 180:
        return jsonify({"message": "Invalid longitude"}), 400

    if not image:
        return jsonify({"message": "Complaint image is required"}), 400

    if not allowed_file(image.filename, image.mimetype):
        return jsonify({"message": "Only JPG, JPEG, PNG and WEBP images are allowed"}), 400

    try:
        image_data = image.read()
    except Exception as e:
        print("? IMAGE READ ERROR:", repr(e))
        return jsonify({"message": "Failed to read image"}), 500

    if not image_data:
        return jsonify({"message": "Uploaded image is empty"}), 400

    conn = None
    cursor = None

    try:
        conn = get_connection()
        cursor = conn.cursor()

        if not title:
            title = "Civic Complaint"

        category = "General"
        address = f"Location ({latitude}, {longitude})"
        status = "SUBMITTED"
        priority = "MEDIUM"

        cursor.execute(
            """
            INSERT INTO complaints
            (
                user_id,
                title,
                description,
                image,
                image_mime_type,
                latitude,
                longitude,
                address,
                category,
                status,
                priority
            )
            VALUES
            (
                %s,
                %s,
                %s,
                %s,
                %s,
                %s,
                %s,
                %s,
                %s,
                %s,
                %s
            )
            """,
            (
                user_id,
                title,
                description if description else None,
                image_data,
                image.mimetype,
                latitude,
                longitude,
                address,
                category,
                status,
                priority,
            ),
        )

        complaint_id = cursor.lastrowid

        cursor.execute(
            """
            INSERT INTO complaint_status_history
            (complaint_id, status, message, department, updated_by)
            VALUES (%s, %s, %s, %s, %s)
            """,
            (
                complaint_id,
                status,
                "Complaint submitted successfully.",
                None,
                user_id,
            ),
        )

        conn.commit()

        print(f"? Complaint created: {complaint_id} | Status: {status} | Priority: NULL")

        # =====================================================
        # TRIGGER AI PIPELINE ASYNCHRONOUSLY IN BACKGROUND
        # =====================================================
        def run_pipeline_async(cid):
            try:
                print(f"[Pipeline Background] Starting async pipeline for complaint {cid}...")
                process_complaint(cid)
                print(f"[Pipeline Background] Pipeline completed for complaint {cid}.")
            except Exception as pipeline_error:
                print(f"[PIPELINE ERROR] for complaint {cid}: {repr(pipeline_error)}")

        thread = threading.Thread(
            target=run_pipeline_async,
            args=(complaint_id,),
            daemon=True
        )
        thread.start()

        # =====================================================
        # IMMEDIATE RESPONSE (STATUS: SUBMITTED)
        # =====================================================
        response_data = {
            "message": "Complaint submitted successfully",
            "complaint": {
                "complaint_id": complaint_id,
                "user_id": user_id,
                "title": title,
                "description": description if description else None,
                "latitude": latitude,
                "longitude": longitude,
                "status": status,
                "priority": priority,
            },
        }

        return jsonify(response_data), 201

    except Exception as e:
        print("? COMPLAINT INSERT ERROR:", repr(e))
        if conn:
            conn.rollback()
        return jsonify({"message": "Failed to submit complaint", "error": str(e)}), 500

    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()


