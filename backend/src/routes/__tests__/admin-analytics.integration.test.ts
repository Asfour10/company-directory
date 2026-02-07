import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import app from '../../index';
import { prisma } from '../../lib/database';
import { redisClient } from '../../lib/redis';
import { generateTestJWT } from '../../utils/test-helpers';

describe('Admin Analytics Endpoint Integration Tests', () => {
  let testTenant: any;
  let testUser: any;
  let testEmployee: any;
  let authToken: string;

  beforeAll(async () => {
    // Connect to Redis for testing
    try {
      await redisClient.connect();
    } catch (error) {
      console.warn('Redis not available for testing, continuing without cache');
    }

    // Create test tenant
    testTenant = await prisma.tenant.create({
      data: {
        id: 'test-tenant-analytics',
        name: 'Test Analytics Tenant',
        subdomain: 'test-analytics',
        isActive: true,
      },
    });

    // Create test user with admin role
    testUser = await prisma.user.create({
      data: {
        id: 'test-admin-user',
        email: 'admin@test-analytics.com',
        tenantId: testTenant.id,
        role: 'admin',
        isActive: true,
      },
    });

    // Create test employee
    testEmployee = await prisma.employee.create({
      data: {
        id: 'test-employee-analytics',
        tenantId: testTenant.id,
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@test-analytics.com',
        title: 'Software Engineer',
        department: 'Engineering',
        isActive: true,
      },
    });

    // Generate auth token
    authToken = generateTestJWT({
      userId: testUser.id,
      tenantId: testTenant.id,
      role: 'admin',
    });
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.analyticsEvent.deleteMany({
      where: { tenantId: testTenant.id },
    });
    await prisma.employee.deleteMany({
      where: { tenantId: testTenant.id },
    });
    await prisma.user.deleteMany({
      where: { tenantId: testTenant.id },
    });
    await prisma.tenant.delete({
      where: { id: testTenant.id },
    });

    // Disconnect Redis
    if (redisClient.isReady()) {
      await redisClient.disconnect();
    }
  });

  beforeEach(async () => {
    // Clear any cached data before each test
    if (redisClient.isReady()) {
      await redisClient.invalidatePattern(`analytics:dashboard:${testTenant.id}:*`);
    }
  });

  afterEach(async () => {
    // Clean up analytics events after each test
    await prisma.analyticsEvent.deleteMany({
      where: { tenantId: testTenant.id },
    });
  });

  describe('GET /api/admin/analytics', () => {
    it('should return dashboard analytics with default 90-day window', async () => {
      // Create some test analytics events
      await prisma.analyticsEvent.createMany({
        data: [
          {
            tenantId: testTenant.id,
            userId: testUser.id,
            eventType: 'search_query',
            metadata: { query: 'john', resultCount: 1, executionTime: 50 },
          },
          {
            tenantId: testTenant.id,
            userId: testUser.id,
            eventType: 'profile_view',
            metadata: { profileId: testEmployee.id, source: 'search' },
          },
          {
            tenantId: testTenant.id,
            userId: testUser.id,
            eventType: 'login',
            metadata: { timestamp: new Date().toISOString() },
          },
        ],
      });

      const response = await request(app)
        .get('/api/admin/analytics')
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-Tenant-ID', testTenant.id)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('period', '90 days');
      expect(response.body.data).toHaveProperty('userMetrics');
      expect(response.body.data).toHaveProperty('profileMetrics');
      expect(response.body.data).toHaveProperty('topSearchQueries');
      expect(response.body.data).toHaveProperty('mostViewedProfiles');
      expect(response.body.data).toHaveProperty('departmentDistribution');
      expect(response.body.data).toHaveProperty('roleDistribution');

      // Verify user metrics
      expect(response.body.data.userMetrics).toHaveProperty('totalUsers');
      expect(response.body.data.userMetrics).toHaveProperty('activeUsers');
      expect(response.body.data.userMetrics).toHaveProperty('activeUsersPeriod', '30 days');

      // Verify profile metrics
      expect(response.body.data.profileMetrics).toHaveProperty('completenessPercentage');
      expect(response.body.data.profileMetrics).toHaveProperty('totalProfiles');
      expect(response.body.data.profileMetrics).toHaveProperty('completeProfiles');

      // Verify arrays are present
      expect(Array.isArray(response.body.data.topSearchQueries)).toBe(true);
      expect(Array.isArray(response.body.data.mostViewedProfiles)).toBe(true);
      expect(Array.isArray(response.body.data.departmentDistribution)).toBe(true);
      expect(Array.isArray(response.body.data.roleDistribution)).toBe(true);

      // Verify cache metadata
      expect(response.body.data).toHaveProperty('cached', false);
      expect(response.body.data).toHaveProperty('cacheExpiry');
    });

    it('should accept custom days parameter', async () => {
      const response = await request(app)
        .get('/api/admin/analytics?days=30')
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-Tenant-ID', testTenant.id)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.period).toBe('30 days');
    });

    it('should limit days parameter to maximum 365', async () => {
      const response = await request(app)
        .get('/api/admin/analytics?days=500')
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-Tenant-ID', testTenant.id)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.period).toBe('365 days');
    });

    it('should limit days parameter to minimum 1', async () => {
      const response = await request(app)
        .get('/api/admin/analytics?days=0')
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-Tenant-ID', testTenant.id)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.period).toBe('1 days');
    });

    it('should return cached data on second request', async () => {
      if (!redisClient.isReady()) {
        console.log('Skipping cache test - Redis not available');
        return;
      }

      // First request - should cache the data
      const response1 = await request(app)
        .get('/api/admin/analytics')
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-Tenant-ID', testTenant.id)
        .expect(200);

      expect(response1.body.data.cached).toBe(false);

      // Second request - should return cached data
      const response2 = await request(app)
        .get('/api/admin/analytics')
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-Tenant-ID', testTenant.id)
        .expect(200);

      expect(response2.body.data.cached).toBe(true);
      
      // Data should be the same (excluding cache metadata)
      const data1 = { ...response1.body.data };
      const data2 = { ...response2.body.data };
      delete data1.cached;
      delete data1.cacheExpiry;
      delete data2.cached;
      delete data2.cacheExpiry;
      
      expect(data1).toEqual(data2);
    });

    it('should require admin role', async () => {
      // Create regular user
      const regularUser = await prisma.user.create({
        data: {
          id: 'test-regular-user',
          email: 'user@test-analytics.com',
          tenantId: testTenant.id,
          role: 'user',
          isActive: true,
        },
      });

      const userToken = generateTestJWT({
        userId: regularUser.id,
        tenantId: testTenant.id,
        role: 'user',
      });

      await request(app)
        .get('/api/admin/analytics')
        .set('Authorization', `Bearer ${userToken}`)
        .set('X-Tenant-ID', testTenant.id)
        .expect(403);

      // Clean up
      await prisma.user.delete({
        where: { id: regularUser.id },
      });
    });

    it('should require authentication', async () => {
      await request(app)
        .get('/api/admin/analytics')
        .set('X-Tenant-ID', testTenant.id)
        .expect(401);
    });

    it('should require tenant context', async () => {
      await request(app)
        .get('/api/admin/analytics')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);
    });

    it('should handle analytics service errors gracefully', async () => {
      // Use invalid tenant ID to trigger error
      const invalidToken = generateTestJWT({
        userId: testUser.id,
        tenantId: 'invalid-tenant-id',
        role: 'admin',
      });

      await request(app)
        .get('/api/admin/analytics')
        .set('Authorization', `Bearer ${invalidToken}`)
        .set('X-Tenant-ID', 'invalid-tenant-id')
        .expect(500);
    });

    it('should include top search queries when available', async () => {
      // Create search query events
      await prisma.analyticsEvent.createMany({
        data: [
          {
            tenantId: testTenant.id,
            userId: testUser.id,
            eventType: 'search_query',
            metadata: { query: 'john', resultCount: 5, executionTime: 50 },
          },
          {
            tenantId: testTenant.id,
            userId: testUser.id,
            eventType: 'search_query',
            metadata: { query: 'engineer', resultCount: 3, executionTime: 75 },
          },
          {
            tenantId: testTenant.id,
            userId: testUser.id,
            eventType: 'search_query',
            metadata: { query: 'john', resultCount: 5, executionTime: 45 },
          },
        ],
      });

      const response = await request(app)
        .get('/api/admin/analytics')
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-Tenant-ID', testTenant.id)
        .expect(200);

      expect(response.body.data.topSearchQueries).toHaveLength(2);
      expect(response.body.data.topSearchQueries[0]).toEqual({
        query: 'john',
        count: 2,
      });
      expect(response.body.data.topSearchQueries[1]).toEqual({
        query: 'engineer',
        count: 1,
      });
    });

    it('should include most viewed profiles when available', async () => {
      // Create profile view events
      await prisma.analyticsEvent.createMany({
        data: [
          {
            tenantId: testTenant.id,
            userId: testUser.id,
            eventType: 'profile_view',
            metadata: { profileId: testEmployee.id, source: 'search' },
          },
          {
            tenantId: testTenant.id,
            userId: testUser.id,
            eventType: 'profile_view',
            metadata: { profileId: testEmployee.id, source: 'direct' },
          },
        ],
      });

      const response = await request(app)
        .get('/api/admin/analytics')
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-Tenant-ID', testTenant.id)
        .expect(200);

      expect(response.body.data.mostViewedProfiles).toHaveLength(1);
      expect(response.body.data.mostViewedProfiles[0]).toEqual({
        profileId: testEmployee.id,
        viewCount: 2,
        employee: {
          firstName: 'John',
          lastName: 'Doe',
          title: 'Software Engineer',
          department: 'Engineering',
        },
      });
    });

    it('should include department and role distribution', async () => {
      // Create additional employees for distribution
      await prisma.employee.createMany({
        data: [
          {
            tenantId: testTenant.id,
            firstName: 'Jane',
            lastName: 'Smith',
            email: 'jane.smith@test-analytics.com',
            title: 'Product Manager',
            department: 'Product',
            isActive: true,
          },
          {
            tenantId: testTenant.id,
            firstName: 'Bob',
            lastName: 'Johnson',
            email: 'bob.johnson@test-analytics.com',
            title: 'Software Engineer',
            department: 'Engineering',
            isActive: true,
          },
        ],
      });

      const response = await request(app)
        .get('/api/admin/analytics')
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-Tenant-ID', testTenant.id)
        .expect(200);

      // Check department distribution
      expect(response.body.data.departmentDistribution).toContainEqual({
        department: 'Engineering',
        count: 2,
      });
      expect(response.body.data.departmentDistribution).toContainEqual({
        department: 'Product',
        count: 1,
      });

      // Check role distribution
      expect(response.body.data.roleDistribution).toContainEqual({
        title: 'Software Engineer',
        count: 2,
      });
      expect(response.body.data.roleDistribution).toContainEqual({
        title: 'Product Manager',
        count: 1,
      });
    });
  });
});