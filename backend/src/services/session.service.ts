import { prisma } from '../lib/database';
import { redisClient } from '../lib/redis';
import crypto from 'crypto';

export interface SessionData {
  userId: string;
  tenantId: string;
  email: string;
  role: string;
}

/**
 * Service for managing user sessions and JWT tokens
 * Handles session storage, validation, and cleanup with Redis caching
 */
export class SessionService {
  /**
   * Create a new session record with Redis caching
   */
  static async createSession(
    userId: string,
    tokenHash: string,
    expiresAt: Date,
    sessionData: SessionData
  ): Promise<void> {
    // Store in database
    await prisma.session.create({
      data: {
        userId,
        tokenHash,
        expiresAt,
      },
    });

    // Cache session data in Redis with 8-hour TTL
    const sessionId = tokenHash;
    await redisClient.setSession(userId, sessionId, sessionData);
  }

  /**
   * Validate a session token with Redis caching
   */
  static async validateSession(tokenHash: string): Promise<SessionData | null> {
    // First, try to get from Redis cache
    const userId = await this.getUserIdFromTokenHash(tokenHash);
    if (userId) {
      const cachedSession = await redisClient.getSession(userId, tokenHash);
      if (cachedSession) {
        return cachedSession;
      }
    }

    // If not in cache, get from database
    const session = await prisma.session.findFirst({
      where: {
        tokenHash,
        expiresAt: {
          gt: new Date(),
        },
      },
      include: {
        user: {
          include: {
            tenant: true,
          },
        },
      },
    });

    if (!session || !session.user) {
      return null;
    }

    const sessionData: SessionData = {
      userId: session.user.id,
      tenantId: session.user.tenantId,
      email: session.user.email,
      role: session.user.role,
    };

    // Cache the session data for future requests
    await redisClient.setSession(session.user.id, tokenHash, sessionData);

    return sessionData;
  }

  /**
   * Helper method to extract user ID from token hash (for cache lookup)
   */
  private static async getUserIdFromTokenHash(tokenHash: string): Promise<string | null> {
    try {
      const session = await prisma.session.findFirst({
        where: { tokenHash },
        select: { userId: true },
      });
      return session?.userId || null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Invalidate a specific session with cache cleanup
   */
  static async invalidateSession(tokenHash: string): Promise<void> {
    // Get user ID before deleting from database
    const userId = await this.getUserIdFromTokenHash(tokenHash);
    
    // Delete from database
    await prisma.session.deleteMany({
      where: {
        tokenHash,
      },
    });

    // Remove from Redis cache
    if (userId) {
      await redisClient.deleteSession(userId, tokenHash);
    }
  }

  /**
   * Invalidate all sessions for a user with cache cleanup
   */
  static async invalidateUserSessions(userId: string): Promise<void> {
    // Delete from database
    await prisma.session.deleteMany({
      where: {
        userId,
      },
    });

    // Remove all user sessions from Redis cache
    await redisClient.deleteUserSessions(userId);
  }

  /**
   * Clean up expired sessions
   */
  static async cleanupExpiredSessions(): Promise<number> {
    const result = await prisma.session.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    });

    return result.count;
  }

  /**
   * Get active sessions for a user
   */
  static async getUserSessions(userId: string) {
    return prisma.session.findMany({
      where: {
        userId,
        expiresAt: {
          gt: new Date(),
        },
      },
      select: {
        id: true,
        createdAt: true,
        expiresAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  /**
   * Hash a token for secure storage
   */
  static hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /**
   * Update user's last login timestamp
   */
  static async updateLastLogin(userId: string): Promise<void> {
    await prisma.user.update({
      where: { id: userId },
      data: { lastLoginAt: new Date() },
    });
  }

  /**
   * Get session statistics for a tenant
   */
  static async getSessionStatistics(tenantId: string) {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [activeSessions, dailyLogins, weeklyLogins] = await Promise.all([
      // Active sessions
      prisma.session.count({
        where: {
          user: { tenantId },
          expiresAt: { gt: now },
        },
      }),
      // Daily logins (unique users)
      prisma.user.count({
        where: {
          tenantId,
          lastLoginAt: { gte: oneDayAgo },
        },
      }),
      // Weekly logins (unique users)
      prisma.user.count({
        where: {
          tenantId,
          lastLoginAt: { gte: oneWeekAgo },
        },
      }),
    ]);

    return {
      activeSessions,
      dailyActiveUsers: dailyLogins,
      weeklyActiveUsers: weeklyLogins,
    };
  }
}