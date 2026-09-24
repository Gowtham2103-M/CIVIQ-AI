"""
Violation Routes - Handle suspended accounts and penalty payments

Endpoints for:
- Checking account suspension status
- Processing penalty payment verification
- Reactivating accounts
"""

import os
import jwt
from flask import Blueprint, request, jsonify

from database import get_connection
from routes.violation_service import (
    get_account_status,
    reactivate_account
)


violation_bp = Blueprint(
    "violations",
    __name__
)


# ============================================================
# HELPER: Get logged-in user from JWT
# ============================================================

def get_logged_in_user():
    """
    Extract and validate user from Authorization header.
    
    Returns:
        Decoded JWT payload dict or None
    """
    
    authorization = request.headers.get("Authorization")

    if not authorization or not authorization.startswith("Bearer "):
        return None

    token = authorization.split(" ", 1)[1]
    secret_key = os.getenv("SECRET_KEY")

    if not secret_key:
        return None

    try:
        payload = jwt.decode(token, secret_key, algorithms=["HS256"])
        if not payload.get("id"):
            return None
        return payload
    except (jwt.ExpiredSignatureError, jwt.InvalidTokenError):
        return None


# ============================================================
# 1. GET ACCOUNT STATUS
# ============================================================

@violation_bp.route("/account-status", methods=["GET"])
def check_account_status():
    """
    Get account status and penalty information for logged-in user.
    
    Returns:
        200: Account status with violation_count, account_status, penalty info
        401: Authentication required
        404: User not found
    """
    
    user = get_logged_in_user()

    if not user:
        return jsonify({"message": "Authentication required"}), 401

    user_id = user.get("id")

    conn = None
    
    try:
        
        conn = get_connection()
        status = get_account_status(conn, user_id)

        if not status:
            return jsonify({"message": "User not found"}), 404

        return jsonify({
            "success": True,
            "user_id": status["user_id"],
            "violation_count": status["violation_count"],
            "account_status": status["account_status"],
            "suspended_until": status["suspended_until"],
            "penalty_required": bool(status["penalty_required"]),
            "penalty_amount": float(status["penalty_amount"] or 0)
        }), 200

    except Exception as error:
        
        print(f"[Error] Account status check failed: {repr(error)}")
        
        return jsonify({
            "message": "Failed to fetch account status"
        }), 500

    finally:
        
        if conn:
            conn.close()


# ============================================================
# 2. VERIFY PAYMENT & REACTIVATE ACCOUNT
# ============================================================

@violation_bp.route("/payment-confirm", methods=["POST"])
def confirm_payment():
    """
    Confirm penalty payment and reactivate account.
    
    This endpoint should be called ONLY after:
    1. Payment gateway confirms transaction success
    2. Payment transaction ID is available
    
    Request body:
    {
        "transaction_id": "string",  # Payment gateway transaction ID
        "payment_method": "string"   # Optional: card, netbanking, upi, etc.
    }
    
    Returns:
        200: Account successfully reactivated
        400: Bad request (missing fields)
        401: Authentication required
        403: Not suspended or no penalty required
        404: User not found
        500: Server error
    """
    
    user = get_logged_in_user()

    if not user:
        return jsonify({"message": "Authentication required"}), 401

    user_id = user.get("id")

    # ========================================================
    # Validate request
    # ========================================================

    data = request.get_json() or {}

    transaction_id = str(
        data.get("transaction_id", "")
    ).strip()

    payment_method = str(
        data.get("payment_method", "")
    ).strip()

    if not transaction_id:
        return jsonify({
            "message": "Transaction ID is required"
        }), 400

    # ========================================================
    # Verify account is actually suspended
    # ========================================================

    conn = None

    try:
        
        conn = get_connection()
        status = get_account_status(conn, user_id)

        if not status:
            return jsonify({"message": "User not found"}), 404

        if status["account_status"] != "SUSPENDED":
            return jsonify({
                "message": "Account is not suspended",
                "account_status": status["account_status"]
            }), 403

        if not status["penalty_required"]:
            return jsonify({
                "message": "No penalty payment is required"
            }), 403

        # ====================================================
        # Reactivate account
        # ====================================================

        reactivation_result = reactivate_account(conn, user_id)

        if not reactivation_result["success"]:
            return jsonify(reactivation_result), 400

        # ====================================================
        # Record transaction in violation history
        # ====================================================

        cursor = conn.cursor()

        try:

            cursor.execute(
                """
                UPDATE user_violation
                SET
                    transaction_id = %s,
                    payment_status = 'PAID',
                    paid_at = CURRENT_TIMESTAMP
                WHERE user_id = %s
                  AND payment_status = 'PENDING'
                ORDER BY violation_id DESC
                LIMIT 1
                """,
                (transaction_id, user_id)
            )

            # Optional: Add payment method to a future audit log
            # if payment_method:
            #     cursor.execute(...)

            conn.commit()

        finally:
            
            cursor.close()

        # ====================================================
        # Return success
        # ====================================================

        return jsonify({
            "success": True,
            "message": "Account reactivated successfully",
            "transaction_id": transaction_id,
            "account_status": "ACTIVE",
            "penalty_required": False
        }), 200

    except Exception as error:
        
        print(f"[Error] Payment confirmation failed: {repr(error)}")
        
        return jsonify({
            "message": "Failed to process payment confirmation"
        }), 500

    finally:
        
        if conn:
            conn.close()


# ============================================================
# 3. GET VIOLATION HISTORY (Optional)
# ============================================================

@violation_bp.route("/history", methods=["GET"])
def get_violation_history():
    """
    Get violation history for logged-in user.
    
    Returns:
        200: List of violations with details
        401: Authentication required
        404: User not found
    """
    
    user = get_logged_in_user()

    if not user:
        return jsonify({"message": "Authentication required"}), 401

    user_id = user.get("id")

    conn = None
    
    try:
        
        conn = get_connection()
        cursor = conn.cursor()

        cursor.execute(
            """
            SELECT
                violation_id,
                user_id,
                complaint_id,
                reason,
                confidence,
                violation_number,
                action,
                penalty_amount,
                payment_status,
                transaction_id,
                paid_at,
                created_at
            FROM user_violation
            WHERE user_id = %s
            ORDER BY created_at DESC
            """,
            (user_id,)
        )

        violations = cursor.fetchall()

        cursor.close()

        # Convert datetime objects to ISO strings
        violation_list = []
        for v in violations:
            v_dict = dict(v)
            if v_dict.get("paid_at"):
                v_dict["paid_at"] = v_dict["paid_at"].isoformat()
            if v_dict.get("created_at"):
                v_dict["created_at"] = v_dict["created_at"].isoformat()
            violation_list.append(v_dict)

        return jsonify({
            "success": True,
            "user_id": user_id,
            "violations": violation_list
        }), 200

    except Exception as error:
        
        print(f"[Error] Violation history fetch failed: {repr(error)}")
        
        return jsonify({
            "message": "Failed to fetch violation history"
        }), 500

    finally:
        
        if conn:
            conn.close()
