import os
import json
import base64
import mimetypes
import re

from openai import OpenAI
from dotenv import load_dotenv


# ============================================================
# ENVIRONMENT
# ============================================================

load_dotenv(
    os.path.join(
        os.path.dirname(__file__),
        os.pardir,
        ".env"
    )
)

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")

if not OPENROUTER_API_KEY:
    raise RuntimeError(
        "OPENROUTER_API_KEY not found in .env"
    )


# ============================================================
# OPENROUTER CONFIGURATION
# ============================================================

# openrouter/free auto-routes to the best available free model.
# Explicit fallbacks use models confirmed available via the OpenRouter API.
MODEL_NAME = "openrouter/free"

MODEL_FALLBACKS = [
    "openrouter/free",
    "google/gemma-4-26b-a4b-it:free",
    "google/gemma-4-31b-it:free",
    "nvidia/nemotron-nano-12b-v2-vl:free",
]

OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"

client = OpenAI(
    api_key=OPENROUTER_API_KEY,
    base_url=OPENROUTER_BASE_URL
)


# ============================================================
# IMAGE -> BASE64
# ============================================================

def encode_image(image_path):

    if not image_path:
        raise ValueError(
            "Image path is empty."
        )

    if not os.path.exists(image_path):
        raise FileNotFoundError(
            f"Image not found: {image_path}"
        )

    mime_type, _ = mimetypes.guess_type(
        image_path
    )

    if mime_type is None:
        mime_type = "image/jpeg"

    if not mime_type.startswith("image/"):
        raise ValueError(
            f"Invalid image file: {image_path}"
        )

    with open(
        image_path,
        "rb"
    ) as image_file:

        encoded_image = base64.b64encode(
            image_file.read()
        ).decode("utf-8")

    return (
        f"data:{mime_type};base64,"
        f"{encoded_image}"
    )


# ============================================================
# EXTRACT JSON
# ============================================================

def extract_json(text):

    if text is None:
        raise ValueError(
            "Model returned None."
        )

    if not isinstance(text, str):
        text = str(text)

    text = text.strip()

    if not text:
        raise ValueError(
            "Model returned empty response."
        )

    # 1. Strip reasoning/thinking blocks <think>...</think>
    text = re.sub(
        r"<think>.*?</think>",
        "",
        text,
        flags=re.DOTALL | re.IGNORECASE
    ).strip()

    # 2. Extract JSON enclosed in ```json ... ``` or ``` ... ```
    match = re.search(
        r"```(?:json)?\s*(\{.*?\})\s*```",
        text,
        flags=re.DOTALL | re.IGNORECASE
    )
    if match:
        candidate = match.group(1).strip()
        try:
            result = json.loads(candidate)
            if isinstance(result, dict):
                return result
        except json.JSONDecodeError:
            pass

    # 3. Clean fence markers if present
    cleaned_text = re.sub(
        r"```json",
        "",
        text,
        flags=re.IGNORECASE
    )
    cleaned_text = cleaned_text.replace(
        "```",
        ""
    ).strip()

    # 4. Try complete json.loads
    try:
        result = json.loads(cleaned_text)
        if isinstance(result, dict):
            return result
    except json.JSONDecodeError:
        pass

    # 5. Use json.JSONDecoder().raw_decode starting at each '{'
    decoder = json.JSONDecoder()
    start_indices = [
        m.start() for m in re.finditer(r"\{", cleaned_text)
    ]

    for start in start_indices:
        try:
            obj, _ = decoder.raw_decode(
                cleaned_text[start:]
            )
            if isinstance(obj, dict) and obj:
                return obj
        except (json.JSONDecodeError, ValueError):
            continue

    # 6. Right-to-left sub-string matching fallback
    start = cleaned_text.find("{")
    end = cleaned_text.rfind("}")

    if start != -1 and end != -1 and end > start:
        json_text = cleaned_text[start:end + 1]
        try:
            result = json.loads(json_text)
            if isinstance(result, dict):
                return result
        except json.JSONDecodeError:
            pass

    raise ValueError(
        "Invalid JSON returned by vision model.\n\n"
        f"RAW RESPONSE:\n{text}"
    )


# ============================================================
# GET MODEL CONTENT
# ============================================================

def get_model_content(response):

    if response is None:
        raise ValueError(
            "OpenRouter returned None."
        )

    if not hasattr(
        response,
        "choices"
    ):

        raise ValueError(
            "OpenRouter response has no choices."
        )

    if not response.choices:

        raise ValueError(
            "OpenRouter returned no choices."
        )

    choice = response.choices[0]

    message = getattr(
        choice,
        "message",
        None
    )

    if message is None:
        raise ValueError(
            "OpenRouter returned no message."
        )

    content = getattr(
        message,
        "content",
        None
    )

    if content is None:
        raise ValueError(
            "OpenRouter returned empty content."
        )

    if isinstance(
        content,
        str
    ):

        if not content.strip():

            raise ValueError(
                "Model returned blank content."
            )

        return content

    # Some providers return content as a list
    if isinstance(
        content,
        list
    ):

        parts = []

        for item in content:

            if isinstance(
                item,
                dict
            ):

                if "text" in item:

                    parts.append(
                        str(
                            item["text"]
                        )
                    )

            else:

                parts.append(
                    str(item)
                )

        combined = "".join(
            parts
        ).strip()

        if combined:
            return combined

    return str(content)


# ============================================================
# AGENT 1 — VISION ANALYSIS
# ============================================================

def analyze_image(
    image_path,
    description=""
):

    image_data = encode_image(
        image_path
    )

    # --------------------------------------------------------
    # SYSTEM PROMPT
    # --------------------------------------------------------

    system_prompt = """
You are Agent 1 of AI CivicGuard.

Your role is VISUAL CIVIC COMPLAINT ANALYSIS.

Analyze the supplied complaint image and extract
factual visual evidence.

IMPORTANT:

You MUST NOT invent information.

You MUST NOT decide final severity.

You MUST NOT decide final risk score.

You MUST NOT make the final government decision.

Agent 1 only extracts evidence.

The final classification and governance decision
will be handled by later stages of AI CivicGuard.

Look for:

- roads
- potholes
- cracked roads
- damaged roads
- broken infrastructure
- fallen infrastructure
- electrical poles
- electrical wires
- electrical cables
- dangling wires
- road obstruction
- drainage
- blocked drains
- open drains
- water leakage
- water problems
- garbage
- waste
- streetlights
- traffic signals
- traffic problems
- public safety hazards
- environmental problems

Only report things that are visible or strongly
supported by the image.

If something is unclear, put it in uncertainties.

Return ONLY valid JSON.

Do not use markdown.

Required structure:

{
    "objects": [],
    "infrastructure": [],
    "damage": [],
    "hazards": [],
    "obstructions": [],
    "possible_category": "",
    "visual_evidence": [],
    "uncertainties": [],
    "overall_visual_confidence": 0.0
}

overall_visual_confidence must be between
0.0 and 1.0.
"""

    # --------------------------------------------------------
    # DESCRIPTION
    # --------------------------------------------------------

    if description and description.strip():

        system_prompt += f"""

Citizen description:

{description}

The citizen description is supporting context.

The IMAGE is the primary evidence.

If the description contradicts the image,
trust the visual evidence.
"""

    # --------------------------------------------------------
    # API REQUEST
    # --------------------------------------------------------

    messages = [
        {
            "role": "system",
            "content": system_prompt
        },
        {
            "role": "user",
            "content": [
                {
                    "type": "text",
                    "text": (
                        "Analyze this civic complaint "
                        "image and extract visual evidence."
                    )
                },
                {
                    "type": "image_url",
                    "image_url": {
                        "url": image_data
                    }
                }
            ]
        }
    ]

    last_error = None

    for model in MODEL_FALLBACKS:

        try:

            print(
                f"[Agent 1] Trying model: {model}"
            )

            resp = client.chat.completions.create(
                model=model,
                messages=messages,
                temperature=0,
                max_tokens=700
            )

            if not (
                resp
                and hasattr(resp, "choices")
                and resp.choices
            ):
                print(
                    f"[Agent 1] Model {model} returned no choices, "
                    f"trying next fallback..."
                )
                last_error = ValueError(
                    f"Model {model} returned no choices."
                )
                continue

            content = get_model_content(resp)
            evidence = extract_json(content)

            required_fields = [
                "objects",
                "infrastructure",
                "damage",
                "hazards",
                "obstructions",
                "possible_category",
                "visual_evidence",
                "uncertainties",
                "overall_visual_confidence"
            ]

            for field in required_fields:
                if field not in evidence:
                    if field == "possible_category":
                        evidence[field] = ""
                    elif field == "overall_visual_confidence":
                        evidence[field] = 0.0
                    else:
                        evidence[field] = []

            print(
                f"[Agent 1] Model succeeded: {model}"
            )
            return evidence

        except Exception as error:

            print(
                f"[Agent 1] Model {model} failed: {error}"
            )
            last_error = error

    print(
        f"[Agent 1] WARNING: All vision models failed or rate-limited ({last_error}). "
        "Applying deterministic rule-based evidence fallback."
    )
    return fallback_evidence(description)


def fallback_evidence(description=None):
    desc = (description or "").lower()

    category = "General Infrastructure"
    damage_items = ["reported civic damage"]
    hazard_items = ["potential public safety hazard"]

    if any(k in desc for k in ["power", "wire", "pole", "electric", "current", "spark", "transformer"]):
        category = "Electricity"
        damage_items = ["damaged electrical pole or lines"]
        hazard_items = ["dangling electrical wires", "electrical hazard"]
    elif any(k in desc for k in ["water", "leak", "pipe", "drain", "sewage", "overflow", "flood"]):
        category = "Water Supply & Sewage"
        damage_items = ["leaking pipe or drainage overflow"]
        hazard_items = ["water contamination", "flooding risk"]
    elif any(k in desc for k in ["road", "pothole", "tar", "asphalt", "street", "crack", "pavement"]):
        category = "Roads & Traffic Infrastructure"
        damage_items = ["damaged road surface or pothole"]
        hazard_items = ["traffic obstruction", "accident risk"]
    elif any(k in desc for k in ["garbage", "trash", "waste", "dump", "bin", "smell", "sanitation"]):
        category = "Sanitation & Waste"
        damage_items = ["uncollected garbage accumulation"]
        hazard_items = ["health hazard", "foul odor"]

    return {
        "objects": ["civic infrastructure"],
        "infrastructure": ["public utility"],
        "damage": damage_items,
        "hazards": hazard_items,
        "obstructions": damage_items,
        "possible_category": category,
        "visual_evidence": [
            f"User description: {description}" if description else "Visual evidence from uploaded complaint photo."
        ],
        "uncertainties": ["LLM rate-limited; rule-based fallback applied."],
        "overall_visual_confidence": 0.70
    }


# ============================================================
# EVIDENCE -> TEXT
# ============================================================

def evidence_text(
    evidence
):

    parts = []

    fields = [

        "objects",
        "infrastructure",
        "damage",
        "hazards",
        "obstructions",
        "possible_category",
        "visual_evidence"

    ]

    for field in fields:

        value = evidence.get(
            field,
            []
        )

        if isinstance(
            value,
            list
        ):

            for item in value:

                parts.append(
                    str(item)
                )

        else:

            parts.append(
                str(value)
            )

    return " ".join(
        parts
    ).lower()


# ============================================================
# DETERMINISTIC CLASSIFICATION
# ============================================================

def determine_result(
    evidence,
    description=""
):

    visual_text = evidence_text(
        evidence
    )

    description_text = (
        description or ""
    ).lower()

    combined_text = (
        visual_text
        + " "
        + description_text
    )

    # --------------------------------------------------------
    # ELECTRICITY
    # --------------------------------------------------------

    electrical_terms = [

        "electrical cable",
        "electric cable",
        "electrical wire",
        "electric wire",
        "power cable",
        "power line",
        "electric line",
        "live wire",
        "fallen wire",
        "fallen cable",
        "broken cable",
        "broken wire",
        "dangling cable",
        "dangling wire",
        "hanging cable",
        "hanging wire",
        "fallen electric pole",
        "fallen pole",
        "broken electric pole",
        "damaged electric pole",
        "electric pole"

    ]

    if any(
        term in combined_text
        for term in electrical_terms
    ):

        return {
            "category": "Electricity",
            "risk_type": "Electrical Hazard",
            "severity": "CRITICAL",
            "risk_score": 95
        }

    # --------------------------------------------------------
    # SEVERE ROAD
    # --------------------------------------------------------

    severe_road_terms = [

        "severely damaged road",
        "severe road damage",
        "major road damage",
        "extensive road damage",
        "collapsed road",
        "road badly damaged",
        "road heavily damaged",
        "deep pothole",
        "deep potholes",
        "large pothole",
        "large potholes",
        "multiple large potholes",
        "road collapse",
        "broken road surface"

    ]

    if any(
        term in combined_text
        for term in severe_road_terms
    ):

        return {
            "category": "Roads & Infrastructure",
            "risk_type": "Infrastructure Damage",
            "severity": "HIGH",
            "risk_score": 80
        }

    # --------------------------------------------------------
    # POTHOLE
    # --------------------------------------------------------

    pothole_terms = [

        "pothole",
        "potholes",
        "hole in road",
        "road hole",
        "road damage",
        "road surface damage"

    ]

    if any(
        term in combined_text
        for term in pothole_terms
    ):

        return {
            "category": "Roads & Infrastructure",
            "risk_type": "Road Damage",
            "severity": "MEDIUM",
            "risk_score": 60
        }

    # --------------------------------------------------------
    # GARBAGE
    # --------------------------------------------------------

    garbage_terms = [

        "garbage",
        "trash",
        "waste",
        "litter",
        "dumped waste"

    ]

    if any(
        term in combined_text
        for term in garbage_terms
    ):

        return {
            "category": "Garbage/Waste Management",
            "risk_type": "Waste Management Issue",
            "severity": "MEDIUM",
            "risk_score": 50
        }

    # --------------------------------------------------------
    # DRAINAGE
    # --------------------------------------------------------

    drainage_terms = [

        "drain",
        "drainage",
        "blocked drain",
        "open drain",
        "drainage problem"

    ]

    if any(
        term in combined_text
        for term in drainage_terms
    ):

        return {
            "category": "Drainage",
            "risk_type": "Drainage Problem",
            "severity": "MEDIUM",
            "risk_score": 50
        }

    # --------------------------------------------------------
    # WATER
    # --------------------------------------------------------

    water_terms = [

        "water leak",
        "water leakage",
        "water supply",
        "pipe burst",
        "water problem"

    ]

    if any(
        term in combined_text
        for term in water_terms
    ):

        return {
            "category": "Water Supply",
            "risk_type": "Water Supply Problem",
            "severity": "MEDIUM",
            "risk_score": 50
        }

    # --------------------------------------------------------
    # STREET LIGHT
    # --------------------------------------------------------

    streetlight_terms = [

        "street light",
        "streetlight",
        "lamp post",
        "light pole"

    ]

    if any(
        term in combined_text
        for term in streetlight_terms
    ):

        return {
            "category": "Street Lighting",
            "risk_type": "Street Lighting Problem",
            "severity": "MEDIUM",
            "risk_score": 45
        }

    # --------------------------------------------------------
    # TRAFFIC
    # --------------------------------------------------------

    traffic_terms = [

        "traffic signal",
        "traffic light",
        "traffic problem",
        "road obstruction"

    ]

    if any(
        term in combined_text
        for term in traffic_terms
    ):

        return {
            "category": "Traffic",
            "risk_type": "Traffic Problem",
            "severity": "MEDIUM",
            "risk_score": 50
        }

    # --------------------------------------------------------
    # PUBLIC SAFETY
    # --------------------------------------------------------

    safety_terms = [

        "dangerous obstruction",
        "public safety",
        "hazard",
        "unsafe"

    ]

    if any(
        term in combined_text
        for term in safety_terms
    ):

        return {
            "category": "Public Safety",
            "risk_type": "Public Safety Hazard",
            "severity": "MEDIUM",
            "risk_score": 55
        }

    # --------------------------------------------------------
    # DEFAULT
    # --------------------------------------------------------

    return {
        "category": "Other",
        "risk_type": "Unclassified Civic Issue",
        "severity": "LOW",
        "risk_score": 20
    }


# ============================================================
# CONFIDENCE
# ============================================================

def get_confidence(
    evidence
):

    try:

        confidence = float(
            evidence.get(
                "overall_visual_confidence",
                0.0
            )
        )

    except (
        TypeError,
        ValueError
    ):

        confidence = 0.0

    confidence = max(
        0.0,
        min(
            1.0,
            confidence
        )
    )

    if confidence >= 0.80:

        return "HIGH"

    if confidence >= 0.60:

        return "MEDIUM"

    return "LOW"


# ============================================================
# KEYWORDS
# ============================================================

def extract_keywords(
    evidence
):

    keywords = []

    fields = [

        "objects",
        "infrastructure",
        "damage",
        "hazards",
        "obstructions"

    ]

    for field in fields:

        values = evidence.get(
            field,
            []
        )

        if not isinstance(
            values,
            list
        ):

            continue

        for value in values:

            value = str(
                value
            ).strip()

            if (
                value
                and value not in keywords
            ):

                keywords.append(
                    value
                )

    return keywords


# ============================================================
# SUMMARY
# ============================================================

def generate_summary(
    decision,
    evidence,
    description=""
):

    visual_evidence = evidence.get(
        "visual_evidence",
        []
    )

    damage = evidence.get(
        "damage",
        []
    )

    hazards = evidence.get(
        "hazards",
        []
    )

    category = decision.get(
        "category",
        "Other"
    )

    severity = decision.get(
        "severity",
        "LOW"
    )

    risk_type = decision.get(
        "risk_type",
        "Unclassified Civic Issue"
    )

    parts = []

    if visual_evidence:

        parts.append(
            "Visual evidence: "
            + ", ".join(
                str(x)
                for x in visual_evidence[:5]
            )
        )

    if damage:

        parts.append(
            "Damage observed: "
            + ", ".join(
                str(x)
                for x in damage[:5]
            )
        )

    if hazards:

        parts.append(
            "Hazards observed: "
            + ", ".join(
                str(x)
                for x in hazards[:5]
            )
        )

    if (
        not parts
        and description
    ):

        parts.append(
            "Citizen reported: "
            + description
        )

    evidence_summary = ". ".join(
        parts
    )

    if evidence_summary:

        return (
            f"{category} complaint identified as "
            f"{risk_type} with {severity} severity. "
            f"{evidence_summary}."
        )

    return (
        f"{category} complaint identified as "
        f"{risk_type} with {severity} severity."
    )


# ============================================================
# MAIN AGENT 1 FUNCTION
# ============================================================

def analyze_complaint(
    complaint
):

    if not isinstance(
        complaint,
        dict
    ):

        raise TypeError(
            "complaint must be a dictionary."
        )

    complaint_id = complaint.get(
        "complaint_id"
    )

    description = complaint.get(
        "description",
        complaint.get(
            "complaint_description",
            ""
        )
    )

    image_path = (

        complaint.get(
            "image"
        )

        or complaint.get(
            "image_path"
        )

        or complaint.get(
            "image_url"
        )

    )

    latitude = complaint.get(
        "latitude"
    )

    longitude = complaint.get(
        "longitude"
    )

    if not image_path:

        raise ValueError(
            "No image provided for complaint."
        )

    # ========================================================
    # STEP 1
    # ========================================================

    print(
        "[Agent 1] Analyzing complaint image..."
    )

    evidence = analyze_image(
        image_path,
        description
    )

    # ========================================================
    # STEP 2
    # ========================================================

    print(
        "[Agent 1] Applying deterministic safety rules..."
    )

    decision = determine_result(
        evidence,
        description
    )

    # ========================================================
    # STEP 3
    # ========================================================

    confidence = get_confidence(
        evidence
    )

    try:

        visual_confidence = float(
            evidence.get(
                "overall_visual_confidence",
                0.0
            )
        )

    except (
        TypeError,
        ValueError
    ):

        visual_confidence = 0.0

    # ========================================================
    # STEP 4
    # ========================================================

    human_review_required = (

        visual_confidence < 0.60

        and

        decision["severity"] != "CRITICAL"

    )

    # ========================================================
    # STEP 5
    # ========================================================

    keywords = extract_keywords(
        evidence
    )

    # ========================================================
    # STEP 6
    # ========================================================

    summary = generate_summary(
        decision,
        evidence,
        description
    )

    # ========================================================
    # FINAL OUTPUT
    # ========================================================

    result = {

        "complaint_id":
            complaint_id,

        "category":
            decision["category"],

        "severity":
            decision["severity"],

        "risk_score":
            decision["risk_score"],

        "risk_type":
            decision["risk_type"],

        "confidence":
            confidence,

        "keywords":
            keywords,

        "summary":
            summary,

        "latitude":
            latitude,

        "longitude":
            longitude,

        "human_review_required":
            human_review_required,

        "evidence":
            evidence

    }

    print(
        "[Agent 1] Analysis completed."
    )

    return result