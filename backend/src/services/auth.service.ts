import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { prisma } from '../lib/database';
import { SessionService, SessionData } from './session.service';
import { JWTPayload, AuthenticatedUser } from '../types';

export class AuthService {
  private readonly jwtSecret: string;
  private readonly jwtExpiresIn: string;
  private readonly refreshSecret: string;
  private readonly refreshExpiresIn: string;

  constructor() {
    this.jwtSecret = process.env.JWT_SECRET || 'fallback-secret-change-in-production';
    this.jwtExpiresIn = process.env.JWT_EXPIRES_IN || '8h';
    this.refreshSecret = process.env.JWT_REFRESH_SECRET || 'fallback-refresh-secret';
    this.refreshExpiresIn = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

    if (process.env.NODE_ENV === 'production' && this.jwtSecret.includes('fallback')) {
      throw new Error('JWT_SECRET must be set in production');
    }
  }

  /**
   * Generate JWT access token with user and tenant claims
   */
  generateToken(userId: string, tenantId: string, email: string, role: string): string {
    const payload: Omit<JWTPayload, 'iat' | 'exp'> = {
      userId,
      tenantId,
      email,
      role,
    };

    return jwt.sign(payload, this.jwtSecret, {
      expiresIn: this.jwtExpiresIn,
      issuer: 'company-directory',
      audience: 'company-directory-users',
    });
  }

  /**
   * Generate refresh token
   */
  generateRefreshToken(userId: string): string {
    const payload = { userId, type: 'refresh' };
    return jwt.sign(payload, this.refreshSecret, {
      expiresIn: this.refreshExpiresIn,
      issuer: 'company-directory',
    });
  }

  /**
   * Validate and decode JWT token
   */
  validateToken(token: string): JWTPayload {
    try {
      const decoded = jwt.verify(token, this.jwtSecret, {
        issuer: 'company-directory',
        audience: 'company-directory-users',
      }) as JWTPayload;

      return decoded;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new Error('Token expired');
      }
      if (error instanceof jwt.JsonWebTokenError) {
        throw new Error('Invalid token');
      }
      throw new Error('Token validation failed');
    }
  }

  /**
   * Validate refresh token
   */
  validateRefreshToken(token: string): { userId: string } {
    try {
      const decoded = jwt.verify(token, this.refreshSecret, {
        issuer: 'company-directory',
      }) as any;

      if (decoded.type !== 'refresh') {
        throw new Error('Invalid refresh token type');
      }

      return { userId: decoded.userId };
    } catch (error) {
      throw new Error('Invalid refresh token');
    }
  }

  /**
   * Create session in database with Redis caching
   */
  async createSession(userId: string, token: string): Promise<void> {
    const tokenHash = this.hashToken(token);
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 8); // 8 hours from now

    // Get user data for session cache
    const user = await this.getUserById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const sessionData: SessionData = {
      userId: user.id,
      tenantId: user.tenantId,
      email: user.email,
      role: user.role,
    };

    // Create session with caching
    await SessionService.createSession(userId, tokenHash, expiresAt, sessionData);
  }

  /**
   * Validate session exists and is not expired with Redis caching
   */
  async validateSession(token: string): Promise<boolean> {
    const tokenHash = this.hashToken(token);
    const sessionData = await SessionService.validateSession(tokenHash);
    return !!sessionData;
  }

  /**
   * Invalidate session (logout) with cache cleanup
   */
  async invalidateSession(token: string): Promise<void> {
    const tokenHash = this.hashToken(token);
    await SessionService.invalidateSession(tokenHash);
  }

  /**
   * Invalidate all sessions for a user with cache cleanup
   */
  async invalidateAllUserSessions(userId: string): Promise<void> {
    await SessionService.invalidateUserSessions(userId);
  }

  /**
   * Clean up expired sessions with cache cleanup
   */
  async cleanupExpiredSessions(): Promise<number> {
    return await SessionService.cleanupExpiredSessions();
  }

  /**
   * Get user by ID with tenant information
   */
  async getUserById(userId: string): Promise<AuthenticatedUser | null> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        tenant: true,
      },
    });

    if (!user) {
      return null;
    }

    return {
      id: user.id,
      tenantId: user.tenantId,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
    };
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshToken(refreshToken: string): Promise<{ accessToken: string; user: AuthenticatedUser }> {
    // Validate refresh token
    const { userId } = this.validateRefreshToken(refreshToken);

    // Get user information
    const user = await this.getUserById(userId);
    if (!user || !user.isActive) {
      throw new Error('User not found or inactive');
    }

    // Generate new access token
    const accessToken = this.generateToken(user.id, user.tenantId, user.email, user.role);

    // Create new session
    await this.createSession(user.id, accessToken);

    return { accessToken, user };
  }

  /**
   * Hash token for secure storage
   */
  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /**
   * Update user's last login timestamp
   */
  async updateLastLogin(userId: string): Promise<void> {
    await prisma.user.update({
      where: { id: userId },
      data: {
        lastLoginAt: new Date(),
      },
    });
  }

  /**
   * Find or create user from SSO provider data
   */
  async findOrCreateUserFromSSO(
    tenantId: string,
    email: string,
    externalId: string,
    userData: {
      firstName?: string;
      lastName?: string;
      title?: string;
      department?: string;
    }
  ): Promise<AuthenticatedUser> {
    // Try to find existing user by external ID or email
    let user = await prisma.user.findFirst({
      where: {
        OR: [
          { externalId },
          { tenantId, email },
        ],
      },
    });

    if (user) {
      // Update external ID if it's missing
      if (!user.externalId && externalId) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: { externalId },
        });
      }
    } else {
      // Create new user and employee profile
      user = await prisma.$transaction(async (tx) => {
        const newUser = await tx.user.create({
          data: {
            tenantId,
            email,
            externalId,
            role: 'user',
          },
        });

        // Create corresponding employee profile if we have name data
        if (userData.firstName && userData.lastName) {
          await tx.employee.create({
            data: {
              tenantId,
              userId: newUser.id,
              firstName: userData.firstName,
              lastName: userData.lastName,
              email,
              title: userData.title,
              department: userData.department,
            },
          });
        }

        return newUser;
      });
    }

    return {
      id: user.id,
      tenantId: user.tenantId,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
    };
  }
}