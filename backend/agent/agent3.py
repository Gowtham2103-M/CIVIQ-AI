import base64
import hashlib
import io
import json
import os
import re
from typing import Any, Dict, List, Optional

from dotenv import load_dotenv
from openai import OpenAI
from PIL import Image, ImageStat

# ============================================================
# ENVIRONMENT CONFIGURATION
# ============================================================

load_dotenv(os.path.join(os.path.dirname(__file__), os.pardir, ".env"))

OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"
PRIMARY_MODEL = os.getenv("OPENROUTER_VISION_MODEL", "").strip()
if not PRIMARY_MODEL:
    raise RuntimeError(
        "OPENROUTER_VISION_MODEL is required for Agent 3 and must be a paid vision model."
    )

# Keep this configurable because OpenRouter model availability changes.
configured_fallbacks = [
    model.strip()
    for model in os.getenv("OPENROUTER_VISION_FALLBACKS", "").split(",")
    if model.strip()
]
MODEL_FALLBACKS: List[str] = [
    PRIMARY_MODEL,
    *configured_fallbacks,
]
# Deduplicate while preserving order
MODEL_FALLBACKS = list(dict.fromkeys(MODEL_FALLBACKS))
if any(model == "openrouter/free" or model.endswith(":free") for model in MODEL_FALLBACKS):
    raise RuntimeError(
        "Agent 3 accepts only paid vision models in OPENROUTER_VISION_MODEL "
        "and OPENROUTER_VISION_FALLBACKS."
    )

MODEL_NAME = PRIMARY_MODEL


# ============================================================
# IMAGE HELPERS & PRE-CHECKS
# ============================================================

def _normalize_bytes(image_data: Any) -> Optional[bytes]:
    """Convert memoryview, bytearray, bytes, base64 strings, data URLs, file paths, BytesIO, or PIL images into standard bytes."""
    if image_data is None:
        return None
    if isinstance(image_data, memoryview):
        return image_data.tobytes()
    if isinstance(image_data, (bytes, bytearray)):
        return bytes(image_data) if image_data else None
    if isinstance(image_data, io.BytesIO):
        return image_data.getvalue()
    if isinstance(image_data, Image.Image):
        buf = io.BytesIO()
        image_data.save(buf, format="JPEG")
        return buf.getvalue()
    if isinstance(image_data, str):
        image_str = image_data.strip()
        if not image_str:
            return None
        # Handle Data URL: data:image/png;base64,iVBORw0KGgo...
        if image_str.startswith("data:") and ";base64," in image_str:
            try:
                base64_part = image_str.split(";base64,", 1)[1].strip()
                return base64.b64decode(base64_part)
            except Exception:
                pass
        # Handle file paths if existing on disk
        if len(image_str) < 1000 and os.path.exists(image_str) and os.path.isfile(image_str):
            try:
                with open(image_str, "rb") as f:
                    return f.read()
            except Exception:
                pass
        # Handle raw base64 string
        try:
            decoded = base64.b64decode(image_str, validate=True)
            if decoded:
                return decoded
        except Exception:
            pass
        # Lenient base64 decode
        try:
            decoded = base64.b64decode(image_str)
            if decoded and len(decoded) > 10:
                return decoded
        except Exception:
            pass
    return None


def _data_url(image_bytes: bytes, mime_type: Optional[str] = None) -> str:
    """Format raw image bytes as a base64 Data URL, auto-detecting image format."""
    if not image_bytes:
        raise ValueError("Image evidence is empty.")
    if not mime_type or mime_type == "application/octet-stream":
        if image_bytes.startswith(b"\x89PNG"):
            mime_type = "image/png"
        elif image_bytes.startswith(b"GIF"):
            mime_type = "image/gif"
        elif image_bytes.startswith(b"RIFF") and b"WEBP" in image_bytes[:12]:
            mime_type = "image/webp"
        elif image_bytes.startswith(b"\xff\xd8\xff"):
            mime_type = "image/jpeg"
        else:
            mime_type = "image/jpeg"
    encoded = base64.b64encode(image_bytes).decode("ascii")
    return f"data:{mime_type};base64,{encoded}"


def _is_valid_image(image_bytes: bytes) -> bool:
    """Confirm that evidence bytes contain a readable image before sending them to vision."""
    try:
        with Image.open(io.BytesIO(image_bytes)) as img:
            img.verify()
        with Image.open(io.BytesIO(image_bytes)) as img:
            return img.width >= 10 and img.height >= 10
    except Exception:
        return False


def _is_blank_or_solid(image_bytes: bytes) -> bool:
    """Check if an image is completely blank or a single solid color."""
    try:
        with Image.open(io.BytesIO(image_bytes)) as img:
            img = img.convert("RGB")
            if img.width < 10 or img.height < 10:
                return True
            stat = ImageStat.Stat(img)
            # If variance across all RGB channels is negligible (< 1.5), image is flat/solid
            if max(stat.var) < 1.5:
                return True
    except Exception:
        pass
    return False


def _precheck_images(before_bytes: Optional[bytes], after_bytes: Optional[bytes]) -> Optional[Dict[str, Any]]:
    """Run local deterministic checks for image duplicates, solid blanks, and corruption."""
    if not after_bytes:
        return {
            "decision": "FAILED",
            "confidence": 99,
            "before_issue_detected": False,
            "after_issue_detected": False,
            "scene_match": False,
            "reason": "No resolution proof image was provided.",
            "model_name": "precheck/missing-after-image",
        }

    if not _is_valid_image(after_bytes):
        return {
            "decision": "FAILED",
            "confidence": 99,
            "before_issue_detected": False,
            "after_issue_detected": False,
            "scene_match": False,
            "reason": "Resolution proof image is not a readable image file.",
            "model_name": "precheck/invalid-after-image",
        }

    if _is_blank_or_solid(after_bytes):
        return {
            "decision": "FAILED",
            "confidence": 98,
            "before_issue_detected": False,
            "after_issue_detected": False,
            "scene_match": False,
            "reason": "Resolution proof image is completely blank, solid color, or corrupted.",
            "model_name": "precheck/blank-after-image",
        }

    if before_bytes:
        if not _is_valid_image(before_bytes):
            return {
                "decision": "FAILED",
                "confidence": 99,
                "before_issue_detected": False,
                "after_issue_detected": False,
                "scene_match": False,
                "reason": "Original complaint image is not a readable image file; resolution cannot be verified.",
                "model_name": "precheck/invalid-before-image",
            }

        if _is_blank_or_solid(before_bytes):
            return {
                "decision": "FAILED",
                "confidence": 95,
                "before_issue_detected": False,
                "after_issue_detected": False,
                "scene_match": False,
                "reason": "Original complaint image is completely blank or corrupted; resolution cannot be verified against it.",
                "model_name": "precheck/blank-before-image",
            }

        # Check for identical duplicate image re-upload fraud
        before_hash = hashlib.sha256(before_bytes).hexdigest()
        after_hash = hashlib.sha256(after_bytes).hexdigest()
        if before_hash == after_hash:
            return {
                "decision": "FAILED",
                "confidence": 99,
                "before_issue_detected": True,
                "after_issue_detected": True,
                "scene_match": True,
                "reason": "Resolution proof image is identical to the initial complaint image. No actual repair work or resolution is demonstrated.",
                "model_name": "precheck/duplicate-image-detector",
            }

    return None


# ============================================================
# JSON RESPONSE EXTRACTION & VALIDATION
# ============================================================

def _extract_json(content: str) -> Dict[str, Any]:
    """Robustly parse and validate structured JSON returned by vision LLM."""
    text = str(content or "").strip()
    # Strip <think> reasoning blocks from DeepSeek / reasoning models
    text = re.sub(r"<think>.*?</think>", "", text, flags=re.DOTALL | re.IGNORECASE).strip()

    # Search for markdown fenced json blocks
    fenced = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, flags=re.DOTALL | re.IGNORECASE)
    if fenced:
        candidate_text = fenced.group(1).strip()
    else:
        start = text.find("{")
        end = text.rfind("}")
        if start < 0 or end <= start:
            raise ValueError("Agent 3 did not find a JSON object in response.")
        candidate_text = text[start:end + 1].strip()

    try:
        result = json.loads(candidate_text)
    except json.JSONDecodeError:
        # Fallback: try raw decode starting at first {
        decoder = json.JSONDecoder()
        try:
            result, _ = decoder.raw_decode(candidate_text)
        except Exception as error:
            raise ValueError(f"Agent 3 returned invalid JSON: {error}") from error

    if not isinstance(result, dict):
        raise ValueError("Agent 3 returned a non-dictionary JSON object.")

    # Extract & validate fields
    decision = str(result.get("decision") or "").upper().strip()
    if decision not in {"VERIFIED", "FAILED"}:
        # Attempt to deduce decision if model used variant string
        if "VERIF" in decision:
            decision = "VERIFIED"
        else:
            decision = "FAILED"

    # Confidence validation
    raw_confidence = result.get("confidence")
    if isinstance(raw_confidence, (int, float)) and not isinstance(raw_confidence, bool):
        confidence = int(round(float(raw_confidence)))
        confidence = max(0, min(100, confidence))
    else:
        # Assign realistic confidence based on decision if missing
        confidence = 85

    # Booleans
    before_issue = result.get("before_issue_detected")
    if not isinstance(before_issue, bool):
        before_issue = str(before_issue).lower() in {"true", "1", "yes"}

    after_issue = result.get("after_issue_detected")
    if not isinstance(after_issue, bool):
        after_issue = str(after_issue).lower() in {"true", "1", "yes"}

    scene_match = result.get("scene_match")
    if scene_match is not None and not isinstance(scene_match, bool):
        scene_match = str(scene_match).lower() in {"true", "1", "yes"}

    reason = str(result.get("reason") or "").strip()
    if not reason:
        reason = "Visual comparison evaluation completed."

    # Strict consistency enforcement:
    # 1. If scenes don't match or are unrelated, cannot be VERIFIED
    if scene_match is False and decision == "VERIFIED":
        decision = "FAILED"
        reason = f"Location / scene mismatch between BEFORE and AFTER images. {reason}".strip()

    # 2. If before issue was never present / image was unrelated/unwanted, cannot be VERIFIED
    if not before_issue and decision == "VERIFIED":
        decision = "FAILED"
        reason = f"Original complaint image does not show the reported civic issue or is unrelated. {reason}".strip()

    # 3. If after image still shows the issue unresolved, cannot be VERIFIED
    if after_issue and decision == "VERIFIED":
        decision = "FAILED"
        reason = f"Civic defect is still visible and unresolved in resolution proof. {reason}".strip()

    return {
        "decision": decision,
        "confidence": confidence,
        "before_issue_detected": before_issue,
        "after_issue_detected": after_issue,
        "scene_match": scene_match if scene_match is not None else True,
        "reason": reason[:1000],
    }


# ============================================================
# MAIN AGENT 3 VERIFICATION LOGIC
# ============================================================

def verify_resolution(complaint: Dict[str, Any], governance: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Compare MySQL BEFORE and AFTER complaint evidence with Agent 3.

    Audits visual authenticity, scene location consistency, defect presence,
    and actual resolution quality.
    """
    governance = governance or {}

    before_bytes = _normalize_bytes(complaint.get("image"))
    after_bytes = _normalize_bytes(complaint.get("resolution_image"))
    mime_type = complaint.get("image_mime_type") or "image/jpeg"

    # Step 1: Run local deterministic pre-checks
    precheck = _precheck_images(before_bytes, after_bytes)
    if precheck:
        return precheck

    # If no before image exists (e.g. text-only complaint submission)
    if not before_bytes:
        return {
            "decision": "FAILED",
            "confidence": 60,
            "before_issue_detected": False,
            "after_issue_detected": False,
            "scene_match": False,
            "reason": (
                "Original complaint was submitted without an initial photo. "
                "Resolution proof image uploaded, but visual comparison is unavailable. "
                "Resolution cannot be verified without an original image."
            ),
            "model_name": "rule-based/no-before-image",
        }

    # Step 2: Build Vision Prompt
    before_data = _data_url(before_bytes, mime_type)
    # Detect the uploaded proof format independently; it may differ from the citizen image.
    after_data = _data_url(after_bytes)

    category = complaint.get("category") or "General Civic Infrastructure"
    title = complaint.get("title") or "Civic Complaint"
    description = complaint.get("description") or "Not provided"
    address = complaint.get("address") or complaint.get("location") or "Not provided"
    department = governance.get("department") or complaint.get("governance_department") or "Civic Operations"
    res_reason = complaint.get("resolution_reason") or "Not provided"
    res_details = complaint.get("resolution_details") or "Not provided"

    system_instruction = """
You are Agent 3, the Resolution Verification AI for CivicGuard (Municipal Infrastructure Verification System).
Your role is to strictly and objectively audit visual evidence before closing a civic complaint.

CRITICAL VERIFICATION RULES:
1. VISUAL EVIDENCE OVER TEXT: Do not blindly believe the text description. You MUST inspect what is actually visible in the images.
2. DETECT UNWANTED / IRRELEVANT IMAGES:
   - If Image 1 (BEFORE) or Image 2 (AFTER) contains unwanted, spam, indoor, personal, or non-civic content (e.g., selfies, living rooms, food, memes, cartoons, pets, random objects, unrelated vehicles, non-civic scenes):
     * Image 1 is INVALID: set "before_issue_detected": false, "scene_match": false, "decision": "FAILED".
     * Image 2 is INVALID: set "decision": "FAILED".
     * Explain clearly in "reason" that the image is unwanted/unrelated.
3. LOCATION & SCENE MATCHING:
   - Image 1 and Image 2 MUST depict the EXACT SAME physical location.
   - Compare physical anchor points: background buildings, road markings, curb shapes, pavement texture, poles, fences, vegetation, and terrain.
   - If Image 1 and Image 2 show different locations or unrelated scenes:
     * Set "scene_match": false and "decision": "FAILED".
4. DEFECT RESOLUTION:
   - Only if Image 1 shows the reported defect AND Image 2 is at the same location, check if the defect was genuinely fixed/repaired/cleaned (e.g. pothole filled with asphalt, garbage removed, pipe fixed).
   - If defect is still present: set "after_issue_detected": true and "decision": "FAILED".
   - If visibly resolved: set "after_issue_detected": false, "before_issue_detected": true, "scene_match": true, and "decision": "VERIFIED".
5. AMBIGUITY:
    - If lighting, heavy blur, extreme glare, or severe angle differences prevent definitive confirmation, set "decision": "FAILED".

OUTPUT JSON SCHEMA:
Respond ONLY with a valid JSON object adhering strictly to this schema:
{
  "before_image_scene": "<concise description of Image 1 scene and objects>",
  "after_image_scene": "<concise description of Image 2 scene and objects>",
  "scene_match": <boolean: true if both images show the same physical location, false otherwise>,
  "before_issue_detected": <boolean: true if reported civic defect is visible in Image 1, false otherwise>,
  "after_issue_detected": <boolean: true if defect is still present/unresolved in Image 2, false if resolved>,
    "decision": "<VERIFIED | FAILED>",
  "confidence": <integer between 0 and 100 based on visual clarity and certainty>,
  "reason": "<clear explanation of findings and rationale>"
}
Do not use markdown wrappers around JSON if possible. Do not include any other text.
""".strip()

    user_text = f"""
COMPLAINT AUDIT CONTEXT:
- Category: {category}
- Title: {title}
- Citizen Description: {description}
- Location: {address}
- Assigned Department: {department}
- Officer Resolution Reason: {res_reason}
- Officer Resolution Details: {res_details}

EVALUATE THE TWO ATTACHED IMAGES:
IMAGE 1: BEFORE evidence (Citizen original report)
IMAGE 2: AFTER evidence (Officer resolution proof)

Inspect both images for relevance, location consistency, and true resolution. Return the structured JSON.
""".strip()

    api_key = os.getenv("OPENROUTER_API_KEY")
    if not api_key:
        raise RuntimeError("OPENROUTER_API_KEY is not configured in .env.")

    client = OpenAI(base_url=OPENROUTER_BASE_URL, api_key=api_key)

    messages = [
        {
            "role": "system",
            "content": system_instruction,
        },
        {
            "role": "user",
            "content": [
                {"type": "text", "text": user_text},
                {"type": "text", "text": "\n[ATTACHED IMAGE 1 - BEFORE]:"},
                {"type": "image_url", "image_url": {"url": before_data}},
                {"type": "text", "text": "\n[ATTACHED IMAGE 2 - AFTER]:"},
                {"type": "image_url", "image_url": {"url": after_data}},
            ],
        },
    ]

    last_error: Optional[Exception] = None

    for model in MODEL_FALLBACKS:
        try:
            print(f"[Agent 3] Evaluating resolution verification with model: {model}")
            response = client.chat.completions.create(
                model=model,
                temperature=0.0,
                max_tokens=600,
                messages=messages,
            )

            if not (response and response.choices and response.choices[0].message):
                print(f"[Agent 3] Model {model} returned empty choices, trying next fallback...")
                last_error = ValueError(f"Model {model} returned no choices.")
                continue

            content = response.choices[0].message.content
            parsed = _extract_json(content)
            parsed["model_name"] = model
            print(f"[Agent 3] Success with model {model}: decision={parsed['decision']}, confidence={parsed['confidence']}%")
            return parsed

        except Exception as err:
            print(f"[Agent 3] Model {model} failed: {err}")
            last_error = err

    error_text = str(last_error or "Unknown provider error")
    error_lower = error_text.lower()
    status_code = getattr(last_error, "status_code", None)
    if status_code is None:
        for candidate in ("401", "403", "404", "429", "500", "502", "503", "504"):
            if candidate in error_text:
                status_code = int(candidate)
                break

    if status_code == 429 or "rate limit" in error_lower:
        return {
            "decision": "RETRY_PENDING",
            "confidence": 0,
            "before_issue_detected": False,
            "after_issue_detected": False,
            "scene_match": False,
            "reason": "OpenRouter rate-limited Agent 3 vision verification; it will be retried.",
            "model_name": "provider/429",
        }
    if status_code in {500, 502, 503, 504}:
        return {
            "decision": "RETRY_PENDING",
            "confidence": 0,
            "before_issue_detected": False,
            "after_issue_detected": False,
            "scene_match": False,
            "reason": f"OpenRouter returned HTTP {status_code}; Agent 3 vision verification will be retried.",
            "model_name": f"provider/{status_code}",
        }
    if status_code in {401, 403}:
        failure_reason = (
            f"OpenRouter returned HTTP {status_code} for Agent 3. "
            "Check OPENROUTER_API_KEY and paid model access."
        )
    elif status_code == 404 or "no endpoints found" in error_lower:
        failure_reason = (
            "OpenRouter returned HTTP 404: the configured Agent 3 vision model is unavailable. "
            "Set OPENROUTER_VISION_MODEL to an active paid vision model and restart the backend."
        )
    else:
        failure_reason = f"Automated vision verification failed: {error_text[:600]}"

    # Step 3: All configured paid models failed.
    print(f"[Agent 3] WARNING: All vision models failed ({last_error}). Falling back to FAILED.")
    return {
        "decision": "FAILED",
        "confidence": 50,
        "before_issue_detected": False,
        "after_issue_detected": False,
        "scene_match": False,
        "reason": failure_reason,
        "model_name": "fallback/failed",
    }
