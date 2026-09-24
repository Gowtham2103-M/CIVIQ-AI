import sys
sys.path.insert(0, '.')
from database import get_connection

conn = get_connection()
cursor = conn.cursor()

cursor.execute("SHOW TABLES")
all_tables = [list(r.values())[0] for r in cursor.fetchall()]
print("All tables:", all_tables)

cursor.execute("SHOW TABLES LIKE 'complaint_governance'")
row = cursor.fetchone()
print("complaint_governance exists:", bool(row))

if row:
    cursor.execute("DESCRIBE complaint_governance")
    for r in cursor.fetchall():
        print(r)
    cursor.execute("SELECT COUNT(*) as cnt FROM complaint_governance")
    print("Row count:", cursor.fetchone())

cursor.close()
conn.close()
