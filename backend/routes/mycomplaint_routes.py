import os
import base64
import jwt

from flask import (
    Blueprint,
    request,
    jsonify,
)

from database import get_connection


# =========================================================
# BLUEPRINT
# =========================================================

mycomplaint_bp = Blueprint(
    "mycomplaints",
    __name__
)


# =========================================================
# SERIALIZE DATETIME
# =========================================================

def serialize_datetime(value):

    if value is None:
        return None

    if hasattr(value, "isoformat"):
        return value.isoformat()

    return str(value)


def serialize_image_to_data_url(image_bytes, mime_type):

    if not image_bytes:
        return None

    # Handle memoryview
    if isinstance(image_bytes, memoryview):
        image_bytes = image_bytes.tobytes()

    # Handle bytes
    if isinstance(image_bytes, bytes):
        encoded = base64.b64encode(image_bytes).decode("utf-8")
        mime = mime_type or "image/png"
        return f"data:{mime};base64,{encoded}"

    # Handle string (shouldn't happen, but handle it)
    if isinstance(image_bytes, str):
        try:
            # Try to encode the string to bytes first
            image_bytes = image_bytes.encode("latin-1")
            encoded = base64.b64encode(image_bytes).decode("utf-8")
            mime = mime_type or "image/png"
            return f"data:{mime};base64,{encoded}"
        except Exception:
            return None

    return None


# =========================================================
# GET LOGGED-IN USER FROM JWT
# =========================================================

def get_logged_in_user():

    authorization = request.headers.get(
        "Authorization"
    )

    # Check Authorization header
    if (
        not authorization
        or not authorization.startswith("Bearer ")
    ):
        return None

    try:

        # Extract token
        token = authorization.split(
            " ",
            1
        )[1]

        # Get secret key
        secret_key = os.getenv(
            "SECRET_KEY"
        )

        if not secret_key:
            print("❌ SECRET_KEY not found")
            return None

        # Decode JWT
        payload = jwt.decode(
            token,
            secret_key,
            algorithms=["HS256"]
        )

        # Validate user ID
        if not payload.get("id"):
            return None

        return payload

    except jwt.ExpiredSignatureError:

        print("❌ JWT token expired")
        return None

    except jwt.InvalidTokenError:

        print("❌ Invalid JWT token")
        return None

    except Exception as e:

        print(
            "❌ JWT AUTH ERROR:",
            repr(e)
        )

        return None


# =========================================================
# GET ALL COMPLAINTS OF LOGGED-IN USER
# =========================================================
#
# GET /api/my-complaints
#
# =========================================================

@mycomplaint_bp.route(
    "",
    methods=["GET"]
)
def get_my_complaints():

    # -----------------------------------------------------
    # AUTHENTICATE USER
    # -----------------------------------------------------

    user = get_logged_in_user()

    if not user:

        return jsonify({
            "message": "Authentication required"
        }), 401


    user_id = user.get("id")


    # -----------------------------------------------------
    # DATABASE VARIABLES
    # -----------------------------------------------------

    conn = None
    cursor = None


    try:

        conn = get_connection()

        cursor = conn.cursor()


        # -------------------------------------------------
        # GET ONLY LOGGED-IN USER'S COMPLAINTS
        # -------------------------------------------------

        cursor.execute(
            """
            SELECT
                complaint_id,
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
                priority,
                created_at,
                updated_at
            FROM complaints
            WHERE user_id = %s
            ORDER BY complaint_id DESC
            """,
            (user_id,)
        )


        rows = cursor.fetchall()

        complaints = []


        # -------------------------------------------------
        # FORMAT RESPONSE
        # -------------------------------------------------

        for row in rows:

            # row is already a dict from DictCursor
            complaint = dict(row)


            # Convert datetime values for JSON
            complaint["created_at"] = serialize_datetime(
                complaint.get("created_at")
            )

            complaint["updated_at"] = serialize_datetime(
                complaint.get("updated_at")
            )


            # -------------------------------------------------
            # IMAGE DATA URL
            #
            # The image is stored in the database as a LONGBLOB,
            # so return it directly as a data URL instead of
            # fetching a second image API.
            # -------------------------------------------------

            complaint["image_data_url"] = serialize_image_to_data_url(
                complaint.get("image"),
                complaint.get("image_mime_type")
            )

            complaint.pop("image", None)
            complaint.pop("image_mime_type", None)

            complaints.append(
                complaint
            )


        print(
            f"✅ Retrieved {len(complaints)} complaints "
            f"for User ID: {user_id}"
        )


        return jsonify({
            "message":
                "Complaints retrieved successfully",

            "count":
                len(complaints),

            "complaints":
                complaints,
        }), 200


    except Exception as e:

        print(
            "❌ GET MY COMPLAINTS ERROR:",
            repr(e)
        )

        return jsonify({
            "message":
                "Failed to retrieve complaints",

            "error":
                str(e),
        }), 500


    finally:

        if cursor:

            cursor.close()

        if conn:

            conn.close()


# =========================================================
# GET SINGLE COMPLAINT OF LOGGED-IN USER
# =========================================================
#
# GET /api/my-complaints/<complaint_id>
#
# =========================================================

@mycomplaint_bp.route(
    "/<int:complaint_id>",
    methods=["GET"]
)
def get_single_complaint(complaint_id):

    # -----------------------------------------------------
    # AUTHENTICATE USER
    # -----------------------------------------------------

    user = get_logged_in_user()

    if not user:

        return jsonify({
            "message": "Authentication required"
        }), 401


    user_id = user.get("id")


    # -----------------------------------------------------
    # DATABASE VARIABLES
    # -----------------------------------------------------

    conn = None
    cursor = None


    try:

        conn = get_connection()

        cursor = conn.cursor()


        # -------------------------------------------------
        # GET ONLY IF COMPLAINT BELONGS TO LOGGED-IN USER
        # -------------------------------------------------

        cursor.execute(
            """
            SELECT
                complaint_id,
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
                priority,
                created_at,
                updated_at
            FROM complaints
            WHERE complaint_id = %s
            AND user_id = %s
            """,
            (
                complaint_id,
                user_id
            )
        )


        row = cursor.fetchone()


        # -------------------------------------------------
        # NOT FOUND
        # -------------------------------------------------

        if not row:

            return jsonify({
                "message":
                    "Complaint not found"
            }), 404


        # row is already a dict from DictCursor
        complaint = dict(row)


        # -------------------------------------------------
        # SERIALIZE DATES
        # -------------------------------------------------

        complaint["created_at"] = serialize_datetime(
            complaint.get("created_at")
        )

        complaint["updated_at"] = serialize_datetime(
            complaint.get("updated_at")
        )


        # -------------------------------------------------
        # IMAGE DATA URL
        # -------------------------------------------------

        complaint["image_data_url"] = serialize_image_to_data_url(
            complaint.get("image"),
            complaint.get("image_mime_type")
        )
        complaint.pop("image", None)
        complaint.pop("image_mime_type", None)

        print(
            f"✅ Retrieved Complaint ID: "
            f"{complaint_id}"
        )


        return jsonify({
            "message":
                "Complaint retrieved successfully",

            "complaint":
                complaint,
        }), 200


    except Exception as e:

        print(
            "❌ GET SINGLE COMPLAINT ERROR:",
            repr(e)
        )

        return jsonify({
            "message":
                "Failed to retrieve complaint",

            "error":
                str(e),
        }), 500


    finally:

        if cursor:

            cursor.close()

        if conn:

            conn.close()