import hashlib
import jwt
from pymysql.err import IntegrityError

from datetime import datetime
from io import BytesIO

from flask import Blueprint, current_app, jsonify, request, send_file

from database import get_connection
from routes.officer_routes import department_matches


field_worker_bp = Blueprint("field_worker", __name__)


def get_officer_id():
    authorization = request.headers.get("Authorization", "")

    if not authorization.startswith("Bearer "):
        return None

    try:
        payload = jwt.decode(
            authorization.split(" ", 1)[1].strip(),
            current_app.config["SECRET_KEY"],
            algorithms=["HS256"],
        )
        return payload.get("id")
    except (jwt.ExpiredSignatureError, jwt.InvalidTokenError):
        return None


def require_officer():
    officer_id = get_officer_id()

    if not officer_id:
        return None, (jsonify({"message": "Officer authentication required."}), 401)

    return officer_id, None


def password_hash(password):
    return hashlib.sha256(password.encode()).hexdigest()


def get_worker_id():
    authorization = request.headers.get("Authorization", "")

    if not authorization.startswith("Bearer "):
        return None

    try:
        payload = jwt.decode(
            authorization.split(" ", 1)[1].strip(),
            current_app.config["SECRET_KEY"],
            algorithms=["HS256"],
        )
        if payload.get("role") != "field_worker":
            return None
        return payload.get("worker_id")
    except (jwt.ExpiredSignatureError, jwt.InvalidTokenError):
        return None


def require_worker():
    worker_id = get_worker_id()
    if not worker_id:
        return None, (jsonify({"message": "Field worker authentication required."}), 401)
    return worker_id, None


def parse_datetime(value):
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00")).replace(tzinfo=None)
    except (TypeError, ValueError):
        return None


@field_worker_bp.post("/login")
def field_worker_login():
    data = request.get_json(silent=True) or {}
    username = str(data.get("username", "")).strip()
    password = str(data.get("password", ""))

    if not username or not password:
        return jsonify({"message": "Username and password are required."}), 400

    conn = None
    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT worker_id, officer_id, full_name, username, password_hash,
                   status, expires_at
            FROM field_workers
            WHERE username = %s
            LIMIT 1
            """,
            (username,),
        )
        worker = cursor.fetchone()

        if not worker or worker["password_hash"] != password_hash(password):
            return jsonify({"message": "Invalid username or password."}), 401
        if worker["status"] != "ACTIVE":
            return jsonify({"message": f"Worker account is {worker['status'].lower()}."}), 403
        if worker["expires_at"] and worker["expires_at"] <= datetime.now():
            cursor.execute(
                "UPDATE field_workers SET status = 'EXPIRED' WHERE worker_id = %s",
                (worker["worker_id"],),
            )
            conn.commit()
            return jsonify({"message": "Worker account has expired."}), 403

        token = jwt.encode(
            {
                "worker_id": worker["worker_id"],
                "role": "field_worker",
                "exp": datetime.utcnow().timestamp() + (8 * 60 * 60),
            },
            current_app.config["SECRET_KEY"],
            algorithm="HS256",
        )

        return jsonify({
            "success": True,
            "access_token": token,
            "worker": {
                "worker_id": worker["worker_id"],
                "officer_id": worker["officer_id"],
                "full_name": worker["full_name"],
                "username": worker["username"],
                "expires_at": worker["expires_at"],
            },
        })
    except Exception as error:
        return database_error_response(error)
    finally:
        if conn:
            conn.close()


@field_worker_bp.get("/dashboard")
def worker_dashboard():
    worker_id, error = require_worker()
    if error:
        return error

    conn = None
    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT fwe.evidence_id, fwe.complaint_id,
                   fwe.status AS evidence_status, fwe.ai_status,
                   fwe.assigned_at, fwe.submitted_at,
                   c.title, c.description, c.address, c.category,
                   c.priority, c.status AS complaint_status,
                   c.latitude, c.longitude, c.created_at
            FROM field_worker_evidence fwe
            JOIN complaints c ON c.complaint_id = fwe.complaint_id
            WHERE fwe.worker_id = %s
              AND fwe.status IN ('ASSIGNED', 'SUBMITTED')
            ORDER BY fwe.assigned_at DESC
            """,
            (worker_id,),
        )
        complaints = cursor.fetchall()
        for complaint in complaints:
            complaint["status"] = complaint.pop("evidence_status") or complaint["complaint_status"]
        return jsonify({"success": True, "complaints": complaints})
    except Exception as error:
        return database_error_response(error)
    finally:
        if conn:
            conn.close()


@field_worker_bp.get("/complaints/<int:complaint_id>")
def worker_complaint(complaint_id):
    worker_id, error = require_worker()
    if error:
        return error

    conn = None
    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT fwe.evidence_id, fwe.complaint_id,
                   fwe.status AS evidence_status, fwe.ai_status,
                   fwe.assigned_at, fwe.submitted_at,
                   c.title, c.description, c.address, c.category,
                   c.priority, c.status AS complaint_status,
                   c.latitude, c.longitude, c.created_at
            FROM field_worker_evidence fwe
            JOIN complaints c ON c.complaint_id = fwe.complaint_id
            WHERE fwe.worker_id = %s AND fwe.complaint_id = %s
            LIMIT 1
            """,
            (worker_id, complaint_id),
        )
        complaint = cursor.fetchone()
        if not complaint:
            return jsonify({"message": "Complaint is not assigned to this worker."}), 404
        complaint["status"] = complaint.pop("evidence_status") or complaint["complaint_status"]
        return jsonify({"success": True, "complaint": complaint})
    except Exception as error:
        return database_error_response(error)
    finally:
        if conn:
            conn.close()


@field_worker_bp.post("/complaints/<int:complaint_id>/submit")
def submit_worker_evidence(complaint_id):
    worker_id, error = require_worker()
    if error:
        return error

    image = request.files.get("image")
    if not image or not image.mimetype.startswith("image/"):
        return jsonify({"message": "A valid resolution image is required."}), 400

    image_data = image.read()
    if not image_data or len(image_data) > 10 * 1024 * 1024:
        return jsonify({"message": "Image must be between 1 byte and 10 MB."}), 400

    conn = None
    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT evidence_id FROM field_worker_evidence
            WHERE worker_id = %s AND complaint_id = %s AND status = 'ASSIGNED'
            LIMIT 1
            """,
            (worker_id, complaint_id),
        )
        evidence = cursor.fetchone()
        if not evidence:
            return jsonify({"message": "This complaint is not awaiting evidence."}), 400

        captured_at = parse_datetime(request.form.get("captured_at")) or datetime.now()
        cursor.execute(
            """
            UPDATE field_worker_evidence
            SET image = %s, image_mime_type = %s, latitude = %s,
                longitude = %s, captured_at = %s, submitted_at = NOW(),
                status = 'SUBMITTED', ai_status = 'PASSED',
                ai_reason = 'Image submitted for officer verification.'
            WHERE evidence_id = %s
            """,
            (
                image_data,
                image.mimetype,
                request.form.get("latitude"),
                request.form.get("longitude"),
                captured_at,
                evidence["evidence_id"],
            ),
        )

        cursor.execute(
            """
            UPDATE complaints
            SET status = 'UNDER_REVIEW', updated_at = NOW()
            WHERE complaint_id = %s
            """,
            (complaint_id,),
        )

        cursor.execute(
            """
            INSERT INTO complaint_status_history
                (complaint_id, status, message, updated_by, created_at)
            VALUES (%s, 'UNDER_REVIEW', %s, %s, NOW())
            """,
            (
                complaint_id,
                "Field worker submitted resolution evidence for officer verification.",
                worker_id,
            ),
        )

        conn.commit()
        return jsonify({
            "success": True,
            "evidence_id": evidence["evidence_id"],
            "status": "UNDER_REVIEW",
            "message": "Resolution evidence submitted for officer verification.",
        })
    except Exception as error:
        if conn:
            conn.rollback()
        return database_error_response(error)
    finally:
        if conn:
            conn.close()


@field_worker_bp.get("/complaints/<int:complaint_id>/image")
def worker_complaint_image(complaint_id):
    worker_id, error = require_worker()
    if error:
        return error

    conn = None
    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT c.image, c.image_mime_type
            FROM complaints c
            JOIN field_worker_evidence fwe ON fwe.complaint_id = c.complaint_id
            WHERE c.complaint_id = %s
              AND fwe.worker_id = %s
              AND fwe.status IN ('ASSIGNED', 'SUBMITTED')
            LIMIT 1
            """,
            (complaint_id, worker_id),
        )
        complaint = cursor.fetchone()
        if not complaint or not complaint["image"]:
            return jsonify({"message": "Complaint image not found."}), 404

        return send_file(
            BytesIO(complaint["image"]),
            mimetype=complaint["image_mime_type"] or "image/jpeg",
        )
    except Exception as error:
        return database_error_response(error)
    finally:
        if conn:
            conn.close()


def database_error_response(error):
    current_app.logger.exception("Field worker database error: %s", error)

    if isinstance(error, IntegrityError):
        return jsonify({
            "message": "Unable to save the field-worker assignment. "
                       "The selected worker, complaint, or officer record is invalid."
        }), 400

    return jsonify({"message": "Field worker data could not be loaded."}), 500


@field_worker_bp.get("/workers")
def list_workers():
    officer_id, error = require_officer()
    if error:
        return error

    conn = None
    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT
                fw.worker_id, fw.officer_id, fw.full_name, fw.username,
                fw.status, fw.expires_at, fw.created_at,
                COUNT(CASE WHEN fwe.status IN ('ASSIGNED', 'SUBMITTED') THEN 1 END) AS assigned_count
            FROM field_workers fw
            LEFT JOIN field_worker_evidence fwe ON fwe.worker_id = fw.worker_id
            WHERE fw.officer_id = %s
            GROUP BY fw.worker_id, fw.officer_id, fw.full_name, fw.username,
                     fw.status, fw.expires_at, fw.created_at
            ORDER BY fw.created_at DESC
            """,
            (officer_id,),
        )
        workers = cursor.fetchall()

        for worker in workers:
            if worker["status"] == "ACTIVE" and worker["expires_at"] and worker["expires_at"] < datetime.now():
                cursor.execute(
                    "UPDATE field_workers SET status = 'EXPIRED' WHERE worker_id = %s",
                    (worker["worker_id"],),
                )
                worker["status"] = "EXPIRED"

        conn.commit()
        return jsonify({"success": True, "workers": workers})
    except Exception as error:
        return database_error_response(error)
    finally:
        if conn:
            conn.close()


@field_worker_bp.get("/complaints")
def list_assignable_complaints():
    officer_id, error = require_officer()
    if error:
        return error

    conn = None
    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute(
            "SELECT department FROM officers WHERE officer_id = %s LIMIT 1",
            (officer_id,),
        )
        officer = cursor.fetchone()
        if not officer:
            return jsonify({"message": "Officer not found."}), 404

        cursor.execute(
            """
            SELECT c.complaint_id, c.title, c.description, c.status, c.priority,
                   c.address, c.created_at, c.officer_id, g.department
            FROM complaints c
            LEFT JOIN complaint_governance g ON g.complaint_id = c.complaint_id
            LEFT JOIN field_worker_evidence fwe
              ON fwe.complaint_id = c.complaint_id
             AND fwe.status IN ('ASSIGNED', 'SUBMITTED')
            WHERE (c.officer_id = %s OR c.officer_id IS NULL)
              AND c.status NOT IN ('RESOLVED', 'CLOSED', 'REJECTED')
              AND fwe.evidence_id IS NULL
            ORDER BY c.created_at DESC
            """,
            (officer_id,),
        )
        complaints = cursor.fetchall()
        related_complaints = [
            complaint
            for complaint in complaints
            if complaint.get("officer_id") == officer_id
            or department_matches(officer.get("department"), complaint.get("department"))
        ]
        return jsonify({"success": True, "complaints": related_complaints})
    except Exception as error:
        return database_error_response(error)
    finally:
        if conn:
            conn.close()


@field_worker_bp.post("/create")
def create_worker():
    officer_id, error = require_officer()
    if error:
        return error

    data = request.get_json(silent=True) or {}
    full_name = str(data.get("full_name", "")).strip()
    username = str(data.get("username", "")).strip()
    password = str(data.get("password", ""))
    expires_at = parse_datetime(data.get("expires_at"))

    if not full_name or not username or not password or not expires_at:
        return jsonify({"message": "All worker details are required."}), 400
    if expires_at <= datetime.now():
        return jsonify({"message": "Account expiry must be in the future."}), 400

    conn = None
    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT worker_id FROM field_workers WHERE username = %s", (username,))
        if cursor.fetchone():
            return jsonify({"message": "Username already exists."}), 409

        cursor.execute(
            "SELECT officer_id FROM officers WHERE officer_id = %s LIMIT 1",
            (officer_id,),
        )
        if not cursor.fetchone():
            return jsonify({"message": "Authenticated officer record was not found."}), 403

        cursor.execute(
            """
            INSERT INTO field_workers
                (officer_id, full_name, username, password_hash, status, expires_at)
            VALUES (%s, %s, %s, %s, 'ACTIVE', %s)
            """,
            (officer_id, full_name, username, password_hash(password), expires_at),
        )
        conn.commit()
        return jsonify({"success": True, "worker_id": cursor.lastrowid}), 201
    except Exception as error:
        if conn:
            conn.rollback()
        return database_error_response(error)
    finally:
        if conn:
            conn.close()


def set_worker_status(worker_id, status):
    officer_id, error = require_officer()
    if error:
        return error

    conn = None
    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute(
            "SELECT expires_at FROM field_workers WHERE worker_id = %s AND officer_id = %s",
            (worker_id, officer_id),
        )
        worker = cursor.fetchone()
        if not worker:
            return jsonify({"message": "Worker not found."}), 404
        if status == "ACTIVE" and worker["expires_at"] <= datetime.now():
            return jsonify({"message": "Worker account has expired."}), 400

        cursor.execute(
            "UPDATE field_workers SET status = %s WHERE worker_id = %s",
            (status, worker_id),
        )
        conn.commit()
        return jsonify({"success": True})
    except Exception as error:
        if conn:
            conn.rollback()
        return database_error_response(error)
    finally:
        if conn:
            conn.close()


@field_worker_bp.put("/workers/<int:worker_id>/disable")
def disable_worker(worker_id):
    return set_worker_status(worker_id, "DISABLED")


@field_worker_bp.put("/workers/<int:worker_id>/enable")
def enable_worker(worker_id):
    return set_worker_status(worker_id, "ACTIVE")


@field_worker_bp.post("/assign")
def assign_complaint():
    officer_id, error = require_officer()
    if error:
        return error

    data = request.get_json(silent=True) or {}
    worker_id = data.get("worker_id")
    complaint_id = data.get("complaint_id")
    if not worker_id or not complaint_id:
        return jsonify({"message": "Worker and complaint are required."}), 400

    conn = None
    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute(
            "SELECT status, expires_at FROM field_workers WHERE worker_id = %s AND officer_id = %s",
            (worker_id, officer_id),
        )
        worker = cursor.fetchone()
        if not worker or worker["status"] != "ACTIVE" or (worker["expires_at"] and worker["expires_at"] < datetime.now()):
            return jsonify({"message": "Worker is not active or has expired."}), 400

        cursor.execute(
            "SELECT department FROM officers WHERE officer_id = %s LIMIT 1",
            (officer_id,),
        )
        officer = cursor.fetchone()
        if not officer:
            return jsonify({"message": "Officer not found."}), 404

        cursor.execute(
            """
            SELECT c.officer_id, g.department
            FROM complaints c
            LEFT JOIN complaint_governance g ON g.complaint_id = c.complaint_id
            WHERE c.complaint_id = %s
            """,
            (complaint_id,),
        )
        complaint = cursor.fetchone()
        if (
            not complaint
            or (
                complaint.get("officer_id") != officer_id
                and not department_matches(
                    officer.get("department"), complaint.get("department")
                )
            )
        ):
            return jsonify({"message": "Complaint is not assigned to this officer."}), 403

        cursor.execute(
            """
            SELECT evidence_id FROM field_worker_evidence
            WHERE complaint_id = %s AND status IN ('ASSIGNED', 'SUBMITTED') LIMIT 1
            """,
            (complaint_id,),
        )
        if cursor.fetchone():
            return jsonify({"message": "Complaint is already assigned to a field worker."}), 409

        cursor.execute(
            """
            INSERT INTO field_worker_evidence (worker_id, complaint_id, assigned_by, status, ai_status)
            VALUES (%s, %s, %s, 'ASSIGNED', 'PENDING')
            """,
            (worker_id, complaint_id, officer_id),
        )
        cursor.execute(
            "UPDATE complaints SET status = 'IN_PROGRESS', updated_at = NOW() WHERE complaint_id = %s",
            (complaint_id,),
        )
        conn.commit()
        return jsonify({"success": True, "evidence_id": cursor.lastrowid})
    except Exception as error:
        if conn:
            conn.rollback()
        return database_error_response(error)
    finally:
        if conn:
            conn.close()


@field_worker_bp.get("/evidence")
def list_evidence():
    officer_id, error = require_officer()
    if error:
        return error

    conn = None
    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT fwe.evidence_id, fwe.worker_id, fwe.complaint_id, fwe.status,
                   fwe.ai_status, fwe.ai_reason, fwe.latitude, fwe.longitude,
                   fwe.captured_at, fwe.submitted_at, fw.full_name AS worker_name,
                   fw.username AS worker_username, c.title, c.address
            FROM field_worker_evidence fwe
            JOIN field_workers fw ON fw.worker_id = fwe.worker_id
            JOIN complaints c ON c.complaint_id = fwe.complaint_id
            WHERE fwe.assigned_by = %s AND fwe.status = 'SUBMITTED'
            ORDER BY fwe.submitted_at DESC
            """,
            (officer_id,),
        )
        return jsonify({"success": True, "evidence": cursor.fetchall()})
    except Exception as error:
        return database_error_response(error)
    finally:
        if conn:
            conn.close()


@field_worker_bp.get("/evidence/<int:evidence_id>/image")
def evidence_image(evidence_id):
    officer_id, error = require_officer()
    if error:
        return error

    conn = None
    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT image, image_mime_type FROM field_worker_evidence
            WHERE evidence_id = %s AND assigned_by = %s
            """,
            (evidence_id, officer_id),
        )
        evidence = cursor.fetchone()
        if not evidence or not evidence["image"]:
            return jsonify({"message": "Evidence image not found."}), 404

        return send_file(
            BytesIO(evidence["image"]),
            mimetype=evidence["image_mime_type"] or "image/jpeg",
        )
    except Exception as error:
        return database_error_response(error)
    finally:
        if conn:
            conn.close()


def review_evidence(evidence_id, approved, reason=""):
    officer_id, error = require_officer()
    if error:
        return error

    conn = None
    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute(
            "SELECT complaint_id, status, image FROM field_worker_evidence WHERE evidence_id = %s AND assigned_by = %s",
            (evidence_id, officer_id),
        )
        evidence = cursor.fetchone()
        if not evidence or evidence["status"] != "SUBMITTED":
            return jsonify({"message": "Evidence is not pending review."}), 400

        if approved:
            cursor.execute(
                """
                UPDATE field_worker_evidence
                SET status = 'APPROVED', reviewed_by = %s, reviewed_at = NOW()
                WHERE evidence_id = %s
                """,
                (officer_id, evidence_id),
            )
            cursor.execute(
                """
                UPDATE complaints SET status = 'RESOLVED', resolution_image = %s,
                resolved_at = NOW(), updated_at = NOW() WHERE complaint_id = %s
                """,
                (evidence["image"], evidence["complaint_id"]),
            )
            cursor.execute(
                """
                INSERT INTO complaint_status_history
                    (complaint_id, status, message, updated_by, created_at, status_image)
                VALUES (%s, 'RESOLVED', %s, %s, NOW(), %s)
                """,
                (
                    evidence["complaint_id"],
                    "Resolution evidence approved by officer.",
                    officer_id,
                    evidence["image"],
                ),
            )
        else:
            cursor.execute(
                """
                UPDATE field_worker_evidence
                SET status = 'REJECTED', reviewed_by = %s, reviewed_at = NOW(), officer_reason = %s
                WHERE evidence_id = %s
                """,
                (officer_id, reason, evidence_id),
            )
            cursor.execute(
                """
                UPDATE complaints
                SET status = 'ASSIGNED', updated_at = NOW()
                WHERE complaint_id = %s
                """,
                (evidence["complaint_id"],),
            )
            cursor.execute(
                """
                INSERT INTO complaint_status_history
                    (complaint_id, status, message, updated_by, created_at)
                VALUES (%s, 'ASSIGNED', %s, %s, NOW())
                """,
                (
                    evidence["complaint_id"],
                    f"Resolution evidence rejected by officer: {reason}",
                    officer_id,
                ),
            )

        conn.commit()
        return jsonify({"success": True})
    except Exception as error:
        if conn:
            conn.rollback()
        return database_error_response(error)
    finally:
        if conn:
            conn.close()


@field_worker_bp.post("/evidence/<int:evidence_id>/approve")
def approve_evidence(evidence_id):
    return review_evidence(evidence_id, True)


@field_worker_bp.post("/evidence/<int:evidence_id>/reject")
def reject_evidence(evidence_id):
    data = request.get_json(silent=True) or {}
    reason = str(data.get("reason", "")).strip()
    if not reason:
        return jsonify({"message": "Rejection reason is required."}), 400
    return review_evidence(evidence_id, False, reason)