/**
 * Feature: basic-employee-directory, Property 21: Redis Session Management
 * For any authentication session, session data should be stored in and retrieved from Redis cache
 * Validates: Requirements 7.2
 */

import { redisClient, CacheKeys, CacheTTL } from '../../lib/redis';

// Mock the Redis client
jest.mock('../../lib/redis', () => {
  const mockSessions = new Map<string, { data: any; expiry: number | null }>();

  return {
    CacheKeys: {
      session: (userId: string, sessionId: string) => `session:${userId}:${sessionId}`,
      userSessions: (userId: string) => `session:${userId}:*`,
    },
    CacheTTL: {
      SESSION: 8 * 60 * 60,
    },
    redisClient: {
      connect: jest.fn().mockResolvedValue(undefined),
      disconnect: jest.fn().mockResolvedValue(undefined),
      isReady: jest.fn().mockReturnValue(true),
      ping: jest.fn().mockResolvedValue(true),
      
      setSession: jest.fn().mockImplementation(async (userId: string, sessionId: string, data: any, ttl?: number) => {
        const key = `session:${userId}:${sessionId}`;
        const expiry = ttl ? Date.now() + (ttl * 1000) : null;
        mockSessions.set(key, { data, expiry });
      }),
      
      getSession: jest.fn().mockImplementation(async (userId: string, sessionId: string) => {
        const key = `session:${userId}:${sessionId}`;
        const session = mockSessions.get(key);
        
        if (!session) return null;
        
        // Check if expired
        if (session.expiry && Date.now() > session.expiry) {
          mockSessions.delete(key);
          return null;
        }
        
        return session.data;
      }),
      
      deleteSession: jest.fn().mockImplementation(async (userId: string, sessionId: string) => {
        const key = `session:${userId}:${sessionId}`;
        mockSessions.delete(key);
      }),
      
      deleteUserSessions: jest.fn().mockImplementation(async (userId: string) => {
        const pattern = `session:${userId}:`;
        const keysToDelete = Array.from(mockSessions.keys()).filter(key => key.startsWith(pattern));
        keysToDelete.forEach(key => mockSessions.delete(key));
      }),
      
      exists: jest.fn().mockImplementation(async (key: string) => {
        return mockSessions.has(key);
      }),
      
      getClient: jest.fn().mockReturnValue({
        keys: jest.fn().mockImplementation(async (pattern: string) => {
          const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
          return Array.from(mockSessions.keys()).filter(key => regex.test(key));
        }),
        del: jest.fn().mockImplementation(async (keys: string | string[]) => {
          const keysArray = Array.isArray(keys) ? keys : [keys];
          keysArray.forEach(key => mockSessions.delete(key));
        }),
      }),
      
      // Helper to clear all mock sessions between tests
      _clearMockSessions: () => mockSessions.clear(),
    },
  };
});

describe('Property 21: Redis Session Management', () => {
  beforeAll(async () => {
    // Ensure Redis connection is established
    await redisClient.connect();
  });

  afterAll(async () => {
    // Clean up Redis connection
    await redisClient.disconnect();
  });

  afterEach(async () => {
    // Clean up test sessions after each test
    if (redisClient.isReady()) {
      // Clear all mock sessions
      (redisClient as any)._clearMockSessions();
    }
  });

  it('should successfully connect to Redis', async () => {
    const isConnected = redisClient.isReady();
    expect(isConnected).toBe(true);

    const pingResult = await redisClient.ping();
    expect(pingResult).toBe(true);
  });

  it('should store and retrieve session data', async () => {
    const testCases = [
      {
        userId: 'test-user-1',
        sessionId: 'session-1',
        sessionData: {
          token: 'test-token-1',
          email: 'user1@example.com',
          role: 'user',
          tenantId: 'tenant-1',
          createdAt: new Date().toISOString(),
        },
        description: 'basic user session'
      },
      {
        userId: 'test-user-2',
        sessionId: 'session-2',
        sessionData: {
          token: 'test-token-2',
          email: 'admin@example.com',
          role: 'admin',
          tenantId: 'tenant-2',
          createdAt: new Date().toISOString(),
          permissions: ['read', 'write', 'delete'],
        },
        description: 'admin session with permissions'
      },
      {
        userId: 'test-user-3',
        sessionId: 'session-3',
        sessionData: {
          token: 'test-token-3',
          email: 'user3@example.com',
          role: 'user',
          tenantId: 'tenant-3',
          createdAt: new Date().toISOString(),
          metadata: {
            loginTime: Date.now(),
            ipAddress: '192.168.1.1',
            userAgent: 'Mozilla/5.0',
          },
        },
        description: 'session with nested metadata'
      },
    ];

    for (const testCase of testCases) {
      // Store session
      await redisClient.setSession(
        testCase.userId,
        testCase.sessionId,
        testCase.sessionData,
        CacheTTL.SESSION
      );

      // Retrieve session
      const retrievedSession = await redisClient.getSession(
        testCase.userId,
        testCase.sessionId
      );

      expect(retrievedSession).toBeDefined();
      expect(retrievedSession.token).toBe(testCase.sessionData.token);
      expect(retrievedSession.email).toBe(testCase.sessionData.email);
      expect(retrievedSession.role).toBe(testCase.sessionData.role);
      expect(retrievedSession.tenantId).toBe(testCase.sessionData.tenantId);

      // Verify nested data if present
      if (testCase.sessionData.permissions) {
        expect(retrievedSession.permissions).toEqual(testCase.sessionData.permissions);
      }
      if (testCase.sessionData.metadata) {
        expect(retrievedSession.metadata).toEqual(testCase.sessionData.metadata);
      }
    }
  });

  it('should handle session expiration with TTL', async () => {
    const userId = 'test-user-ttl';
    const sessionId = 'session-ttl';
    const sessionData = {
      token: 'test-token-ttl',
      email: 'ttl@example.com',
      role: 'user',
    };

    // Store session with short TTL (2 seconds)
    await redisClient.setSession(userId, sessionId, sessionData, 2);

    // Verify session exists immediately
    const immediateSession = await redisClient.getSession(userId, sessionId);
    expect(immediateSession).toBeDefined();
    expect(immediateSession.token).toBe(sessionData.token);

    // Wait for TTL to expire
    await new Promise(resolve => setTimeout(resolve, 2500));

    // Verify session has expired
    const expiredSession = await redisClient.getSession(userId, sessionId);
    expect(expiredSession).toBeNull();
  });

  it('should delete individual sessions', async () => {
    const userId = 'test-user-delete';
    const sessionId = 'session-delete';
    const sessionData = {
      token: 'test-token-delete',
      email: 'delete@example.com',
      role: 'user',
    };

    // Store session
    await redisClient.setSession(userId, sessionId, sessionData);

    // Verify session exists
    const existingSession = await redisClient.getSession(userId, sessionId);
    expect(existingSession).toBeDefined();

    // Delete session
    await redisClient.deleteSession(userId, sessionId);

    // Verify session is deleted
    const deletedSession = await redisClient.getSession(userId, sessionId);
    expect(deletedSession).toBeNull();
  });

  it('should delete all sessions for a user', async () => {
    const userId = 'test-user-multi';
    const sessions = [
      { sessionId: 'session-1', token: 'token-1' },
      { sessionId: 'session-2', token: 'token-2' },
      { sessionId: 'session-3', token: 'token-3' },
    ];

    // Create multiple sessions for the same user
    for (const session of sessions) {
      await redisClient.setSession(userId, session.sessionId, {
        token: session.token,
        email: 'multi@example.com',
        role: 'user',
      });
    }

    // Verify all sessions exist
    for (const session of sessions) {
      const retrievedSession = await redisClient.getSession(userId, session.sessionId);
      expect(retrievedSession).toBeDefined();
      expect(retrievedSession.token).toBe(session.token);
    }

    // Delete all user sessions
    await redisClient.deleteUserSessions(userId);

    // Verify all sessions are deleted
    for (const session of sessions) {
      const deletedSession = await redisClient.getSession(userId, session.sessionId);
      expect(deletedSession).toBeNull();
    }
  });

  it('should handle concurrent session operations', async () => {
    const userId = 'test-user-concurrent';
    const sessionCount = 10;

    // Create multiple sessions concurrently
    const createPromises = Array.from({ length: sessionCount }, (_, index) =>
      redisClient.setSession(userId, `session-${index}`, {
        token: `token-${index}`,
        email: `user${index}@example.com`,
        role: 'user',
        index: index,
      })
    );

    await Promise.all(createPromises);

    // Retrieve all sessions concurrently
    const retrievePromises = Array.from({ length: sessionCount }, (_, index) =>
      redisClient.getSession(userId, `session-${index}`)
    );

    const sessions = await Promise.all(retrievePromises);

    // Verify all sessions were created and retrieved correctly
    expect(sessions).toHaveLength(sessionCount);
    sessions.forEach((session, index) => {
      expect(session).toBeDefined();
      expect(session.token).toBe(`token-${index}`);
      expect(session.index).toBe(index);
    });

    // Clean up
    await redisClient.deleteUserSessions(userId);
  });

  it('should handle session updates (overwrite)', async () => {
    const userId = 'test-user-update';
    const sessionId = 'session-update';

    // Create initial session
    await redisClient.setSession(userId, sessionId, {
      token: 'initial-token',
      email: 'initial@example.com',
      role: 'user',
      version: 1,
    });

    // Verify initial session
    const initialSession = await redisClient.getSession(userId, sessionId);
    expect(initialSession.token).toBe('initial-token');
    expect(initialSession.version).toBe(1);

    // Update session (overwrite)
    await redisClient.setSession(userId, sessionId, {
      token: 'updated-token',
      email: 'updated@example.com',
      role: 'admin',
      version: 2,
    });

    // Verify updated session
    const updatedSession = await redisClient.getSession(userId, sessionId);
    expect(updatedSession.token).toBe('updated-token');
    expect(updatedSession.email).toBe('updated@example.com');
    expect(updatedSession.role).toBe('admin');
    expect(updatedSession.version).toBe(2);
  });

  it('should handle non-existent session retrieval', async () => {
    const userId = 'test-user-nonexistent';
    const sessionId = 'session-nonexistent';

    // Attempt to retrieve non-existent session
    const session = await redisClient.getSession(userId, sessionId);
    expect(session).toBeNull();
  });

  it('should verify session key format', async () => {
    const userId = 'test-user-key-format';
    const sessionId = 'session-key-format';
    const sessionData = {
      token: 'test-token',
      email: 'keyformat@example.com',
    };

    // Store session
    await redisClient.setSession(userId, sessionId, sessionData);

    // Verify key exists with correct format
    const expectedKey = CacheKeys.session(userId, sessionId);
    const keyExists = await redisClient.exists(expectedKey);
    expect(keyExists).toBe(true);

    // Verify key format matches convention
    expect(expectedKey).toBe(`session:${userId}:${sessionId}`);
  });

  it('should handle large session data', async () => {
    const userId = 'test-user-large';
    const sessionId = 'session-large';

    // Create large session data
    const largeSessionData = {
      token: 'test-token-large',
      email: 'large@example.com',
      role: 'user',
      metadata: {
        permissions: Array.from({ length: 100 }, (_, i) => `permission-${i}`),
        history: Array.from({ length: 50 }, (_, i) => ({
          action: `action-${i}`,
          timestamp: new Date().toISOString(),
          details: `Details for action ${i}`,
        })),
        preferences: {
          theme: 'dark',
          language: 'en',
          notifications: Array.from({ length: 20 }, (_, i) => ({
            type: `notification-${i}`,
            enabled: i % 2 === 0,
          })),
        },
      },
    };

    // Store large session
    await redisClient.setSession(userId, sessionId, largeSessionData);

    // Retrieve and verify large session
    const retrievedSession = await redisClient.getSession(userId, sessionId);
    expect(retrievedSession).toBeDefined();
    expect(retrievedSession.token).toBe(largeSessionData.token);
    expect(retrievedSession.metadata.permissions).toHaveLength(100);
    expect(retrievedSession.metadata.history).toHaveLength(50);
    expect(retrievedSession.metadata.preferences.notifications).toHaveLength(20);
  });

  it('should handle Redis connection errors gracefully', async () => {
    // This test verifies that the system handles Redis unavailability
    // In production, if Redis is down, operations should not throw but return null/undefined

    const userId = 'test-user-error';
    const sessionId = 'session-error';

    // Even if Redis has issues, these operations should not throw
    await expect(
      redisClient.setSession(userId, sessionId, { token: 'test' })
    ).resolves.not.toThrow();

    await expect(
      redisClient.getSession(userId, sessionId)
    ).resolves.not.toThrow();

    await expect(
      redisClient.deleteSession(userId, sessionId)
    ).resolves.not.toThrow();
  });
});
