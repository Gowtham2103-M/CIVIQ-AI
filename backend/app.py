import os
import jwt

from io import BytesIO

from flask import (
    Flask,
    send_from_directory,
    request,
    jsonify,
    send_file,
)

from flask_cors import CORS
from flask_mail import Mail, Message
from dotenv import load_dotenv

from routes.Login import auth_bp
from routes.user_register import register_bp
from routes.complaint_routes import complaint_bp
from routes.complaint_tracking import complaint_tracking_bp
from routes.mycomplaint_routes import mycomplaint_bp
from routes.profile_routes import profile_bp
from routes.notification_routes import notification_bp
from routes.violation_routes import violation_bp

from database import get_connection
from agent.pipeline import start_complaint_worker
from flask import current_app
from routes.officer_routes import officer_bp
from routes.officercomplaint_routes import officercomplaint_bp
from routes.ai_analysis_routes import ai_analysis_bp
from routes.priority_queue_routes import priority_queue_bp
from routes.department_routes import department_bp
from routes.officer_analytics_routes import officer_analytics_bp
from routes.field_worker_flask import field_worker_bp



# =========================================================
# LOAD ENVIRONMENT VARIABLES
# =========================================================

load_dotenv()


# =========================================================
# CREATE FLASK APP
# =========================================================

app = Flask(__name__)


# =========================================================
# CORS
# =========================================================

CORS(
    app,
    resources={
        r"/*": {
            "origins": "*"
        }
    },
    supports_credentials=True
)


# =========================================================
# MAIL
# =========================================================

mail = Mail()


# =========================================================
# CONFIGURATION
# =========================================================

app.config["SECRET_KEY"] = os.getenv(
    "SECRET_KEY",
    "change-this-secret-key"
)

app.config["MAIL_SERVER"] = os.getenv(
    "MAIL_SERVER",
    "smtp.gmail.com"
)

app.config["MAIL_PORT"] = int(
    os.getenv(
        "MAIL_PORT",
        587
    )
)

app.config["MAIL_USE_TLS"] = True

app.config["MAIL_USERNAME"] = os.getenv(
    "MAIL_USERNAME"
)

app.config["MAIL_PASSWORD"] = os.getenv(
    "MAIL_PASSWORD"
)

app.config["GOOGLE_CLIENT_ID"] = os.getenv(
    "GOOGLE_CLIENT_ID"
)

# =========================================================
# DEBUG: VERIFY CONFIGURATION
# =========================================================

print("\n" + "="*60)
print("[Flask] FLASK CONFIGURATION LOADED")
print("="*60)
print(f"SECRET_KEY: {'***SET***' if app.config.get('SECRET_KEY') else 'NOT SET'}")
print(f"MAIL_USERNAME: {app.config.get('MAIL_USERNAME') or 'NOT SET'}")
print(f"MAIL_PASSWORD: {'***SET***' if app.config.get('MAIL_PASSWORD') else 'NOT SET'}")
print(f"GOOGLE_CLIENT_ID: {app.config.get('GOOGLE_CLIENT_ID') or 'NOT SET'}")
print("="*60 + "\n")

if not app.config.get("GOOGLE_CLIENT_ID"):
    print("[Flask] WARNING: GOOGLE_CLIENT_ID not configured in .env file")
else:
    print("[Flask] GOOGLE_CLIENT_ID loaded successfully")



# =========================================================
# INITIALIZE FLASK MAIL
# =========================================================

mail.init_app(app)


# =========================================================
# UPLOAD CONFIGURATION
# =========================================================

app.config["UPLOAD_FOLDER"] = os.path.join(
    os.getcwd(),
    "uploads",
    "complaints"
)

os.makedirs(
    app.config["UPLOAD_FOLDER"],
    exist_ok=True
)


# =========================================================
# INITIALIZE DATABASE TABLES
# =========================================================

def init_database():
    """Create required database tables if they don't exist"""
    try:
        conn = get_connection()
        cursor = conn.cursor()
        
        # Create password_reset_tokens table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS password_reset_tokens (
                token_id        INT             NOT NULL AUTO_INCREMENT,
                user_id         INT             NOT NULL,
                otp             VARCHAR(10)     NOT NULL,
                expires_at      DATETIME        NOT NULL,
                is_used         TINYINT(1)      DEFAULT 0,
                created_at      TIMESTAMP       DEFAULT CURRENT_TIMESTAMP,
                
                PRIMARY KEY (token_id),
                FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
                KEY idx_user_id (user_id),
                KEY idx_expires_at (expires_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        """)
        
        conn.commit()

        # Field workers are owned by municipal officers. Repair databases
        # created with the earlier users.user_id foreign key.
        cursor.execute("""
            SELECT REFERENCED_TABLE_NAME
            FROM information_schema.KEY_COLUMN_USAGE
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = 'field_workers'
              AND CONSTRAINT_NAME = 'fk_field_worker_officer'
              AND COLUMN_NAME = 'officer_id'
            LIMIT 1
        """)
        field_worker_fk = cursor.fetchone()
        if field_worker_fk and field_worker_fk["REFERENCED_TABLE_NAME"] == "users":
            cursor.execute(
                "ALTER TABLE field_workers DROP FOREIGN KEY fk_field_worker_officer"
            )
            cursor.execute("""
                ALTER TABLE field_workers
                ADD CONSTRAINT fk_field_worker_officer
                  FOREIGN KEY (officer_id) REFERENCES officers (officer_id)
                  ON DELETE RESTRICT ON UPDATE CASCADE
            """)
            conn.commit()
            print("[Database] Field worker officer foreign key repaired")

        for constraint_name, delete_action in (
            ("fk_fwe_assigned_by", "RESTRICT"),
            ("fk_fwe_reviewed_by", "SET NULL"),
        ):
            cursor.execute("""
                SELECT REFERENCED_TABLE_NAME
                FROM information_schema.KEY_COLUMN_USAGE
                WHERE TABLE_SCHEMA = DATABASE()
                  AND TABLE_NAME = 'field_worker_evidence'
                  AND CONSTRAINT_NAME = %s
                LIMIT 1
            """, (constraint_name,))
            evidence_fk = cursor.fetchone()

            if evidence_fk and evidence_fk["REFERENCED_TABLE_NAME"] == "users":
                cursor.execute(
                    f"ALTER TABLE field_worker_evidence DROP FOREIGN KEY {constraint_name}"
                )
                cursor.execute(f"""
                    ALTER TABLE field_worker_evidence
                    ADD CONSTRAINT {constraint_name}
                      FOREIGN KEY ({'assigned_by' if constraint_name == 'fk_fwe_assigned_by' else 'reviewed_by'})
                      REFERENCES officers (officer_id)
                      ON DELETE {delete_action} ON UPDATE CASCADE
                """)
                conn.commit()
                print(f"[Database] Repaired {constraint_name} foreign key")

        print("[Database] Database tables initialized successfully")
        
    except Exception as e:
        print("[Database] Error initializing database:", str(e))
    finally:
        if conn:
            conn.close()

# Run initialization on startup
init_database()


# =========================================================
# REGISTER BLUEPRINTS
# =========================================================

# Authentication
app.register_blueprint(
    auth_bp,
    url_prefix="/api/auth"
)

# Registration
app.register_blueprint(
    register_bp
)


# Complaint creation / processing
app.register_blueprint(
    complaint_bp,
    url_prefix="/api/complaints"
)

# Complaint detail + tracking history
app.register_blueprint(
    complaint_tracking_bp
)


# My Complaints
#
# This handles:
# GET /api/my-complaints
# GET /api/my-complaints/<complaint_id>
#
app.register_blueprint(
    mycomplaint_bp,
    url_prefix="/api/my-complaints"
)


# Profile
app.register_blueprint(
    profile_bp,
    url_prefix="/api/profile"
)


# Notifications
app.register_blueprint(
    notification_bp,
    url_prefix="/api/notifications"
)

# Account violation, suspension, and penalty endpoints
app.register_blueprint(
    violation_bp,
    url_prefix="/api/violations"
)

# Officer module blueprints (unified under /api/officer)
app.register_blueprint(
    officer_bp, 
    url_prefix="/api/officer"
)
app.register_blueprint(
    officercomplaint_bp,
    url_prefix="/api/officer"
)
app.register_blueprint(
    ai_analysis_bp,
    url_prefix="/api/officer"
)
app.register_blueprint(
    priority_queue_bp,
    url_prefix="/api/officer"
)
app.register_blueprint(
    department_bp,
    url_prefix="/api/officer"
)
app.register_blueprint(
    officer_analytics_bp,
    url_prefix="/api/officer"
)
app.register_blueprint(
    field_worker_bp,
    url_prefix="/api/field-worker"
)
# =========================================================
# HOME / SERVER TEST
# =========================================================

@app.route("/", methods=["GET"])
def home():

    return jsonify({
        "message": "AI CivicGuard Backend Running"
    }), 200


# =========================================================
# TEST EMAIL CONFIGURATION
# =========================================================

@app.route("/api/test-email", methods=["POST"])
def test_email():
    """Test email configuration - sends a test email to verify setup"""
    
    data = request.get_json() or {}
    test_email_address = data.get("email")
    
    if not test_email_address:
        return jsonify({
            "error": "Email address required",
            "example": {"email": "user@example.com"}
        }), 400
    
    mail_username = current_app.config.get("MAIL_USERNAME")
    mail_password = current_app.config.get("MAIL_PASSWORD")
    mail_server = current_app.config.get("MAIL_SERVER")
    mail_port = current_app.config.get("MAIL_PORT")
    
    # Check configuration
    config_status = {
        "MAIL_SERVER": mail_server,
        "MAIL_PORT": mail_port,
        "MAIL_USERNAME": mail_username if mail_username else "NOT SET",
        "MAIL_USE_TLS": current_app.config.get("MAIL_USE_TLS"),
        "MAIL_PASSWORD": "***SET***" if (mail_password and "your_gmail_app_password" not in mail_password) else "NOT SET or PLACEHOLDER",
    }
    
    print("\n" + "="*60)
    print("📧 EMAIL CONFIGURATION TEST")
    print("="*60)
    for key, value in config_status.items():
        print(f"{key}: {value}")
    print("="*60 + "\n")
    
    # Check if email is properly configured
    if (mail_username and mail_password and 
        "your_email" not in mail_username and 
        "your_gmail_app_password" not in mail_password):
        
        try:
            msg = Message(
                subject="CivicGuard Test Email",
                sender=mail_username,
                recipients=[test_email_address]
            )
            msg.body = """
Test Email from CivicGuard

If you're seeing this, your email configuration is working correctly!

Configuration Details:
- Mail Server: {} 
- Port: {}
- From: {}

Regards,
CivicGuard Team
""".format(mail_server, mail_port, mail_username)
            
            mail.send(msg)
            
            return jsonify({
                "success": True,
                "message": f"✅ Test email sent successfully to {test_email_address}",
                "config": config_status
            }), 200
            
        except Exception as e:
            error_msg = str(e)
            print(f"❌ Email sending error: {repr(e)}")
            return jsonify({
                "success": False,
                "message": f"❌ Failed to send test email: {error_msg}",
                "error_type": type(e).__name__,
                "config": config_status
            }), 500
    else:
        return jsonify({
            "success": False,
            "message": "❌ Email credentials not properly configured. Please update .env file.",
            "details": "MAIL_USERNAME and MAIL_PASSWORD must be real credentials (not placeholder values)",
            "config": config_status
        }), 400


# =========================================================
# GET USER FROM JWT
# =========================================================

def get_logged_in_user():

    authorization = request.headers.get(
        "Authorization"
    )

    if (
        not authorization
        or not authorization.startswith("Bearer ")
    ):
        return None

    token = authorization.split(
        " ",
        1
    )[1]

    try:

        payload = jwt.decode(
            token,
            app.config["SECRET_KEY"],
            algorithms=["HS256"]
        )

        if not payload.get("id"):
            return None

        return payload

    except (
        jwt.ExpiredSignatureError,
        jwt.InvalidTokenError
    ):

        return None


# =========================================================
# GET COMPLAINT IMAGE FROM MYSQL LONGBLOB
# =========================================================
#
# Frontend URL:
#
# GET /api/complaints/<complaint_id>/image
#
# Example:
#
# http://localhost:5000/api/complaints/1/image
#
# The JWT ensures a citizen can retrieve only
# their own uploaded complaint image.
#
# =========================================================

@app.route(
    "/api/complaints/<int:complaint_id>/image",
    methods=["GET"]
)
def get_complaint_image(complaint_id):

    # -----------------------------------------------------
    # AUTHENTICATE USER
    # -----------------------------------------------------

    user = get_logged_in_user()
    conn = None
    cursor = None

    try:
        conn = get_connection()
        cursor = conn.cursor()

        if user and user.get("role") in ["officer", "admin"]:
            cursor.execute(
                """
                SELECT image, image_mime_type
                FROM complaints
                WHERE complaint_id = %s
                """,
                (complaint_id,)
            )
        elif user and user.get("id"):
            cursor.execute(
                """
                SELECT image, image_mime_type
                FROM complaints
                WHERE complaint_id = %s AND user_id = %s
                """,
                (complaint_id, user.get("id"))
            )
        else:
            # Direct image request from browser img tag
            cursor.execute(
                """
                SELECT image, image_mime_type
                FROM complaints
                WHERE complaint_id = %s
                """,
                (complaint_id,)
            )

        row = cursor.fetchone()

        if not row:
            return jsonify({"message": "Complaint not found"}), 404

        image_data = row.get("image") if isinstance(row, dict) else row[0]
        image_mime_type = row.get("image_mime_type") if isinstance(row, dict) else row[1]

        if not image_data:
            return jsonify({"message": "Complaint image not found"}), 404

        return send_file(
            BytesIO(image_data),
            mimetype=(image_mime_type or "image/jpeg"),
            conditional=True,
            max_age=3600
        )


    except Exception as e:

        print(
            "❌ IMAGE RETRIEVAL ERROR:",
            repr(e)
        )

        return jsonify({
            "message":
                "Failed to retrieve complaint image",

            "error":
                str(e)
        }), 500


    finally:

        if cursor:

            cursor.close()

        if conn:

            conn.close()


# =========================================================
# COMPLAINT API TEST
# =========================================================

@app.route(
    "/api/complaints-test",
    methods=["GET"]
)
def complaints_test():

    return jsonify({
        "message":
            "Complaint API route is reachable"
    }), 200


# =========================================================
# SERVE OLD FILE-BASED COMPLAINT IMAGES
# =========================================================

@app.route(
    "/uploads/complaints/<path:filename>",
    methods=["GET"]
)
def old_complaint_image(filename):

    return send_from_directory(
        app.config["UPLOAD_FOLDER"],
        filename
    )


# =========================================================
# DATABASE TEST
# =========================================================

@app.route(
    "/api/test-db",
    methods=["GET"]
)
def test_database():

    conn = None
    cursor = None

    try:

        conn = get_connection()

        cursor = conn.cursor()

        cursor.execute(
            "SELECT 1"
        )

        result = cursor.fetchone()

        return jsonify({
            "message":
                "Database connected successfully",

            "result":
                result
        }), 200


    except Exception as e:

        print(
            "❌ DATABASE TEST ERROR:",
            repr(e)
        )

        return jsonify({
            "message":
                "Database connection failed",

            "error":
                str(e)
        }), 500


    finally:

        if cursor:

            cursor.close()

        if conn:

            conn.close()


# =========================================================
# ERROR HANDLERS
# =========================================================

@app.errorhandler(404)
def not_found(error):

    return jsonify({
        "message": "Route not found"
    }), 404


@app.errorhandler(500)
def internal_server_error(error):

    return jsonify({
        "message": "Internal server error"
    }), 500


# =========================================================
# BACKGROUND COMPLAINT WORKER DAEMON
# =========================================================

# Ensure worker thread runs once during Flask dev server reload
if os.environ.get("WERKZEUG_RUN_MAIN") == "true" or not app.debug:
    start_complaint_worker(interval_seconds=10)


# =========================================================
# RUN SERVER
# =========================================================

if __name__ == "__main__":

    app.run(
        host="0.0.0.0",
        port=5000,
        debug=True
    )