import request from 'supertest';
import express from 'express';
import analyticsRoutes from '../analytics.routes';
import { prisma } from '../../lib/database';
import { createErrorHandler } from '../../utils/errors';

// Mock the analytics service
jest.mock('../../services/analytics.service', () => ({
  AnalyticsService: {
    getAnalyticsSummary: jest.fn(),
    getSearchAnalytics: jest.fn(),
    getProfileAnalytics: jest.fn(),
    getUserActivityAnalytics: jest.fn(),
    getDashboardAnalytics: jest.fn(),
    getDetailedAnalytics: jest.fn(),
    cleanupOldEvents: jest.fn(),
  },
}));

// Mock the database
jest.mock('../../lib/database', () => ({
  prisma: {
    tenant: {
      findUnique: jest.fn(),
    },
  },
}));

import { AnalyticsService } from '../../services/analytics.service';

const mockAnalyticsService = AnalyticsService as jest.Mocked<typeof AnalyticsService>;
const mockPrisma = prisma as jest.Mocked<typeof prisma>;

// Create test app
const app = express();
app.use(express.json());

// Mock middleware
app.use((req, res, next) => {
  req.tenant = { id: 'test-tenant-id', name: 'Test Tenant' };
  req.user = { 
    id: 'test-user-id', 
    email: 'admin@test.com', 
    role: 'admin',
    tenantId: 'test-tenant-id'
  };
  next();
});

app.use('/api/analytics', analyticsRoutes);
app.use(createErrorHandler());

describe('Analytics Routes Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/analytics/summary', () => {
    it('should return analytics summary for admin users', async () => {
      const mockSummary = {
        period: '30 days',
        summary: {
          totalSearches: 150,
          uniqueSearchQueries: 45,
          totalProfileViews: 300,
          totalProfileUpdates: 25,
          totalLogins: 80,
        },
        topSearchQueries: [
          { query: 'john doe', count: 15 },
          { query: 'engineering', count: 12 },
        ],
        mostViewedProfiles: [
          { profileId: 'profile-1', count: 25 },
          { profileId: 'profile-2', count: 18 },
        ],
      };

      mockAnalyticsService.getAnalyticsSummary.mockResolvedValue(mockSummary);

      const response = await request(app)
        .get('/api/analytics/summary')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: mockSummary,
      });

      expect(mockAnalyticsService.getAnalyticsSummary).toHaveBeenCalledWith('test-tenant-id', 30);
    });

    it('should accept custom days parameter', async () => {
      const mockSummary = {
        period: '7 days',
        summary: {
          totalSearches: 50,
          uniqueSearchQueries: 20,
          totalProfileViews: 100,
          totalProfileUpdates: 10,
          totalLogins: 25,
        },
        topSearchQueries: [],
        mostViewedProfiles: [],
      };

      mockAnalyticsService.getAnalyticsSummary.mockResolvedValue(mockSummary);

      const response = await request(app)
        .get('/api/analytics/summary?days=7')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(mockAnalyticsService.getAnalyticsSummary).toHaveBeenCalledWith('test-tenant-id', 7);
    });

    it('should limit days parameter to maximum 365', async () => {
      mockAnalyticsService.getAnalyticsSummary.mockResolvedValue({
        period: '365 days',
        summary: { totalSearches: 0, uniqueSearchQueries: 0, totalProfileViews: 0, totalProfileUpdates: 0, totalLogins: 0 },
        topSearchQueries: [],
        mostViewedProfiles: [],
      });

      await request(app)
        .get('/api/analytics/summary?days=500')
        .expect(200);

      expect(mockAnalyticsService.getAnalyticsSummary).toHaveBeenCalledWith('test-tenant-id', 365);
    });

    it('should require admin access', async () => {
      const userApp = express();
      userApp.use(express.json());
      userApp.use((req, res, next) => {
        req.tenant = { id: 'test-tenant-id', name: 'Test Tenant' };
        req.user = { 
          id: 'test-user-id', 
          email: 'user@test.com', 
          role: 'user',
          tenantId: 'test-tenant-id'
        };
        next();
      });
      userApp.use('/api/analytics', analyticsRoutes);

      await request(userApp)
        .get('/api/analytics/summary')
        .expect(403);
    });
  });

  describe('GET /api/analytics/search', () => {
    it('should return search analytics', async () => {
      const mockSearchAnalytics = {
        period: '30 days',
        statistics: {
          totalSearches: 200,
          uniqueQueries: 75,
          averageResults: 5,
          averageExecutionTime: 125,
        },
        topQueries: [
          { query: 'developer', count: 25, averageResults: 8, averageExecutionTime: 110 },
        ],
        trends: [
          { date: '2024-01-01', searchCount: 15 },
        ],
      };

      mockAnalyticsService.getSearchAnalytics.mockResolvedValue(mockSearchAnalytics);

      const response = await request(app)
        .get('/api/analytics/search')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: mockSearchAnalytics,
      });
    });
  });

  describe('GET /api/analytics/profiles', () => {
    it('should return profile analytics', async () => {
      const mockProfileAnalytics = {
        period: '30 days',
        statistics: {
          totalViews: 500,
          totalUpdates: 75,
          uniqueProfilesViewed: 150,
          uniqueProfilesUpdated: 45,
        },
        mostViewedProfiles: [
          {
            profileId: 'profile-1',
            viewCount: 35,
            employee: {
              firstName: 'John',
              lastName: 'Doe',
              title: 'Developer',
              department: 'Engineering',
            },
          },
        ],
        activity: [
          { date: '2024-01-01', views: 25, updates: 5 },
        ],
      };

      mockAnalyticsService.getProfileAnalytics.mockResolvedValue(mockProfileAnalytics);

      const response = await request(app)
        .get('/api/analytics/profiles')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: mockProfileAnalytics,
      });
    });
  });

  describe('GET /api/analytics/users', () => {
    it('should return user activity analytics', async () => {
      const mockUserAnalytics = {
        period: '30 days',
        statistics: {
          totalEvents: 1000,
          uniqueUsers: 50,
          totalLogins: 200,
        },
        activeUsers: [
          {
            userId: 'user-1',
            eventCount: 75,
            email: 'active@test.com',
            lastActivity: new Date('2024-01-01'),
          },
        ],
        loginTrends: [
          { date: '2024-01-01', loginCount: 15, uniqueUsers: 12 },
        ],
      };

      mockAnalyticsService.getUserActivityAnalytics.mockResolvedValue(mockUserAnalytics);

      const response = await request(app)
        .get('/api/analytics/users')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: mockUserAnalytics,
      });
    });
  });

  describe('POST /api/analytics/cleanup', () => {
    it('should allow super admin to cleanup old events', async () => {
      const superAdminApp = express();
      superAdminApp.use(express.json());
      superAdminApp.use((req, res, next) => {
        req.tenant = { id: 'test-tenant-id', name: 'Test Tenant' };
        req.user = { 
          id: 'test-user-id', 
          email: 'superadmin@test.com', 
          role: 'super_admin',
          tenantId: 'test-tenant-id'
        };
        next();
      });
      superAdminApp.use('/api/analytics', analyticsRoutes);

      mockAnalyticsService.cleanupOldEvents.mockResolvedValue(150);

      const response = await request(superAdminApp)
        .post('/api/analytics/cleanup')
        .send({ retentionDays: 60 })
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        message: 'Cleaned up 150 old analytics events',
        data: {
          deletedCount: 150,
          retentionDays: 60,
        },
      });

      expect(mockAnalyticsService.cleanupOldEvents).toHaveBeenCalledWith('test-tenant-id', 60);
    });

    it('should reject regular admin from cleanup', async () => {
      await request(app)
        .post('/api/analytics/cleanup')
        .send({ retentionDays: 60 })
        .expect(403);
    });

    it('should use default retention days if not provided', async () => {
      const superAdminApp = express();
      superAdminApp.use(express.json());
      superAdminApp.use((req, res, next) => {
        req.tenant = { id: 'test-tenant-id', name: 'Test Tenant' };
        req.user = { 
          id: 'test-user-id', 
          email: 'superadmin@test.com', 
          role: 'super_admin',
          tenantId: 'test-tenant-id'
        };
        next();
      });
      superAdminApp.use('/api/analytics', analyticsRoutes);

      mockAnalyticsService.cleanupOldEvents.mockResolvedValue(75);

      await request(superAdminApp)
        .post('/api/analytics/cleanup')
        .send({})
        .expect(200);

      expect(mockAnalyticsService.cleanupOldEvents).toHaveBeenCalledWith('test-tenant-id', 90);
    });
  });

  describe('GET /api/analytics/dashboard', () => {
    it('should return comprehensive dashboard analytics', async () => {
      const mockDashboardData = {
        period: '90 days',
        userMetrics: {
          totalUsers: 100,
          activeUsers: 75,
          activeUsersPeriod: '30 days',
        },
        profileMetrics: {
          completenessPercentage: 85,
          totalProfiles: 50,
          completeProfiles: 42,
        },
        topSearchQueries: [
          { query: 'developer', count: 25 },
          { query: 'manager', count: 15 },
        ],
        mostViewedProfiles: [
          {
            profileId: 'profile-1',
            viewCount: 40,
            employee: {
              firstName: 'John',
              lastName: 'Doe',
              title: 'Senior Developer',
              department: 'Engineering',
            },
          },
        ],
        departmentDistribution: [
          { department: 'Engineering', count: 30 },
          { department: 'Marketing', count: 15 },
          { department: 'Sales', count: 5 },
        ],
        roleDistribution: [
          { title: 'Developer', count: 20 },
          { title: 'Manager', count: 10 },
          { title: 'Designer', count: 8 },
        ],
      };

      mockAnalyticsService.getDashboardAnalytics.mockResolvedValue(mockDashboardData);

      const response = await request(app)
        .get('/api/analytics/dashboard')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: mockDashboardData,
      });

      expect(mockAnalyticsService.getDashboardAnalytics).toHaveBeenCalledWith('test-tenant-id', 90);
    });

    it('should accept custom days parameter', async () => {
      const mockDashboardData = {
        period: '30 days',
        userMetrics: { totalUsers: 50, activeUsers: 40, activeUsersPeriod: '30 days' },
        profileMetrics: { completenessPercentage: 80, totalProfiles: 25, completeProfiles: 20 },
        topSearchQueries: [],
        mostViewedProfiles: [],
        departmentDistribution: [],
        roleDistribution: [],
      };

      mockAnalyticsService.getDashboardAnalytics.mockResolvedValue(mockDashboardData);

      const response = await request(app)
        .get('/api/analytics/dashboard?days=30')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(mockAnalyticsService.getDashboardAnalytics).toHaveBeenCalledWith('test-tenant-id', 30);
    });

    it('should handle empty data gracefully', async () => {
      const mockDashboardData = {
        period: '90 days',
        userMetrics: { totalUsers: 0, activeUsers: 0, activeUsersPeriod: '30 days' },
        profileMetrics: { completenessPercentage: 0, totalProfiles: 0, completeProfiles: 0 },
        topSearchQueries: [],
        mostViewedProfiles: [],
        departmentDistribution: [],
        roleDistribution: [],
      };

      mockAnalyticsService.getDashboardAnalytics.mockResolvedValue(mockDashboardData);

      const response = await request(app)
        .get('/api/analytics/dashboard')
        .expect(200);

      expect(response.body.data.userMetrics.totalUsers).toBe(0);
      expect(response.body.data.profileMetrics.completenessPercentage).toBe(0);
    });
  });

  describe('GET /api/analytics/detailed', () => {
    it('should return comprehensive detailed analytics', async () => {
      const mockDetailedData = {
        dashboard: {
          period: '90 days',
          userMetrics: { totalUsers: 100, activeUsers: 75, activeUsersPeriod: '30 days' },
          profileMetrics: { completenessPercentage: 85, totalProfiles: 50, completeProfiles: 42 },
          topSearchQueries: [],
          mostViewedProfiles: [],
          departmentDistribution: [],
          roleDistribution: [],
        },
        search: {
          period: '90 days',
          statistics: { totalSearches: 200, uniqueQueries: 100, averageResults: 5, averageExecutionTime: 120 },
          topQueries: [],
          trends: [],
        },
        profiles: {
          period: '90 days',
          statistics: { totalViews: 500, totalUpdates: 75, uniqueProfilesViewed: 150, uniqueProfilesUpdated: 45 },
          mostViewedProfiles: [],
          activity: [],
        },
        users: {
          period: '90 days',
          statistics: { totalEvents: 1000, uniqueUsers: 75, totalLogins: 200 },
          activeUsers: [],
          loginTrends: [],
        },
        generatedAt: '2024-01-01T12:00:00.000Z',
      };

      mockAnalyticsService.getDetailedAnalytics.mockResolvedValue(mockDetailedData);

      const response = await request(app)
        .get('/api/analytics/detailed')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: mockDetailedData,
      });

      expect(mockAnalyticsService.getDetailedAnalytics).toHaveBeenCalledWith('test-tenant-id', 90);
    });
  });

  describe('GET /api/analytics/dashboard-legacy', () => {
    it('should return formatted dashboard data (legacy endpoint)', async () => {
      const mockSummary = {
        period: '30 days',
        summary: {
          totalSearches: 100,
          uniqueSearchQueries: 30,
          totalProfileViews: 200,
          totalProfileUpdates: 20,
          totalLogins: 50,
        },
        topSearchQueries: [{ query: 'test', count: 10 }],
        mostViewedProfiles: [{ profileId: 'profile-1', count: 15 }],
      };

      const mockSearchAnalytics = {
        period: '30 days',
        statistics: { totalSearches: 100, uniqueQueries: 30, averageResults: 5, averageExecutionTime: 120 },
        topQueries: [],
        trends: [{ date: '2024-01-01', searchCount: 10 }],
      };

      const mockProfileAnalytics = {
        period: '30 days',
        statistics: { totalViews: 200, totalUpdates: 20, uniqueProfilesViewed: 80, uniqueProfilesUpdated: 15 },
        mostViewedProfiles: [],
        activity: [{ date: '2024-01-01', views: 20, updates: 2 }],
      };

      const mockUserAnalytics = {
        period: '30 days',
        statistics: { totalEvents: 500, uniqueUsers: 25, totalLogins: 50 },
        activeUsers: [],
        loginTrends: [{ date: '2024-01-01', loginCount: 5, uniqueUsers: 4 }],
      };

      mockAnalyticsService.getAnalyticsSummary.mockResolvedValue(mockSummary);
      mockAnalyticsService.getSearchAnalytics.mockResolvedValue(mockSearchAnalytics);
      mockAnalyticsService.getProfileAnalytics.mockResolvedValue(mockProfileAnalytics);
      mockAnalyticsService.getUserActivityAnalytics.mockResolvedValue(mockUserAnalytics);

      const response = await request(app)
        .get('/api/analytics/dashboard')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('overview');
      expect(response.body.data).toHaveProperty('topSearchQueries');
      expect(response.body.data).toHaveProperty('mostViewedProfiles');
      expect(response.body.data).toHaveProperty('searchTrends');
      expect(response.body.data).toHaveProperty('profileActivity');
      expect(response.body.data).toHaveProperty('loginTrends');
      expect(response.body.data).toHaveProperty('searchPerformance');

      expect(response.body.data.overview).toEqual({
        totalSearches: 100,
        totalProfileViews: 200,
        totalProfileUpdates: 20,
        activeUsers: 25,
        totalLogins: 50,
      });
    });
  });

  describe('Error handling', () => {
    it('should handle analytics service errors gracefully', async () => {
      mockAnalyticsService.getAnalyticsSummary.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/api/analytics/summary')
        .expect(500);

      expect(response.body.error.code).toBe('ANALYTICS_ERROR');
      expect(response.body.error.message).toBe('Failed to retrieve analytics summary');
    });

    it('should handle cleanup errors gracefully', async () => {
      const superAdminApp = express();
      superAdminApp.use(express.json());
      superAdminApp.use((req, res, next) => {
        req.tenant = { id: 'test-tenant-id', name: 'Test Tenant' };
        req.user = { 
          id: 'test-user-id', 
          email: 'superadmin@test.com', 
          role: 'super_admin',
          tenantId: 'test-tenant-id'
        };
        next();
      });
      superAdminApp.use('/api/analytics', analyticsRoutes);
      superAdminApp.use(createErrorHandler());

      mockAnalyticsService.cleanupOldEvents.mockRejectedValue(new Error('Cleanup failed'));

      const response = await request(superAdminApp)
        .post('/api/analytics/cleanup')
        .send({ retentionDays: 60 })
        .expect(500);

      expect(response.body.error.code).toBe('CLEANUP_ERROR');
    });
  });
});