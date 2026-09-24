-- ============================================================
-- MIGRATION: Populate NULL complaint fields
-- 
-- This script fixes existing complaints that have NULL values
-- for title, category, address, or priority.
-- ============================================================

-- 1. Reset any title values that were incorrectly copied from description text
UPDATE complaints
SET title = 'Civic Complaint'
WHERE title IS NULL
   OR title = description
   OR title = SUBSTRING(description, 1, 100);

-- 2. POPULATE CATEGORY with "General"
UPDATE complaints
SET category = 'General'
WHERE category IS NULL;

-- 3. POPULATE ADDRESS from coordinates
UPDATE complaints
SET address = CONCAT('Location (', latitude, ', ', longitude, ')')
WHERE address IS NULL AND latitude IS NOT NULL AND longitude IS NOT NULL;

UPDATE complaints
SET address = 'Location Unknown'
WHERE address IS NULL;

-- 4. POPULATE PRIORITY with "MEDIUM"
UPDATE complaints
SET priority = 'MEDIUM'
WHERE priority IS NULL;

-- Verify the changes
SELECT 
    complaint_id,
    title,
    category,
    address,
    priority,
    status,
    created_at
FROM complaints
ORDER BY complaint_id DESC
LIMIT 10;
