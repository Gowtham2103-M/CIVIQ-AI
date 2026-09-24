# routes/field_worker.py

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from io import BytesIO
import hashlib

from database import get_db


router = APIRouter(
    prefix="/api/field-worker",
    tags=["Field Worker"]
)


# ============================================================
# HELPERS
# ============================================================

def hash_password(password: str) -> str:
    """
    Replace with bcrypt/passlib if your project already uses it.
    """
    return hashlib.sha256(password.encode()).hexdigest()


def check_worker(worker):
    """
    Validate temporary worker account.
    """
    if not worker:
        raise HTTPException(
            status_code=401,
            detail="Invalid field worker credentials"
        )

    if worker["status"] != "ACTIVE":
        raise HTTPException(
            status_code=403,
            detail=f"Worker account is {worker['status']}"
        )

    if worker["expires_at"] and worker["expires_at"] < datetime.now():
        raise HTTPException(
            status_code=403,
            detail="Field worker account has expired"
        )


# ============================================================
# MODELS
# ============================================================

class WorkerLogin(BaseModel):
    username: str
    password: str


class CreateWorker(BaseModel):
    officer_id: int
    full_name: str
    username: str
    password: str
    expires_at: datetime


class AssignComplaint(BaseModel):
    worker_id: int
    complaint_id: int
    officer_id: int


class RejectEvidence(BaseModel):
    officer_id: int
    reason: str


# ============================================================
# 1. FIELD WORKER LOGIN
# ============================================================

@router.post("/login")
def field_worker_login(
    data: WorkerLogin,
    db=Depends(get_db)
):

    cursor = db.cursor(dictionary=True)

    cursor.execute(
        """
        SELECT
            worker_id,
            officer_id,
            full_name,
            username,
            password_hash,
            status,
            expires_at
        FROM field_workers
        WHERE username = %s
        """,
        (data.username,)
    )

    worker = cursor.fetchone()

    if not worker:
        raise HTTPException(
            status_code=401,
            detail="Invalid username or password"
        )

    if worker["password_hash"] != hash_password(data.password):
        raise HTTPException(
            status_code=401,
            detail="Invalid username or password"
        )

    check_worker(worker)

    return {
        "success": True,
        "message": "Login successful",
        "worker": {
            "worker_id": worker["worker_id"],
            "officer_id": worker["officer_id"],
            "full_name": worker["full_name"],
            "username": worker["username"],
            "expires_at": worker["expires_at"]
        }
    }


# ============================================================
# 2. OFFICER - CREATE TEMPORARY FIELD WORKER
# ============================================================

@router.post("/create")
def create_field_worker(
    data: CreateWorker,
    db=Depends(get_db)
):

    cursor = db.cursor(dictionary=True)

    # Check username
    cursor.execute(
        """
        SELECT worker_id
        FROM field_workers
        WHERE username = %s
        """,
        (data.username,)
    )

    existing = cursor.fetchone()

    if existing:
        raise HTTPException(
            status_code=400,
            detail="Username already exists"
        )

    # Verify officer exists
    cursor.execute(
        """
        SELECT user_id
        FROM users
        WHERE user_id = %s
        """,
        (data.officer_id,)
    )

    officer = cursor.fetchone()

    if not officer:
        raise HTTPException(
            status_code=404,
            detail="Officer not found"
        )

    if data.expires_at <= datetime.now():
        raise HTTPException(
            status_code=400,
            detail="Expiry time must be in the future"
        )

    password_hash = hash_password(data.password)

    cursor.execute(
        """
        INSERT INTO field_workers (
            officer_id,
            full_name,
            username,
            password_hash,
            status,
            expires_at
        )
        VALUES (%s, %s, %s, %s, 'ACTIVE', %s)
        """,
        (
            data.officer_id,
            data.full_name,
            data.username,
            password_hash,
            data.expires_at
        )
    )

    db.commit()

    worker_id = cursor.lastrowid

    return {
        "success": True,
        "message": "Temporary field worker account created",
        "worker_id": worker_id,
        "username": data.username,
        "expires_at": data.expires_at
    }


# ============================================================
# 3. OFFICER - LIST FIELD WORKERS
# ============================================================

@router.get("/workers/{officer_id}")
def get_field_workers(
    officer_id: int,
    db=Depends(get_db)
):

    cursor = db.cursor(dictionary=True)

    cursor.execute(
        """
        SELECT
            worker_id,
            officer_id,
            full_name,
            username,
            status,
            expires_at,
            created_at
        FROM field_workers
        WHERE officer_id = %s
        ORDER BY created_at DESC
        """,
        (officer_id,)
    )

    workers = cursor.fetchall()

    # Automatically mark expired accounts
    for worker in workers:

        if (
            worker["status"] == "ACTIVE"
            and worker["expires_at"]
            and worker["expires_at"] < datetime.now()
        ):

            cursor.execute(
                """
                UPDATE field_workers
                SET status = 'EXPIRED'
                WHERE worker_id = %s
                """,
                (worker["worker_id"],)
            )

            worker["status"] = "EXPIRED"

    db.commit()

    return {
        "success": True,
        "workers": workers
    }


# ============================================================
# 4. OFFICER - DISABLE WORKER
# ============================================================

@router.put("/workers/{worker_id}/disable")
def disable_worker(
    worker_id: int,
    officer_id: int,
    db=Depends(get_db)
):

    cursor = db.cursor(dictionary=True)

    cursor.execute(
        """
        SELECT worker_id
        FROM field_workers
        WHERE worker_id = %s
        AND officer_id = %s
        """,
        (worker_id, officer_id)
    )

    worker = cursor.fetchone()

    if not worker:
        raise HTTPException(
            status_code=404,
            detail="Worker not found"
        )

    cursor.execute(
        """
        UPDATE field_workers
        SET status = 'DISABLED'
        WHERE worker_id = %s
        """,
        (worker_id,)
    )

    db.commit()

    return {
        "success": True,
        "message": "Field worker disabled"
    }


# ============================================================
# 5. OFFICER - ENABLE WORKER
# ============================================================

@router.put("/workers/{worker_id}/enable")
def enable_worker(
    worker_id: int,
    officer_id: int,
    db=Depends(get_db)
):

    cursor = db.cursor(dictionary=True)

    cursor.execute(
        """
        SELECT worker_id, expires_at
        FROM field_workers
        WHERE worker_id = %s
        AND officer_id = %s
        """,
        (worker_id, officer_id)
    )

    worker = cursor.fetchone()

    if not worker:
        raise HTTPException(
            status_code=404,
            detail="Worker not found"
        )

    if worker["expires_at"] <= datetime.now():
        raise HTTPException(
            status_code=400,
            detail="Worker account has expired"
        )

    cursor.execute(
        """
        UPDATE field_workers
        SET status = 'ACTIVE'
        WHERE worker_id = %s
        """,
        (worker_id,)
    )

    db.commit()

    return {
        "success": True,
        "message": "Field worker enabled"
    }


# ============================================================
# 6. OFFICER - ASSIGN COMPLAINT TO WORKER
# ============================================================

@router.post("/assign")
def assign_complaint(
    data: AssignComplaint,
    db=Depends(get_db)
):

    cursor = db.cursor(dictionary=True)

    # Check worker
    cursor.execute(
        """
        SELECT
            worker_id,
            officer_id,
            status,
            expires_at
        FROM field_workers
        WHERE worker_id = %s
        """,
        (data.worker_id,)
    )

    worker = cursor.fetchone()

    if not worker:
        raise HTTPException(
            status_code=404,
            detail="Field worker not found"
        )

    if worker["officer_id"] != data.officer_id:
        raise HTTPException(
            status_code=403,
            detail="Worker does not belong to this officer"
        )

    check_worker(worker)

    # Check complaint
    cursor.execute(
        """
        SELECT
            complaint_id,
            officer_id,
            status,
            latitude,
            longitude
        FROM complaints
        WHERE complaint_id = %s
        """,
        (data.complaint_id,)
    )

    complaint = cursor.fetchone()

    if not complaint:
        raise HTTPException(
            status_code=404,
            detail="Complaint not found"
        )

    # Check complaint belongs to officer
    if complaint["officer_id"] != data.officer_id:
        raise HTTPException(
            status_code=403,
            detail="Complaint is not assigned to this officer"
        )

    # Prevent duplicate active assignment
    cursor.execute(
        """
        SELECT evidence_id
        FROM field_worker_evidence
        WHERE worker_id = %s
        AND complaint_id = %s
        AND status IN ('ASSIGNED', 'SUBMITTED')
        LIMIT 1
        """,
        (
            data.worker_id,
            data.complaint_id
        )
    )

    existing = cursor.fetchone()

    if existing:
        raise HTTPException(
            status_code=400,
            detail="Complaint is already assigned to this worker"
        )

    # Create assignment
    cursor.execute(
        """
        INSERT INTO field_worker_evidence (
            worker_id,
            complaint_id,
            assigned_by,
            status,
            ai_status
        )
        VALUES (
            %s,
            %s,
            %s,
            'ASSIGNED',
            'PENDING'
        )
        """,
        (
            data.worker_id,
            data.complaint_id,
            data.officer_id
        )
    )

    # Update complaint status
    cursor.execute(
        """
        UPDATE complaints
        SET
            status = 'IN_PROGRESS',
            updated_at = NOW()
        WHERE complaint_id = %s
        """,
        (data.complaint_id,)
    )

    db.commit()

    return {
        "success": True,
        "message": "Complaint assigned to field worker",
        "evidence_id": cursor.lastrowid
    }


# ============================================================
# 7. FIELD WORKER - GET ASSIGNED COMPLAINTS
# ============================================================

@router.get("/{worker_id}/complaints")
def get_worker_complaints(
    worker_id: int,
    db=Depends(get_db)
):

    cursor = db.cursor(dictionary=True)

    # Check worker
    cursor.execute(
        """
        SELECT
            worker_id,
            status,
            expires_at
        FROM field_workers
        WHERE worker_id = %s
        """,
        (worker_id,)
    )

    worker = cursor.fetchone()

    check_worker(worker)

    # Only assigned complaints
    cursor.execute(
        """
        SELECT
            fwe.evidence_id,
            fwe.complaint_id,
            fwe.status AS evidence_status,
            fwe.assigned_at,

            c.title,
            c.description,
            c.address,
            c.category,
            c.priority,
            c.status AS complaint_status,
            c.latitude,
            c.longitude,
            c.created_at

        FROM field_worker_evidence fwe

        INNER JOIN complaints c
            ON c.complaint_id = fwe.complaint_id

        WHERE fwe.worker_id = %s

        AND fwe.status IN (
            'ASSIGNED',
            'SUBMITTED'
        )

        ORDER BY fwe.assigned_at DESC
        """,
        (worker_id,)
    )

    complaints = cursor.fetchall()

    return {
        "success": True,
        "complaints": complaints
    }


# ============================================================
# 8. FIELD WORKER - GET SINGLE COMPLAINT
# ============================================================

@router.get("/{worker_id}/complaints/{complaint_id}")
def get_worker_complaint(
    worker_id: int,
    complaint_id: int,
    db=Depends(get_db)
):

    cursor = db.cursor(dictionary=True)

    cursor.execute(
        """
        SELECT
            fwe.evidence_id,
            fwe.worker_id,
            fwe.complaint_id,
            fwe.status AS evidence_status,
            fwe.ai_status,
            fwe.assigned_at,

            c.title,
            c.description,
            c.address,
            c.category,
            c.priority,
            c.status AS complaint_status,
            c.latitude,
            c.longitude,
            c.created_at

        FROM field_worker_evidence fwe

        INNER JOIN complaints c
            ON c.complaint_id = fwe.complaint_id

        WHERE fwe.worker_id = %s
        AND fwe.complaint_id = %s

        LIMIT 1
        """,
        (
            worker_id,
            complaint_id
        )
    )

    complaint = cursor.fetchone()

    if not complaint:
        raise HTTPException(
            status_code=404,
            detail="Complaint is not assigned to this worker"
        )

    return {
        "success": True,
        "complaint": complaint
    }


# ============================================================
# 9. FIELD WORKER - UPLOAD RESOLUTION IMAGE
# ============================================================

@router.post("/{worker_id}/complaints/{complaint_id}/submit")
async def submit_resolution_evidence(
    worker_id: int,
    complaint_id: int,
    latitude: Optional[float] = Form(None),
    longitude: Optional[float] = Form(None),
    captured_at: Optional[str] = Form(None),
    image: UploadFile = File(...),
    db=Depends(get_db)
):

    cursor = db.cursor(dictionary=True)

    # Validate worker
    cursor.execute(
        """
        SELECT
            worker_id,
            status,
            expires_at
        FROM field_workers
        WHERE worker_id = %s
        """,
        (worker_id,)
    )

    worker = cursor.fetchone()

    check_worker(worker)

    # Validate assignment
    cursor.execute(
        """
        SELECT
            evidence_id,
            status
        FROM field_worker_evidence
        WHERE worker_id = %s
        AND complaint_id = %s
        AND status = 'ASSIGNED'
        LIMIT 1
        """,
        (
            worker_id,
            complaint_id
        )
    )

    evidence = cursor.fetchone()

    if not evidence:
        raise HTTPException(
            status_code=404,
            detail="Complaint is not assigned or already submitted"
        )

    # Validate image
    if not image.content_type:
        raise HTTPException(
            status_code=400,
            detail="Invalid image"
        )

    allowed_types = [
        "image/jpeg",
        "image/png",
        "image/webp"
    ]

    if image.content_type not in allowed_types:
        raise HTTPException(
            status_code=400,
            detail="Only JPG, PNG and WEBP images are allowed"
        )

    image_data = await image.read()

    if not image_data:
        raise HTTPException(
            status_code=400,
            detail="Empty image"
        )

    # Maximum 10 MB
    if len(image_data) > 10 * 1024 * 1024:
        raise HTTPException(
            status_code=400,
            detail="Image size must be below 10 MB"
        )

    # Capture time
    capture_datetime = None

    if captured_at:
        try:
            capture_datetime = datetime.fromisoformat(
                captured_at.replace("Z", "+00:00")
            )
        except ValueError:
            raise HTTPException(
                status_code=400,
                detail="Invalid captured_at format"
            )
    else:
        capture_datetime = datetime.now()

    # --------------------------------------------------------
    # AI VERIFICATION
    # --------------------------------------------------------
    #
    # Replace this section with your actual AI image verification.
    #
    # IMPORTANT:
    # AI should return:
    #
    # passed = True / False
    # reason = "..."
    #
    # --------------------------------------------------------

    ai_passed = True
    ai_reason = "Image submitted for officer verification."

    if not ai_passed:

        cursor.execute(
            """
            UPDATE field_worker_evidence

            SET
                image = %s,
                image_mime_type = %s,

                latitude = %s,
                longitude = %s,

                captured_at = %s,

                status = 'AI_REJECTED',

                ai_status = 'FAILED',

                ai_reason = %s,

                submitted_at = NOW()

            WHERE evidence_id = %s
            """,
            (
                image_data,
                image.content_type,
                latitude,
                longitude,
                capture_datetime,
                ai_reason,
                evidence["evidence_id"]
            )
        )

        db.commit()

        return {
            "success": False,
            "status": "AI_REJECTED",
            "message": "Image rejected by AI verification",
            "reason": ai_reason
        }

    # AI passed
    cursor.execute(
        """
        UPDATE field_worker_evidence

        SET
            image = %s,
            image_mime_type = %s,

            latitude = %s,
            longitude = %s,

            captured_at = %s,

            status = 'SUBMITTED',

            ai_status = 'PASSED',

            ai_reason = %s,

            submitted_at = NOW()

        WHERE evidence_id = %s
        """,
        (
            image_data,
            image.content_type,
            latitude,
            longitude,
            capture_datetime,
            ai_reason,
            evidence["evidence_id"]
        )
    )

    db.commit()

    return {
        "success": True,
        "status": "SUBMITTED",
        "message": "Resolution evidence submitted successfully",
        "evidence_id": evidence["evidence_id"]
    }


# ============================================================
# 10. OFFICER - GET PENDING EVIDENCE
# ============================================================

@router.get("/officer/{officer_id}/evidence")
def get_pending_evidence(
    officer_id: int,
    db=Depends(get_db)
):

    cursor = db.cursor(dictionary=True)

    cursor.execute(
        """
        SELECT
            fwe.evidence_id,
            fwe.worker_id,
            fwe.complaint_id,

            fwe.status,
            fwe.ai_status,
            fwe.ai_reason,

            fwe.latitude,
            fwe.longitude,
            fwe.captured_at,
            fwe.assigned_at,
            fwe.submitted_at,

            fw.full_name AS worker_name,
            fw.username AS worker_username,

            c.title,
            c.description,
            c.address,
            c.latitude AS complaint_latitude,
            c.longitude AS complaint_longitude,
            c.status AS complaint_status

        FROM field_worker_evidence fwe

        INNER JOIN field_workers fw
            ON fw.worker_id = fwe.worker_id

        INNER JOIN complaints c
            ON c.complaint_id = fwe.complaint_id

        WHERE fwe.assigned_by = %s

        AND fwe.status = 'SUBMITTED'

        ORDER BY fwe.submitted_at DESC
        """,
        (officer_id,)
    )

    evidence = cursor.fetchall()

    return {
        "success": True,
        "evidence": evidence
    }


# ============================================================
# 11. OFFICER - VIEW EVIDENCE IMAGE
# ============================================================

@router.get("/evidence/{evidence_id}/image")
def get_evidence_image(
    evidence_id: int,
    db=Depends(get_db)
):

    cursor = db.cursor(dictionary=True)

    cursor.execute(
        """
        SELECT
            image,
            image_mime_type
        FROM field_worker_evidence
        WHERE evidence_id = %s
        """,
        (evidence_id,)
    )

    evidence = cursor.fetchone()

    if not evidence or not evidence["image"]:
        raise HTTPException(
            status_code=404,
            detail="Evidence image not found"
        )

    return StreamingResponse(
        BytesIO(evidence["image"]),
        media_type=evidence["image_mime_type"] or "image/jpeg"
    )


# ============================================================
# 12. OFFICER - APPROVE EVIDENCE
# ============================================================

@router.post("/officer/{officer_id}/evidence/{evidence_id}/approve")
def approve_evidence(
    officer_id: int,
    evidence_id: int,
    db=Depends(get_db)
):

    cursor = db.cursor(dictionary=True)

    # Get evidence
    cursor.execute(
        """
        SELECT
            evidence_id,
            worker_id,
            complaint_id,
            assigned_by,
            image,
            image_mime_type,
            status
        FROM field_worker_evidence
        WHERE evidence_id = %s
        """,
        (evidence_id,)
    )

    evidence = cursor.fetchone()

    if not evidence:
        raise HTTPException(
            status_code=404,
            detail="Evidence not found"
        )

    if evidence["assigned_by"] != officer_id:
        raise HTTPException(
            status_code=403,
            detail="You cannot approve this evidence"
        )

    if evidence["status"] != "SUBMITTED":
        raise HTTPException(
            status_code=400,
            detail="Evidence is not pending approval"
        )

    if not evidence["image"]:
        raise HTTPException(
            status_code=400,
            detail="Evidence image is missing"
        )

    # Get current complaint status
    cursor.execute(
        """
        SELECT
            complaint_id,
            status
        FROM complaints
        WHERE complaint_id = %s
        """,
        (evidence["complaint_id"],)
    )

    complaint = cursor.fetchone()

    if not complaint:
        raise HTTPException(
            status_code=404,
            detail="Complaint not found"
        )

    old_status = complaint["status"]

    # --------------------------------------------------------
    # APPROVE EVIDENCE
    # --------------------------------------------------------

    cursor.execute(
        """
        UPDATE field_worker_evidence

        SET
            status = 'APPROVED',
            reviewed_by = %s,
            reviewed_at = NOW()

        WHERE evidence_id = %s
        """,
        (
            officer_id,
            evidence_id
        )
    )

    # --------------------------------------------------------
    # COPY FIELD WORKER IMAGE TO COMPLAINT
    # --------------------------------------------------------

    cursor.execute(
        """
        UPDATE complaints

        SET
            status = 'RESOLVED',

            resolution_image = %s,

            resolved_at = NOW(),

            updated_at = NOW()

        WHERE complaint_id = %s
        """,
        (
            evidence["image"],
            evidence["complaint_id"]
        )
    )

    # --------------------------------------------------------
    # COMPLAINT STATUS HISTORY
    # --------------------------------------------------------
    #
    # IMPORTANT:
    # Adjust this INSERT to match your exact
    # complaint_status_history columns.
    #
    # --------------------------------------------------------

    try:

        cursor.execute(
            """
            INSERT INTO complaint_status_history (
                complaint_id,
                old_status,
                new_status,
                changed_by,
                reason,
                changed_at
            )
            VALUES (
                %s,
                %s,
                'RESOLVED',
                %s,
                %s,
                NOW()
            )
            """,
            (
                evidence["complaint_id"],
                old_status,
                officer_id,
                "Resolution verified using field worker evidence."
            )
        )

    except Exception:
        # If your history table has different columns,
        # the complaint update should still be handled
        # according to your existing project structure.
        db.rollback()

        raise HTTPException(
            status_code=500,
            detail=(
                "Evidence approval failed because "
                "complaint_status_history schema does not match "
                "the expected columns."
            )
        )

    db.commit()

    return {
        "success": True,
        "message": "Evidence approved and complaint resolved",
        "complaint_id": evidence["complaint_id"],
        "status": "RESOLVED"
    }


# ============================================================
# 13. OFFICER - REJECT EVIDENCE
# ============================================================

@router.post("/officer/{officer_id}/evidence/{evidence_id}/reject")
def reject_evidence(
    officer_id: int,
    evidence_id: int,
    data: RejectEvidence,
    db=Depends(get_db)
):

    cursor = db.cursor(dictionary=True)

    if not data.reason.strip():
        raise HTTPException(
            status_code=400,
            detail="Rejection reason is required"
        )

    cursor.execute(
        """
        SELECT
            evidence_id,
            assigned_by,
            status
        FROM field_worker_evidence
        WHERE evidence_id = %s
        """,
        (evidence_id,)
    )

    evidence = cursor.fetchone()

    if not evidence:
        raise HTTPException(
            status_code=404,
            detail="Evidence not found"
        )

    if evidence["assigned_by"] != officer_id:
        raise HTTPException(
            status_code=403,
            detail="You cannot reject this evidence"
        )

    if evidence["status"] != "SUBMITTED":
        raise HTTPException(
            status_code=400,
            detail="Evidence is not pending review"
        )

    cursor.execute(
        """
        UPDATE field_worker_evidence

        SET
            status = 'OFFICER_REJECTED',
            officer_reason = %s,
            reviewed_by = %s,
            reviewed_at = NOW()

        WHERE evidence_id = %s
        """,
        (
            data.reason,
            officer_id,
            evidence_id
        )
    )

    db.commit()

    return {
        "success": True,
        "message": "Evidence rejected",
        "evidence_id": evidence_id
    }