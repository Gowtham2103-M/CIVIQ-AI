import os
import io
import json
import base64
from PIL import Image, ImageDraw
from dotenv import load_dotenv
from agent.agent3 import verify_resolution, _normalize_bytes, _precheck_images

load_dotenv()

def create_dummy_image(color="red", text=""):
    img = Image.new("RGB", (200, 200), color=color)
    draw = ImageDraw.Draw(img)
    if text:
        draw.text((10, 90), text, fill="white")
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    return buf.getvalue()

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

def run_tests():
    print("=" * 60)
    print("AGENT 3 RESOLUTION VERIFICATION - FULL TEST SUITE")
    print("=" * 60)

    # 1. Duplicate Image Check
    print("\n--- Test 1: Duplicate Image Fraud Pre-check ---")
    img_sample = create_dummy_image("blue", "Sample Civic Scene")
    comp_duplicate = {
        "title": "Pothole on Main Road",
        "category": "Roads",
        "description": "Deep pothole near crossroad",
        "address": "123 Main St",
        "image": img_sample,
        "resolution_image": img_sample,
        "image_mime_type": "image/jpeg",
        "resolution_reason": "Repaired road surface",
        "resolution_details": "Filled with bitumen patch"
    }
    res1 = verify_resolution(comp_duplicate, {"department": "Roads & Bridges"})
    print("Result 1:", json.dumps(res1, indent=2))
    assert res1["decision"] == "FAILED"
    print(">>> Test 1 PASSED: Duplicate image flagged as fraud.")

    # 2. Blank Solid Image Check
    print("\n--- Test 2: Blank Solid Image Pre-check ---")
    blank_img = create_dummy_image("black")
    comp_blank = {
        "title": "Broken Streetlight",
        "category": "Electrical",
        "description": "Streetlight pole damaged",
        "address": "45 Park Ave",
        "image": img_sample,
        "resolution_image": blank_img,
        "image_mime_type": "image/jpeg",
        "resolution_reason": "Replaced bulb",
        "resolution_details": "Installed new LED"
    }
    res2 = verify_resolution(comp_blank, {"department": "Electricity"})
    print("Result 2:", json.dumps(res2, indent=2))
    assert res2["decision"] == "FAILED"
    print(">>> Test 2 PASSED: Blank/solid image rejected.")

    # 3. Test Base64 Data URL and String Input Formats for After Image
    print("\n--- Test 3: Base64 / Data URL After Image Support ---")
    raw_bytes = create_dummy_image("orange", "Test Base64")
    b64_str = base64.b64encode(raw_bytes).decode("ascii")
    data_url = f"data:image/jpeg;base64,{b64_str}"

    norm1 = _normalize_bytes(b64_str)
    norm2 = _normalize_bytes(data_url)
    assert norm1 == raw_bytes, "Failed to normalize raw base64 string"
    assert norm2 == raw_bytes, "Failed to normalize data URL string"
    print(">>> Test 3 PASSED: Base64 strings and Data URLs normalized correctly into bytes.")

    # 4. Unwanted / Unrelated Images with Road Description
    print("\n--- Test 4: Unwanted / Unrelated Images vs Road Description ---")
    img_unwanted_1 = create_dummy_image("purple", "Indoor Living Room")
    img_unwanted_2 = create_dummy_image("green", "Plate of Food / Fruit")

    comp_unwanted = {
        "title": "Severe Pothole on Road",
        "category": "Roads & Highways",
        "description": "Large pothole in the middle of 5th Avenue causing traffic congestion and accidents.",
        "address": "5th Avenue, Ward 12",
        "image": img_unwanted_1,
        "resolution_image": f"data:image/jpeg;base64,{base64.b64encode(img_unwanted_2).decode('ascii')}",
        "image_mime_type": "image/jpeg",
        "resolution_reason": "Road repaved with asphalt",
        "resolution_details": "Road maintenance team filled the pothole and leveled the surface"
    }
    res4 = verify_resolution(comp_unwanted, {"department": "Roads Department"})
    print("Result 4:", json.dumps(res4, indent=2))
    assert res4["decision"] in ["FAILED", "MANUAL_REVIEW"], f"Test 4 failed: Decision is {res4['decision']}"
    assert res4["decision"] != "VERIFIED", "Test 4 failed: Unwanted images were wrongly VERIFIED!"
    assert res4["before_issue_detected"] is False, "Test 4 failed: Before issue was detected on unrelated image!"
    print(">>> Test 4 PASSED: Data URL passed successfully to Agent 3 and rejected correctly!")

    # 5. Corrupt Before/After Evidence Check
    print("\n--- Test 5: Corrupt Before/After Evidence Check ---")
    res5 = _precheck_images(b"not-an-image", b"not-an-image")
    print("Result 5:", json.dumps(res5, indent=2))
    assert res5["decision"] == "FAILED"
    assert res5["model_name"] == "precheck/invalid-after-image"
    print(">>> Test 5 PASSED: Unreadable evidence rejected before vision analysis.")

    print("\n" + "=" * 60)
    print("ALL TESTS PASSED SUCCESSFULLY!")
    print("=" * 60)

if __name__ == "__main__":
    run_tests()
