"""
Quick test: Run the pipeline for the latest complaint and print the full error.
"""
import sys
import traceback

sys.path.insert(0, '.')

from database import get_connection

# Find the latest complaint
conn = get_connection()
cursor = conn.cursor()
cursor.execute("SELECT complaint_id FROM complaints ORDER BY complaint_id DESC LIMIT 1")
row = cursor.fetchone()
cursor.close()
conn.close()

if not row:
    print("No complaints found in the database.")
    sys.exit(1)

complaint_id = row["complaint_id"]
print(f"Testing pipeline for complaint_id = {complaint_id}")

try:
    from agent.pipeline import process_complaint
    result = process_complaint(complaint_id)
    print("\n=== PIPELINE SUCCESS ===")
    print(result)
except Exception as e:
    print("\n=== PIPELINE FAILED ===")
    traceback.print_exc()
