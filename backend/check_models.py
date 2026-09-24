"""
Query OpenRouter models API to find currently available free vision models.
"""
import os
import sys
import json
import urllib.request

sys.path.insert(0, '.')
from dotenv import load_dotenv
load_dotenv('.env')

api_key = os.getenv("OPENROUTER_API_KEY")

req = urllib.request.Request(
    "https://openrouter.ai/api/v1/models",
    headers={
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }
)

with urllib.request.urlopen(req, timeout=15) as resp:
    data = json.loads(resp.read().decode())

models = data.get("data", [])

# Find free vision models (pricing = 0 and supports image input)
free_vision = []
free_text = []

for m in models:
    pricing = m.get("pricing", {})
    prompt_cost = float(pricing.get("prompt", "1") or "1")
    is_free = prompt_cost == 0

    arch = m.get("architecture", {})
    modalities = arch.get("input_modalities", []) or arch.get("modality", "")
    supports_image = (
        "image" in str(modalities).lower()
        or "vision" in m.get("name", "").lower()
        or "vl" in m.get("id", "").lower()
    )

    if is_free and supports_image:
        free_vision.append(m["id"])
    elif is_free:
        free_text.append(m["id"])

print("\n=== FREE VISION MODELS ===")
for mid in sorted(free_vision):
    print(f"  {mid}")

print(f"\n=== FREE TEXT MODELS (first 20) ===")
for mid in sorted(free_text)[:20]:
    print(f"  {mid}")

print(f"\nTotal free vision: {len(free_vision)}")
print(f"Total free text: {len(free_text)}")
