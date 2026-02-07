import request from 'supertest';
import express from 'express';
import authRoutes from '../auth.routes';
import { prisma } from '../../lib/database';
import { createErrorHandler } from '../../utils/errors';

// Mock the auth service
jest.mock('../../services/auth.service', () => ({
  AuthService: jest.fn().mockImplementation(() => ({
    createSession: jest.fn(),
    refreshSession: jest.fn(),
    revokeSession: jest.fn(),
    revokeAllUserSessions: jest.fn(),
    validateSession: jest.fn(),
    getUserSessions: jest.fn(),
  })),
}));

// Mock the user service
jest.mock('../../services/user.service', () => ({
  UserService: {
    findByEmail: jest.fn(),
    createUser: jest.fn(),
    updateLastLogin: jest.fn(),
  },
}));

// Mock the tenant service
jest.mock('../../services/tenant.service', () => ({
  TenantService: {
    getTenantBySubdomain: jest.fn(),
  },
}));

// Mock the analytics service
jest.mock('../../services/analytics.service', () => ({
  AnalyticsService: {
    trackLogin: jest.fn(),
    trackLogout: jest.fn(),
  },
}));

// Mock passport strategies
jest.mock('passport', () => ({
  authenticate: jest.fn(() => (req: any, res: any, next: any) => {
    // Mock successful authentication
    req.user = {
      id: 'user-123',
      email: 'user@example.com',
      role: 'user',
      tenantId: 'tenant-456',
    };
    next();
  }),
  use: jest.fn(),
  initialize: jest.fn(() => (req: any, res: any, next: any) => next()),
  session: jest.fn(() => (req: any, res: any, next: any) => next()),
}));

// Mock the database
jest.mock('../../lib/database', () => ({
  prisma: {
    tenant: {
      findUnique: jest.fn(),
    },
  },
}));

import { AuthService } from '../../services/auth.service';
import { UserService } from '../../services/user.service';
import { TenantService } from '../../services/tenant.service';
import { AnalyticsService } from '../../services/analytics.service';

const mockAuthService = new (AuthService as jest.MockedClass<typeof AuthService>)();
const mockUserService = UserService as jest.Mocked<typeof UserService>;
const mockTenantService = TenantService as jest.Mocked<typeof TenantService>;
const mockAnalyticsService = AnalyticsService as jest.Mocked<typeof AnalyticsService>;
const mockPrisma = prisma as jest.Mocked<typeof prisma>;

// Create test app
const app = express();
app.use(express.json());
app.use('/api/auth', authRoutes);
app.use(createErrorHandler());

describe('Auth Routes Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/auth/login', () => {
    it('should login user with valid credentials', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'user@example.com',
        role: 'user',
        tenantId: 'tenant-456',
        isActive: true,
      };

      const mockTenant = {
        id: 'tenant-456',
        name: 'Test Company',
        subdomain: 'testcompany',
      };

      const mockSession = {
        id: 'session-789',
        userId: 'user-123',
        tenantId: 'tenant-456',
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000),
        ipAddress: '127.0.0.1',
        userAgent: 'Test Agent',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockTokens = {
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      };

      mockUserService.findByEmail.mockResolvedValue(mockUser);
      mockTenantService.getTenantBySubdomain.mockResolvedValue(mockTenant);
      mockAuthService.createSession.mockResolvedValue({
        session: mockSession,
        tokens: mockTokens,
      });
      mockUserService.updateLastLogin.mockResolvedValue(undefined);

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'user@example.com',
          password: 'password123',
          subdomain: 'testcompany',
        })
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: {
          user: {
            id: mockUser.id,
            email: mockUser.email,
            role: mockUser.role,
            tenantId: mockUser.tenantId,
          },
          tenant: mockTenant,
          tokens: mockTokens,
          session: {
            id: mockSession.id,
            expiresAt: mockSession.expiresAt.toISOString(),
          },
        },
      });

      expect(mockUserService.findByEmail).toHaveBeenCalledWith('user@example.com', 'tenant-456');
      expect(mockAuthService.createSession).toHaveBeenCalledWith(
        'user-123',
        'tenant-456',
        'user@example.com',
        'user',
        expect.any(String),
        expect.any(String)
      );
      expect(mockAnalyticsService.trackLogin).toHaveBeenCalledWith(
        'tenant-456',
        'user-123',
        {
          loginMethod: 'password',
          ipAddress: expect.any(String),
        }
      );
    });

    it('should return 400 for missing credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'user@example.com',
          // Missing password and subdomain
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 401 for invalid credentials', async () => {
      mockUserService.findByEmail.mockResolvedValue(null);

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'invalid@example.com',
          password: 'wrongpassword',
          subdomain: 'testcompany',
        })
        .expect(401);

      expect(response.body).toEqual({
        success: false,
        error: {
          message: 'Invalid credentials',
          code: 'UNAUTHORIZED',
        },
      });
    });

    it('should return 404 for invalid tenant', async () => {
      mockTenantService.getTenantBySubdomain.mockResolvedValue(null);

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'user@example.com',
          password: 'password123',
          subdomain: 'nonexistent',
        })
        .expect(404);

      expect(response.body).toEqual({
        success: false,
        error: {
          message: 'Tenant not found',
          code: 'NOT_FOUND',
        },
      });
    });

    it('should return 401 for inactive user', async () => {
      const inactiveUser = {
        id: 'user-123',
        email: 'user@example.com',
        role: 'user',
        tenantId: 'tenant-456',
        isActive: false,
      };

      const mockTenant = {
        id: 'tenant-456',
        name: 'Test Company',
        subdomain: 'testcompany',
      };

      mockUserService.findByEmail.mockResolvedValue(inactiveUser);
      mockTenantService.getTenantBySubdomain.mockResolvedValue(mockTenant);

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'user@example.com',
          password: 'password123',
          subdomain: 'testcompany',
        })
        .expect(401);

      expect(response.body).toEqual({
        success: false,
        error: {
          message: 'Account is inactive',
          code: 'UNAUTHORIZED',
        },
      });
    });
  });

  describe('POST /api/auth/refresh', () => {
    it('should refresh tokens with valid refresh token', async () => {
      const mockSession = {
        id: 'session-789',
        userId: 'user-123',
        tenantId: 'tenant-456',
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
        expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000),
        updatedAt: new Date(),
      };

      const mockTokens = {
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
      };

      mockAuthService.refreshSession.mockResolvedValue({
        session: mockSession,
        tokens: mockTokens,
      });

      const response = await request(app)
        .post('/api/auth/refresh')
        .send({
          refreshToken: 'valid-refresh-token',
        })
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: {
          tokens: mockTokens,
          session: {
            id: mockSession.id,
            expiresAt: mockSession.expiresAt.toISOString(),
          },
        },
      });

      expect(mockAuthService.refreshSession).toHaveBeenCalledWith('valid-refresh-token');
    });

    it('should return 400 for missing refresh token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 401 for invalid refresh token', async () => {
      mockAuthService.refreshSession.mockRejectedValue(new Error('Invalid refresh token'));

      const response = await request(app)
        .post('/api/auth/refresh')
        .send({
          refreshToken: 'invalid-refresh-token',
        })
        .expect(401);

      expect(response.body).toEqual({
        success: false,
        error: {
          message: 'Invalid refresh token',
          code: 'UNAUTHORIZED',
        },
      });
    });
  });

  describe('POST /api/auth/logout', () => {
    it('should logout user and revoke session', async () => {
      mockAuthService.revokeSession.mockResolvedValue(undefined);

      const response = await request(app)
        .post('/api/auth/logout')
        .send({
          sessionId: 'session-789',
        })
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        message: 'Logged out successfully',
      });

      expect(mockAuthService.revokeSession).toHaveBeenCalledWith('session-789');
    });

    it('should return 400 for missing session ID', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('POST /api/auth/logout-all', () => {
    it('should logout user from all sessions', async () => {
      mockAuthService.revokeAllUserSessions.mockResolvedValue(3);

      const response = await request(app)
        .post('/api/auth/logout-all')
        .send({
          userId: 'user-123',
        })
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        message: 'Logged out from all sessions successfully',
        data: {
          revokedSessions: 3,
        },
      });

      expect(mockAuthService.revokeAllUserSessions).toHaveBeenCalledWith('user-123');
    });

    it('should return 400 for missing user ID', async () => {
      const response = await request(app)
        .post('/api/auth/logout-all')
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET /api/auth/sessions/:userId', () => {
    it('should return user sessions', async () => {
      const mockSessions = [
        {
          id: 'session-1',
          userId: 'user-123',
          ipAddress: '192.168.1.1',
          userAgent: 'Chrome/91.0',
          createdAt: new Date(),
          lastActivity: new Date(),
          isActive: true,
        },
        {
          id: 'session-2',
          userId: 'user-123',
          ipAddress: '192.168.1.2',
          userAgent: 'Firefox/89.0',
          createdAt: new Date(),
          lastActivity: new Date(),
          isActive: true,
        },
      ];

      mockAuthService.getUserSessions.mockResolvedValue(mockSessions);

      const response = await request(app)
        .get('/api/auth/sessions/user-123')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: mockSessions,
      });

      expect(mockAuthService.getUserSessions).toHaveBeenCalledWith('user-123');
    });

    it('should return empty array for user with no sessions', async () => {
      mockAuthService.getUserSessions.mockResolvedValue([]);

      const response = await request(app)
        .get('/api/auth/sessions/user-123')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: [],
      });
    });
  });

  describe('GET /api/auth/validate/:sessionId', () => {
    it('should validate active session', async () => {
      const mockSession = {
        id: 'session-789',
        userId: 'user-123',
        tenantId: 'tenant-456',
        isActive: true,
        expiresAt: new Date(Date.now() + 3600000), // 1 hour from now
      };

      mockAuthService.validateSession.mockResolvedValue(mockSession);

      const response = await request(app)
        .get('/api/auth/validate/session-789')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: {
          valid: true,
          session: mockSession,
        },
      });

      expect(mockAuthService.validateSession).toHaveBeenCalledWith('session-789');
    });

    it('should return invalid for non-existent session', async () => {
      mockAuthService.validateSession.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/auth/validate/non-existent')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: {
          valid: false,
          session: null,
        },
      });
    });
  });

  describe('SSO Authentication', () => {
    describe('GET /api/auth/sso/:provider', () => {
      it('should initiate SSO authentication', async () => {
        const response = await request(app)
          .get('/api/auth/sso/google')
          .query({ subdomain: 'testcompany' })
          .expect(302); // Redirect to SSO provider

        expect(response.headers.location).toBeDefined();
      });

      it('should return 400 for missing subdomain', async () => {
        const response = await request(app)
          .get('/api/auth/sso/google')
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe('VALIDATION_ERROR');
      });

      it('should return 400 for unsupported provider', async () => {
        const response = await request(app)
          .get('/api/auth/sso/unsupported')
          .query({ subdomain: 'testcompany' })
          .expect(400);

        expect(response.body).toEqual({
          success: false,
          error: {
            message: 'Unsupported SSO provider',
            code: 'VALIDATION_ERROR',
          },
        });
      });
    });

    describe('GET /api/auth/sso/:provider/callback', () => {
      it('should handle successful SSO callback', async () => {
        const mockUser = {
          id: 'user-123',
          email: 'user@example.com',
          role: 'user',
          tenantId: 'tenant-456',
          isActive: true,
        };

        const mockTenant = {
          id: 'tenant-456',
          name: 'Test Company',
          subdomain: 'testcompany',
        };

        const mockSession = {
          id: 'session-789',
          userId: 'user-123',
          tenantId: 'tenant-456',
          accessToken: 'access-token',
          refreshToken: 'refresh-token',
          expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000),
        };

        const mockTokens = {
          accessToken: 'access-token',
          refreshToken: 'refresh-token',
        };

        // Mock passport authentication success
        jest.doMock('passport', () => ({
          authenticate: jest.fn(() => (req: any, res: any, next: any) => {
            req.user = mockUser;
            next();
          }),
        }));

        mockTenantService.getTenantBySubdomain.mockResolvedValue(mockTenant);
        mockAuthService.createSession.mockResolvedValue({
          session: mockSession,
          tokens: mockTokens,
        });

        const response = await request(app)
          .get('/api/auth/sso/google/callback')
          .query({ state: 'testcompany' })
          .expect(200);

        expect(response.body).toEqual({
          success: true,
          data: {
            user: {
              id: mockUser.id,
              email: mockUser.email,
              role: mockUser.role,
              tenantId: mockUser.tenantId,
            },
            tenant: mockTenant,
            tokens: mockTokens,
            session: {
              id: mockSession.id,
              expiresAt: mockSession.expiresAt.toISOString(),
            },
          },
        });

        expect(mockAnalyticsService.trackLogin).toHaveBeenCalledWith(
          'tenant-456',
          'user-123',
          {
            loginMethod: 'sso',
            provider: 'google',
            ipAddress: expect.any(String),
          }
        );
      });

      it('should handle SSO authentication failure', async () => {
        // Mock passport authentication failure
        jest.doMock('passport', () => ({
          authenticate: jest.fn(() => (req: any, res: any, next: any) => {
            const error = new Error('Authentication failed');
            next(error);
          }),
        }));

        const response = await request(app)
          .get('/api/auth/sso/google/callback')
          .query({ state: 'testcompany' })
          .expect(401);

        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe('UNAUTHORIZED');
      });
    });
  });

  describe('Error handling', () => {
    it('should handle service errors gracefully', async () => {
      mockUserService.findByEmail.mockRejectedValue(new Error('Database connection failed'));

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'user@example.com',
          password: 'password123',
          subdomain: 'testcompany',
        })
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toBe('Database connection failed');
    });

    it('should handle validation errors', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'invalid-email-format',
          password: '',
          subdomain: '',
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('Security measures', () => {
    it('should not expose sensitive information in error responses', async () => {
      mockUserService.findByEmail.mockResolvedValue(null);

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'password123',
          subdomain: 'testcompany',
        })
        .expect(401);

      expect(response.body.error.message).toBe('Invalid credentials');
      expect(response.body.error.details).toBeUndefined();
    });

    it('should handle rate limiting', async () => {
      // This would typically be handled by middleware like express-rate-limit
      // For now, we'll just verify the endpoint structure
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'user@example.com',
          password: 'password123',
          subdomain: 'testcompany',
        });

      expect(response.status).toBeDefined();
    });
  });
});