from flask import Blueprint, request, jsonify
from argon2 import PasswordHasher
from argon2.exceptions import VerificationError
import os
from dotenv import load_dotenv
from database import get_connection
import pymysql

load_dotenv()

ph = PasswordHasher()

register_bp = Blueprint("register", __name__)


@register_bp.route("/api/register", methods=["POST"])
def register_user():

    connection = None
    cursor = None

    try:
        data = request.get_json()

        full_name = data.get("full_name", "").strip()
        email = data.get("email", "").strip().lower()
        phone = data.get("phone", "").strip()
        address = data.get("address", "").strip()
        password = data.get("password", "")

        # -----------------------------
        # VALIDATION
        # -----------------------------

        if not full_name:
            return jsonify({
                "message": "Full name is required."
            }), 400

        if len(full_name) > 100:
            return jsonify({
                "message": "Full name must not exceed 100 characters."
            }), 400

        if not email:
            return jsonify({
                "message": "Email address is required."
            }), 400

        if len(email) > 150:
            return jsonify({
                "message": "Email must not exceed 150 characters."
            }), 400

        if not phone:
            return jsonify({
                "message": "Phone number is required."
            }), 400

        if len(phone) > 20:
            return jsonify({
                "message": "Phone number must not exceed 20 characters."
            }), 400

        if not password:
            return jsonify({
                "message": "Password is required."
            }), 400

        if len(password) < 6:
            return jsonify({
                "message": "Password must contain at least 6 characters."
            }), 400

        # -----------------------------
        # DATABASE CONNECTION
        # -----------------------------

        connection = get_connection()
        cursor = connection.cursor()

        # -----------------------------
        # CHECK DUPLICATE EMAIL
        # -----------------------------

        cursor.execute(
            """
            SELECT user_id
            FROM users
            WHERE email = %s
            """,
            (email,)
        )

        existing_user = cursor.fetchone()

        if existing_user:
            return jsonify({
                "message": "An account with this email already exists."
            }), 409

        # -----------------------------
        # HASH PASSWORD
        # -----------------------------

        password_hash = ph.hash(password)

        # -----------------------------
        # INSERT CITIZEN
        # -----------------------------
        #
        # role = citizen
        # is_verified = 0
        #
        # created_at and updated_at are
        # automatically handled by MySQL.
        #

        cursor.execute(
            """
            INSERT INTO users
            (
                full_name,
                email,
                phone,
                password_hash,
                role,
                address,
                is_verified
            )
            VALUES
            (
                %s,
                %s,
                %s,
                %s,
                'citizen',
                %s,
                0
            )
            """,
            (
                full_name,
                email,
                phone,
                password_hash,
                address if address else None
            )
        )

        connection.commit()

        user_id = cursor.lastrowid

        return jsonify({
            "message": "Registration successful.",
            "user_id": user_id
        }), 201

    except pymysql.Error as e:

        if connection:
            connection.rollback()

        print("Database error:", e)

        return jsonify({
            "message": "Database error occurred."
        }), 500

    except Exception as e:

        if connection:
            connection.rollback()

        print("Registration error:", e)

        return jsonify({
            "message": "Something went wrong during registration."
        }), 500

    finally:

        if cursor:
            cursor.close()

        if connection:
            connection.close()