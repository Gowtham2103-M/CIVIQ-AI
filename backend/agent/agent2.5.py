import os
import json
import base64
import mimetypes
from pathlib import Path

from dotenv import load_dotenv
from openai import OpenAI


# ============================================================
# CivIQ AI - Agent 2.5
# Civic Complaint Image Filter
# ============================================================

BASE_DIR = Path(__file__).resolve().parent

IMAGE_PATH = BASE_DIR / "uploads" / "complaint.jpg"


# ============================================================
# LOAD .ENV
# ============================================================

load_dotenv(BASE_DIR / ".env")

API_KEY = os.getenv("OPENROUTER_API_KEY")
MODEL = os.getenv(
    "OPENROUTER_MODEL",
    "google/gemini-2.5-flash"
)

if not API_KEY:
    raise ValueError(
        "OPENROUTER_API_KEY is missing in .env"
    )


# ============================================================
# OPENROUTER CLIENT
# ============================================================

client = OpenAI(
    base_url="https://openrouter.ai/api/v1",
    api_key=API_KEY
)


# ============================================================
# IMAGE TO BASE64
# ============================================================

def image_to_data_url(image_path):

    if not image_path.exists():
        raise FileNotFoundError(
            f"Image not found:\n{image_path}"
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
# OPTIONAL COMPLAINT TEXT
# ============================================================

complaint_text = input(
    "Enter complaint text (press Enter to skip): "
).strip()


# ============================================================
# IMAGE
# ============================================================

image_data = image_to_data_url(IMAGE_PATH)


# ============================================================
# AGENT 2.5 INSTRUCTIONS
# ============================================================

system_prompt = """
You are Agent 2.5 of CivIQ AI.

Your job is to filter unwanted, irrelevant, unsafe,
or unusable complaint images BEFORE they continue
to Agent 2.

INPUT:
- One image
- Optional complaint text

RETURN EXACTLY ONE:
ACCEPT
REJECT
MANUAL_REVIEW


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


IMPORTANT:
- Do not assume every outdoor image is civic.
- Do not invent problems that are not visible.
- Do not reject a legitimate civic image just because it
  is unusual.
- When uncertain, prefer MANUAL_REVIEW.
- Do not claim 100% confidence.


OPTIONAL TEXT:
If complaint text is provided, compare it with the image.

Example:
Text = "Street light is broken"
Image = broken street light
=> ACCEPT

Text = "Pipe leakage"
Image = chair
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
decision = ACCEPT, REJECT, or MANUAL_REVIEW
confidence = integer from 0 to 100
text_image_consistent = true, false, or null
category_hint = short uppercase category or null
"""


# ============================================================
# USER PROMPT
# ============================================================

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


# ============================================================
# SEND TO OPENROUTER
# ============================================================

print()
print("=" * 60)
print("CivIQ AI - AGENT 2.5")
print("Civic Complaint Image Filter")
print("=" * 60)

print("Image :", IMAGE_PATH.name)
print("Model :", MODEL)
print()
print("Sending image to OpenRouter...")


response = client.chat.completions.create(

    model=MODEL,

    messages=[
        {
            "role": "system",
            "content": system_prompt
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


# ============================================================
# READ RESULT
# ============================================================

result = response.choices[0].message.content.strip()

# Remove markdown code fences if model adds them
if result.startswith("```"):
    result = result.replace("```json", "", 1)
    result = result.replace("```", "", 1).strip()


# ============================================================
# PARSE RESULT
# ============================================================

try:
    data = json.loads(result)

except json.JSONDecodeError:
    print("\nModel returned invalid JSON:")
    print(result)
    raise SystemExit(1)


# ============================================================
# VALIDATE DECISION
# ============================================================

allowed = {
    "ACCEPT",
    "REJECT",
    "MANUAL_REVIEW"
}

decision = str(
    data.get("decision", "")
).upper().strip()

if decision not in allowed:
    print("\nInvalid decision:", decision)
    raise SystemExit(1)


# ============================================================
# CONFIDENCE
# ============================================================

try:
    confidence = int(
        data.get("confidence", 0)
    )
except (TypeError, ValueError):
    confidence = 0

confidence = max(
    0,
    min(100, confidence)
)


# ============================================================
# FINAL LOCAL SAFETY RULE
# ============================================================

# Don't automatically accept a low-confidence result.
if decision == "ACCEPT" and confidence < 90:
    decision = "MANUAL_REVIEW"

    data["reason"] = (
        "AI confidence is below the automatic "
        "acceptance threshold."
    )

# Don't automatically reject a low-confidence result.
if decision == "REJECT" and confidence < 90:
    decision = "MANUAL_REVIEW"

    data["reason"] = (
        "AI confidence is below the automatic "
        "rejection threshold."
    )

data["decision"] = decision
data["confidence"] = confidence


# ============================================================
# FINAL OUTPUT
# ============================================================

print()
print("=" * 60)
print("AGENT 2.5 RESULT")
print("=" * 60)

print(
    json.dumps(
        data,
        indent=4,
        ensure_ascii=False
    )
)

print("=" * 60)

print()
print("FINAL DECISION:", decision)