import { AuthService } from '../auth.service';
import { SessionService } from '../session.service';
import { prisma } from '../../lib/database';
import jwt from 'jsonwebtoken';

// Mock dependencies
jest.mock('../session.service');
jest.mock('../../lib/database', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  },
}));
jest.mock('jsonwebtoken');

const mockSessionService = SessionService as jest.Mocked<typeof SessionService>;
const mockPrisma = prisma as jest.Mocked<typeof prisma>;
const mockJwt = jwt as jest.Mocked<typeof jwt>;

describe('AuthService', () => {
  let authService: AuthService;

  beforeEach(() => {
    jest.clearAllMocks();
    // Set environment variables for testing
    process.env.JWT_SECRET = 'test-secret';
    process.env.JWT_EXPIRES_IN = '8h';
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
    process.env.JWT_REFRESH_EXPIRES_IN = '7d';
    process.env.NODE_ENV = 'test';

    authService = new AuthService();
  });

  afterEach(() => {
    delete process.env.JWT_SECRET;
    delete process.env.JWT_EXPIRES_IN;
    delete process.env.JWT_REFRESH_SECRET;
    delete process.env.JWT_REFRESH_EXPIRES_IN;
    delete process.env.NODE_ENV;
  });

  describe('constructor', () => {
    it('should initialize with environment variables', () => {
      expect(authService).toBeInstanceOf(AuthService);
    });

    it('should throw error in production without JWT_SECRET', () => {
      process.env.NODE_ENV = 'production';
      delete process.env.JWT_SECRET;

      expect(() => new AuthService()).toThrow('JWT_SECRET must be set in production');
    });

    it('should use fallback secrets in non-production', () => {
      delete process.env.JWT_SECRET;
      delete process.env.JWT_REFRESH_SECRET;

      expect(() => new AuthService()).not.toThrow();
    });
  });

  describe('generateToken', () => {
    it('should generate JWT token with correct payload', () => {
      const userId = 'user-123';
      const tenantId = 'tenant-456';
      const email = 'user@example.com';
      const role = 'admin';
      const expectedToken = 'jwt-token';

      mockJwt.sign.mockReturnValue(expectedToken);

      const result = authService.generateToken(userId, tenantId, email, role);

      expect(mockJwt.sign).toHaveBeenCalledWith(
        {
          userId,
          tenantId,
          email,
          role,
        },
        'test-secret',
        {
          expiresIn: '8h',
          issuer: 'company-directory',
          audience: 'company-directory-users',
        }
      );
      expect(result).toBe(expectedToken);
    });
  });

  describe('generateRefreshToken', () => {
    it('should generate refresh token', () => {
      const userId = 'user-123';
      const expectedToken = 'refresh-token';

      mockJwt.sign.mockReturnValue(expectedToken);

      const result = authService.generateRefreshToken(userId);

      expect(mockJwt.sign).toHaveBeenCalledWith(
        { userId, type: 'refresh' },
        'test-refresh-secret',
        {
          expiresIn: '7d',
          issuer: 'company-directory',
        }
      );
      expect(result).toBe(expectedToken);
    });
  });

  describe('verifyToken', () => {
    it('should verify valid token', () => {
      const token = 'valid-token';
      const expectedPayload = {
        userId: 'user-123',
        tenantId: 'tenant-456',
        email: 'user@example.com',
        role: 'admin',
        iat: 1234567890,
        exp: 1234567890 + 3600,
      };

      mockJwt.verify.mockReturnValue(expectedPayload);

      const result = authService.verifyToken(token);

      expect(mockJwt.verify).toHaveBeenCalledWith(token, 'test-secret');
      expect(result).toEqual(expectedPayload);
    });

    it('should throw error for invalid token', () => {
      const token = 'invalid-token';
      const error = new Error('Invalid token');

      mockJwt.verify.mockImplementation(() => {
        throw error;
      });

      expect(() => authService.verifyToken(token)).toThrow('Invalid token');
    });
  });

  describe('verifyRefreshToken', () => {
    it('should verify valid refresh token', () => {
      const token = 'valid-refresh-token';
      const expectedPayload = {
        userId: 'user-123',
        type: 'refresh',
        iat: 1234567890,
        exp: 1234567890 + 604800,
      };

      mockJwt.verify.mockReturnValue(expectedPayload);

      const result = authService.verifyRefreshToken(token);

      expect(mockJwt.verify).toHaveBeenCalledWith(token, 'test-refresh-secret');
      expect(result).toEqual(expectedPayload);
    });

    it('should throw error for invalid refresh token', () => {
      const token = 'invalid-refresh-token';
      const error = new Error('Invalid refresh token');

      mockJwt.verify.mockImplementation(() => {
        throw error;
      });

      expect(() => authService.verifyRefreshToken(token)).toThrow('Invalid refresh token');
    });
  });

  describe('createSession', () => {
    it('should create session successfully', async () => {
      const userId = 'user-123';
      const tenantId = 'tenant-456';
      const email = 'user@example.com';
      const role = 'admin';
      const ipAddress = '192.168.1.1';
      const userAgent = 'Test Agent';

      const mockTokens = {
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      };

      const mockSession = {
        id: 'session-123',
        userId,
        tenantId,
        accessToken: mockTokens.accessToken,
        refreshToken: mockTokens.refreshToken,
        expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000),
        ipAddress,
        userAgent,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockJwt.sign
        .mockReturnValueOnce(mockTokens.accessToken)
        .mockReturnValueOnce(mockTokens.refreshToken);

      mockSessionService.createSession.mockResolvedValue(mockSession);

      const result = await authService.createSession(
        userId,
        tenantId,
        email,
        role,
        ipAddress,
        userAgent
      );

      expect(mockSessionService.createSession).toHaveBeenCalledWith({
        userId,
        tenantId,
        accessToken: mockTokens.accessToken,
        refreshToken: mockTokens.refreshToken,
        expiresAt: expect.any(Date),
        ipAddress,
        userAgent,
      });
      expect(result).toEqual({
        session: mockSession,
        tokens: mockTokens,
      });
    });
  });

  describe('refreshSession', () => {
    it('should refresh session with valid refresh token', async () => {
      const refreshToken = 'valid-refresh-token';
      const userId = 'user-123';
      const tenantId = 'tenant-456';

      const mockUser = {
        id: userId,
        email: 'user@example.com',
        role: 'admin',
        tenantId,
        isActive: true,
      };

      const mockRefreshPayload = {
        userId,
        type: 'refresh',
        iat: 1234567890,
        exp: 1234567890 + 604800,
      };

      const mockSession = {
        id: 'session-123',
        userId,
        tenantId,
        refreshToken,
        isActive: true,
      };

      const newAccessToken = 'new-access-token';
      const newRefreshToken = 'new-refresh-token';

      mockJwt.verify.mockReturnValue(mockRefreshPayload);
      mockSessionService.findByRefreshToken.mockResolvedValue(mockSession);
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockJwt.sign
        .mockReturnValueOnce(newAccessToken)
        .mockReturnValueOnce(newRefreshToken);

      const updatedSession = {
        ...mockSession,
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000),
        updatedAt: new Date(),
      };

      mockSessionService.updateSession.mockResolvedValue(updatedSession);

      const result = await authService.refreshSession(refreshToken);

      expect(mockJwt.verify).toHaveBeenCalledWith(refreshToken, 'test-refresh-secret');
      expect(mockSessionService.findByRefreshToken).toHaveBeenCalledWith(refreshToken);
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          role: true,
          tenantId: true,
          isActive: true,
        },
      });
      expect(mockSessionService.updateSession).toHaveBeenCalledWith(mockSession.id, {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        expiresAt: expect.any(Date),
      });
      expect(result).toEqual({
        session: updatedSession,
        tokens: {
          accessToken: newAccessToken,
          refreshToken: newRefreshToken,
        },
      });
    });

    it('should throw error for invalid refresh token', async () => {
      const refreshToken = 'invalid-refresh-token';
      const error = new Error('Invalid token');

      mockJwt.verify.mockImplementation(() => {
        throw error;
      });

      await expect(authService.refreshSession(refreshToken)).rejects.toThrow('Invalid refresh token');
    });

    it('should throw error for non-existent session', async () => {
      const refreshToken = 'valid-refresh-token';
      const mockRefreshPayload = {
        userId: 'user-123',
        type: 'refresh',
        iat: 1234567890,
        exp: 1234567890 + 604800,
      };

      mockJwt.verify.mockReturnValue(mockRefreshPayload);
      mockSessionService.findByRefreshToken.mockResolvedValue(null);

      await expect(authService.refreshSession(refreshToken)).rejects.toThrow('Invalid refresh token');
    });

    it('should throw error for inactive session', async () => {
      const refreshToken = 'valid-refresh-token';
      const mockRefreshPayload = {
        userId: 'user-123',
        type: 'refresh',
        iat: 1234567890,
        exp: 1234567890 + 604800,
      };

      const mockSession = {
        id: 'session-123',
        userId: 'user-123',
        tenantId: 'tenant-456',
        refreshToken,
        isActive: false,
      };

      mockJwt.verify.mockReturnValue(mockRefreshPayload);
      mockSessionService.findByRefreshToken.mockResolvedValue(mockSession);

      await expect(authService.refreshSession(refreshToken)).rejects.toThrow('Session is no longer active');
    });

    it('should throw error for inactive user', async () => {
      const refreshToken = 'valid-refresh-token';
      const mockRefreshPayload = {
        userId: 'user-123',
        type: 'refresh',
        iat: 1234567890,
        exp: 1234567890 + 604800,
      };

      const mockSession = {
        id: 'session-123',
        userId: 'user-123',
        tenantId: 'tenant-456',
        refreshToken,
        isActive: true,
      };

      const mockUser = {
        id: 'user-123',
        email: 'user@example.com',
        role: 'admin',
        tenantId: 'tenant-456',
        isActive: false,
      };

      mockJwt.verify.mockReturnValue(mockRefreshPayload);
      mockSessionService.findByRefreshToken.mockResolvedValue(mockSession);
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      await expect(authService.refreshSession(refreshToken)).rejects.toThrow('User account is inactive');
    });
  });

  describe('revokeSession', () => {
    it('should revoke session successfully', async () => {
      const sessionId = 'session-123';

      mockSessionService.revokeSession.mockResolvedValue(undefined);

      await authService.revokeSession(sessionId);

      expect(mockSessionService.revokeSession).toHaveBeenCalledWith(sessionId);
    });
  });

  describe('revokeAllUserSessions', () => {
    it('should revoke all user sessions', async () => {
      const userId = 'user-123';

      mockSessionService.revokeAllUserSessions.mockResolvedValue(3);

      const result = await authService.revokeAllUserSessions(userId);

      expect(mockSessionService.revokeAllUserSessions).toHaveBeenCalledWith(userId);
      expect(result).toBe(3);
    });
  });

  describe('validateSession', () => {
    it('should validate active session', async () => {
      const sessionId = 'session-123';
      const mockSession = {
        id: sessionId,
        userId: 'user-123',
        tenantId: 'tenant-456',
        isActive: true,
        expiresAt: new Date(Date.now() + 3600000), // 1 hour from now
      };

      mockSessionService.findById.mockResolvedValue(mockSession);

      const result = await authService.validateSession(sessionId);

      expect(mockSessionService.findById).toHaveBeenCalledWith(sessionId);
      expect(result).toEqual(mockSession);
    });

    it('should return null for non-existent session', async () => {
      const sessionId = 'non-existent-session';

      mockSessionService.findById.mockResolvedValue(null);

      const result = await authService.validateSession(sessionId);

      expect(result).toBeNull();
    });

    it('should return null for inactive session', async () => {
      const sessionId = 'session-123';
      const mockSession = {
        id: sessionId,
        userId: 'user-123',
        tenantId: 'tenant-456',
        isActive: false,
        expiresAt: new Date(Date.now() + 3600000),
      };

      mockSessionService.findById.mockResolvedValue(mockSession);

      const result = await authService.validateSession(sessionId);

      expect(result).toBeNull();
    });

    it('should return null for expired session', async () => {
      const sessionId = 'session-123';
      const mockSession = {
        id: sessionId,
        userId: 'user-123',
        tenantId: 'tenant-456',
        isActive: true,
        expiresAt: new Date(Date.now() - 3600000), // 1 hour ago
      };

      mockSessionService.findById.mockResolvedValue(mockSession);

      const result = await authService.validateSession(sessionId);

      expect(result).toBeNull();
    });
  });

  describe('updateLastActivity', () => {
    it('should update session last activity', async () => {
      const sessionId = 'session-123';

      mockSessionService.updateLastActivity.mockResolvedValue(undefined);

      await authService.updateLastActivity(sessionId);

      expect(mockSessionService.updateLastActivity).toHaveBeenCalledWith(sessionId);
    });
  });

  describe('cleanupExpiredSessions', () => {
    it('should cleanup expired sessions', async () => {
      mockSessionService.cleanupExpiredSessions.mockResolvedValue(5);

      const result = await authService.cleanupExpiredSessions();

      expect(mockSessionService.cleanupExpiredSessions).toHaveBeenCalled();
      expect(result).toBe(5);
    });
  });

  describe('getUserSessions', () => {
    it('should get user sessions', async () => {
      const userId = 'user-123';
      const mockSessions = [
        {
          id: 'session-1',
          userId,
          ipAddress: '192.168.1.1',
          userAgent: 'Chrome',
          createdAt: new Date(),
          lastActivity: new Date(),
          isActive: true,
        },
        {
          id: 'session-2',
          userId,
          ipAddress: '192.168.1.2',
          userAgent: 'Firefox',
          createdAt: new Date(),
          lastActivity: new Date(),
          isActive: true,
        },
      ];

      mockSessionService.getUserSessions.mockResolvedValue(mockSessions);

      const result = await authService.getUserSessions(userId);

      expect(mockSessionService.getUserSessions).toHaveBeenCalledWith(userId);
      expect(result).toEqual(mockSessions);
    });
  });

  describe('generateSecureToken', () => {
    it('should generate secure random token', () => {
      const token1 = (authService as any).generateSecureToken();
      const token2 = (authService as any).generateSecureToken();

      expect(token1).toHaveLength(64); // 32 bytes = 64 hex characters
      expect(token2).toHaveLength(64);
      expect(token1).not.toBe(token2);
      expect(token1).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  describe('calculateExpirationTime', () => {
    it('should calculate expiration time correctly', () => {
      const expiresIn = '8h';
      const result = (authService as any).calculateExpirationTime(expiresIn);

      expect(result).toBeInstanceOf(Date);
      expect(result.getTime()).toBeGreaterThan(Date.now());
      expect(result.getTime()).toBeLessThanOrEqual(Date.now() + 8 * 60 * 60 * 1000);
    });

    it('should handle different time formats', () => {
      const testCases = ['1h', '30m', '7d', '1w'];

      testCases.forEach(expiresIn => {
        const result = (authService as any).calculateExpirationTime(expiresIn);
        expect(result).toBeInstanceOf(Date);
        expect(result.getTime()).toBeGreaterThan(Date.now());
      });
    });
  });
});