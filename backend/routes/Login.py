from flask import Blueprint, request, jsonify, current_app
from flask_mail import Message

from database import get_connection
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError, VerificationError

import jwt
import datetime
import random
import os

from google.oauth2 import id_token
from google.auth.transport import requests as google_requests

ph = PasswordHasher()


def row_to_dict(cursor, row):
    return dict(zip(cursor.column_names, row)) if row else None


auth_bp = Blueprint("auth", __name__)


def get_secret_key():
    return current_app.config.get("SECRET_KEY")


def get_google_client_id():
    return current_app.config.get("GOOGLE_CLIENT_ID")


def get_mail():
    mail = current_app.extensions.get("mail")
    if mail is None:
        raise RuntimeError("Flask-Mail has not been initialized")
    return mail


# -------------------------
# Database connection check (startup)
# -------------------------
try:
    conn = get_connection()
    print("[Login] Database connected successfully!")

    cursor = conn.cursor()

    # Test retrieving a record
    cursor.execute(
        "SELECT user_id, full_name, email, role FROM users LIMIT 1"
    )

    user = cursor.fetchone()

    if user:
        print("[Login] Record retrieved successfully!")
        print("User:", user)
    else:
        print("[Login] Database connected, but users table is empty.")

    cursor.close()
    conn.close()

except Exception as e:
    print("[Login] Error:", type(e).__name__, e)


def require_fields(data, fields):
    """Return an error message if data is missing any required field, else None."""
    if not data:
        return "Request body must be JSON"
    missing = [f for f in fields if not data.get(f)]
    if missing:
        return f"Missing required field(s): {', '.join(missing)}"
    return None


# -------------------------
# Home
# -------------------------
@auth_bp.route("/")
def home():
    return jsonify({
        "message": "Backend Running"
    })


# -------------------------
# Login
# -------------------------
@auth_bp.route("/login", methods=["POST"])
def login():

    data = request.get_json(silent=True)

    err = require_fields(data, ["email", "password"])

    if err:
        return jsonify({"message": err}), 400

    email = data["email"]
    password = data["password"]

    conn = None

    try:
        conn = get_connection()
        cursor = conn.cursor()

        cursor.execute(
            "SELECT * FROM users WHERE email=%s",
            (email,)
        )

        user = cursor.fetchone()

        print("USER FROM DATABASE:", user)

        if user is None:
            return jsonify({
                "message": "User Not Found"
            }), 404

        # Argon2 password verification
        try:
            ph.verify(
                user["password_hash"],
                password
            )

            print("✅ PASSWORD VERIFIED")

        except VerifyMismatchError:

            print("❌ INCORRECT PASSWORD")

            return jsonify({
                "message": "Incorrect Password"
            }), 401

        except VerificationError as e:

            print("❌ ARGON2 ERROR:", e)

            return jsonify({
                "message": "Invalid password hash"
            }), 500

        # Check SECRET_KEY
        secret_key = get_secret_key()
        if not secret_key:
            print("❌ SECRET_KEY missing from .env")

            return jsonify({
                "message": "Server configuration error"
            }), 500

        # Create JWT
        token = jwt.encode(
            {
                "id": user["user_id"],
                "email": user["email"],
                "role": user["role"],
                "exp": datetime.datetime.now(
                    datetime.timezone.utc
                ) + datetime.timedelta(hours=1)
            },
            secret_key,
            algorithm="HS256"
        )

        print("✅ JWT CREATED")

        return jsonify({
            "message": "Login Successful",
            "token": token,
            "user": {
                "id": user["user_id"],
                "name": user["full_name"],
                "email": user["email"],
                "role": user["role"]
            }
        })

    except Exception as e:

        print("❌ LOGIN ERROR:", repr(e))

        return jsonify({
            "message": "Login failed"
        }), 500

    finally:

        if conn:
            conn.close()
# -------------------------
# Forgot Password
# -------------------------
@auth_bp.route("/forgot-password", methods=["POST"])
def forgot_password():

    data = request.get_json(silent=True)

    err = require_fields(data, ["email"])

    if err:
        return jsonify({"message": err}), 400

    email = data["email"]

    conn = None

    try:
        conn = get_connection()
        cursor = conn.cursor()

        # Find user
        cursor.execute(
            "SELECT user_id, email FROM users WHERE email=%s",
            (email,)
        )

        user = cursor.fetchone()

        if user is None:
            return jsonify({
                "message": "Email not found"
            }), 404

        # Generate 6-digit OTP
        otp = str(random.randint(100000, 999999))

        # OTP expires in 5 minutes
        expiry = datetime.datetime.now() + datetime.timedelta(minutes=5)

        # Delete previous OTP
        cursor.execute(
            """
            DELETE FROM password_reset_tokens
            WHERE user_id=%s
            """,
            (user["user_id"],)
        )

        # Store new OTP
        cursor.execute(
            """
            INSERT INTO password_reset_tokens
            (user_id, otp, expires_at, is_used)
            VALUES(%s, %s, %s, 0)
            """,
            (
                user["user_id"],
                otp,
                expiry
            )
        )

        conn.commit()

        # ========================
        # TRY TO SEND EMAIL
        # ========================
        email_sent = False
        email_error = None
        
        try:
            mail_username = current_app.config.get("MAIL_USERNAME")
            mail_password = current_app.config.get("MAIL_PASSWORD")
            
            print(f"📧 Attempting to send email from: {mail_username}")
            print(f"📧 Mail server: {current_app.config.get('MAIL_SERVER')}")
            print(f"📧 Mail port: {current_app.config.get('MAIL_PORT')}")
            
            # Check if email credentials are properly configured (not placeholders)
            if (mail_username and mail_password and 
                "your_email" not in mail_username and 
                "your_gmail_app_password" not in mail_password):
                
                try:
                    mail = get_mail()

                    msg = Message(
                        subject="CivicGuard Password Reset OTP",
                        sender=mail_username,
                        recipients=[email]
                    )

                    msg.body = f"""
Hello,

Your CivicGuard password reset OTP is:

{otp}

This OTP will expire in 5 minutes.

If you did not request a password reset, please ignore this email.

Regards,
CivicGuard Team
"""
                    mail.send(msg)
                    email_sent = True
                    print(f"✅ OTP email sent successfully to: {email}")
                    
                except Exception as send_error:
                    email_error = str(send_error)
                    print(f"⚠️  Failed to send email: {repr(send_error)}")
            else:
                # Email not configured
                print("⚠️  Email credentials are not properly configured (still using placeholders)")
                print(f"    MAIL_USERNAME: {mail_username}")
                print(f"    MAIL_PASSWORD configured: {'Yes' if mail_password else 'No'}")
                
        except Exception as mail_error:
            email_error = str(mail_error)
            print(f"⚠️  Email error: {repr(mail_error)}")

        # Always return success and store OTP in database
        # Email will be sent if configured, otherwise user needs to check junk/spam
        return jsonify({
            "message": "Verification code sent. Please check your email (including spam folder). If not received, contact support."
        }), 200

    except Exception as e:

        print("❌ Forgot password error:", repr(e))

        if conn:
            conn.rollback()

        return jsonify({
            "message": "Failed to process password reset request"
        }), 500

    finally:

        if conn:
            conn.close()


# -------------------------
# Verify OTP (for password reset)
# -------------------------
@auth_bp.route("/verify-otp", methods=["POST"])
def verify_otp():
    """Verify OTP for password reset"""
    
    data = request.get_json(silent=True)
    
    err = require_fields(data, ["email", "otp"])
    
    if err:
        return jsonify({"message": err}), 400
    
    email = data["email"]
    otp = data["otp"]
    
    conn = None
    
    try:
        conn = get_connection()
        cursor = conn.cursor()
        
        # Find user
        cursor.execute(
            "SELECT user_id FROM users WHERE email=%s",
            (email,)
        )
        
        user = cursor.fetchone()
        
        if user is None:
            return jsonify({
                "message": "User not found"
            }), 404
        
        user_id = user["user_id"]
        
        # Find valid OTP (not used and not expired)
        cursor.execute(
            """
            SELECT token_id, otp, expires_at
            FROM password_reset_tokens
            WHERE user_id=%s
            AND otp=%s
            AND is_used=0
            ORDER BY token_id DESC
            LIMIT 1
            """,
            (
                user_id,
                otp
            )
        )
        
        otp_record = cursor.fetchone()
        
        if otp_record is None:
            return jsonify({
                "message": "Invalid OTP"
            }), 400
        
        # Check expiry
        if otp_record["expires_at"] < datetime.datetime.now():
            return jsonify({
                "message": "OTP expired"
            }), 400
        
        print("✅ OTP verified successfully for:", email)
        
        return jsonify({
            "message": "Verification code verified successfully"
        }), 200
    
    except Exception as e:
        
        print("❌ OTP verification error:", repr(e))
        
        if conn:
            try:
                conn.rollback()
            except:
                pass
        
        return jsonify({
            "message": "Failed to verify code. Please try again."
        }), 500
    
    finally:
        
        if conn:
            try:
                conn.close()
            except:
                pass


# -------------------------
# Reset Password
# -------------------------
@auth_bp.route("/change-password", methods=["POST"])
def change_password():
    authorization = request.headers.get("Authorization")

    if not authorization or not authorization.startswith("Bearer "):
        return jsonify({"message": "Authentication required"}), 401

    token = authorization.split(" ", 1)[1].strip()

    if not token:
        return jsonify({"message": "Authentication required"}), 401

    try:
        payload = jwt.decode(
            token,
            get_secret_key(),
            algorithms=["HS256"]
        )
    except jwt.ExpiredSignatureError:
        return jsonify({"message": "Session expired. Please login again."}), 401
    except jwt.InvalidTokenError:
        return jsonify({"message": "Invalid token."}), 401

    user_id = payload.get("id")
    if not user_id:
        return jsonify({"message": "Authentication required"}), 401

    data = request.get_json(silent=True)
    if not data or not data.get("current_password") or not data.get("new_password"):
        return jsonify({"message": "Current password and new password are required"}), 400

    current_password = data["current_password"]
    new_password = data["new_password"]

    if len(new_password) < 6:
        return jsonify({"message": "New password must be at least 6 characters long"}), 400

    conn = None
    try:
        conn = get_connection()
        cursor = conn.cursor()

        cursor.execute(
            "SELECT password_hash FROM users WHERE user_id=%s",
            (user_id,)
        )

        user = cursor.fetchone()
        if user is None:
            return jsonify({"message": "User not found"}), 404

        try:
            ph.verify(user["password_hash"], current_password)
        except VerifyMismatchError:
            return jsonify({"message": "Current password is incorrect"}), 401
        except VerificationError:
            return jsonify({"message": "Unable to verify current password"}), 500

        new_hash = ph.hash(new_password)

        cursor.execute(
            "UPDATE users SET password_hash=%s WHERE user_id=%s",
            (new_hash, user_id)
        )

        conn.commit()
        return jsonify({"message": "Password changed successfully"}), 200

    except Exception as e:
        print("❌ CHANGE PASSWORD ERROR:", repr(e))
        if conn:
            conn.rollback()
        return jsonify({"message": "Failed to change password"}), 500
    finally:
        if conn:
            conn.close()


@auth_bp.route("/reset-password", methods=["POST"])
def reset_password():
    """Reset password using OTP"""

    data = request.get_json(silent=True)

    err = require_fields(
        data,
        ["email", "otp", "new_password"]
    )

    if err:
        return jsonify({"message": err}), 400

    email = data["email"]
    otp = data["otp"]
    new_password = data["new_password"]

    conn = None

    try:
        conn = get_connection()
        cursor = conn.cursor()

        # Find user
        cursor.execute(
            "SELECT user_id FROM users WHERE email=%s",
            (email,)
        )

        user = cursor.fetchone()

        if user is None:
            return jsonify({
                "message": "User not found"
            }), 404

        user_id = user["user_id"]

        # Find valid OTP
        cursor.execute(
            """
            SELECT token_id, otp, expires_at
            FROM password_reset_tokens
            WHERE user_id=%s
            AND otp=%s
            AND is_used=0
            ORDER BY token_id DESC
            LIMIT 1
            """,
            (
                user_id,
                otp
            )
        )

        otp_record = cursor.fetchone()

        if otp_record is None:
            return jsonify({
                "message": "Invalid OTP"
            }), 400

        # Check expiry
        if otp_record["expires_at"] < datetime.datetime.now():
            return jsonify({
                "message": "OTP expired"
            }), 400

        # Hash new password using Argon2
        hashed_password = ph.hash(new_password)

        # Update password
        cursor.execute(
            """
            UPDATE users
            SET password_hash=%s
            WHERE user_id=%s
            """,
            (
                hashed_password,
                user_id
            )
        )

        # Mark OTP as used
        cursor.execute(
            """
            UPDATE password_reset_tokens
            SET is_used=1
            WHERE token_id=%s
            """,
            (
                otp_record["token_id"],
            )
        )

        conn.commit()

        print("✅ Password changed for:", email)

        return jsonify({
            "message": "Password changed successfully"
        }), 200

    except Exception as e:

        print("❌ Reset password error:", repr(e))

        if conn:
            conn.rollback()

        return jsonify({
            "message": "Failed to reset password"
        }), 500

    finally:

        if conn:
            conn.close()
#-------------------------
# Google Login 
#-------------------------

@auth_bp.route("/google-login", methods=["POST"])
def google_login():

    data = request.get_json(silent=True)

    if not data or not data.get("credential"):
        return jsonify({
            "message": "Google credential is required"
        }), 400

    credential = data["credential"]

    google_client_id = get_google_client_id()
    if not google_client_id:
        print("❌ GOOGLE_CLIENT_ID missing")

        return jsonify({
            "message": "Google login is not configured"
        }), 500

    conn = None

    try:
        # Verify Google ID token
        google_user = id_token.verify_oauth2_token(
            credential,
            google_requests.Request(),
            google_client_id
        )

        google_id = google_user.get("sub")
        email = google_user.get("email")
        name = google_user.get("name", "Google User")
        email_verified = google_user.get("email_verified", False)

        if not google_id or not email:
            return jsonify({
                "message": "Invalid Google account information"
            }), 400

        if not email_verified:
            return jsonify({
                "message": "Google email is not verified"
            }), 400

        conn = get_connection()
        cursor = conn.cursor()

        # Check whether user already exists
        cursor.execute(
            """
            SELECT *
            FROM users
            WHERE email=%s
            """,
            (email,)
        )

        user = cursor.fetchone()

        # Existing user
        if user:

            print("✅ Existing Google user:", email)

            user_id = user["user_id"]
            role = user["role"]

        # New user
        else:

            print("🆕 Creating Google user:", email)

            # Google users don't need a local password.
            # Store a random unusable value.
            random_password = os.urandom(32).hex()

            hashed_password = ph.hash(random_password)

            cursor.execute(
                """
                INSERT INTO users
                (
                    full_name,
                    email,
                    password_hash,
                    role,
                    is_verified
                )
                VALUES(%s, %s, %s, %s, %s)
                """,
                (
                    name,
                    email,
                    hashed_password,
                    "citizen",
                    1
                )
            )

            conn.commit()

            user_id = cursor.lastrowid
            role = "citizen"

        # Create your application's JWT
        token = jwt.encode(
            {
                "id": user_id,
                "email": email,
                "role": role,
                "exp": datetime.datetime.now(
                    datetime.timezone.utc
                ) + datetime.timedelta(hours=1)
            },
            get_secret_key(),
            algorithm="HS256"
        )

        print("✅ Google login successful:", email)

        return jsonify({
            "message": "Google Login Successful",
            "token": token,
            "user": {
                "id": user_id,
                "name": name,
                "email": email,
                "role": role
            }
        }), 200

    except ValueError as e:

        print("❌ Invalid Google token:", e)

        return jsonify({
            "message": "Invalid Google token"
        }), 401

    except Exception as e:

        print("❌ Google login error:", repr(e))

        if conn:
            conn.rollback()

        return jsonify({
            "message": "Google login failed"
        }), 500

    finally:

        if conn:
            conn.close()