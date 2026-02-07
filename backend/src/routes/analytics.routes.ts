import { Router, Request, Response, NextFunction } from 'express';
import { AnalyticsService } from '../services/analytics.service';
import { authenticateToken } from '../middleware/auth.middleware';
import { tenantMiddleware, requireTenant } from '../middleware/tenant.middleware';
import { AuthenticatedUser } from '../types';

const router = Router();

// Simple async handler utility
const asyncHandler = (fn: Function) => (req: Request, res: Response, next: NextFunction) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Apply middleware to all routes
router.use(tenantMiddleware);
router.use(requireTenant);
router.use(authenticateToken);

// Middleware to check admin permissions for analytics endpoints
const requireAnalyticsAccess = (req: Request, res: Response, next: NextFunction) => {
  const user = req.user as AuthenticatedUser;
  
  if (user.role !== 'admin' && user.role !== 'super_admin') {
    return res.status(403).json({
      error: {
        code: 'FORBIDDEN',
        message: 'Admin access required to view analytics',
        requestId: req.headers['x-request-id'],
      },
    });
  }
  
  next();
};

/**
 * GET /api/analytics/summary - Get overall analytics summary
 */
router.get('/summary', requireAnalyticsAccess, asyncHandler(async (req: Request, res: Response) => {
  const days = Math.min(365, Math.max(1, parseInt(req.query.days as string) || 30));

  try {
    const summary = await AnalyticsService.getAnalyticsSummary(req.tenant!.id, days);

    res.json({
      success: true,
      data: summary,
    });
  } catch (error) {
    console.error('Failed to get analytics summary:', error);
    res.status(500).json({
      error: {
        code: 'ANALYTICS_ERROR',
        message: 'Failed to retrieve analytics summary',
        requestId: req.headers['x-request-id'],
      },
    });
  }
}));

/**
 * GET /api/analytics/search - Get search analytics
 */
router.get('/search', requireAnalyticsAccess, asyncHandler(async (req: Request, res: Response) => {
  const days = Math.min(365, Math.max(1, parseInt(req.query.days as string) || 30));

  try {
    const searchAnalytics = await AnalyticsService.getSearchAnalytics(req.tenant!.id, days);

    res.json({
      success: true,
      data: searchAnalytics,
    });
  } catch (error) {
    console.error('Failed to get search analytics:', error);
    res.status(500).json({
      error: {
        code: 'ANALYTICS_ERROR',
        message: 'Failed to retrieve search analytics',
        requestId: req.headers['x-request-id'],
      },
    });
  }
}));

/**
 * GET /api/analytics/profiles - Get profile analytics
 */
router.get('/profiles', requireAnalyticsAccess, asyncHandler(async (req: Request, res: Response) => {
  const days = Math.min(365, Math.max(1, parseInt(req.query.days as string) || 30));

  try {
    const profileAnalytics = await AnalyticsService.getProfileAnalytics(req.tenant!.id, days);

    res.json({
      success: true,
      data: profileAnalytics,
    });
  } catch (error) {
    console.error('Failed to get profile analytics:', error);
    res.status(500).json({
      error: {
        code: 'ANALYTICS_ERROR',
        message: 'Failed to retrieve profile analytics',
        requestId: req.headers['x-request-id'],
      },
    });
  }
}));

/**
 * GET /api/analytics/users - Get user activity analytics
 */
router.get('/users', requireAnalyticsAccess, asyncHandler(async (req: Request, res: Response) => {
  const days = Math.min(365, Math.max(1, parseInt(req.query.days as string) || 30));

  try {
    const userAnalytics = await AnalyticsService.getUserActivityAnalytics(req.tenant!.id, days);

    res.json({
      success: true,
      data: userAnalytics,
    });
  } catch (error) {
    console.error('Failed to get user analytics:', error);
    res.status(500).json({
      error: {
        code: 'ANALYTICS_ERROR',
        message: 'Failed to retrieve user analytics',
        requestId: req.headers['x-request-id'],
      },
    });
  }
}));

/**
 * POST /api/analytics/cleanup - Clean up old analytics events
 */
router.post('/cleanup', requireAnalyticsAccess, asyncHandler(async (req: Request, res: Response) => {
  const user = req.user as AuthenticatedUser;
  
  // Only super admins can trigger cleanup
  if (user.role !== 'super_admin') {
    return res.status(403).json({
      error: {
        code: 'FORBIDDEN',
        message: 'Super admin access required for cleanup operations',
        requestId: req.headers['x-request-id'],
      },
    });
  }

  const retentionDays = Math.min(365, Math.max(30, parseInt(req.body.retentionDays) || 90));

  try {
    const deletedCount = await AnalyticsService.cleanupOldEvents(req.tenant!.id, retentionDays);

    res.json({
      success: true,
      message: `Cleaned up ${deletedCount} old analytics events`,
      data: {
        deletedCount,
        retentionDays,
      },
    });
  } catch (error) {
    console.error('Failed to cleanup analytics events:', error);
    res.status(500).json({
      error: {
        code: 'CLEANUP_ERROR',
        message: 'Failed to cleanup analytics events',
        requestId: req.headers['x-request-id'],
      },
    });
  }
}));

/**
 * GET /api/analytics/dashboard - Get comprehensive dashboard analytics
 * Implements requirements 16.2, 16.3, 16.4, 16.5
 */
router.get('/dashboard', requireAnalyticsAccess, asyncHandler(async (req: Request, res: Response) => {
  const days = Math.min(365, Math.max(1, parseInt(req.query.days as string) || 90));

  try {
    const dashboardData = await AnalyticsService.getDashboardAnalytics(req.tenant!.id, days);

    res.json({
      success: true,
      data: dashboardData,
    });
  } catch (error) {
    console.error('Failed to get dashboard analytics:', error);
    res.status(500).json({
      error: {
        code: 'DASHBOARD_ERROR',
        message: 'Failed to retrieve dashboard analytics',
        requestId: req.headers['x-request-id'],
      },
    });
  }
}));

/**
 * GET /api/analytics/detailed - Get detailed analytics report
 * Provides comprehensive analytics data for admin dashboard
 */
router.get('/detailed', requireAnalyticsAccess, asyncHandler(async (req: Request, res: Response) => {
  const days = Math.min(365, Math.max(1, parseInt(req.query.days as string) || 90));

  try {
    const detailedAnalytics = await AnalyticsService.getDetailedAnalytics(req.tenant!.id, days);

    res.json({
      success: true,
      data: detailedAnalytics,
    });
  } catch (error) {
    console.error('Failed to get detailed analytics:', error);
    res.status(500).json({
      error: {
        code: 'ANALYTICS_ERROR',
        message: 'Failed to retrieve detailed analytics',
        requestId: req.headers['x-request-id'],
      },
    });
  }
}));

/**
 * GET /api/analytics/dashboard-legacy - Get dashboard data for analytics (legacy endpoint)
 * This endpoint provides data specifically formatted for dashboard display
 */
router.get('/dashboard-legacy', requireAnalyticsAccess, asyncHandler(async (req: Request, res: Response) => {
  const days = Math.min(365, Math.max(1, parseInt(req.query.days as string) || 30));

  try {
    const [summary, searchAnalytics, profileAnalytics, userAnalytics] = await Promise.all([
      AnalyticsService.getAnalyticsSummary(req.tenant!.id, days),
      AnalyticsService.getSearchAnalytics(req.tenant!.id, days),
      AnalyticsService.getProfileAnalytics(req.tenant!.id, days),
      AnalyticsService.getUserActivityAnalytics(req.tenant!.id, days),
    ]);

    // Format data for dashboard consumption
    const dashboardData = {
      period: summary.period,
      overview: {
        totalSearches: summary.summary.totalSearches,
        totalProfileViews: summary.summary.totalProfileViews,
        totalProfileUpdates: summary.summary.totalProfileUpdates,
        activeUsers: userAnalytics.statistics.uniqueUsers,
        totalLogins: userAnalytics.statistics.totalLogins,
      },
      topSearchQueries: summary.topSearchQueries.slice(0, 10),
      mostViewedProfiles: summary.mostViewedProfiles.slice(0, 10),
      searchTrends: searchAnalytics.trends,
      profileActivity: profileAnalytics.activity,
      loginTrends: userAnalytics.loginTrends,
      searchPerformance: {
        averageResults: searchAnalytics.statistics.averageResults,
        averageExecutionTime: searchAnalytics.statistics.averageExecutionTime,
      },
    };

    res.json({
      success: true,
      data: dashboardData,
    });
  } catch (error) {
    console.error('Failed to get dashboard analytics:', error);
    res.status(500).json({
      error: {
        code: 'DASHBOARD_ERROR',
        message: 'Failed to retrieve dashboard analytics',
        requestId: req.headers['x-request-id'],
      },
    });
  }
}));

export default router;