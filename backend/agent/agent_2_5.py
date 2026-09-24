"""
Agent 2.5 - CivIQ AI Civic Complaint Image Filter

Validates complaint images before they proceed to Agent 3.
Filters out irrelevant, unsafe, or unusable images.

Returns standardized JSON decision structure.
"""

import os
import json
import base64
import mimetypes
from pathlib import Path

from openai import OpenAI
from dotenv import load_dotenv


# ============================================================
# ENVIRONMENT SETUP
# ============================================================

# Load .env from backend directory
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

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")

if not OPENROUTER_API_KEY:
    raise RuntimeError(
        "OPENROUTER_API_KEY not found in .env"
    )


# ============================================================
# OPENROUTER CLIENT & MODEL
# ============================================================

MODEL = os.getenv(
    "OPENROUTER_AGENT_2_5_MODEL",
    "google/gemini-2.5-flash"
)

client = OpenAI(
    base_url="https://openrouter.ai/api/v1",
    api_key=OPENROUTER_API_KEY
)


# ============================================================
# IMAGE TO BASE64
# ============================================================

def image_to_data_url(image_path):
    """
    Convert image file to data URL with base64 encoding.
    
    Args:
        image_path: Path to image file
    
    Returns:
        data URL string
    
    Raises:
        FileNotFoundError: If image file does not exist
    """
    
    image_path = Path(image_path)
    
    if not image_path.exists():
        raise FileNotFoundError(
            f"Image not found: {image_path}"
        )

    mime_type, _ = mimetypes.guess_type(
        str(image_path)
    )

    if mime_type is None:
        mime_type = "image/jpeg"

    with open(image_path, "rb") as file:
        encoded = base64.b64encode(
            file.read()
        ).decode("utf-8")

    return f"data:{mime_type};base64,{encoded}"


# ============================================================
# AGENT 2.5 SYSTEM PROMPT
# ============================================================

SYSTEM_PROMPT = """
You are Agent 2.5 of CivIQ AI.

Your job is to filter unwanted, irrelevant, unsafe,
or unusable complaint images BEFORE they continue
to Agent 3.

INPUT:
- One image
- Optional complaint text

RETURN EXACTLY ONE DECISION:
- ACCEPT
- REJECT
- MANUAL_REVIEW


ACCEPT:
The image clearly provides evidence of a legitimate
public/civic issue.

Examples:
- pothole
- damaged road
- broken street light
- drinking water problem
- pipe leakage
- garbage/waste
- drainage
- waterlogging
- damaged bus stop
- broken footpath
- public infrastructure damage
- public electrical/utility issue
- other civic problems


REJECT:
Clearly irrelevant or unwanted images.

Examples:
- chair
- table
- furniture
- selfie
- random person photo
- pet photo
- food
- product
- random household object
- random scenery
- meme
- unrelated screenshot
- spam
- clearly inappropriate image unrelated to a civic complaint


MANUAL_REVIEW:
Use this when:
- image is blurry
- image is too dark
- image is unclear
- civic relevance is uncertain
- text conflicts with image but may still be legitimate
- evidence is not strong enough for ACCEPT or REJECT


CONFIDENCE RULES:
- If confidence < 90: Always use MANUAL_REVIEW (safety first)
- Never claim 100% confidence
- Confidence must be 0-100


IMPORTANT RULES:
- Do not assume every outdoor image is civic
- Do not invent problems that are not visible
- Do not reject legitimate civic images just because unusual
- When uncertain, prefer MANUAL_REVIEW
- Never punish user for AI errors


TEXT-IMAGE CONSISTENCY:
If complaint text is provided, compare it with image.
The IMAGE is the primary evidence. The complaint text is secondary context.
Never invent visible evidence from the text, and never accept an image only
because the description claims that a civic issue is present.
Example:
  Text: "Street light is broken"
  Image: broken street light
  => ACCEPT

Example:
  Text: "Pipe leakage"
  Image: chair
  => REJECT or MANUAL_REVIEW


RETURN ONLY VALID JSON:

{
  "decision": "ACCEPT",
  "confidence": 95,
  "civic_relevance": true,
  "safety_flag": false,
  "text_image_consistent": true,
  "category_hint": "ROAD_DAMAGE",
  "reason": "Short explanation"
}

Rules:
- decision = ACCEPT, REJECT, or MANUAL_REVIEW
- confidence = integer from 0 to 100
- civic_relevance = true/false
- safety_flag = true/false
- text_image_consistent = true, false, or null
- category_hint = uppercase category or null
- reason = brief human-readable explanation
"""


# ============================================================
# RUN AGENT 2.5
# ============================================================

def run_agent_2_5(
    image_path: str,
    complaint_text: str = ""
) -> dict:
    """
    Run Agent 2.5 image validation on a complaint.
    
    Args:
        image_path: Path to complaint image file
        complaint_text: Optional complaint description text
    
    Returns:
        Dictionary with structure:
        {
            "decision": "ACCEPT" | "REJECT" | "MANUAL_REVIEW",
            "confidence": int (0-100),
            "civic_relevance": bool,
            "safety_flag": bool,
            "text_image_consistent": bool | null,
            "category_hint": str | null,
            "reason": str
        }
    
    Raises:
        FileNotFoundError: If image file not found
        ValueError: If OpenRouter API fails or returns invalid JSON
    """
    
    # ========================================================
    # VALIDATE INPUT
    # ========================================================
    
    image_path = str(image_path).strip()
    complaint_text = str(complaint_text).strip() if complaint_text else ""
    
    if not image_path:
        raise ValueError("image_path is required")
    
    # ========================================================
    # CONVERT IMAGE TO DATA URL
    # ========================================================
    
    try:
        image_data = image_to_data_url(image_path)
    except FileNotFoundError as e:
        raise FileNotFoundError(
            f"Complaint image not found: {image_path}"
        ) from e
    
    # ========================================================
    # BUILD USER PROMPT
    # ========================================================
    
    if complaint_text:
        user_prompt = f"""
Analyze this complaint image.

USER COMPLAINT:
{complaint_text}

Check whether the image is relevant to the complaint
and whether it provides evidence of a civic issue.

Return only JSON.
"""
    else:
        user_prompt = """
Analyze this complaint image.

No complaint text was provided.

Use visual evidence only.

Return only JSON.
"""
    
    # ========================================================
    # SEND TO OPENROUTER
    # ========================================================
    
    try:
        response = client.chat.completions.create(
            model=MODEL,
            messages=[
                {
                    "role": "system",
                    "content": SYSTEM_PROMPT
                },
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": user_prompt
                        },
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": image_data
                            }
                        }
                    ]
                }
            ],
            temperature=0,
            max_tokens=300
        )
        
        result = response.choices[0].message.content.strip()
        
    except Exception as api_error:
        # API failure => MANUAL_REVIEW (never punish user)
        print(f"[Agent 2.5] API Error: {repr(api_error)}")
        return {
            "decision": "MANUAL_REVIEW",
            "confidence": 0,
            "civic_relevance": None,
            "safety_flag": False,
            "text_image_consistent": None,
            "category_hint": None,
            "reason": "AI analysis failed. Image flagged for manual review."
        }
    
    # ========================================================
    # PARSE JSON RESPONSE
    # ========================================================
    
    # Remove markdown code fences if present
    if result.startswith("```"):
        result = result.replace("```json", "", 1)
        result = result.replace("```", "", 1).strip()
    
    try:
        data = json.loads(result)
    except json.JSONDecodeError:
        # Invalid JSON => MANUAL_REVIEW (never punish user)
        print(f"[Agent 2.5] Invalid JSON from model: {result}")
        return {
            "decision": "MANUAL_REVIEW",
            "confidence": 0,
            "civic_relevance": None,
            "safety_flag": False,
            "text_image_consistent": None,
            "category_hint": None,
            "reason": "AI returned invalid response. Image flagged for manual review."
        }
    
    # ========================================================
    # VALIDATE AND NORMALIZE DECISION
    # ========================================================
    
    ALLOWED_DECISIONS = {
        "ACCEPT",
        "REJECT",
        "MANUAL_REVIEW"
    }
    
    decision = str(
        data.get("decision", "")
    ).upper().strip()
    
    if decision not in ALLOWED_DECISIONS:
        # Invalid decision => MANUAL_REVIEW
        print(f"[Agent 2.5] Invalid decision: {decision}")
        return {
            "decision": "MANUAL_REVIEW",
            "confidence": 0,
            "civic_relevance": data.get("civic_relevance"),
            "safety_flag": data.get("safety_flag", False),
            "text_image_consistent": data.get("text_image_consistent"),
            "category_hint": data.get("category_hint"),
            "reason": "Invalid AI decision. Flagged for manual review."
        }
    
    # ========================================================
    # VALIDATE CONFIDENCE
    # ========================================================
    
    try:
        confidence = int(data.get("confidence", 0))
    except (TypeError, ValueError):
        confidence = 0
    
    # Clamp confidence to 0-100
    confidence = max(0, min(100, confidence))
    
    # ========================================================
    # APPLY CONFIDENCE SAFETY RULE
    # ========================================================
    
    # If confidence < 90, force MANUAL_REVIEW
    # This prevents high-error automatic rejections/acceptances
    
    if confidence < 90 and decision in ("ACCEPT", "REJECT"):
        decision = "MANUAL_REVIEW"
        data["reason"] = (
            "AI confidence is below the automatic threshold. "
            "Flagged for manual review."
        )
    
    # ========================================================
    # FINALIZE RESPONSE
    # ========================================================
    
    return {
        "decision": decision,
        "confidence": confidence,
        "civic_relevance": data.get("civic_relevance", True),
        "safety_flag": data.get("safety_flag", False),
        "text_image_consistent": data.get("text_image_consistent"),
        "category_hint": data.get("category_hint"),
        "reason": data.get("reason", "Image analysis completed.")
    }
