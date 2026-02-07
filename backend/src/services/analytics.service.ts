import { prisma } from '../lib/database';
import { AuditService } from './audit.service';

export interface AnalyticsEventData {
  tenantId: string;
  userId?: string;
  eventType: 'search_query' | 'profile_view' | 'profile_update' | 'profile_create' | 'profile_delete' | 'login' | 'logout' | 'org_chart_view';
  metadata?: Record<string, any>;
}

export interface SearchAnalyticsData {
  query: string;
  resultCount: number;
  executionTime: number;
  filters?: Record<string, any>;
  clickedResult?: string;
}

export interface ProfileAnalyticsData {
  profileId: string;
  action: 'view' | 'update' | 'create' | 'delete';
  fieldsChanged?: string[];
  source?: 'direct' | 'search' | 'org_chart';
}

/**
 * Service for tracking and managing analytics events
 * Implements requirement 16.1: Track search queries, profile views, profile updates
 */
export class AnalyticsService {
  /**
   * Track a search query event
   */
  static async trackSearchQuery(
    tenantId: string,
    userId: string | undefined,
    data: SearchAnalyticsData
  ): Promise<void> {
    await AuditService.trackEvent({
      tenantId,
      userId,
      eventType: 'search_query',
      metadata: {
        query: data.query,
        resultCount: data.resultCount,
        executionTime: data.executionTime,
        filters: data.filters,
        clickedResult: data.clickedResult,
        timestamp: new Date().toISOString(),
      },
    });
  }

  /**
   * Track a profile view event
   */
  static async trackProfileView(
    tenantId: string,
    userId: string | undefined,
    data: ProfileAnalyticsData
  ): Promise<void> {
    await AuditService.trackEvent({
      tenantId,
      userId,
      eventType: 'profile_view',
      metadata: {
        profileId: data.profileId,
        source: data.source || 'direct',
        timestamp: new Date().toISOString(),
      },
    });
  }

  /**
   * Track a profile update event
   */
  static async trackProfileUpdate(
    tenantId: string,
    userId: string | undefined,
    data: ProfileAnalyticsData
  ): Promise<void> {
    await AuditService.trackEvent({
      tenantId,
      userId,
      eventType: 'profile_update',
      metadata: {
        profileId: data.profileId,
        fieldsChanged: data.fieldsChanged || [],
        timestamp: new Date().toISOString(),
      },
    });
  }

  /**
   * Track a profile creation event
   */
  static async trackProfileCreate(
    tenantId: string,
    userId: string | undefined,
    data: ProfileAnalyticsData
  ): Promise<void> {
    await AuditService.trackEvent({
      tenantId,
      userId,
      eventType: 'profile_create',
      metadata: {
        profileId: data.profileId,
        timestamp: new Date().toISOString(),
      },
    });
  }

  /**
   * Track a profile deletion/deactivation event
   */
  static async trackProfileDelete(
    tenantId: string,
    userId: string | undefined,
    data: ProfileAnalyticsData
  ): Promise<void> {
    await AuditService.trackEvent({
      tenantId,
      userId,
      eventType: 'profile_delete',
      metadata: {
        profileId: data.profileId,
        timestamp: new Date().toISOString(),
      },
    });
  }

  /**
   * Track user login event
   */
  static async trackLogin(
    tenantId: string,
    userId: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    await AuditService.trackEvent({
      tenantId,
      userId,
      eventType: 'login',
      metadata: {
        ...metadata,
        timestamp: new Date().toISOString(),
      },
    });
  }

  /**
   * Track user logout event
   */
  static async trackLogout(
    tenantId: string,
    userId: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    await AuditService.trackEvent({
      tenantId,
      userId,
      eventType: 'logout',
      metadata: {
        ...metadata,
        timestamp: new Date().toISOString(),
      },
    });
  }

  /**
   * Track organizational chart view event
   */
  static async trackOrgChartView(
    tenantId: string,
    userId: string | undefined,
    metadata?: Record<string, any>
  ): Promise<void> {
    await AuditService.trackEvent({
      tenantId,
      userId,
      eventType: 'org_chart_view',
      metadata: {
        ...metadata,
        timestamp: new Date().toISOString(),
      },
    });
  }

  /**
   * Get analytics summary for a tenant
   */
  static async getAnalyticsSummary(tenantId: string, days: number = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const [
      totalSearches,
      uniqueSearchQueries,
      totalProfileViews,
      totalProfileUpdates,
      totalLogins,
      topSearchQueries,
      mostViewedProfiles,
    ] = await Promise.all([
      // Total searches
      prisma.analyticsEvent.count({
        where: {
          tenantId,
          eventType: 'search_query',
          createdAt: { gte: startDate },
        },
      }),

      // Unique search queries
      prisma.analyticsEvent.groupBy({
        by: ['metadata'],
        where: {
          tenantId,
          eventType: 'search_query',
          createdAt: { gte: startDate },
        },
        _count: { id: true },
      }),

      // Total profile views
      prisma.analyticsEvent.count({
        where: {
          tenantId,
          eventType: 'profile_view',
          createdAt: { gte: startDate },
        },
      }),

      // Total profile updates
      prisma.analyticsEvent.count({
        where: {
          tenantId,
          eventType: 'profile_update',
          createdAt: { gte: startDate },
        },
      }),

      // Total logins
      prisma.analyticsEvent.count({
        where: {
          tenantId,
          eventType: 'login',
          createdAt: { gte: startDate },
        },
      }),

      // Top search queries (using raw SQL for better JSON handling)
      prisma.$queryRaw<Array<{ query: string; count: bigint }>>`
        SELECT 
          metadata->>'query' as query,
          COUNT(*) as count
        FROM analytics_events 
        WHERE tenant_id = ${tenantId}::uuid
          AND event_type = 'search_query'
          AND created_at >= ${startDate}
          AND metadata->>'query' IS NOT NULL
        GROUP BY metadata->>'query'
        ORDER BY count DESC
        LIMIT 10
      `,

      // Most viewed profiles
      prisma.$queryRaw<Array<{ profileId: string; count: bigint }>>`
        SELECT 
          metadata->>'profileId' as "profileId",
          COUNT(*) as count
        FROM analytics_events 
        WHERE tenant_id = ${tenantId}::uuid
          AND event_type = 'profile_view'
          AND created_at >= ${startDate}
          AND metadata->>'profileId' IS NOT NULL
        GROUP BY metadata->>'profileId'
        ORDER BY count DESC
        LIMIT 10
      `,
    ]);

    return {
      period: `${days} days`,
      summary: {
        totalSearches,
        uniqueSearchQueries: uniqueSearchQueries.length,
        totalProfileViews,
        totalProfileUpdates,
        totalLogins,
      },
      topSearchQueries: topSearchQueries.map(item => ({
        query: item.query,
        count: Number(item.count),
      })),
      mostViewedProfiles: mostViewedProfiles.map(item => ({
        profileId: item.profileId,
        count: Number(item.count),
      })),
    };
  }

  /**
   * Get search analytics for a tenant
   */
  static async getSearchAnalytics(tenantId: string, days: number = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const [searchStats, topQueries, searchTrends] = await Promise.all([
      // Basic search statistics
      prisma.$queryRaw<Array<{
        total_searches: bigint;
        unique_queries: bigint;
        avg_results: number;
        avg_execution_time: number;
      }>>`
        SELECT 
          COUNT(*) as total_searches,
          COUNT(DISTINCT metadata->>'query') as unique_queries,
          AVG((metadata->>'resultCount')::int) as avg_results,
          AVG((metadata->>'executionTime')::int) as avg_execution_time
        FROM analytics_events 
        WHERE tenant_id = ${tenantId}::uuid
          AND event_type = 'search_query'
          AND created_at >= ${startDate}
      `,

      // Top search queries with details
      prisma.$queryRaw<Array<{
        query: string;
        count: bigint;
        avg_results: number;
        avg_execution_time: number;
      }>>`
        SELECT 
          metadata->>'query' as query,
          COUNT(*) as count,
          AVG((metadata->>'resultCount')::int) as avg_results,
          AVG((metadata->>'executionTime')::int) as avg_execution_time
        FROM analytics_events 
        WHERE tenant_id = ${tenantId}::uuid
          AND event_type = 'search_query'
          AND created_at >= ${startDate}
          AND metadata->>'query' IS NOT NULL
        GROUP BY metadata->>'query'
        ORDER BY count DESC
        LIMIT 20
      `,

      // Search trends by day
      prisma.$queryRaw<Array<{
        date: string;
        search_count: bigint;
      }>>`
        SELECT 
          DATE(created_at) as date,
          COUNT(*) as search_count
        FROM analytics_events 
        WHERE tenant_id = ${tenantId}::uuid
          AND event_type = 'search_query'
          AND created_at >= ${startDate}
        GROUP BY DATE(created_at)
        ORDER BY date
      `,
    ]);

    const stats = searchStats[0];

    return {
      period: `${days} days`,
      statistics: {
        totalSearches: Number(stats?.total_searches || 0),
        uniqueQueries: Number(stats?.unique_queries || 0),
        averageResults: Math.round(stats?.avg_results || 0),
        averageExecutionTime: Math.round(stats?.avg_execution_time || 0),
      },
      topQueries: topQueries.map(item => ({
        query: item.query,
        count: Number(item.count),
        averageResults: Math.round(item.avg_results || 0),
        averageExecutionTime: Math.round(item.avg_execution_time || 0),
      })),
      trends: searchTrends.map(item => ({
        date: item.date,
        searchCount: Number(item.search_count),
      })),
    };
  }

  /**
   * Get profile analytics for a tenant
   */
  static async getProfileAnalytics(tenantId: string, days: number = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const [profileStats, mostViewedProfiles, profileActivity] = await Promise.all([
      // Basic profile statistics
      prisma.$queryRaw<Array<{
        total_views: bigint;
        total_updates: bigint;
        unique_profiles_viewed: bigint;
        unique_profiles_updated: bigint;
      }>>`
        SELECT 
          SUM(CASE WHEN event_type = 'profile_view' THEN 1 ELSE 0 END) as total_views,
          SUM(CASE WHEN event_type = 'profile_update' THEN 1 ELSE 0 END) as total_updates,
          COUNT(DISTINCT CASE WHEN event_type = 'profile_view' THEN metadata->>'profileId' END) as unique_profiles_viewed,
          COUNT(DISTINCT CASE WHEN event_type = 'profile_update' THEN metadata->>'profileId' END) as unique_profiles_updated
        FROM analytics_events 
        WHERE tenant_id = ${tenantId}::uuid
          AND event_type IN ('profile_view', 'profile_update')
          AND created_at >= ${startDate}
      `,

      // Most viewed profiles with employee details
      prisma.$queryRaw<Array<{
        profileId: string;
        viewCount: bigint;
        firstName: string;
        lastName: string;
        title: string;
        department: string;
      }>>`
        SELECT 
          ae.metadata->>'profileId' as "profileId",
          COUNT(*) as "viewCount",
          e.first_name as "firstName",
          e.last_name as "lastName",
          e.title,
          e.department
        FROM analytics_events ae
        JOIN employees e ON e.id = (ae.metadata->>'profileId')::uuid
        WHERE ae.tenant_id = ${tenantId}::uuid
          AND ae.event_type = 'profile_view'
          AND ae.created_at >= ${startDate}
          AND ae.metadata->>'profileId' IS NOT NULL
        GROUP BY ae.metadata->>'profileId', e.first_name, e.last_name, e.title, e.department
        ORDER BY "viewCount" DESC
        LIMIT 10
      `,

      // Profile activity trends by day
      prisma.$queryRaw<Array<{
        date: string;
        views: bigint;
        updates: bigint;
      }>>`
        SELECT 
          DATE(created_at) as date,
          SUM(CASE WHEN event_type = 'profile_view' THEN 1 ELSE 0 END) as views,
          SUM(CASE WHEN event_type = 'profile_update' THEN 1 ELSE 0 END) as updates
        FROM analytics_events 
        WHERE tenant_id = ${tenantId}::uuid
          AND event_type IN ('profile_view', 'profile_update')
          AND created_at >= ${startDate}
        GROUP BY DATE(created_at)
        ORDER BY date
      `,
    ]);

    const stats = profileStats[0];

    return {
      period: `${days} days`,
      statistics: {
        totalViews: Number(stats?.total_views || 0),
        totalUpdates: Number(stats?.total_updates || 0),
        uniqueProfilesViewed: Number(stats?.unique_profiles_viewed || 0),
        uniqueProfilesUpdated: Number(stats?.unique_profiles_updated || 0),
      },
      mostViewedProfiles: mostViewedProfiles.map(item => ({
        profileId: item.profileId,
        viewCount: Number(item.viewCount),
        employee: {
          firstName: item.firstName,
          lastName: item.lastName,
          title: item.title,
          department: item.department,
        },
      })),
      activity: profileActivity.map(item => ({
        date: item.date,
        views: Number(item.views),
        updates: Number(item.updates),
      })),
    };
  }

  /**
   * Get user activity analytics
   */
  static async getUserActivityAnalytics(tenantId: string, days: number = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const [activityStats, activeUsers, loginTrends] = await Promise.all([
      // Basic activity statistics
      prisma.$queryRaw<Array<{
        total_events: bigint;
        unique_users: bigint;
        total_logins: bigint;
      }>>`
        SELECT 
          COUNT(*) as total_events,
          COUNT(DISTINCT user_id) as unique_users,
          SUM(CASE WHEN event_type = 'login' THEN 1 ELSE 0 END) as total_logins
        FROM analytics_events 
        WHERE tenant_id = ${tenantId}::uuid
          AND created_at >= ${startDate}
          AND user_id IS NOT NULL
      `,

      // Most active users
      prisma.$queryRaw<Array<{
        userId: string;
        eventCount: bigint;
        email: string;
        lastActivity: Date;
      }>>`
        SELECT 
          ae.user_id as "userId",
          COUNT(*) as "eventCount",
          u.email,
          MAX(ae.created_at) as "lastActivity"
        FROM analytics_events ae
        JOIN users u ON u.id = ae.user_id
        WHERE ae.tenant_id = ${tenantId}::uuid
          AND ae.created_at >= ${startDate}
          AND ae.user_id IS NOT NULL
        GROUP BY ae.user_id, u.email
        ORDER BY "eventCount" DESC
        LIMIT 10
      `,

      // Login trends by day
      prisma.$queryRaw<Array<{
        date: string;
        login_count: bigint;
        unique_users: bigint;
      }>>`
        SELECT 
          DATE(created_at) as date,
          COUNT(*) as login_count,
          COUNT(DISTINCT user_id) as unique_users
        FROM analytics_events 
        WHERE tenant_id = ${tenantId}::uuid
          AND event_type = 'login'
          AND created_at >= ${startDate}
        GROUP BY DATE(created_at)
        ORDER BY date
      `,
    ]);

    const stats = activityStats[0];

    return {
      period: `${days} days`,
      statistics: {
        totalEvents: Number(stats?.total_events || 0),
        uniqueUsers: Number(stats?.unique_users || 0),
        totalLogins: Number(stats?.total_logins || 0),
      },
      activeUsers: activeUsers.map(item => ({
        userId: item.userId,
        eventCount: Number(item.eventCount),
        email: item.email,
        lastActivity: item.lastActivity,
      })),
      loginTrends: loginTrends.map(item => ({
        date: item.date,
        loginCount: Number(item.login_count),
        uniqueUsers: Number(item.unique_users),
      })),
    };
  }

  /**
   * Get comprehensive dashboard analytics for admin dashboard
   * Implements requirements 16.2, 16.3, 16.4
   */
  static async getDashboardAnalytics(tenantId: string, days: number = 90) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const activeUserStartDate = new Date();
    activeUserStartDate.setDate(activeUserStartDate.getDate() - 30);

    const [
      totalUsers,
      activeUsers,
      profileCompleteness,
      topSearches,
      mostViewedProfiles,
      departmentDistribution,
      roleDistribution,
    ] = await Promise.all([
      // Total users in tenant
      prisma.user.count({
        where: {
          tenantId,
          isActive: true,
        },
      }),

      // Active users in last 30 days (users who have logged in or performed actions)
      prisma.user.count({
        where: {
          tenantId,
          isActive: true,
          OR: [
            {
              lastLoginAt: {
                gte: activeUserStartDate,
              },
            },
            {
              analyticsEvents: {
                some: {
                  createdAt: {
                    gte: activeUserStartDate,
                  },
                },
              },
            },
          ],
        },
      }),

      // Profile completeness percentage
      this.calculateProfileCompleteness(tenantId),

      // Top 10 search queries
      prisma.$queryRaw<Array<{ query: string; count: bigint }>>`
        SELECT 
          metadata->>'query' as query,
          COUNT(*) as count
        FROM analytics_events 
        WHERE tenant_id = ${tenantId}::uuid
          AND event_type = 'search_query'
          AND created_at >= ${startDate}
          AND metadata->>'query' IS NOT NULL
          AND metadata->>'query' != ''
        GROUP BY metadata->>'query'
        ORDER BY count DESC
        LIMIT 10
      `,

      // Top 10 most viewed profiles with employee details
      prisma.$queryRaw<Array<{
        profileId: string;
        viewCount: bigint;
        firstName: string;
        lastName: string;
        title: string;
        department: string;
      }>>`
        SELECT 
          ae.metadata->>'profileId' as "profileId",
          COUNT(*) as "viewCount",
          e.first_name as "firstName",
          e.last_name as "lastName",
          e.title,
          e.department
        FROM analytics_events ae
        JOIN employees e ON e.id = (ae.metadata->>'profileId')::uuid
        WHERE ae.tenant_id = ${tenantId}::uuid
          AND ae.event_type = 'profile_view'
          AND ae.created_at >= ${startDate}
          AND ae.metadata->>'profileId' IS NOT NULL
          AND e.is_active = true
        GROUP BY ae.metadata->>'profileId', e.first_name, e.last_name, e.title, e.department
        ORDER BY "viewCount" DESC
        LIMIT 10
      `,

      // Department distribution
      prisma.employee.groupBy({
        by: ['department'],
        where: {
          tenantId,
          isActive: true,
          department: {
            not: null,
          },
        },
        _count: {
          id: true,
        },
        orderBy: {
          _count: {
            id: 'desc',
          },
        },
      }),

      // Role/Title distribution
      prisma.employee.groupBy({
        by: ['title'],
        where: {
          tenantId,
          isActive: true,
          title: {
            not: null,
          },
        },
        _count: {
          id: true,
        },
        orderBy: {
          _count: {
            id: 'desc',
          },
        },
        take: 15, // Limit to top 15 roles to avoid too much data
      }),
    ]);

    return {
      period: `${days} days`,
      userMetrics: {
        totalUsers,
        activeUsers: activeUsers,
        activeUsersPeriod: '30 days',
      },
      profileMetrics: {
        completenessPercentage: profileCompleteness.averageCompleteness,
        totalProfiles: profileCompleteness.totalProfiles,
        completeProfiles: profileCompleteness.completeProfiles,
      },
      topSearchQueries: topSearches.map(item => ({
        query: item.query,
        count: Number(item.count),
      })),
      mostViewedProfiles: mostViewedProfiles.map(item => ({
        profileId: item.profileId,
        viewCount: Number(item.viewCount),
        employee: {
          firstName: item.firstName,
          lastName: item.lastName,
          title: item.title || 'No Title',
          department: item.department || 'No Department',
        },
      })),
      departmentDistribution: departmentDistribution.map(item => ({
        department: item.department || 'No Department',
        count: item._count.id,
      })),
      roleDistribution: roleDistribution.map(item => ({
        title: item.title || 'No Title',
        count: item._count.id,
      })),
    };
  }

  /**
   * Calculate profile completeness percentage
   * A profile is considered complete if it has: firstName, lastName, email, title, department, phone
   * Custom fields are also included in the completeness calculation
   */
  private static async calculateProfileCompleteness(tenantId: string) {
    const [totalProfiles, customFields, employees] = await Promise.all([
      // Total active profiles
      prisma.employee.count({
        where: {
          tenantId,
          isActive: true,
        },
      }),

      // Get custom field definitions for this tenant
      prisma.customField.findMany({
        where: { tenantId },
        select: { fieldName: true, isRequired: true },
      }),

      // Get all employees with their custom fields
      prisma.employee.findMany({
        where: {
          tenantId,
          isActive: true,
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          title: true,
          department: true,
          phone: true,
          officeLocation: true,
          bio: true,
          photoUrl: true,
          skills: true,
          customFields: true,
        },
      }),
    ]);

    if (totalProfiles === 0) {
      return {
        totalProfiles: 0,
        completeProfiles: 0,
        averageCompleteness: 0,
        completenessPercentage: 0,
      };
    }

    // Calculate completeness for each employee
    let totalCompleteness = 0;
    let completeProfiles = 0;

    const requiredCustomFields = customFields.filter(cf => cf.isRequired);
    const optionalCustomFields = customFields.filter(cf => !cf.isRequired);

    for (const employee of employees) {
      // Standard required fields (70% weight)
      const requiredFields = ['firstName', 'lastName', 'email', 'title', 'department'];
      const completedRequired = requiredFields.filter(field => {
        const value = employee[field as keyof typeof employee];
        return value !== null && value !== undefined && value !== '';
      }).length;

      // Add required custom fields to required count
      const completedRequiredCustom = requiredCustomFields.filter(cf => {
        const customFieldValues = employee.customFields as Record<string, any> || {};
        const value = customFieldValues[cf.fieldName];
        return value !== null && value !== undefined && value !== '';
      }).length;

      const totalRequired = requiredFields.length + requiredCustomFields.length;
      const completedRequiredTotal = completedRequired + completedRequiredCustom;

      // Standard optional fields (30% weight)
      const optionalFields = ['phone', 'officeLocation', 'bio', 'skills', 'photoUrl'];
      const completedOptional = optionalFields.filter(field => {
        const value = employee[field as keyof typeof employee];
        if (field === 'skills') {
          return Array.isArray(value) && value.length > 0;
        }
        return value !== null && value !== undefined && value !== '';
      }).length;

      // Add optional custom fields to optional count
      const completedOptionalCustom = optionalCustomFields.filter(cf => {
        const customFieldValues = employee.customFields as Record<string, any> || {};
        const value = customFieldValues[cf.fieldName];
        return value !== null && value !== undefined && value !== '';
      }).length;

      const totalOptional = optionalFields.length + optionalCustomFields.length;
      const completedOptionalTotal = completedOptional + completedOptionalCustom;

      // Calculate weighted completeness (70% required, 30% optional)
      const completeness = Math.round(
        ((completedRequiredTotal / Math.max(totalRequired, 1)) * 70) + 
        ((completedOptionalTotal / Math.max(totalOptional, 1)) * 30)
      );

      totalCompleteness += completeness;

      // Consider profile complete if all required fields are filled (including custom fields)
      if (completedRequiredTotal === totalRequired) {
        completeProfiles++;
      }
    }

    const averageCompleteness = Math.round(totalCompleteness / totalProfiles);

    return {
      totalProfiles,
      completeProfiles,
      averageCompleteness,
      completenessPercentage: totalProfiles > 0 ? Math.round((completeProfiles / totalProfiles) * 100) : 0,
    };
  }

  /**
   * Get detailed analytics for a specific time period
   * Supports requirements 16.2, 16.3, 16.4, 16.5
   */
  static async getDetailedAnalytics(tenantId: string, days: number = 90) {
    const [
      dashboardData,
      searchAnalytics,
      profileAnalytics,
      userActivity,
    ] = await Promise.all([
      this.getDashboardAnalytics(tenantId, days),
      this.getSearchAnalytics(tenantId, days),
      this.getProfileAnalytics(tenantId, days),
      this.getUserActivityAnalytics(tenantId, days),
    ]);

    return {
      dashboard: dashboardData,
      search: searchAnalytics,
      profiles: profileAnalytics,
      users: userActivity,
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Clean up old analytics events based on retention policy
   */
  static async cleanupOldEvents(tenantId: string, retentionDays: number = 90): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const result = await prisma.analyticsEvent.deleteMany({
      where: {
        tenantId,
        createdAt: {
          lt: cutoffDate,
        },
      },
    });

    return result.count;
  }
}