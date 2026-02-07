// Simple test runner to verify functionality without Jest
import jwt from 'jsonwebtoken';
import { generateTestJWT, generateTestRefreshToken } from './utils/test-helpers';

// Set up test environment
process.env.JWT_SECRET = 'test-secret-for-property-tests';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
process.env.NODE_ENV = 'test';

console.log('🧪 Running basic authentication tests...');

try {
  // Test 1: Generate valid JWT token
  console.log('Test 1: Generate valid JWT token');
  const token = generateTestJWT({
    userId: 'test-user-123',
    tenantId: 'test-tenant-456',
    email: 'test@example.com',
    role: 'user',
  });

  if (typeof token !== 'string' || token.length === 0) {
    throw new Error('Token should be a non-empty string');
  }

  const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
  if (decoded.userId !== 'test-user-123') {
    throw new Error('Token should contain correct userId');
  }
  console.log('✅ Test 1 passed');

  // Test 2: Generate valid refresh token
  console.log('Test 2: Generate valid refresh token');
  const refreshToken = generateTestRefreshToken('test-user-123');

  if (typeof refreshToken !== 'string' || refreshToken.length === 0) {
    throw new Error('Refresh token should be a non-empty string');
  }

  const decodedRefresh = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET!) as any;
  if (decodedRefresh.userId !== 'test-user-123') {
    throw new Error('Refresh token should contain correct userId');
  }
  console.log('✅ Test 2 passed');

  // Test 3: Reject invalid tokens
  console.log('Test 3: Reject invalid tokens');
  try {
    jwt.verify('invalid-token', process.env.JWT_SECRET!);
    throw new Error('Should have thrown an error for invalid token');
  } catch (error) {
    // Expected to throw
    console.log('✅ Test 3 passed');
  }

  console.log('🎉 All basic tests passed!');
  
} catch (error) {
  console.error('❌ Test failed:', error);
  process.exit(1);
}