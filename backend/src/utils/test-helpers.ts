import jwt from 'jsonwebtoken';
import { JWTPayload } from '../types';

/**
 * Generate a test JWT token for use in integration tests
 */
export function generateTestJWT(payload: {
  userId: string;
  tenantId: string;
  role: string;
  email?: string;
}): string {
  const jwtSecret = process.env.JWT_SECRET || 'fallback-secret-change-in-production';
  
  const tokenPayload: Omit<JWTPayload, 'iat' | 'exp'> = {
    userId: payload.userId,
    tenantId: payload.tenantId,
    email: payload.email || `test-${payload.userId}@example.com`,
    role: payload.role,
  };

  return jwt.sign(tokenPayload, jwtSecret, {
    expiresIn: '1h',
    issuer: 'company-directory',
    audience: 'company-directory-users',
  });
}

/**
 * Generate a test refresh token for use in integration tests
 */
export function generateTestRefreshToken(userId: string): string {
  const refreshSecret = process.env.JWT_REFRESH_SECRET || 'fallback-refresh-secret';
  
  const payload = { userId, type: 'refresh' };
  
  return jwt.sign(payload, refreshSecret, {
    expiresIn: '7d',
    issuer: 'company-directory',
  });
}

/**
 * Create test data helpers
 */
export const TestDataHelpers = {
  /**
   * Generate a unique test ID
   */
  generateTestId: (prefix: string = 'test'): string => {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  },

  /**
   * Generate test email
   */
  generateTestEmail: (prefix: string = 'test'): string => {
    return `${prefix}-${Date.now()}@example.com`;
  },

  /**
   * Generate test tenant data
   */
  generateTestTenant: () => ({
    id: TestDataHelpers.generateTestId('tenant'),
    name: 'Test Tenant',
    subdomain: `test-${Date.now()}`,
    isActive: true,
  }),

  /**
   * Generate test user data
   */
  generateTestUser: (tenantId: string, role: string = 'user') => ({
    id: TestDataHelpers.generateTestId('user'),
    email: TestDataHelpers.generateTestEmail('user'),
    tenantId,
    role,
    isActive: true,
  }),

  /**
   * Generate test employee data
   */
  generateTestEmployee: (tenantId: string, userId?: string) => ({
    id: TestDataHelpers.generateTestId('employee'),
    tenantId,
    userId,
    firstName: 'Test',
    lastName: 'Employee',
    email: TestDataHelpers.generateTestEmail('employee'),
    title: 'Test Title',
    department: 'Test Department',
    isActive: true,
  }),
};