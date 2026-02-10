// Test login to backend
const axios = require('axios');
const { Client } = require('pg');

const BACKEND_URL = 'https://company-directory-oknw.onrender.com';
const DATABASE_URL = 'postgresql://company_directory_user:OCZK2sZXDFepo5UhRLKP9BSXhcMRhX5e@dpg-d64l4bpr0fns73c9n02g-a.ohio-postgres.render.com/company_directory';

async function testLogin() {
  console.log('=== Testing Login ===\n');

  // Step 1: Check database
  console.log('1. Checking database for users...');
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    
    const result = await client.query(`
      SELECT 
        u.id,
        u.email,
        u.first_name,
        u.last_name,
        u.role,
        u.password_hash,
        t.name as tenant_name,
        t.id as tenant_id
      FROM users u
      JOIN tenants t ON u.tenant_id = t.id
      WHERE u.email = 'admin@company.com';
    `);
    
    if (result.rows.length === 0) {
      console.log('❌ No user found with email admin@company.com');
      console.log('   Run: node setup-admin-user.js first');
      await client.end();
      return;
    }
    
    console.log('✓ User found in database:');
    console.log('  Email:', result.rows[0].email);
    console.log('  Name:', result.rows[0].first_name, result.rows[0].last_name);
    console.log('  Role:', result.rows[0].role);
    console.log('  Tenant:', result.rows[0].tenant_name);
    console.log('  Password hash:', result.rows[0].password_hash.substring(0, 20) + '...');
    
    await client.end();
  } catch (error) {
    console.error('❌ Database error:', error.message);
    return;
  }

  // Step 2: Test backend health
  console.log('\n2. Checking backend health...');
  try {
    const healthResponse = await axios.get(`${BACKEND_URL}/`);
    console.log('✓ Backend is responding:', healthResponse.data);
  } catch (error) {
    console.error('❌ Backend health check failed:', error.message);
    return;
  }

  // Step 3: Test login endpoint
  console.log('\n3. Testing login endpoint...');
  try {
    const loginResponse = await axios.post(`${BACKEND_URL}/api/auth/login`, {
      email: 'admin@company.com',
      password: 'admin123'
    });
    
    console.log('✓ Login successful!');
    console.log('  Token received:', loginResponse.data.token ? 'Yes' : 'No');
    console.log('  User:', loginResponse.data.user);
    
  } catch (error) {
    console.error('❌ Login failed');
    if (error.response) {
      console.error('  Status:', error.response.status);
      console.error('  Error:', JSON.stringify(error.response.data, null, 2));
      if (error.response.data.stack) {
        console.error('  Stack:', error.response.data.stack);
      }
    } else {
      console.error('  Error:', error.message);
      console.error('  Full error:', error);
    }
  }

  console.log('\n=== Test Complete ===');
}

testLogin();
