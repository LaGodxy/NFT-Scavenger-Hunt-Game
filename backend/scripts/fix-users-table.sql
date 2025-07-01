-- Fix the users table by handling existing null values
-- Run this script to resolve the database migration issue

-- First, let's see what's in the users table
SELECT id, email, username, name FROM users WHERE name IS NULL;

-- Option 1: Update existing users with null names to have a default value
UPDATE users 
SET name = COALESCE(username, 'Unknown User') 
WHERE name IS NULL;

-- Option 2: If you want to drop and recreate the table (WARNING: This will delete all data)
-- Uncomment the lines below only if you're okay with losing existing user data

-- DROP TABLE IF EXISTS users CASCADE;

-- Option 3: Add the column as nullable first, then update, then make it NOT NULL
-- This is the safest approach for production

-- Step 1: Make sure the name column exists and is nullable
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS name VARCHAR(100);

-- Step 2: Update null values
UPDATE users 
SET name = COALESCE(username, CONCAT('User_', SUBSTRING(id::text, 1, 8)))
WHERE name IS NULL OR name = '';

-- Step 3: Now make it NOT NULL (TypeORM will handle this automatically)
-- ALTER TABLE users ALTER COLUMN name SET NOT NULL;

-- Verify the changes
SELECT COUNT(*) as total_users, 
       COUNT(name) as users_with_names,
       COUNT(*) - COUNT(name) as users_without_names
FROM users;
