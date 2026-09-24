import os
import sys
import json
import tempfile
import traceback
import time
import threading

from dotenv import load_dotenv


# ============================================================
# ENVIRONMENT
# ============================================================

# Resolve .env relative to backend/ directory
# Works regardless of working directory

_BACKEND_DIR = os.path.abspath(
    os.path.join(
        os.path.dirname(__file__),
        os.pardir
    )
)

load_dotenv(
    os.path.join(
        _BACKEND_DIR,
        ".env"
    )
)


# ============================================================
# IMPORT AGENTS
# ============================================================

from agent.agent1 import analyze_complaint
from agent.agent2 import run_agent2
from agent.agent_2_5 import run_agent_2_5


# ============================================================
# DATABASE
# ============================================================

# Use the same pymysql connection as the rest of the app

sys.path.insert(0, _BACKEND_DIR)

from database import get_connection
from routes.violation_service import handle_violation


# ============================================================
# GET COMPLAINT FROM DATABASE
# ============================================================

def get_complaint(complaint_id):

    conn = get_connection()
    cursor = conn.cursor()

    try:

        cursor.execute(
            """
            SELECT
                complaint_id,
                title,
                description,
                image,
                image_mime_type,
                latitude,
                longitude
            FROM complaints
            WHERE complaint_id = %s
            """,
            (complaint_id,)
        )

        complaint = cursor.fetchone()

        if not complaint:

            raise ValueError(
                f"Complaint {complaint_id} not found."
            )

        return complaint

    finally:

        cursor.close()
        conn.close()


# ============================================================
# RESOLVE IMAGE PATH
# ============================================================
#
# The complaints table may store:
#
#   1. LONGBLOB binary data (current setup)
#   2. A relative file path like "uploads/complaints/a.jpg"
#
# This function handles both cases and returns an
# absolute filesystem path that Agent 1 can read.
#
# For LONGBLOB: writes bytes to a temp file.
# For string path: resolves relative to backend/ dir.
#
# ============================================================

def resolve_image(complaint):

    image_value = complaint.get("image")

    if image_value is None:

        raise ValueError(
            "Complaint has no image."
        )

    # --------------------------------------------------------
    # Case 1: String path
    # --------------------------------------------------------

    if isinstance(image_value, str):

        image_path = image_value

        if not os.path.isabs(image_path):

            image_path = os.path.join(
                _BACKEND_DIR,
                image_path
            )

        image_path = os.path.normpath(
            image_path
        )

        if not os.path.exists(image_path):

            raise FileNotFoundError(
                f"Image file not found: {image_path}"
            )

        return image_path, False

    # --------------------------------------------------------
    # Case 2: LONGBLOB binary data
    # --------------------------------------------------------

    if isinstance(image_value, (bytes, bytearray, memoryview)):

        if isinstance(image_value, memoryview):
            image_value = image_value.tobytes()

        if not image_value:

            raise ValueError(
                "Complaint image data is empty."
            )

        # Determine extension from MIME type
        mime_type = complaint.get(
            "image_mime_type",
            "image/jpeg"
        )

        extension_map = {
            "image/jpeg": ".jpg",
            "image/png": ".png",
            "image/webp": ".webp",
        }

        extension = extension_map.get(
            mime_type,
            ".jpg"
        )

        # Write to a temp file
        temp_file = tempfile.NamedTemporaryFile(
            suffix=extension,
            prefix="civicguard_",
            delete=False
        )

        try:

            temp_file.write(image_value)
            temp_file.flush()
            temp_file.close()

            return temp_file.name, True

        except Exception:

            temp_file.close()

            if os.path.exists(temp_file.name):
                os.unlink(temp_file.name)

            raise

    # --------------------------------------------------------
    # Unsupported type
    # --------------------------------------------------------

    raise ValueError(
        f"Unsupported image type: {type(image_value)}"
    )


# ============================================================
# CHECK DUPLICATE GOVERNANCE
# ============================================================

def governance_exists(complaint_id):

    conn = get_connection()
    cursor = conn.cursor()

    try:

        cursor.execute(
            """
            SELECT governance_id
            FROM complaint_governance
            WHERE complaint_id = %s
            LIMIT 1
            """,
            (complaint_id,)
        )

        return cursor.fetchone() is not None

    finally:

        cursor.close()
        conn.close()


# ============================================================
# SAVE AGENT 2 OUTPUT
# ============================================================

def save_agent2_output(agent2_output):

    complaint_id = agent2_output["complaint_id"]

    # Prevent duplicate records
    if governance_exists(complaint_id):

        print(
            f"\n[Pipeline] Governance record already exists "
            f"for complaint {complaint_id}. Skipping insert."
        )

        return

    conn = get_connection()
    cursor = conn.cursor()

    try:

        # ----------------------------------------------------
        # 1. INSERT INTO complaint_governance
        # ----------------------------------------------------
        cursor.execute(
            """
            INSERT INTO complaint_governance
            (
                complaint_id,
                department,
                priority,
                sla_hours,
                escalation_level,
                action,
                reason,
                status
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
                %s
            )
            """,
            (
                agent2_output["complaint_id"],
                agent2_output["department"],
                agent2_output["priority"],
                agent2_output["sla_hours"],
                agent2_output["escalation_level"],
                agent2_output["action"],
                agent2_output["reason"],
                agent2_output["status"],
            )
        )

        # ----------------------------------------------------
        # 2. UPDATE complaints TABLE (status, priority)
        # ----------------------------------------------------
        raw_status = agent2_output["status"]
        mapped_status = raw_status
        if raw_status in ["HUMAN_REVIEW", "PENDING"]:
            mapped_status = "UNDER_REVIEW"
        elif raw_status not in ['SUBMITTED', 'AI_ANALYZED', 'UNDER_REVIEW', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'REJECTED', 'CLOSED']:
            mapped_status = "ASSIGNED"

        cursor.execute(
            """
            UPDATE complaints
            SET
                status = %s,
                priority = %s,
                updated_at = CURRENT_TIMESTAMP
            WHERE complaint_id = %s
            """,
            (
                mapped_status,
                agent2_output["priority"],
                complaint_id
            )
        )

        # ----------------------------------------------------
        # 3. INSERT INTO complaint_status_history
        # ----------------------------------------------------
        history_msg = (
            f"Governance Decision: Assigned to {agent2_output['department']}. "
            f"Action: {agent2_output['action']}. SLA: {agent2_output['sla_hours']} hours."
        )

        cursor.execute(
            """
            INSERT INTO complaint_status_history
            (
                complaint_id,
                status,
                message,
                department,
                updated_by
            )
            VALUES (%s, %s, %s, %s, %s)
            """,
            (
                complaint_id,
                raw_status,
                history_msg,
                agent2_output["department"],
                None
            )
        )

        # ----------------------------------------------------
        # 4. FETCH user_id & INSERT INTO notifications TABLE
        # ----------------------------------------------------
        cursor.execute(
            """
            SELECT user_id FROM complaints WHERE complaint_id = %s
            """,
            (complaint_id,)
        )
        user_row = cursor.fetchone()

        user_id = None
        if user_row:
            user_id = user_row.get("user_id") if isinstance(user_row, dict) else user_row[0]

        if user_id:
            notif_title = f"Complaint #{complaint_id} Assigned to {agent2_output['department']}"
            notif_message = (
                f"Your complaint has been assigned to the {agent2_output['department']} "
                f"with priority '{agent2_output['priority']}'. "
                f"Expected resolution within {agent2_output['sla_hours']} hours."
            )

            cursor.execute(
                """
                INSERT INTO notifications
                (
                    user_id,
                    complaint_id,
                    type,
                    title,
                    message,
                    is_read
                )
                VALUES (%s, %s, %s, %s, %s, 0)
                """,
                (
                    user_id,
                    complaint_id,
                    "GOVERNANCE_UPDATE",
                    notif_title,
                    notif_message
                )
            )

        conn.commit()

        print(
            "\n[Pipeline] Agent 2 output, status history, and notification saved successfully."
        )

    except Exception as error:

        conn.rollback()

        raise RuntimeError(
            f"Failed to save Agent 2 output: {error}"
        )

    finally:

        cursor.close()
        conn.close()


def save_agent2_5_decision(complaint, agent2_5_output):
    """Persist image-filter decisions before governance assignment."""
    complaint_id = complaint["complaint_id"]
    decision = str(agent2_5_output.get("decision", "MANUAL_REVIEW")).upper()
    status = "REJECTED" if decision == "REJECT" else "UNDER_REVIEW"
    reason = agent2_5_output.get("reason") or "Image requires human review."

    conn = get_connection()
    cursor = conn.cursor()

    try:
        violation_result = {
            "violation_created": False,
            "account_status": "ACTIVE",
        }

        cursor.execute(
            """
            UPDATE complaints
            SET status = %s, updated_at = CURRENT_TIMESTAMP
            WHERE complaint_id = %s
            """,
            (status, complaint_id),
        )

        history_message = (
            "Complaint rejected because the uploaded image is unrelated to the "
            f"reported civic issue: {reason}"
            if status == "REJECTED"
            else f"Image requires manual review before staff assignment: {reason}"
        )
        cursor.execute(
            """
            INSERT INTO complaint_status_history
            (complaint_id, status, message, department, updated_by)
            VALUES (%s, %s, %s, %s, %s)
            """,
            (complaint_id, status, history_message[:500], None, None),
        )

        cursor.execute(
            "SELECT user_id FROM complaints WHERE complaint_id = %s",
            (complaint_id,),
        )
        user_row = cursor.fetchone()
        user_id = user_row.get("user_id") if user_row else None

        if user_id and decision == "REJECT":
            violation_result = handle_violation(
                conn,
                user_id,
                complaint_id,
                agent2_5_output,
            )

        if user_id:
            notification_title = (
                f"Complaint #{complaint_id} Rejected"
                if status == "REJECTED"
                else f"Complaint #{complaint_id} Needs Image Review"
            )
            cursor.execute(
                """
                INSERT INTO notifications
                (user_id, complaint_id, type, title, message, is_read)
                VALUES (%s, %s, 'STATUS_UPDATE', %s, %s, 0)
                """,
                (user_id, complaint_id, notification_title, history_message[:500]),
            )

        conn.commit()
    except Exception as error:
        conn.rollback()
        raise RuntimeError(f"Failed to save Agent 2.5 decision: {error}") from error
    finally:
        cursor.close()
        conn.close()

    return {
        "complaint_id": complaint_id,
        "status": status,
        "decision": decision,
        "reason": reason,
        "violation": violation_result,
    }


# ============================================================
# DISPLAY AGENT 1 OUTPUT
# ============================================================

def display_agent1_output(agent1_output):

    print("\n")
    print("=" * 80)
    print("AGENT 1 OUTPUT")
    print("=" * 80)

    print(
        json.dumps(
            agent1_output,
            indent=4,
            ensure_ascii=False,
            default=str
        )
    )

    print("=" * 80)


# ============================================================
# DISPLAY AGENT 2 OUTPUT
# ============================================================

def display_agent2_output(agent2_output):

    print("\n")
    print("=" * 80)
    print("AGENT 2 OUTPUT")
    print("=" * 80)

    print(
        json.dumps(
            agent2_output,
            indent=4,
            ensure_ascii=False,
            default=str
        )
    )

    print("=" * 80)


# ============================================================
# MAIN PIPELINE
# ============================================================

def process_complaint(complaint_id):

    print("\n")
    print("=" * 80)
    print("AI CIVICGUARD — COMPLAINT PIPELINE")
    print("=" * 80)

    temp_image_path = None
    is_temp_file = False

    try:

        # ====================================================
        # STEP 1
        # GET COMPLAINT
        # ====================================================

        print(
            f"\n[1] Loading complaint {complaint_id} "
            f"from database..."
        )

        complaint = get_complaint(
            complaint_id
        )

        print(
            "[1] Complaint loaded successfully."
        )

        # Log complaint data (without raw image bytes)
        log_complaint = {
            k: v for k, v in complaint.items()
            if k != "image"
        }

        log_complaint["image"] = (
            f"<{len(complaint['image'])} bytes>"
            if isinstance(
                complaint.get("image"),
                (bytes, bytearray, memoryview)
            )
            else complaint.get("image")
        )

        print("\nComplaint data:")

        print(
            json.dumps(
                log_complaint,
                indent=4,
                ensure_ascii=False,
                default=str
            )
        )

        # ====================================================
        # STEP 2
        # RESOLVE IMAGE PATH
        # ====================================================

        print(
            "\n[2] Resolving image path..."
        )

        image_path, is_temp_file = resolve_image(
            complaint
        )

        if is_temp_file:
            temp_image_path = image_path

        print(
            f"[2] Image resolved: {image_path}"
        )

        # ====================================================
        # STEP 3
        # AGENT 1
        # ====================================================

        print("\n[3] Running Agent 1...")

        # Build complaint dict for Agent 1
        # with resolved image path

        agent1_input = {
            "complaint_id": complaint["complaint_id"],
            "description": complaint.get(
                "description",
                ""
            ),
            "image": image_path,
            "latitude": float(complaint.get("latitude") or 0),
            "longitude": float(complaint.get("longitude") or 0),
        }

        agent1_output = analyze_complaint(
            agent1_input
        )

        print(
            "[3] Agent 1 completed."
        )

        display_agent1_output(
            agent1_output
        )

        # ====================================================
        # IMPORTANT
        #
        # Agent 1 output is NOT stored anywhere here.
        #
        # It remains a Python dictionary.
        #
        # Agent 1
        #     ↓
        # Python dictionary
        #     ↓
        # Agent 2
        #
        # ====================================================

        print(
            "\n[Pipeline] Passing Agent 1 output "
            "directly to Agent 2..."
        )

        # ====================================================
        # STEP 4
        # AGENT 2
        # ====================================================

        print("\n[4] Running Agent 2...")

        agent2_output = run_agent2(
            agent1_output
        )

        print(
            "[4] Agent 2 completed."
        )

        display_agent2_output(
            agent2_output
        )

        # ====================================================
        # STEP 5: IMAGE RELEVANCE FILTER
        # ====================================================

        print("\n[5] Running Agent 2.5 image relevance filter...")

        complaint_text = " ".join(
            value for value in (
                complaint.get("title"),
                complaint.get("description"),
            ) if value
        )
        agent2_5_output = run_agent_2_5(
            image_path,
            complaint_text,
        )

        print(
            f"[5] Agent 2.5 decision: {agent2_5_output.get('decision')} "
            f"({agent2_5_output.get('confidence', 0)}% confidence)"
        )

        image_decision = str(
            agent2_5_output.get("decision", "MANUAL_REVIEW")
        ).upper().strip()

        if image_decision != "ACCEPT":
            filtered_result = save_agent2_5_decision(
                complaint,
                agent2_5_output,
            )

            print(
                f"[Pipeline] Image filter stopped assignment with status "
                f"{filtered_result['status']}."
            )

            return {
                **agent2_output,
                **filtered_result,
                "image_filter": agent2_5_output,
            }

        # ====================================================
        # STEP 6
        # SAVE AGENT 2 OUTPUT
        # ====================================================

        print(
            "\n[5] Saving Agent 2 governance decision..."
        )

        save_agent2_output(
            agent2_output
        )

        # ====================================================
        # COMPLETE
        # ====================================================

        print("\n")
        print("=" * 80)
        print("PIPELINE COMPLETED SUCCESSFULLY")
        print("=" * 80)

        return agent2_output

    except Exception as error:

        print("\n")
        print("=" * 80)
        print("PIPELINE ERROR")
        print("=" * 80)
        print(str(error))
        traceback.print_exc()
        print("=" * 80)

        raise

    finally:

        # Clean up temp image file
        if (
            is_temp_file
            and temp_image_path
            and os.path.exists(temp_image_path)
        ):

            try:
                os.unlink(temp_image_path)

                print(
                    "[Pipeline] Temp image file cleaned up."
                )

            except OSError:
                pass


# ============================================================
# UNPROCESSED COMPLAINTS WORKER
# ============================================================

_ACTIVE_PROCESSING_IDS = set()
_PROCESSING_LOCK = threading.Lock()


def process_unprocessed_complaints():
    """
    Finds complaints in 'SUBMITTED' status that do not have a governance record,
    runs Agent 1 -> Agent 2 pipeline, inserts governance decision, assigns department,
    updates status to ASSIGNED, and commits to database.
    """
    conn = None
    cursor = None
    complaint_ids = []

    try:
        conn = get_connection()
        cursor = conn.cursor()

        cursor.execute(
            """
            SELECT c.complaint_id
            FROM complaints c
            LEFT JOIN complaint_governance cg ON c.complaint_id = cg.complaint_id
            WHERE c.status = 'SUBMITTED' AND cg.complaint_id IS NULL
            ORDER BY c.complaint_id ASC
            """
        )

        rows = cursor.fetchall()
        complaint_ids = [row["complaint_id"] for row in rows]

    except Exception as err:
        print(f"[ERROR] Worker error querying unprocessed complaints: {repr(err)}")
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()

    for cid in complaint_ids:
        with _PROCESSING_LOCK:
            if cid in _ACTIVE_PROCESSING_IDS:
                continue
            _ACTIVE_PROCESSING_IDS.add(cid)

        try:
            print(f"[Worker] Dynamically processing SUBMITTED complaint ID: {cid}...")
            process_complaint(cid)
            print(f"[Worker] Successfully processed and assigned complaint ID: {cid}.")
        except Exception as err:
            print(f"[ERROR] Worker error processing complaint {cid}: {repr(err)}")
        finally:
            with _PROCESSING_LOCK:
                _ACTIVE_PROCESSING_IDS.discard(cid)


def process_unverified_resolutions():
    """
    Finds complaints in 'UNDER_REVIEW' that have a resolution_image but no
    complaint_verification record, and runs Agent 3 verification on them.
    """
    conn = None
    cursor = None
    complaint_ids = []

    try:
        conn = get_connection()
        cursor = conn.cursor()

        cursor.execute(
            """
            SELECT c.complaint_id
            FROM complaints c
            WHERE c.status = 'UNDER_REVIEW'
              AND c.resolution_image IS NOT NULL
            ORDER BY c.complaint_id ASC
            LIMIT 10
            """
        )

        rows = cursor.fetchall()
        complaint_ids = [row["complaint_id"] for row in rows]

    except Exception as err:
        print(f"[ERROR] Worker error querying unverified resolutions: {repr(err)}")
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()

    for cid in complaint_ids:
        with _PROCESSING_LOCK:
            if cid in _ACTIVE_PROCESSING_IDS:
                continue
            _ACTIVE_PROCESSING_IDS.add(cid)

        try:
            print(f"[Worker] Dynamically running Agent 3 on UNDER_REVIEW complaint #{cid}...")
            from routes.officercomplaint_routes import run_agent3_verification
            run_agent3_verification(cid)
            print(f"[Worker] Agent 3 completed for complaint #{cid}.")
        except Exception as err:
            print(f"[ERROR] Worker error running Agent 3 on complaint #{cid}: {repr(err)}")
        finally:
            with _PROCESSING_LOCK:
                _ACTIVE_PROCESSING_IDS.discard(cid)


def start_complaint_worker(interval_seconds=10):
    """
    Starts a background daemon thread that periodically checks for un-processed 'SUBMITTED' complaints
    and un-verified resolution submissions.
    """
    def worker_loop():
        print(f"[Worker Daemon] Started background complaint worker (polling interval: {interval_seconds}s)...")
        while True:
            try:
                process_unprocessed_complaints()
            except Exception as e:
                print(f"[ERROR] Worker loop unhandled error (unprocessed): {repr(e)}")
            try:
                process_unverified_resolutions()
            except Exception as e:
                print(f"[ERROR] Worker loop unhandled error (unverified): {repr(e)}")
            time.sleep(interval_seconds)

    thread = threading.Thread(target=worker_loop, daemon=True)
    thread.start()
    return thread


# ============================================================
# TERMINAL TEST
# ============================================================

if __name__ == "__main__":

    if len(sys.argv) < 2:

        print(
            "\nUsage:"
        )

        print(
            "python -m agent.pipeline 1"
        )

        sys.exit(1)

    try:

        complaint_id = int(
            sys.argv[1]
        )

    except ValueError:

        print(
            "Complaint ID must be an integer."
        )

        sys.exit(1)

    try:

        process_complaint(
            complaint_id
        )

    except Exception as error:

        print("\n")
        print("=" * 80)
        print("PIPELINE ERROR")
        print("=" * 80)

        print(
            str(error)
        )

        print("=" * 80)

        sys.exit(1)