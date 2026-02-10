// Direct test of auth endpoint with detailed error reporting
const axios = require('axios');

const BACKEND_URL = 'https://company-directory-oknw.onrender.com';

async function testAuth() {
  console.log('Testing auth endpoint directly...\n');
  
  try {
    const response = await axios.post(`${BACKEND_URL}/api/auth/login`, {
      email: 'admin@company.com',
      password: 'admin123'
    }, {
      headers: {
        'Content-Type': 'application/json'
      },
      validateStatus: () => true // Don't throw on any status
    });
    
    console.log('Status:', response.status);
    console.log('Headers:', JSON.stringify(response.headers, null, 2));
    console.log('Data:', JSON.stringify(response.data, null, 2));
    
    if (response.status === 200) {
      console.log('\n✓ Login successful!');
      console.log('Token:', response.data.accessToken ? 'Received' : 'Missing');
    } else {
      console.log('\n❌ Login failed');
    }
    
  } catch (error) {
    console.error('Request error:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
  }
}

testAuth();
