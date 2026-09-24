import os
import io
import time
import base64
import jwt
from PIL import Image, ImageDraw
from dotenv import load_dotenv
from database import get_connection
from app import app
from routes.officercomplaint_routes import run_agent3_verification, trigger_agent3_async

load_dotenv()

def create_road_image(pothole=True):
    img = Image.new("RGB", (300, 300), color=(60, 60, 65))
    draw = ImageDraw.Draw(img)
    draw.rectangle([140, 20, 160, 80], fill=(240, 200, 30))
    draw.rectangle([140, 120, 160, 180], fill=(240, 200, 30))
    draw.rectangle([140, 220, 160, 280], fill=(240, 200, 30))
    draw.rectangle([0, 0, 40, 300], fill=(160, 160, 160))
    draw.rectangle([260, 0, 300, 300], fill=(160, 160, 160))

    if pothole:
        draw.ellipse([70, 110, 130, 190], fill=(20, 20, 25), outline=(10, 10, 15), width=3)
        draw.text((75, 140), "DEEP POTHOLE", fill=(200, 200, 200))
    else:
        draw.ellipse([68, 108, 132, 192], fill=(45, 45, 50), outline=(55, 55, 60), width=2)
        draw.text((75, 140), "FRESH REPAIR", fill=(180, 180, 180))

    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    return buf.getvalue()

def test_async_resolution_flow():
    print("=" * 60)
    print("TESTING INSTANT RESOLUTION SUBMIT & ASYNC AGENT 3 TRIGGER")
    print("=" * 60)

    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT officer_id, full_name, department FROM officers WHERE status = 'ACTIVE' LIMIT 1")
    officer = cursor.fetchone()
    if not officer:
        cursor.execute("SELECT officer_id, full_name, department FROM officers LIMIT 1")
        officer = cursor.fetchone()
    assert officer, "No officer found in database"
    officer_id = officer["officer_id"]
    officer_dept = officer.get("department") or "Roads & Infrastructure"

    cursor.execute("SELECT user_id FROM users LIMIT 1")
    user = cursor.fetchone()
    assert user, "No user found in database"
    user_id = user["user_id"]

    # ----------------------------------------------------
    # TEST 1: VERIFIED CASE
    # ----------------------------------------------------
    before_img = create_road_image(pothole=True)
    after_img = create_road_image(pothole=False)

    cursor.execute("""
        INSERT INTO complaints
        (user_id, officer_id, title, description, category, status, priority, image, image_mime_type, address)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
    """, (
        user_id,
        officer_id,
        "Test Async Resolution Pothole",
        "Large pothole in main intersection needing asphalt repair",
        "Roads",
        "IN_PROGRESS",
        "HIGH",
        before_img,
        "image/jpeg",
        "100 Test St, City"
    ))
    complaint_id_1 = cursor.lastrowid

    cursor.execute("""
        INSERT INTO complaint_governance (complaint_id, department, priority, sla_hours, escalation_level, action, reason, status)
        VALUES (%s, %s, 'HIGH', 24, 1, 'Repair road surface', 'High traffic hazard', 'ASSIGNED')
    """, (complaint_id_1, officer_dept))

    conn.commit()

    secret_key = os.getenv("SECRET_KEY", "civicguard-development-secret")
    token = jwt.encode({"id": officer_id, "role": "officer"}, secret_key, algorithm="HS256")
    client = app.test_client()

    start_time = time.time()
    response = client.put(
        f"/api/officer/complaints/{complaint_id_1}/status",
        headers={"Authorization": f"Bearer {token}"},
        data={
            "status": "RESOLVED",
            "reason": "Road repaved and pothole filled with hot asphalt mix",
            "details": "Maintenance crew cleared debris and compacted new bitumen patch",
            "resolution_image": (io.BytesIO(after_img), "resolution_proof.jpg", "image/jpeg"),
        },
        content_type="multipart/form-data",
    )
    elapsed = time.time() - start_time
    print(f"\n[Test 1] Submit response status: {response.status_code} in {elapsed:.3f}s")
    assert response.status_code == 200
    assert elapsed < 3.0, f"Submit took {elapsed:.2f}s, expected instant (< 3s)"

    # ----------------------------------------------------
    # TEST 2: FAILED VERIFICATION (> 50% CONFIDENCE) -> STATUS SET TO 'ASSIGNED'
    # ----------------------------------------------------
    print("\n--- Test 2: Failed Verification (>50% confidence) transitions to ASSIGNED for rework ---")
    cursor.execute("""
        INSERT INTO complaints
        (user_id, officer_id, title, description, category, status, priority, image, image_mime_type, address)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
    """, (
        user_id,
        officer_id,
        "Test Failed Verification Pothole",
        "Large pothole in main intersection needing asphalt repair",
        "Roads",
        "IN_PROGRESS",
        "HIGH",
        before_img,
        "image/jpeg",
        "200 Test St, City"
    ))
    complaint_id_2 = cursor.lastrowid

    cursor.execute("""
        INSERT INTO complaint_governance (complaint_id, department, priority, sla_hours, escalation_level, action, reason, status)
        VALUES (%s, %s, 'HIGH', 24, 1, 'Repair road surface', 'High traffic hazard', 'ASSIGNED')
    """, (complaint_id_2, officer_dept))

    conn.commit()

    # Submit resolution with duplicate image (same as before_img) to trigger fraud/failure
    response_fail = client.put(
        f"/api/officer/complaints/{complaint_id_2}/status",
        headers={"Authorization": f"Bearer {token}"},
        data={
            "status": "RESOLVED",
            "reason": "Claims road was fixed",
            "details": "Uploaded same before image as proof",
            "resolution_image": (io.BytesIO(before_img), "duplicate_proof.jpg", "image/jpeg"),
        },
        content_type="multipart/form-data",
    )
    assert response_fail.status_code == 200

    # Run verification synchronously
    res_fail = run_agent3_verification(complaint_id_2, officer_id)
    print("Failed Verification Result:", res_fail)

    assert res_fail.get("success") is True
    assert res_fail.get("status") == "ASSIGNED", f"Expected ASSIGNED, got {res_fail.get('status')}"
    assert res_fail["verification"]["decision"] == "FAILED"
    assert res_fail["verification"]["confidence"] > 50

    cursor.execute("SELECT status, resolved_at FROM complaints WHERE complaint_id = %s", (complaint_id_2,))
    row_check = cursor.fetchone()
    print(f"Complaint #{complaint_id_2} status in DB: {row_check['status']}, resolved_at={row_check['resolved_at']}")
    assert row_check["status"] == "ASSIGNED", f"Expected ASSIGNED in database, got {row_check['status']}"
    assert row_check["resolved_at"] is None, "resolved_at should be None for rework!"
    print(">>> Test 2 PASSED: Failed resolution changed status from RESOLVED to ASSIGNED so it can rework!")

    # Cleanup test complaints
    for cid in [complaint_id_1, complaint_id_2]:
        cursor.execute("DELETE FROM complaint_status_history WHERE complaint_id = %s", (cid,))
        cursor.execute("DELETE FROM complaint_verification WHERE complaint_id = %s", (cid,))
        cursor.execute("DELETE FROM complaint_governance WHERE complaint_id = %s", (cid,))
        cursor.execute("DELETE FROM notifications WHERE complaint_id = %s", (cid,))
        cursor.execute("DELETE FROM complaints WHERE complaint_id = %s", (cid,))
    conn.commit()
    conn.close()

    print("\n" + "=" * 60)
    print("ALL TESTS PASSED SUCCESSFULLY!")
    print("=" * 60)

if __name__ == "__main__":
    test_async_resolution_flow()
