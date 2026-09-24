import os
import json
import re

from dotenv import load_dotenv
from openai import OpenAI


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
    raise ValueError(
        "OPENROUTER_API_KEY not found in .env"
    )


# ============================================================
# OPENROUTER CONFIGURATION
# ============================================================

OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"

# openrouter/free auto-routes to the best available free model.
# Explicit fallbacks use models confirmed available via the OpenRouter API.
MODEL_NAME = "openrouter/free"

MODEL_FALLBACKS = [
    "openrouter/free",
    "nvidia/nemotron-3-super-120b-a12b:free",
    "nvidia/nemotron-nano-9b-v2:free",
    "openai/gpt-oss-20b:free",
]

client = OpenAI(
    api_key=OPENROUTER_API_KEY,
    base_url=OPENROUTER_BASE_URL
)


# ============================================================
# EXTRACT JSON
# ============================================================

def extract_json(text):

    if text is None:
        raise ValueError(
            "Agent 2 returned empty response."
        )

    if not isinstance(text, str):
        text = str(text)

    text = text.strip()

    if not text:
        raise ValueError(
            "Agent 2 returned blank response."
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

    # 6. Fallback slice extraction
    start = cleaned_text.find("{")
    end = cleaned_text.rfind("}")

    if start != -1 and end != -1 and end > start:
        json_candidate = cleaned_text[start:end + 1]
        try:
            result = json.loads(json_candidate)
            if isinstance(result, dict):
                return result
        except json.JSONDecodeError:
            pass

    raise ValueError(
        "Agent 2 did not return valid JSON."
    )


# ============================================================
# GET MODEL CONTENT
# ============================================================

def get_model_content(response):

    if response is None:
        raise ValueError(
            "OpenRouter returned None."
        )

    if not hasattr(response, "choices"):
        raise ValueError(
            "OpenRouter response has no choices."
        )

    if not response.choices:
        raise ValueError(
            "OpenRouter returned zero choices."
        )

    choice = response.choices[0]

    message = getattr(
        choice,
        "message",
        None
    )

    if message is None:
        raise ValueError(
            "OpenRouter response has no message."
        )

    content = getattr(
        message,
        "content",
        None
    )

    if content is None:
        raise ValueError(
            "OpenRouter response has empty content."
        )

    if isinstance(content, str):

        if not content.strip():
            raise ValueError(
                "OpenRouter returned blank content."
            )

        return content

    # Structured content
    if isinstance(content, list):

        text_parts = []

        for item in content:

            if isinstance(item, dict):

                if "text" in item:
                    text_parts.append(
                        str(item["text"])
                    )

            else:

                text_parts.append(
                    str(item)
                )

        combined = "".join(
            text_parts
        ).strip()

        if combined:
            return combined

    return str(content)


# ============================================================
# VALIDATE AGENT 1 OUTPUT
# ============================================================

def validate_agent1_output(agent1_output):

    if not isinstance(agent1_output, dict):

        raise TypeError(
            "Agent 1 output must be a Python dictionary."
        )

    required_fields = [

        "complaint_id",
        "category",
        "severity",
        "risk_score",
        "risk_type",
        "confidence",
        "keywords",
        "summary",
        "latitude",
        "longitude",
        "human_review_required",
        "evidence"

    ]

    missing_fields = [

        field
        for field in required_fields
        if field not in agent1_output

    ]

    if missing_fields:

        raise ValueError(
            "Agent 1 output is missing fields: "
            + ", ".join(missing_fields)
        )

    return True


# ============================================================
# VALIDATE AGENT 2 OUTPUT
# ============================================================

def validate_agent2_output(
    agent2_output,
    agent1_output
):

    if not isinstance(agent2_output, dict):

        raise ValueError(
            "Agent 2 output must be a JSON object."
        )

    required_fields = [

        "complaint_id",
        "department",
        "priority",
        "sla_hours",
        "escalation_level",
        "action",
        "reason",
        "status"

    ]

    missing_fields = [

        field
        for field in required_fields
        if field not in agent2_output

    ]

    if missing_fields:

        raise ValueError(
            "Agent 2 output is missing fields: "
            + ", ".join(missing_fields)
        )

    # --------------------------------------------------------
    # Complaint ID
    # --------------------------------------------------------

    if (
        agent2_output["complaint_id"]
        !=
        agent1_output["complaint_id"]
    ):

        raise ValueError(
            "Agent 2 complaint_id does not match Agent 1."
        )

    # --------------------------------------------------------
    # Priority
    # --------------------------------------------------------

    allowed_priorities = [

        "LOW",
        "MEDIUM",
        "HIGH",
        "CRITICAL"

    ]

    priority = str(
        agent2_output["priority"]
    ).upper()

    if priority not in allowed_priorities:

        raise ValueError(
            f"Invalid priority: {priority}"
        )

    agent2_output["priority"] = priority

    # --------------------------------------------------------
    # SLA
    # --------------------------------------------------------

    try:

        sla_hours = int(
            agent2_output["sla_hours"]
        )

    except (
        TypeError,
        ValueError
    ):

        raise ValueError(
            "sla_hours must be an integer."
        )

    if sla_hours <= 0:

        raise ValueError(
            "sla_hours must be greater than zero."
        )

    agent2_output["sla_hours"] = sla_hours

    # --------------------------------------------------------
    # Escalation
    # --------------------------------------------------------

    try:

        escalation_level = int(
            agent2_output["escalation_level"]
        )

    except (
        TypeError,
        ValueError
    ):

        raise ValueError(
            "escalation_level must be 1, 2, or 3."
        )

    if escalation_level not in [1, 2, 3]:

        raise ValueError(
            "escalation_level must be 1, 2, or 3."
        )

    agent2_output[
        "escalation_level"
    ] = escalation_level

    # --------------------------------------------------------
    # Status
    # --------------------------------------------------------

    allowed_statuses = [

        "ASSIGNED",
        "HUMAN_REVIEW",
        "PENDING"

    ]

    status = str(
        agent2_output["status"]
    ).upper()

    if status not in allowed_statuses:

        raise ValueError(
            f"Invalid status: {status}"
        )

    agent2_output["status"] = status

    return agent2_output


# ============================================================
# AGENT 2 SYSTEM PROMPT
# ============================================================

SYSTEM_PROMPT = """

You are AGENT 2 of AI CivicGuard.

Your role is GOVERNANCE DECISION AND ACTION MANAGEMENT.

Agent 1 has already analyzed a citizen complaint.

You receive the COMPLETE Agent 1 output.

Do NOT analyze an image.

Do NOT perform computer vision.

Do NOT invent facts.

Use Agent 1's visual evidence as the primary source.
The image evidence comes first; the citizen description is supporting
context only and must never override what is visibly shown.
If visual evidence and the description conflict, follow the visual evidence
and choose HUMAN_REVIEW when the conflict makes the civic issue uncertain.

Your responsibility is to determine:

1. Responsible government department
2. Complaint priority
3. SLA in hours
4. Escalation level
5. Recommended government action
6. Reason for the decision
7. Assignment status


============================================================
PRIORITY RULES
============================================================

CRITICAL:
Agent 1 severity = CRITICAL
or risk score >= 90.

HIGH:
Agent 1 severity = HIGH
or risk score >= 70.

MEDIUM:
Agent 1 severity = MEDIUM
or risk score >= 40.

LOW:
Agent 1 severity = LOW
or risk score < 40.


============================================================
ESCALATION RULES
============================================================

CRITICAL -> 3

HIGH -> 2

MEDIUM -> 1

LOW -> 1


============================================================
DEPARTMENT RULES
============================================================

Roads & Infrastructure
-> Public Works Department / Municipal Engineering

Electricity
-> Electricity Board / Electrical Department

Garbage/Waste Management
-> Municipal Sanitation / Waste Management

Drainage
-> Municipal Drainage / Public Works Department

Water Supply
-> Water Supply Department / Municipal Water Department

Street Lighting
-> Municipal Street Lighting Department

Traffic
-> Traffic Police / Transport Department

Public Safety
-> Municipal Corporation / Public Safety Department

Other
-> Municipal Corporation / General Civic Administration


============================================================
SLA RULES
============================================================

CRITICAL -> 4 to 12 hours

HIGH -> 12 to 24 hours

MEDIUM -> 24 to 72 hours

LOW -> 72 to 168 hours


============================================================
STATUS RULES
============================================================

Normally:

ASSIGNED

If Agent 1 has:

human_review_required = true

then use:

HUMAN_REVIEW


============================================================
IMPORTANT
============================================================

The complaint_id MUST come from Agent 1.

Priority must be consistent with Agent 1 severity
and risk_score.

Department must match the category supported by Agent 1's visual evidence.

Description is secondary context. Do not assign a department, priority, or
action based only on the description when the image does not support it.

SLA must be an integer.

Escalation level must be 1, 2, or 3.

Return ONLY valid JSON.

Do not return markdown.

Do not return explanations outside JSON.


============================================================
OUTPUT FORMAT
============================================================

{
    "complaint_id": 1,
    "department": "Public Works Department",
    "priority": "HIGH",
    "sla_hours": 24,
    "escalation_level": 2,
    "action": "Inspect and repair the damaged road",
    "reason": "The complaint presents a significant public infrastructure risk.",
    "status": "ASSIGNED"
}

"""


# ============================================================
# RUN AGENT 2
# ============================================================

def run_agent2(agent1_output):

    # --------------------------------------------------------
    # Validate Agent 1 input
    # --------------------------------------------------------

    validate_agent1_output(
        agent1_output
    )

    print(
        "\n[Agent 2] Agent 1 output received directly."
    )

    # --------------------------------------------------------
    # Convert dictionary to JSON text
    #
    # IMPORTANT:
    # This is NOT database storage.
    #
    # It is only the request sent to the Agent 2 model.
    # --------------------------------------------------------

    agent1_json = json.dumps(
        agent1_output,
        indent=4,
        ensure_ascii=False
    )

    # --------------------------------------------------------
    # User prompt
    # --------------------------------------------------------

    user_prompt = f"""

Agent 1 has completed its analysis.

Use the COMPLETE Agent 1 output below.

AGENT 1 OUTPUT:

{agent1_json}

Now make the governance decision.

Return ONLY the required JSON object.

"""


    # --------------------------------------------------------
    # OpenRouter request
    # --------------------------------------------------------

    last_error = None

    for model in MODEL_FALLBACKS:

        try:

            print(
                f"[Agent 2] Trying model: {model}"
            )

            try:
                resp = client.chat.completions.create(
                    model=model,
                    temperature=0,
                    messages=[
                        {
                            "role": "system",
                            "content": SYSTEM_PROMPT
                        },
                        {
                            "role": "user",
                            "content": user_prompt
                        }
                    ],
                    response_format={
                        "type": "json_object"
                    },
                    max_tokens=1000
                )
            except Exception:
                resp = client.chat.completions.create(
                    model=model,
                    temperature=0,
                    messages=[
                        {
                            "role": "system",
                            "content": SYSTEM_PROMPT
                        },
                        {
                            "role": "user",
                            "content": user_prompt
                        }
                    ],
                    max_tokens=1000
                )

            if not (
                resp
                and hasattr(resp, "choices")
                and resp.choices
            ):
                print(
                    f"[Agent 2] Model {model} returned no choices, "
                    f"trying next fallback..."
                )
                last_error = ValueError(
                    f"Model {model} returned no choices."
                )
                continue

            content = get_model_content(resp)
            extracted = extract_json(content)
            agent2_output = validate_agent2_output(
                extracted,
                agent1_output
            )

            print(
                f"[Agent 2] Model succeeded: {model}"
            )
            print(
                "[Agent 2] Governance decision completed."
            )
            return agent2_output

        except Exception as error:

            print(
                f"[Agent 2] Model {model} failed: {error}"
            )
            last_error = error

    print(
        f"[Agent 2] WARNING: All text models failed or rate-limited ({last_error}). "
        "Applying deterministic rule-based governance fallback."
    )
    return fallback_agent2_governance(agent1_output)


def fallback_agent2_governance(agent1_output):
    complaint_id = agent1_output.get("complaint_id")
    category = (agent1_output.get("category") or "").lower()
    severity = (agent1_output.get("severity") or "MEDIUM").upper()
    risk_type = agent1_output.get("risk_type") or "Civic Hazard"

    if any(k in category for k in ["electric", "power", "pole", "wire"]):
        department = "Electricity Board / Electrical Department"
    elif any(k in category for k in ["water", "sewage", "drain", "pipe"]):
        department = "Water Supply & Sewerage Board"
    elif any(k in category for k in ["road", "pothole", "street", "traffic"]):
        department = "Roads & Public Works Department"
    elif any(k in category for k in ["garbage", "trash", "sanitation", "waste"]):
        department = "Solid Waste Management / Sanitation Department"
    else:
        department = "Civic Infrastructure & Maintenance Department"

    sla_map = {
        "CRITICAL": (8, 3),
        "HIGH": (24, 2),
        "MEDIUM": (48, 1),
        "LOW": (72, 1)
    }

    sla_hours, escalation_level = sla_map.get(severity, (48, 1))
    action = f"Immediate field inspection and response by {department} for {risk_type}."
    reason = f"Automated governance rule assignment based on {severity} severity {risk_type}."

    print("[Agent 2] Governance decision completed (Fallback Mode).")

    return {
        "complaint_id": complaint_id,
        "department": department,
        "priority": severity,
        "sla_hours": sla_hours,
        "escalation_level": escalation_level,
        "action": action,
        "reason": reason,
        "status": "ASSIGNED"
    }


# ============================================================
# DISPLAY AGENT 2 OUTPUT
# ============================================================

def display_agent2_output(agent2_output):

    print("\n")
    print("=" * 80)
    print("AI CIVICGUARD — AGENT 2 OUTPUT")
    print("=" * 80)

    print(
        json.dumps(
            agent2_output,
            indent=4,
            ensure_ascii=False
        )
    )

    print("=" * 80)


# ============================================================
# STANDALONE INFORMATION
# ============================================================

if __name__ == "__main__":

    print("\n" + "=" * 80)

    print(
        "AI CIVICGUARD — AGENT 2"
    )

    print("=" * 80)

    print(
        "\nAgent 2 receives Agent 1 output directly."
    )

    print(
        "\nNormal application flow:"
    )

    print(
        "complaint -> Agent 1 -> Agent 2 -> Database"
    )

    print(
        "\nNo intermediate JSON file is required."
    )

    print(
        "\nIn pipeline.py:"
    )

    print(
        "agent1_output = analyze_complaint(complaint)"
    )

    print(
        "agent2_output = run_agent2(agent1_output)"
    )

    print(
        "\nAgent 2 output can then be stored in your database."
    )