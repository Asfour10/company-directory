import { AnalyticsService } from '../analytics.service';
import { AuditService } from '../audit.service';
import { prisma } from '../../lib/database';

// Mock dependencies
jest.mock('../../lib/database', () => ({
  prisma: {
    analyticsEvent: {
      count: jest.fn(),
      groupBy: jest.fn(),
      findMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    $queryRaw: jest.fn(),
  },
}));

jest.mock('../audit.service', () => ({
  AuditService: {
    trackEvent: jest.fn(),
  },
}));

const mockPrisma = prisma as jest.Mocked<typeof prisma>;
const mockAuditService = AuditService as jest.Mocked<typeof AuditService>;

describe('AnalyticsService', () => {
  const testTenantId = 'tenant-123';
  const testUserId = 'user-456';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('trackSearchQuery', () => {
    it('should track search query events', async () => {
      const searchData = {
        query: 'test search',
        resultCount: 5,
        executionTime: 120,
        filters: { department: 'Engineering' },
      };

      await AnalyticsService.trackSearchQuery(testTenantId, testUserId, searchData);

      expect(mockAuditService.trackEvent).toHaveBeenCalledWith({
        tenantId: testTenantId,
        userId: testUserId,
        eventType: 'search_query',
        metadata: {
          query: searchData.query,
          resultCount: searchData.resultCount,
          executionTime: searchData.executionTime,
          filters: searchData.filters,
          clickedResult: undefined,
          timestamp: expect.any(String),
        },
      });
    });

    it('should track search query with clicked result', async () => {
      const searchData = {
        query: 'john doe',
        resultCount: 3,
        executionTime: 95,
        clickedResult: 'employee-789',
      };

      await AnalyticsService.trackSearchQuery(testTenantId, testUserId, searchData);

      expect(mockAuditService.trackEvent).toHaveBeenCalledWith({
        tenantId: testTenantId,
        userId: testUserId,
        eventType: 'search_query',
        metadata: {
          query: searchData.query,
          resultCount: searchData.resultCount,
          executionTime: searchData.executionTime,
          filters: undefined,
          clickedResult: searchData.clickedResult,
          timestamp: expect.any(String),
        },
      });
    });
  });

  describe('trackProfileView', () => {
    it('should track profile view events', async () => {
      const profileData = {
        profileId: 'profile-123',
        action: 'view' as const,
        source: 'search',
      };

      await AnalyticsService.trackProfileView(testTenantId, testUserId, profileData);

      expect(mockAuditService.trackEvent).toHaveBeenCalledWith({
        tenantId: testTenantId,
        userId: testUserId,
        eventType: 'profile_view',
        metadata: {
          profileId: profileData.profileId,
          source: profileData.source,
          timestamp: expect.any(String),
        },
      });
    });

    it('should default source to direct when not provided', async () => {
      const profileData = {
        profileId: 'profile-123',
        action: 'view' as const,
      };

      await AnalyticsService.trackProfileView(testTenantId, testUserId, profileData);

      expect(mockAuditService.trackEvent).toHaveBeenCalledWith({
        tenantId: testTenantId,
        userId: testUserId,
        eventType: 'profile_view',
        metadata: {
          profileId: profileData.profileId,
          source: 'direct',
          timestamp: expect.any(String),
        },
      });
    });
  });

  describe('trackProfileUpdate', () => {
    it('should track profile update events with fields changed', async () => {
      const profileData = {
        profileId: 'profile-123',
        action: 'update' as const,
        fieldsChanged: ['firstName', 'title', 'department'],
      };

      await AnalyticsService.trackProfileUpdate(testTenantId, testUserId, profileData);

      expect(mockAuditService.trackEvent).toHaveBeenCalledWith({
        tenantId: testTenantId,
        userId: testUserId,
        eventType: 'profile_update',
        metadata: {
          profileId: profileData.profileId,
          fieldsChanged: profileData.fieldsChanged,
          timestamp: expect.any(String),
        },
      });
    });

    it('should handle empty fields changed array', async () => {
      const profileData = {
        profileId: 'profile-123',
        action: 'update' as const,
      };

      await AnalyticsService.trackProfileUpdate(testTenantId, testUserId, profileData);

      expect(mockAuditService.trackEvent).toHaveBeenCalledWith({
        tenantId: testTenantId,
        userId: testUserId,
        eventType: 'profile_update',
        metadata: {
          profileId: profileData.profileId,
          fieldsChanged: [],
          timestamp: expect.any(String),
        },
      });
    });
  });

  describe('trackProfileCreate', () => {
    it('should track profile creation events', async () => {
      const profileData = {
        profileId: 'profile-123',
        action: 'create' as const,
      };

      await AnalyticsService.trackProfileCreate(testTenantId, testUserId, profileData);

      expect(mockAuditService.trackEvent).toHaveBeenCalledWith({
        tenantId: testTenantId,
        userId: testUserId,
        eventType: 'profile_create',
        metadata: {
          profileId: profileData.profileId,
          timestamp: expect.any(String),
        },
      });
    });
  });

  describe('trackProfileDelete', () => {
    it('should track profile deletion events', async () => {
      const profileData = {
        profileId: 'profile-123',
        action: 'delete' as const,
      };

      await AnalyticsService.trackProfileDelete(testTenantId, testUserId, profileData);

      expect(mockAuditService.trackEvent).toHaveBeenCalledWith({
        tenantId: testTenantId,
        userId: testUserId,
        eventType: 'profile_delete',
        metadata: {
          profileId: profileData.profileId,
          timestamp: expect.any(String),
        },
      });
    });
  });

  describe('trackLogin', () => {
    it('should track login events', async () => {
      const metadata = {
        loginMethod: 'sso',
        ipAddress: '192.168.1.100',
      };

      await AnalyticsService.trackLogin(testTenantId, testUserId, metadata);

      expect(mockAuditService.trackEvent).toHaveBeenCalledWith({
        tenantId: testTenantId,
        userId: testUserId,
        eventType: 'login',
        metadata: {
          ...metadata,
          timestamp: expect.any(String),
        },
      });
    });

    it('should track login events without metadata', async () => {
      await AnalyticsService.trackLogin(testTenantId, testUserId);

      expect(mockAuditService.trackEvent).toHaveBeenCalledWith({
        tenantId: testTenantId,
        userId: testUserId,
        eventType: 'login',
        metadata: {
          timestamp: expect.any(String),
        },
      });
    });
  });

  describe('trackLogout', () => {
    it('should track logout events', async () => {
      const metadata = {
        sessionDuration: 3600,
      };

      await AnalyticsService.trackLogout(testTenantId, testUserId, metadata);

      expect(mockAuditService.trackEvent).toHaveBeenCalledWith({
        tenantId: testTenantId,
        userId: testUserId,
        eventType: 'logout',
        metadata: {
          ...metadata,
          timestamp: expect.any(String),
        },
      });
    });
  });

  describe('trackOrgChartView', () => {
    it('should track org chart view events', async () => {
      const metadata = {
        viewType: 'full_chart',
      };

      await AnalyticsService.trackOrgChartView(testTenantId, testUserId, metadata);

      expect(mockAuditService.trackEvent).toHaveBeenCalledWith({
        tenantId: testTenantId,
        userId: testUserId,
        eventType: 'org_chart_view',
        metadata: {
          ...metadata,
          timestamp: expect.any(String),
        },
      });
    });
  });

  describe('getAnalyticsSummary', () => {
    it('should return analytics summary with all metrics', async () => {
      const days = 30;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      // Mock the parallel Promise.all calls
      mockPrisma.analyticsEvent.count
        .mockResolvedValueOnce(150) // totalSearches
        .mockResolvedValueOnce(75)  // totalProfileViews
        .mockResolvedValueOnce(25)  // totalProfileUpdates
        .mockResolvedValueOnce(50); // totalLogins

      mockPrisma.analyticsEvent.groupBy.mockResolvedValue([
        { metadata: { query: 'test' }, _count: { id: 5 } },
        { metadata: { query: 'john' }, _count: { id: 3 } },
      ]);

      mockPrisma.$queryRaw
        .mockResolvedValueOnce([
          { query: 'test query', count: BigInt(10) },
          { query: 'another query', count: BigInt(5) },
        ])
        .mockResolvedValueOnce([
          { profileId: 'profile-1', count: BigInt(15) },
          { profileId: 'profile-2', count: BigInt(8) },
        ]);

      const result = await AnalyticsService.getAnalyticsSummary(testTenantId, days);

      expect(result).toEqual({
        period: `${days} days`,
        summary: {
          totalSearches: 150,
          uniqueSearchQueries: 2,
          totalProfileViews: 75,
          totalProfileUpdates: 25,
          totalLogins: 50,
        },
        topSearchQueries: [
          { query: 'test query', count: 10 },
          { query: 'another query', count: 5 },
        ],
        mostViewedProfiles: [
          { profileId: 'profile-1', count: 15 },
          { profileId: 'profile-2', count: 8 },
        ],
      });

      expect(mockPrisma.analyticsEvent.count).toHaveBeenCalledTimes(4);
      expect(mockPrisma.analyticsEvent.groupBy).toHaveBeenCalledWith({
        by: ['metadata'],
        where: {
          tenantId: testTenantId,
          eventType: 'search_query',
          createdAt: { gte: expect.any(Date) },
        },
        _count: { id: true },
      });
    });
  });

  describe('getSearchAnalytics', () => {
    it('should return detailed search analytics', async () => {
      const days = 30;

      mockPrisma.$queryRaw
        .mockResolvedValueOnce([{
          total_searches: BigInt(100),
          unique_queries: BigInt(50),
          avg_results: 5.5,
          avg_execution_time: 125.5,
        }])
        .mockResolvedValueOnce([
          {
            query: 'popular query',
            count: BigInt(20),
            avg_results: 6.0,
            avg_execution_time: 110.0,
          },
        ])
        .mockResolvedValueOnce([
          {
            date: '2024-01-01',
            search_count: BigInt(25),
          },
        ]);

      const result = await AnalyticsService.getSearchAnalytics(testTenantId, days);

      expect(result).toEqual({
        period: `${days} days`,
        statistics: {
          totalSearches: 100,
          uniqueQueries: 50,
          averageResults: 6, // rounded
          averageExecutionTime: 126, // rounded
        },
        topQueries: [
          {
            query: 'popular query',
            count: 20,
            averageResults: 6,
            averageExecutionTime: 110,
          },
        ],
        trends: [
          {
            date: '2024-01-01',
            searchCount: 25,
          },
        ],
      });
    });
  });

  describe('getProfileAnalytics', () => {
    it('should return detailed profile analytics', async () => {
      const days = 30;

      mockPrisma.$queryRaw
        .mockResolvedValueOnce([{
          total_views: BigInt(200),
          total_updates: BigInt(50),
          unique_profiles_viewed: BigInt(75),
          unique_profiles_updated: BigInt(25),
        }])
        .mockResolvedValueOnce([
          {
            profileId: 'profile-1',
            viewCount: BigInt(30),
            firstName: 'John',
            lastName: 'Doe',
            title: 'Developer',
            department: 'Engineering',
          },
        ])
        .mockResolvedValueOnce([
          {
            date: '2024-01-01',
            views: BigInt(15),
            updates: BigInt(3),
          },
        ]);

      const result = await AnalyticsService.getProfileAnalytics(testTenantId, days);

      expect(result).toEqual({
        period: `${days} days`,
        statistics: {
          totalViews: 200,
          totalUpdates: 50,
          uniqueProfilesViewed: 75,
          uniqueProfilesUpdated: 25,
        },
        mostViewedProfiles: [
          {
            profileId: 'profile-1',
            viewCount: 30,
            employee: {
              firstName: 'John',
              lastName: 'Doe',
              title: 'Developer',
              department: 'Engineering',
            },
          },
        ],
        activity: [
          {
            date: '2024-01-01',
            views: 15,
            updates: 3,
          },
        ],
      });
    });
  });

  describe('getUserActivityAnalytics', () => {
    it('should return user activity analytics', async () => {
      const days = 30;

      mockPrisma.$queryRaw
        .mockResolvedValueOnce([{
          total_events: BigInt(500),
          unique_users: BigInt(25),
          total_logins: BigInt(100),
        }])
        .mockResolvedValueOnce([
          {
            userId: 'user-1',
            eventCount: BigInt(50),
            email: 'user1@test.com',
            lastActivity: new Date('2024-01-01'),
          },
        ])
        .mockResolvedValueOnce([
          {
            date: '2024-01-01',
            login_count: BigInt(10),
            unique_users: BigInt(8),
          },
        ]);

      const result = await AnalyticsService.getUserActivityAnalytics(testTenantId, days);

      expect(result).toEqual({
        period: `${days} days`,
        statistics: {
          totalEvents: 500,
          uniqueUsers: 25,
          totalLogins: 100,
        },
        activeUsers: [
          {
            userId: 'user-1',
            eventCount: 50,
            email: 'user1@test.com',
            lastActivity: new Date('2024-01-01'),
          },
        ],
        loginTrends: [
          {
            date: '2024-01-01',
            loginCount: 10,
            uniqueUsers: 8,
          },
        ],
      });
    });
  });

  describe('getDashboardAnalytics', () => {
    it('should return comprehensive dashboard analytics', async () => {
      const days = 90;

      // Mock user counts
      mockPrisma.user.count
        .mockResolvedValueOnce(100) // totalUsers
        .mockResolvedValueOnce(75); // activeUsers

      // Mock profile completeness calculation
      mockPrisma.employee.count.mockResolvedValue(50);
      mockPrisma.$queryRaw
        .mockResolvedValueOnce([{
          total_profiles: BigInt(50),
          complete_profiles: BigInt(35),
          avg_completeness: 85.5,
        }])
        .mockResolvedValueOnce([
          { query: 'test search', count: BigInt(25) },
          { query: 'john doe', count: BigInt(15) },
        ])
        .mockResolvedValueOnce([
          {
            profileId: 'profile-1',
            viewCount: BigInt(40),
            firstName: 'John',
            lastName: 'Doe',
            title: 'Developer',
            department: 'Engineering',
          },
        ]);

      // Mock department and role distribution
      mockPrisma.employee.groupBy
        .mockResolvedValueOnce([
          { department: 'Engineering', _count: { id: 25 } },
          { department: 'Marketing', _count: { id: 15 } },
        ])
        .mockResolvedValueOnce([
          { title: 'Developer', _count: { id: 20 } },
          { title: 'Manager', _count: { id: 10 } },
        ]);

      const result = await AnalyticsService.getDashboardAnalytics(testTenantId, days);

      expect(result).toEqual({
        period: `${days} days`,
        userMetrics: {
          totalUsers: 100,
          activeUsers: 75,
          activeUsersPeriod: '30 days',
        },
        profileMetrics: {
          completenessPercentage: 86,
          totalProfiles: 50,
          completeProfiles: 35,
        },
        topSearchQueries: [
          { query: 'test search', count: 25 },
          { query: 'john doe', count: 15 },
        ],
        mostViewedProfiles: [
          {
            profileId: 'profile-1',
            viewCount: 40,
            employee: {
              firstName: 'John',
              lastName: 'Doe',
              title: 'Developer',
              department: 'Engineering',
            },
          },
        ],
        departmentDistribution: [
          { department: 'Engineering', count: 25 },
          { department: 'Marketing', count: 15 },
        ],
        roleDistribution: [
          { title: 'Developer', count: 20 },
          { title: 'Manager', count: 10 },
        ],
      });
    });

    it('should handle null departments and titles', async () => {
      const days = 30;

      mockPrisma.user.count
        .mockResolvedValueOnce(50)
        .mockResolvedValueOnce(30);

      mockPrisma.employee.count.mockResolvedValue(25);
      mockPrisma.$queryRaw
        .mockResolvedValueOnce([{
          total_profiles: BigInt(25),
          complete_profiles: BigInt(10),
          avg_completeness: 60.0,
        }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          {
            profileId: 'profile-1',
            viewCount: BigInt(5),
            firstName: 'Jane',
            lastName: 'Smith',
            title: null,
            department: null,
          },
        ]);

      mockPrisma.employee.groupBy
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const result = await AnalyticsService.getDashboardAnalytics(testTenantId, days);

      expect(result.mostViewedProfiles[0].employee).toEqual({
        firstName: 'Jane',
        lastName: 'Smith',
        title: 'No Title',
        department: 'No Department',
      });
    });
  });

  describe('calculateProfileCompleteness', () => {
    it('should calculate profile completeness correctly', async () => {
      mockPrisma.employee.count.mockResolvedValue(100);
      mockPrisma.$queryRaw.mockResolvedValue([{
        total_profiles: BigInt(100),
        complete_profiles: BigInt(75),
        avg_completeness: 82.5,
      }]);

      // Access private method through any cast for testing
      const result = await (AnalyticsService as any).calculateProfileCompleteness(testTenantId);

      expect(result).toEqual({
        totalProfiles: 100,
        completeProfiles: 75,
        averageCompleteness: 83, // rounded
        completenessPercentage: 75,
      });
    });

    it('should handle zero profiles', async () => {
      mockPrisma.employee.count.mockResolvedValue(0);
      mockPrisma.$queryRaw.mockResolvedValue([{
        total_profiles: BigInt(0),
        complete_profiles: BigInt(0),
        avg_completeness: 0,
      }]);

      const result = await (AnalyticsService as any).calculateProfileCompleteness(testTenantId);

      expect(result).toEqual({
        totalProfiles: 0,
        completeProfiles: 0,
        averageCompleteness: 0,
        completenessPercentage: 0,
      });
    });
  });

  describe('getDetailedAnalytics', () => {
    it('should return comprehensive analytics report', async () => {
      const days = 90;

      // Mock all the individual analytics methods
      jest.spyOn(AnalyticsService, 'getDashboardAnalytics').mockResolvedValue({
        period: `${days} days`,
        userMetrics: { totalUsers: 100, activeUsers: 75, activeUsersPeriod: '30 days' },
        profileMetrics: { completenessPercentage: 80, totalProfiles: 50, completeProfiles: 40 },
        topSearchQueries: [],
        mostViewedProfiles: [],
        departmentDistribution: [],
        roleDistribution: [],
      });

      jest.spyOn(AnalyticsService, 'getSearchAnalytics').mockResolvedValue({
        period: `${days} days`,
        statistics: { totalSearches: 200, uniqueQueries: 100, averageResults: 5, averageExecutionTime: 120 },
        topQueries: [],
        trends: [],
      });

      jest.spyOn(AnalyticsService, 'getProfileAnalytics').mockResolvedValue({
        period: `${days} days`,
        statistics: { totalViews: 300, totalUpdates: 50, uniqueProfilesViewed: 80, uniqueProfilesUpdated: 30 },
        mostViewedProfiles: [],
        activity: [],
      });

      jest.spyOn(AnalyticsService, 'getUserActivityAnalytics').mockResolvedValue({
        period: `${days} days`,
        statistics: { totalEvents: 500, uniqueUsers: 75, totalLogins: 150 },
        activeUsers: [],
        loginTrends: [],
      });

      const result = await AnalyticsService.getDetailedAnalytics(testTenantId, days);

      expect(result).toHaveProperty('dashboard');
      expect(result).toHaveProperty('search');
      expect(result).toHaveProperty('profiles');
      expect(result).toHaveProperty('users');
      expect(result).toHaveProperty('generatedAt');
      expect(result.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });
  });

  describe('cleanupOldEvents', () => {
    it('should clean up old analytics events', async () => {
      const retentionDays = 90;
      mockPrisma.analyticsEvent.deleteMany.mockResolvedValue({ count: 150 });

      const result = await AnalyticsService.cleanupOldEvents(testTenantId, retentionDays);

      expect(result).toBe(150);
      expect(mockPrisma.analyticsEvent.deleteMany).toHaveBeenCalledWith({
        where: {
          tenantId: testTenantId,
          createdAt: {
            lt: expect.any(Date),
          },
        },
      });
    });

    it('should use default retention period of 90 days', async () => {
      mockPrisma.analyticsEvent.deleteMany.mockResolvedValue({ count: 50 });

      const result = await AnalyticsService.cleanupOldEvents(testTenantId);

      expect(result).toBe(50);
      expect(mockPrisma.analyticsEvent.deleteMany).toHaveBeenCalledWith({
        where: {
          tenantId: testTenantId,
          createdAt: {
            lt: expect.any(Date),
          },
        },
      });
    });
  });
});