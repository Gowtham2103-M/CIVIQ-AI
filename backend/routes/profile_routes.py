import os
import jwt
import pymysql

from flask import Blueprint, request, jsonify
from database import get_connection


profile_bp = Blueprint(
    "profile",
    __name__,
    url_prefix="/api/profile"
)


# ============================================================
# AUTHENTICATION
# ============================================================

def get_logged_in_user():
    """
    Get authenticated user information from JWT.
    Returns decoded JWT payload or None.
    """

    authorization = request.headers.get("Authorization")

    if not authorization:
        return None

    if not authorization.startswith("Bearer "):
        return None

    token = authorization.split(" ", 1)[1].strip()

    if not token:
        return None

    secret_key = os.getenv("SECRET_KEY")

    if not secret_key:
        print("❌ SECRET_KEY is not configured")
        return None

    try:
        decoded_token = jwt.decode(
            token,
            secret_key,
            algorithms=["HS256"]
        )

        return decoded_token

    except jwt.ExpiredSignatureError:
        print("❌ JWT token expired")
        return None

    except jwt.InvalidTokenError:
        print("❌ Invalid JWT token")
        return None

    except Exception as e:
        print("❌ JWT ERROR:", repr(e))
        return None


# ============================================================
# GET USER ID FROM JWT
# ============================================================

def get_user_id_from_token():
    """
    Extract user ID from JWT.

    Supports:
        id
        user_id
    """

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
# GET PROFILE
# ============================================================

@profile_bp.route("", methods=["GET"])
def get_profile():

    user_id = get_user_id_from_token()

    if user_id is None:
        return jsonify({
            "success": False,
            "message": "Authentication required"
        }), 401

    conn = None
    cursor = None

    try:

        conn = get_connection()

        cursor = conn.cursor(pymysql.cursors.DictCursor)

        cursor.execute(
            """
            SELECT
                user_id,
                full_name,
                email,
                phone,
                address,
                role,
                is_verified,
                created_at,
                updated_at
            FROM users
            WHERE user_id = %s
            LIMIT 1
            """,
            (user_id,)
        )

        profile = cursor.fetchone()

        if not profile:

            return jsonify({
                "success": False,
                "message": "Profile not found"
            }), 404

        return jsonify({
            "success": True,
            "message": "Profile retrieved successfully",
            "profile": profile
        }), 200

    except Exception as e:

        print("❌ PROFILE GET ERROR:", repr(e))

        return jsonify({
            "success": False,
            "message": "Failed to retrieve profile"
        }), 500

    finally:

        if cursor:
            cursor.close()

        if conn:
            conn.close()


# ============================================================
# UPDATE PROFILE
# ============================================================

@profile_bp.route("", methods=["PUT"])
def update_profile():

    user_id = get_user_id_from_token()

    if user_id is None:
        return jsonify({
            "success": False,
            "message": "Authentication required"
        }), 401

    data = request.get_json(silent=True)

    if not isinstance(data, dict):

        return jsonify({
            "success": False,
            "message": "Request body must be valid JSON"
        }), 400

    # --------------------------------------------------------
    # Read values
    # --------------------------------------------------------

    full_name = data.get("full_name")
    phone = data.get("phone")
    address = data.get("address")

    # --------------------------------------------------------
    # Validate full name
    # --------------------------------------------------------

    if full_name is None:

        return jsonify({
            "success": False,
            "message": "Full name is required"
        }), 400

    if not isinstance(full_name, str):

        return jsonify({
            "success": False,
            "message": "Full name must be text"
        }), 400

    full_name = full_name.strip()

    if not full_name:

        return jsonify({
            "success": False,
            "message": "Full name cannot be empty"
        }), 400

    if len(full_name) > 100:

        return jsonify({
            "success": False,
            "message": "Full name cannot exceed 100 characters"
        }), 400

    # --------------------------------------------------------
    # Validate phone
    # --------------------------------------------------------

    if phone is not None:

        if not isinstance(phone, str):

            return jsonify({
                "success": False,
                "message": "Phone number must be text"
            }), 400

        phone = phone.strip()

        if len(phone) > 20:

            return jsonify({
                "success": False,
                "message": "Phone number is too long"
            }), 400

    # --------------------------------------------------------
    # Validate address
    # --------------------------------------------------------

    if address is not None:

        if not isinstance(address, str):

            return jsonify({
                "success": False,
                "message": "Address must be text"
            }), 400

        address = address.strip()

        if len(address) > 500:

            return jsonify({
                "success": False,
                "message": "Address cannot exceed 500 characters"
            }), 400

    conn = None
    cursor = None

    try:

        conn = get_connection()

        cursor = conn.cursor()

        # ----------------------------------------------------
        # Check user exists
        # ----------------------------------------------------

        cursor.execute(
            """
            SELECT user_id
            FROM users
            WHERE user_id = %s
            LIMIT 1
            """,
            (user_id,)
        )

        existing_user = cursor.fetchone()

        if not existing_user:

            return jsonify({
                "success": False,
                "message": "User account not found"
            }), 404

        # ----------------------------------------------------
        # Update profile
        # ----------------------------------------------------

        cursor.execute(
            """
            UPDATE users
            SET
                full_name = %s,
                phone = %s,
                address = %s,
                updated_at = CURRENT_TIMESTAMP
            WHERE user_id = %s
            """,
            (
                full_name,
                phone if phone else None,
                address if address else None,
                user_id
            )
        )

        conn.commit()

        # ----------------------------------------------------
        # Get updated profile
        # ----------------------------------------------------

        cursor.close()
        cursor = conn.cursor(pymysql.cursors.DictCursor)

        cursor.execute(
            """
            SELECT
                user_id,
                full_name,
                email,
                phone,
                address,
                role,
                is_verified,
                created_at,
                updated_at
            FROM users
            WHERE user_id = %s
            LIMIT 1
            """,
            (user_id,)
        )

        updated_profile = cursor.fetchone()

        if not updated_profile:

            return jsonify({
                "success": False,
                "message": "Profile updated but could not retrieve updated data"
            }), 500

        return jsonify({
            "success": True,
            "message": "Profile updated successfully",
            "profile": updated_profile
        }), 200

    except Exception as e:

        print("❌ PROFILE UPDATE ERROR:", repr(e))

        if conn:
            conn.rollback()

        return jsonify({
            "success": False,
            "message": "Failed to update profile"
        }), 500

    finally:

        if cursor:
            cursor.close()

        if conn:
            conn.close()