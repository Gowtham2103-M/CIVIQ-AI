"""
Violation Service - Handle Agent 2.5 Rejections

Manages violation warnings, account suspension, and penalty payments.
Uses pymysql for database operations (consistent with Flask app).
"""

from datetime import datetime
from typing import Optional
import pymysql

# ============================================================
# CIVIQ VIOLATION POLICY
# ============================================================

MAX_VIOLATIONS = 3
PENALTY_AMOUNT = 100.00


# ============================================================
# HANDLE AGENT 2.5 REJECTION
# ============================================================

def handle_violation(
    conn: pymysql.connections.Connection,
    user_id: int,
    complaint_id: Optional[int],
    agent_result: dict,
) -> dict:
    """
    Handle an Agent 2.5 rejected image.

    Policy:
        1st violation -> WARNING
        2nd violation -> WARNING
        3rd violation -> SUSPENDED + PENALTY

    Args:
        conn: pymysql database connection
        user_id: User who submitted the rejected complaint
        complaint_id: Complaint ID that triggered the violation
        agent_result: Agent 2.5 output dict with 'decision' and other fields

    Returns:
        Dict with violation handling result and user account status
    """

    cursor = conn.cursor()

    try:

        decision = str(
            agent_result.get("decision", "")
        ).upper().strip()

        # Only REJECT creates a violation.
        if decision != "REJECT":
            return {
                "success": True,
                "violation_created": False,
                "message": "No violation created."
            }

        # ====================================================
        # Get current user violation count
        # ====================================================

        cursor.execute(
            """
            SELECT
                user_id,
                violation_count,
                account_status
            FROM users
            WHERE user_id = %s
            """,
            (user_id,)
        )

        user = cursor.fetchone()

        if not user:
            raise ValueError(f"User {user_id} not found.")

        current_count = int(
            user.get("violation_count") or 0
        )

        account_status = str(
            user.get("account_status") or "ACTIVE"
        ).upper()

        # Don't create additional violations for an already suspended account.
        if account_status == "SUSPENDED":
            return {
                "success": False,
                "violation_created": False,
                "message": "Account is already suspended.",
                "account_status": "SUSPENDED"
            }

        # ====================================================
        # New violation number
        # ====================================================

        violation_number = current_count + 1

        reason = str(
            agent_result.get(
                "reason",
                "Invalid or unwanted complaint image."
            )
        )

        confidence = agent_result.get("confidence")

        try:
            confidence = int(confidence)
        except (TypeError, ValueError):
            confidence = None

        # ====================================================
        # Decide action
        # ====================================================

        if violation_number >= MAX_VIOLATIONS:
            action = "SUSPENDED"
            penalty_amount = PENALTY_AMOUNT
            payment_status = "PENDING"
        else:
            action = "WARNING"
            penalty_amount = 0.00
            payment_status = "NOT_REQUIRED"

        # ====================================================
        # Insert violation history
        # ====================================================

        cursor.execute(
            """
            INSERT INTO user_violation (
                user_id,
                complaint_id,
                reason,
                confidence,
                violation_number,
                action,
                penalty_amount,
                payment_status
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (
                user_id,
                complaint_id,
                reason,
                confidence,
                violation_number,
                action,
                penalty_amount,
                payment_status,
            )
        )

        # ====================================================
        # Update user account
        # ====================================================

        if action == "SUSPENDED":

            cursor.execute(
                """
                UPDATE users
                SET
                    violation_count = %s,
                    account_status = 'SUSPENDED',
                    suspended_until = NULL,
                    penalty_required = 1,
                    penalty_amount = %s
                WHERE user_id = %s
                """,
                (
                    violation_number,
                    PENALTY_AMOUNT,
                    user_id,
                )
            )

        else:

            cursor.execute(
                """
                UPDATE users
                SET
                    violation_count = %s
                WHERE user_id = %s
                """,
                (
                    violation_number,
                    user_id,
                )
            )

        conn.commit()

        # ====================================================
        # Return result
        # ====================================================

        if action == "SUSPENDED":

            return {
                "success": True,
                "violation_created": True,
                "violation_number": violation_number,
                "action": "SUSPENDED",
                "account_status": "SUSPENDED",
                "penalty_required": True,
                "penalty_amount": float(PENALTY_AMOUNT),
                "payment_status": "PENDING",
                "message": (
                    "Account suspended after repeated "
                    "invalid complaint submissions."
                )
            }

        return {
            "success": True,
            "violation_created": True,
            "violation_number": violation_number,
            "action": "WARNING",
            "account_status": "ACTIVE",
            "penalty_required": False,
            "penalty_amount": 0,
            "payment_status": "NOT_REQUIRED",
            "message": (
                f"Warning issued. Violation "
                f"{violation_number} of {MAX_VIOLATIONS}."
            )
        }

    except Exception as error:
        conn.rollback()
        raise RuntimeError(
            f"Failed to handle violation: {error}"
        ) from error

    finally:
        cursor.close()


# ============================================================
# GET ACCOUNT STATUS
# ============================================================

def get_account_status(
    conn: pymysql.connections.Connection,
    user_id: int,
) -> Optional[dict]:
    """
    Get account status information for a user.

    Args:
        conn: pymysql database connection
        user_id: User ID to check

    Returns:
        Dict with user account status or None if user not found
    """

    cursor = conn.cursor()

    try:

        cursor.execute(
            """
            SELECT
                user_id,
                violation_count,
                account_status,
                suspended_until,
                penalty_required,
                penalty_amount
            FROM users
            WHERE user_id = %s
            """,
            (user_id,)
        )

        user = cursor.fetchone()

        if not user:
            return None

        return user

    finally:
        cursor.close()


# ============================================================
# REACTIVATE ACCOUNT AFTER PAYMENT
# ============================================================

def reactivate_account(
    conn: pymysql.connections.Connection,
    user_id: int,
) -> dict:
    """
    Reactivate account after confirmed penalty payment.

    Payment must already be confirmed before calling this.

    Args:
        conn: pymysql database connection
        user_id: User ID to reactivate

    Returns:
        Dict with reactivation result
    """

    cursor = conn.cursor()

    try:

        cursor.execute(
            """
            SELECT
                user_id,
                account_status,
                penalty_required
            FROM users
            WHERE user_id = %s
            """,
            (user_id,)
        )

        user = cursor.fetchone()

        if not user:
            raise ValueError(f"User {user_id} not found.")

        if user.get("account_status") != "SUSPENDED":
            return {
                "success": False,
                "message": "Account is not suspended."
            }

        if not user.get("penalty_required"):
            return {
                "success": False,
                "message": "No penalty payment is required."
            }

        # ====================================================
        # Reactivate account
        # ====================================================

        cursor.execute(
            """
            UPDATE users
            SET
                account_status = 'ACTIVE',
                suspended_until = NULL,
                penalty_required = 0,
                penalty_amount = 0
            WHERE user_id = %s
            """,
            (user_id,)
        )

        # ====================================================
        # Mark latest pending penalty as paid
        # ====================================================

        cursor.execute(
            """
            UPDATE user_violation
            SET
                payment_status = 'PAID',
                paid_at = %s
            WHERE violation_id = (
                SELECT violation_id
                FROM user_violation
                WHERE user_id = %s
                  AND payment_status = 'PENDING'
                ORDER BY violation_id DESC
                LIMIT 1
            )
            """,
            (datetime.now(), user_id)
        )

        conn.commit()

        return {
            "success": True,
            "account_status": "ACTIVE",
            "penalty_required": False,
            "message": "Account successfully reactivated."
        }

    except Exception as error:
        conn.rollback()
        raise RuntimeError(
            f"Failed to reactivate account: {error}"
        ) from error

    finally:
        cursor.close()