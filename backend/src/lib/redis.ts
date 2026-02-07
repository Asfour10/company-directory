import { createClient, RedisClientType } from 'redis';
import { metricsService } from '../services/metrics.service';

/**
 * Cache key naming conventions
 */
export const CacheKeys = {
  // Session keys
  session: (userId: string, sessionId: string) => `session:${userId}:${sessionId}`,
  userSessions: (userId: string) => `session:${userId}:*`,
  
  // Employee profile keys
  employee: (tenantId: string, employeeId: string) => `employee:${tenantId}:${employeeId}`,
  employeeList: (tenantId: string, page: number, pageSize: number) => `employees:${tenantId}:${page}:${pageSize}`,
  employeesByTenant: (tenantId: string) => `employee:${tenantId}:*`,
  
  // Search result keys
  search: (tenantId: string, queryHash: string) => `search:${tenantId}:${queryHash}`,
  searchByTenant: (tenantId: string) => `search:${tenantId}:*`,
  
  // Tenant configuration keys
  tenant: (tenantId: string) => `tenant:${tenantId}`,
  tenantBranding: (tenantId: string) => `tenant:branding:${tenantId}`,
  tenantSettings: (tenantId: string) => `tenant:settings:${tenantId}`,
  
  // Analytics keys
  analytics: (tenantId: string, type: string) => `analytics:${tenantId}:${type}`,
  analyticsByTenant: (tenantId: string) => `analytics:${tenantId}:*`,
} as const;

/**
 * Cache TTL constants (in seconds)
 */
export const CacheTTL = {
  SESSION: 8 * 60 * 60, // 8 hours
  EMPLOYEE_PROFILE: 5 * 60, // 5 minutes
  SEARCH_RESULTS: 5 * 60, // 5 minutes
  TENANT_CONFIG: 60 * 60, // 1 hour
  ANALYTICS: 60 * 60, // 1 hour
} as const;

class RedisClient {
  private client: RedisClientType | null = null;
  private isConnected = false;

  async connect(): Promise<void> {
    if (this.isConnected && this.client) {
      return;
    }

    try {
      const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
      
      this.client = createClient({
        url: redisUrl,
        socket: {
          reconnectStrategy: (retries) => Math.min(retries * 50, 1000),
          connectTimeout: 10000,
        },
        // Connection pooling configuration
        isolationPoolOptions: {
          min: 2,
          max: 10,
        },
      });

      this.client.on('error', (err) => {
        console.error('Redis Client Error:', err);
        this.isConnected = false;
      });

      this.client.on('connect', () => {
        console.log('Redis Client Connected');
        this.isConnected = true;
      });

      this.client.on('disconnect', () => {
        console.log('Redis Client Disconnected');
        this.isConnected = false;
      });

      this.client.on('reconnecting', () => {
        console.log('Redis Client Reconnecting...');
      });

      await this.client.connect();
    } catch (error) {
      console.error('Failed to connect to Redis:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.disconnect();
      this.client = null;
      this.isConnected = false;
    }
  }

  getClient(): RedisClientType {
    if (!this.client || !this.isConnected) {
      throw new Error('Redis client not connected');
    }
    return this.client;
  }

  isReady(): boolean {
    return this.isConnected && this.client !== null;
  }

  // Session management methods
  async setSession(userId: string, sessionId: string, value: any, ttlSeconds: number = CacheTTL.SESSION): Promise<void> {
    if (!this.isReady()) return;
    
    try {
      const key = CacheKeys.session(userId, sessionId);
      await this.client!.setEx(key, ttlSeconds, JSON.stringify(value));
    } catch (error) {
      console.error('Redis setSession error:', error);
    }
  }

  async getSession(userId: string, sessionId: string): Promise<any | null> {
    if (!this.isReady()) return null;
    
    try {
      const key = CacheKeys.session(userId, sessionId);
      const value = await this.client!.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.error('Redis getSession error:', error);
      return null;
    }
  }

  async deleteSession(userId: string, sessionId: string): Promise<void> {
    if (!this.isReady()) return;
    
    try {
      const key = CacheKeys.session(userId, sessionId);
      await this.client!.del(key);
    } catch (error) {
      console.error('Redis deleteSession error:', error);
    }
  }

  async deleteUserSessions(userId: string): Promise<void> {
    if (!this.isReady()) return;
    
    try {
      const pattern = CacheKeys.userSessions(userId);
      const keys = await this.client!.keys(pattern);
      if (keys.length > 0) {
        await this.client!.del(keys);
      }
    } catch (error) {
      console.error('Redis deleteUserSessions error:', error);
    }
  }

  // Cache management methods
  async set(key: string, value: any, ttlSeconds?: number): Promise<void> {
    if (!this.isReady()) return;
    
    try {
      const serialized = JSON.stringify(value);
      if (ttlSeconds) {
        await this.client!.setEx(key, ttlSeconds, serialized);
      } else {
        await this.client!.set(key, serialized);
      }
    } catch (error) {
      console.error('Redis set error:', error);
    }
  }

  async get(key: string): Promise<any | null> {
    if (!this.isReady()) return null;
    
    try {
      const value = await this.client!.get(key);
      const result = value ? JSON.parse(value) : null;
      
      // Record cache metrics
      if (result !== null) {
        metricsService.recordCacheHit('redis');
      } else {
        metricsService.recordCacheMiss('redis');
      }
      
      return result;
    } catch (error) {
      console.error('Redis get error:', error);
      metricsService.recordCacheMiss('redis');
      return null;
    }
  }

  async del(key: string): Promise<void> {
    if (!this.isReady()) return;
    
    try {
      await this.client!.del(key);
    } catch (error) {
      console.error('Redis del error:', error);
    }
  }

  async exists(key: string): Promise<boolean> {
    if (!this.isReady()) return false;
    
    try {
      const result = await this.client!.exists(key);
      return result === 1;
    } catch (error) {
      console.error('Redis exists error:', error);
      return false;
    }
  }

  async invalidatePattern(pattern: string): Promise<void> {
    if (!this.isReady()) return;
    
    try {
      const keys = await this.client!.keys(pattern);
      if (keys.length > 0) {
        await this.client!.del(keys);
      }
    } catch (error) {
      console.error('Redis invalidatePattern error:', error);
    }
  }

  // Employee profile cache methods
  async setEmployeeProfile(tenantId: string, employeeId: string, profile: any): Promise<void> {
    const key = CacheKeys.employee(tenantId, employeeId);
    await this.set(key, profile, CacheTTL.EMPLOYEE_PROFILE);
  }

  async getEmployeeProfile(tenantId: string, employeeId: string): Promise<any | null> {
    const key = CacheKeys.employee(tenantId, employeeId);
    return this.get(key);
  }

  async invalidateEmployeeProfile(tenantId: string, employeeId: string): Promise<void> {
    const key = CacheKeys.employee(tenantId, employeeId);
    await this.del(key);
  }

  async invalidateEmployeesByTenant(tenantId: string): Promise<void> {
    const pattern = CacheKeys.employeesByTenant(tenantId);
    await this.invalidatePattern(pattern);
  }

  // Search results cache methods
  async setSearchResults(tenantId: string, queryHash: string, results: any): Promise<void> {
    const key = CacheKeys.search(tenantId, queryHash);
    await this.set(key, results, CacheTTL.SEARCH_RESULTS);
  }

  async getSearchResults(tenantId: string, queryHash: string): Promise<any | null> {
    const key = CacheKeys.search(tenantId, queryHash);
    return this.get(key);
  }

  async invalidateSearchByTenant(tenantId: string): Promise<void> {
    const pattern = CacheKeys.searchByTenant(tenantId);
    await this.invalidatePattern(pattern);
  }

  // Tenant configuration cache methods
  async setTenantConfig(tenantId: string, config: any): Promise<void> {
    const key = CacheKeys.tenant(tenantId);
    await this.set(key, config, CacheTTL.TENANT_CONFIG);
  }

  async getTenantConfig(tenantId: string): Promise<any | null> {
    const key = CacheKeys.tenant(tenantId);
    return this.get(key);
  }

  async setTenantBranding(tenantId: string, branding: any): Promise<void> {
    const key = CacheKeys.tenantBranding(tenantId);
    await this.set(key, branding, CacheTTL.TENANT_CONFIG);
  }

  async getTenantBranding(tenantId: string): Promise<any | null> {
    const key = CacheKeys.tenantBranding(tenantId);
    return this.get(key);
  }

  async invalidateTenantConfig(tenantId: string): Promise<void> {
    const keys = [
      CacheKeys.tenant(tenantId),
      CacheKeys.tenantBranding(tenantId),
      CacheKeys.tenantSettings(tenantId),
    ];
    
    for (const key of keys) {
      await this.del(key);
    }
  }

  // Analytics cache methods
  async setAnalytics(tenantId: string, type: string, data: any): Promise<void> {
    const key = CacheKeys.analytics(tenantId, type);
    await this.set(key, data, CacheTTL.ANALYTICS);
  }

  async getAnalytics(tenantId: string, type: string): Promise<any | null> {
    const key = CacheKeys.analytics(tenantId, type);
    return this.get(key);
  }

  async invalidateAnalyticsByTenant(tenantId: string): Promise<void> {
    const pattern = CacheKeys.analyticsByTenant(tenantId);
    await this.invalidatePattern(pattern);
  }

  // Health check method
  async ping(): Promise<boolean> {
    if (!this.isReady()) return false;
    
    try {
      const result = await this.client!.ping();
      return result === 'PONG';
    } catch (error) {
      console.error('Redis ping error:', error);
      return false;
    }
  }

  // Get cache statistics
  async getStats(): Promise<any> {
    if (!this.isReady()) return null;
    
    try {
      const info = await this.client!.info('memory');
      const keyspace = await this.client!.info('keyspace');
      
      return {
        memory: info,
        keyspace: keyspace,
        connected: this.isConnected,
      };
    } catch (error) {
      console.error('Redis getStats error:', error);
      return null;
    }
  }
}

// Create singleton instance
const redisClient = new RedisClient();

export { redisClient };

// Graceful shutdown
process.on('SIGINT', async () => {
  await redisClient.disconnect();
});

process.on('SIGTERM', async () => {
  await redisClient.disconnect();
});