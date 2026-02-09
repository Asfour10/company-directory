-- Company Directory - Initial Setup Script
-- Run this in your Render PostgreSQL database

-- Step 1: Create a tenant (if one doesn't exist)
INSERT INTO "Tenant" (
  id,
  name,
  subdomain,
  "createdAt",
  "updatedAt"
)
SELECT 
  gen_random_uuid(),
  'My Company',
  'mycompany',
  NOW(),
  NOW()
WHERE NOT EXISTS (SELECT 1 FROM "Tenant" LIMIT 1);

-- Step 2: Create an admin user
-- IMPORTANT: Replace 'YOUR_PASSWORD_HERE' with your actual password
-- To generate a bcrypt hash for your password, run this locally:
-- node -e "const bcrypt = require('bcrypt'); bcrypt.hash('YourPassword123', 10, (err, hash) => console.log(hash));"

INSERT INTO "User" (
  id,
  email,
  "passwordHash",
  "firstName",
  "lastName",
  role,
  "tenantId",
  "createdAt",
  "updatedAt"
)
VALUES (
  gen_random_uuid(),
  'admin@company.com',
  -- Replace this hash with your generated hash
  '$2b$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW',  -- This is 'password123'
  'Admin',
  'User',
  'super_admin',
  (SELECT id FROM "Tenant" LIMIT 1),
  NOW(),
  NOW()
);

-- Verify the setup
SELECT 
  u.email,
  u."firstName",
  u."lastName",
  u.role,
  t.name as tenant_name
FROM "User" u
JOIN "Tenant" t ON u."tenantId" = t.id;
