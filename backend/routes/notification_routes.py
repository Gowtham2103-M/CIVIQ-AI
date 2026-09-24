import os
import jwt

from flask import Blueprint, request, jsonify
from database import get_connection


# =========================================================
# NOTIFICATION BLUEPRINT
# =========================================================

notification_bp = Blueprint(
    "notifications",
    __name__
)


# =========================================================
# GET LOGGED-IN USER FROM JWT
# =========================================================

def get_logged_in_user():

    authorization = request.headers.get(
        "Authorization"
    )

    # Check Authorization header
    if not authorization:

        return None


    # Expected format:
    # Authorization: Bearer <token>
    if not authorization.startswith("Bearer "):

        return None


    token = authorization.split(
        " ",
        1
    )[1].strip()


    if not token:

        return None


    # Must match app.py
    secret_key = os.getenv(
        "SECRET_KEY",
        "change-this-secret-key"
    )


    try:

        payload = jwt.decode(
            token,
            secret_key,
            algorithms=["HS256"]
        )


        # Your JWT must contain:
        # { "id": user_id }
        user_id = payload.get("id")


        if not user_id:

            return None


        return payload


    except jwt.ExpiredSignatureError:

        print(
            "❌ NOTIFICATION AUTH ERROR: JWT token expired"
        )

        return None


    except jwt.InvalidTokenError as error:

        print(
            "❌ NOTIFICATION AUTH ERROR: Invalid JWT:",
            str(error)
        )

        return None


    except Exception as error:

        print(
            "❌ NOTIFICATION AUTH ERROR:",
            repr(error)
        )

        return None


# =========================================================
# SERIALIZE DATABASE VALUE
# =========================================================

def serialize_value(value):

    if value is None:

        return None


    # datetime/date values
    if hasattr(value, "isoformat"):

        return value.isoformat()


    return value


# =========================================================
# CONVERT DATABASE ROW TO DICTIONARY
# =========================================================

def row_to_dict(columns, row):

    # get_connection() uses DictCursor,
    # so rows are already dictionaries in many cases.
    if isinstance(row, dict):
        return {
            key: serialize_value(value)
            for key, value in row.items()
        }

    result = {}

    for index, column in enumerate(columns):
        result[column] = serialize_value(
            row[index]
        )

    return result


# =========================================================
# GET ALL NOTIFICATIONS FOR LOGGED-IN USER
#
# GET /api/notifications
# =========================================================

@notification_bp.route(
    "",
    methods=["GET"]
)
def get_notifications():

    user = get_logged_in_user()


    if not user:

        return jsonify({
            "message": "Authentication required"
        }), 401


    user_id = user.get("id")


    conn = None
    cursor = None


    try:

        print(
            f"📢 GET NOTIFICATIONS | User ID: {user_id}"
        )


        # Connect database
        conn = get_connection()


        if conn is None:

            raise Exception(
                "Could not establish database connection"
            )


        cursor = conn.cursor()


        # Get only logged-in user's notifications
        cursor.execute(
            """
            SELECT
                notification_id,
                user_id,
                complaint_id,
                type,
                title,
                message,
                is_read,
                created_at
            FROM notifications
            WHERE user_id = %s
            ORDER BY created_at DESC, notification_id DESC
            """,
            (user_id,)
        )


        rows = cursor.fetchall()


        # Get column names
        columns = [
            column[0]
            for column in cursor.description
        ]


        notifications = []


        for row in rows:

            notification = row_to_dict(
                columns,
                row
            )


            # Convert MySQL TINYINT(1)/BOOLEAN
            # into JavaScript true/false
            notification["is_read"] = bool(
                notification.get(
                    "is_read",
                    False
                )
            )


            notifications.append(
                notification
            )


        unread_count = sum(
            1
            for notification in notifications
            if not notification["is_read"]
        )


        print(
            f"✅ NOTIFICATIONS FOUND: {len(notifications)}"
        )


        return jsonify({

            "message":
                "Notifications retrieved successfully",

            "count":
                len(notifications),

            "unread_count":
                unread_count,

            "notifications":
                notifications

        }), 200


    except Exception as error:

        print(
            "❌ GET NOTIFICATIONS ERROR:",
            repr(error)
        )


        return jsonify({

            "message":
                "Failed to retrieve notifications",

            "error":
                str(error)

        }), 500


    finally:

        if cursor:

            try:

                cursor.close()

            except Exception as error:

                print(
                    "⚠️ Cursor close error:",
                    repr(error)
                )


        if conn:

            try:

                conn.close()

            except Exception as error:

                print(
                    "⚠️ Connection close error:",
                    repr(error)
                )


# =========================================================
# MARK ONE NOTIFICATION AS READ
#
# PUT /api/notifications/<notification_id>/read
# =========================================================

@notification_bp.route(
    "/<int:notification_id>/read",
    methods=["PUT"]
)
def mark_notification_as_read(notification_id):

    user = get_logged_in_user()


    if not user:

        return jsonify({
            "message": "Authentication required"
        }), 401


    user_id = user.get("id")


    conn = None
    cursor = None


    try:

        conn = get_connection()


        if conn is None:

            raise Exception(
                "Could not establish database connection"
            )


        cursor = conn.cursor()


        # Update only notification belonging to logged-in user
        cursor.execute(
            """
            UPDATE notifications
            SET is_read = 1
            WHERE notification_id = %s
            AND user_id = %s
            """,
            (
                notification_id,
                user_id
            )
        )


        if cursor.rowcount == 0:

            conn.rollback()


            return jsonify({

                "message":
                    "Notification not found"

            }), 404


        conn.commit()


        print(
            f"✅ Notification {notification_id} "
            f"marked as read"
        )


        return jsonify({

            "message":
                "Notification marked as read"

        }), 200


    except Exception as error:

        if conn:

            try:

                conn.rollback()

            except Exception:
                pass


        print(
            "❌ MARK NOTIFICATION READ ERROR:",
            repr(error)
        )


        return jsonify({

            "message":
                "Failed to mark notification as read",

            "error":
                str(error)

        }), 500


    finally:

        if cursor:

            try:

                cursor.close()

            except Exception:
                pass


        if conn:

            try:

                conn.close()

            except Exception:
                pass


# =========================================================
# MARK ALL NOTIFICATIONS AS READ
#
# PUT /api/notifications/read-all
#
# IMPORTANT:
# This route must appear BEFORE the generic
# /<int:notification_id> route.
# =========================================================

@notification_bp.route(
    "/read-all",
    methods=["PUT"]
)
def mark_all_notifications_as_read():

    user = get_logged_in_user()


    if not user:

        return jsonify({
            "message": "Authentication required"
        }), 401


    user_id = user.get("id")


    conn = None
    cursor = None


    try:

        conn = get_connection()


        if conn is None:

            raise Exception(
                "Could not establish database connection"
            )


        cursor = conn.cursor()


        cursor.execute(
            """
            UPDATE notifications
            SET is_read = 1
            WHERE user_id = %s
            AND is_read = 0
            """,
            (user_id,)
        )


        updated_count = cursor.rowcount


        conn.commit()


        print(
            f"✅ MARK ALL READ | User ID: {user_id} | "
            f"Updated: {updated_count}"
        )


        return jsonify({

            "message":
                "All notifications marked as read",

            "updated_count":
                updated_count

        }), 200


    except Exception as error:

        if conn:

            try:

                conn.rollback()

            except Exception:
                pass


        print(
            "❌ MARK ALL NOTIFICATIONS ERROR:",
            repr(error)
        )


        return jsonify({

            "message":
                "Failed to mark all notifications as read",

            "error":
                str(error)

        }), 500


    finally:

        if cursor:

            try:

                cursor.close()

            except Exception:
                pass


        if conn:

            try:

                conn.close()

            except Exception:
                pass


# =========================================================
# DELETE NOTIFICATION
#
# DELETE /api/notifications/<notification_id>
# =========================================================

@notification_bp.route(
    "/<int:notification_id>",
    methods=["DELETE"]
)
def delete_notification(notification_id):

    user = get_logged_in_user()


    if not user:

        return jsonify({
            "message": "Authentication required"
        }), 401


    user_id = user.get("id")


    conn = None
    cursor = None


    try:

        conn = get_connection()


        if conn is None:

            raise Exception(
                "Could not establish database connection"
            )


        cursor = conn.cursor()


        # Delete only notification belonging to this user
        cursor.execute(
            """
            DELETE FROM notifications
            WHERE notification_id = %s
            AND user_id = %s
            """,
            (
                notification_id,
                user_id
            )
        )


        if cursor.rowcount == 0:

            conn.rollback()


            return jsonify({

                "message":
                    "Notification not found"

            }), 404


        conn.commit()


        print(
            f"🗑️ Notification {notification_id} deleted"
        )


        return jsonify({

            "message":
                "Notification deleted successfully"

        }), 200


    except Exception as error:

        if conn:

            try:

                conn.rollback()

            except Exception:
                pass


        print(
            "❌ DELETE NOTIFICATION ERROR:",
            repr(error)
        )


        return jsonify({

            "message":
                "Failed to delete notification",

            "error":
                str(error)

        }), 500


    finally:

        if cursor:

            try:

                cursor.close()

            except Exception:
                pass


        if conn:

            try:

                conn.close()

            except Exception:
                pass