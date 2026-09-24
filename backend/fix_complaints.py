#!/usr/bin/env python3
"""
Database migration script to populate NULL fields in complaints table
"""

import os
import pymysql
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def get_connection():
    return pymysql.connect(
        host=os.getenv("DB_HOST"),
        port=int(os.getenv("DB_PORT", 3306)),
        user=os.getenv("DB_USER"),
        password=os.getenv("DB_PASSWORD"),
        database=os.getenv("DB_NAME"),
        cursorclass=pymysql.cursors.DictCursor
    )

def migrate_complaints():
    conn = get_connection()
    cursor = conn.cursor()
    
    try:
        # 1. Reset any titles that were incorrectly copied from description text
        cursor.execute('''
            UPDATE complaints
            SET title = %s
            WHERE title IS NULL OR title = description OR title = SUBSTRING(description, 1, 100)
        ''', ('Civic Complaint',))
        count1 = cursor.rowcount
        print(f'✅ Reset {count1} complaint titles to the default title')

        # 2. Update NULL titles with default
        cursor.execute('UPDATE complaints SET title = %s WHERE title IS NULL', ('Civic Complaint',))
        count2 = cursor.rowcount
        print(f'✅ Updated {count2} complaints with default title')

        # 3. Update category
        cursor.execute('UPDATE complaints SET category = %s WHERE category IS NULL', ('General',))
        count3 = cursor.rowcount
        print(f'✅ Updated {count3} complaints with category')

        # 4. Update address from coordinates
        cursor.execute('''
            UPDATE complaints
            SET address = CONCAT('Location (', ROUND(latitude, 6), ', ', ROUND(longitude, 6), ')')
            WHERE address IS NULL AND latitude IS NOT NULL AND longitude IS NOT NULL
        ''')
        count4 = cursor.rowcount
        print(f'✅ Updated {count4} complaints with address from coordinates')

        # 5. Update NULL address with default
        cursor.execute('UPDATE complaints SET address = %s WHERE address IS NULL', ('Location Unknown',))
        count5 = cursor.rowcount
        print(f'✅ Updated {count5} complaints with default address')

        # 6. Update priority
        cursor.execute('UPDATE complaints SET priority = %s WHERE priority IS NULL', ('MEDIUM',))
        count6 = cursor.rowcount
        print(f'✅ Updated {count6} complaints with priority')

        conn.commit()
        print('\n✅ Database migration completed successfully!')

        # Verify
        cursor.execute('''
            SELECT complaint_id, title, category, address, priority, status, created_at
            FROM complaints 
            ORDER BY complaint_id DESC 
            LIMIT 10
        ''')
        print('\n📋 Sample complaints after migration:')
        print('-' * 120)
        rows = cursor.fetchall()
        for row in rows:
            comp_id = row.get('complaint_id', '?')
            title = str(row.get('title', ''))[:30]
            category = str(row.get('category', ''))[:15]
            address = str(row.get('address', ''))[:35]
            print(f'ID: {comp_id:3d} | Title: {title:30s} | Category: {category:15s} | Address: {address:35s}')
        print('-' * 120)

    except Exception as e:
        print(f'❌ Error during migration: {e}')
        conn.rollback()
    finally:
        cursor.close()
        conn.close()

if __name__ == '__main__':
    migrate_complaints()
