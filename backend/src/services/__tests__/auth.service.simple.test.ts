import jwt from 'jsonwebtoken';
import { generateTestJWT, generateTestRefreshToken } from '../../utils/test-helpers';

describe('AuthService Simple Tests', () => {
  beforeEach(() => {
    process.env.JWT_SECRET = 'test-secret-for-property-tests';
    process.env.JWT_EXPIRES_IN = '8h';
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
    process.env.JWT_REFRESH_EXPIRES_IN = '7d';
    process.env.NODE_ENV = 'test';
  });

  afterEach(() => {
    delete process.env.JWT_EXPIRES_IN;
    delete process.env.JWT_REFRESH_SECRET;
    delete process.env.JWT_REFRESH_EXPIRES_IN;
    delete process.env.NODE_ENV;
  });

  describe('Basic JWT functionality', () => {
    it('should generate a valid JWT token', () => {
      const token = generateTestJWT({
        userId: 'test-user-123',
        tenantId: 'test-tenant-456',
        email: 'test@example.com',
        role: 'user',
      });

      expect(typeof token).toBe('string');
      expect(token.length).toBeGreaterThan(0);

      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
      expect(decoded.userId).toBe('test-user-123');
      expect(decoded.tenantId).toBe('test-tenant-456');
      expect(decoded.email).toBe('test@example.com');
      expect(decoded.role).toBe('user');
    });

    it('should generate a valid refresh token', () => {
      const refreshToken = generateTestRefreshToken('test-user-123');

      expect(typeof refreshToken).toBe('string');
      expect(refreshToken.length).toBeGreaterThan(0);

      const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET!) as any;
      expect(decoded.userId).toBe('test-user-123');
      expect(decoded.type).toBe('refresh');
    });

    it('should reject invalid tokens', () => {
      expect(() => {
        jwt.verify('invalid-token', process.env.JWT_SECRET!);
      }).toThrow();
    });
  });
});