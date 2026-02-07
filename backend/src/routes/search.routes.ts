import { Router, Request, Response, NextFunction } from 'express';
import { SearchService } from '../services/search.service';
import { AnalyticsService } from '../services/analytics.service';
import { authenticateToken } from '../middleware/auth.middleware';
import { tenantMiddleware, requireTenant } from '../middleware/tenant.middleware';
import { AuthenticatedUser } from '../types';
import { prisma } from '../lib/database';
import { createClient, RedisClientType } from 'redis';

const router = Router();

// Simple async handler utility
const asyncHandler = (fn: Function) => (req: Request, res: Response, next: NextFunction) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Redis client for caching (optional - falls back to no caching if Redis unavailable)
let redisClient: RedisClientType | null = null;

// Initialize Redis client if available
const initializeRedis = async () => {
  if (process.env.REDIS_URL) {
    try {
      redisClient = createClient({
        url: process.env.REDIS_URL,
        socket: {
          connectTimeout: 5000,
        },
      });
      
      redisClient.on('error', (err) => {
        console.warn('Redis client error:', err);
        redisClient = null; // Disable caching on error
      });

      // Don't await connection here, let it connect lazily
    } catch (error) {
      console.warn('Failed to initialize Redis client:', error);
      redisClient = null;
    }
  }
};

// Initialize Redis on module load
initializeRedis();

// Apply middleware to all routes
router.use(tenantMiddleware);
router.use(requireTenant);
router.use(authenticateToken);

/**
 * GET /api/search - Advanced search employees with caching
 */
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const startTime = Date.now();
  const user = req.user as AuthenticatedUser;

  // Parse and validate query parameters
  const query = req.query.q as string || req.query.query as string || '';
  
  if (!query || query.trim().length === 0) {
    return res.json({
      results: [],
      total: 0,
      page: 1,
      pageSize: 20,
      hasMore: false,
      query: '',
      executionTime: Date.now() - startTime,
      message: 'Please enter a search term',
      cached: false,
    });
  }

  // Parse filters and pagination
  const filters = {
    department: req.query.department as string,
    title: req.query.title as string,
    skills: req.query.skills ? (req.query.skills as string).split(',') : undefined,
    isActive: req.query.includeInactive !== 'true',
  };

  const pagination = {
    page: Math.max(1, parseInt(req.query.page as string) || 1),
    pageSize: Math.min(100, Math.max(1, parseInt(req.query.pageSize as string) || 20)),
  };

  const options = {
    includeInactive: req.query.includeInactive === 'true',
    fuzzyThreshold: parseFloat(req.query.fuzzyThreshold as string) || 0.3,
    rankingWeights: req.query.customWeights ? {
      exactMatch: parseFloat(req.query.exactWeight as string) || 1.0,
      fuzzyMatch: parseFloat(req.query.fuzzyWeight as string) || 0.7,
      partialMatch: parseFloat(req.query.partialWeight as string) || 0.4,
    } : undefined,
  };

  // Create cache key
  const cacheKey = `search:${req.tenant!.id}:${Buffer.from(JSON.stringify({
    query: query.toLowerCase().trim(),
    filters,
    pagination,
    options,
  })).toString('base64')}`;

  let result;
  let cached = false;

  // Try to get from cache first
  if (redisClient) {
    try {
      const cachedResult = await redisClient.get(cacheKey);
      if (cachedResult) {
        result = JSON.parse(cachedResult);
        cached = true;
      }
    } catch (error) {
      console.warn('Redis cache read error:', error);
    }
  }

  // If not cached, perform search
  if (!result) {
    try {
      result = await SearchService.search(req.tenant!.id, {
        query,
        filters: Object.fromEntries(
          Object.entries(filters).filter(([_, value]) => value !== undefined && value !== '')
        ),
        pagination,
        options,
      });

      // Track search analytics
      await AnalyticsService.trackSearchQuery(
        req.tenant!.id,
        user?.id,
        {
          query: query.trim(),
          resultCount: result.total,
          executionTime: result.executionTime,
          filters: Object.fromEntries(
            Object.entries(filters).filter(([_, value]) => value !== undefined && value !== '')
          ),
        }
      );

      // Cache the result for 5 minutes
      if (redisClient && result.total > 0) {
        try {
          await redisClient.setEx(cacheKey, 300, JSON.stringify(result)); // 5 min TTL
        } catch (error) {
          console.warn('Redis cache write error:', error);
        }
      }
    } catch (error) {
      console.error('Search error:', error);
      return res.status(500).json({
        error: {
          code: 'SEARCH_ERROR',
          message: 'Search temporarily unavailable',
          requestId: req.headers['x-request-id'],
        },
      });
    }
  }

  const responseTime = Date.now() - startTime;

  // Check if response time exceeds 500ms requirement
  if (responseTime > 500) {
    console.warn(`Search response time exceeded 500ms: ${responseTime}ms for query "${query}"`);
  }

  // Format response
  const response: any = {
    results: result.results,
    total: result.total,
    page: result.page,
    pageSize: result.pageSize,
    hasMore: result.hasMore,
    query: result.query,
    executionTime: cached ? responseTime : result.executionTime,
    suggestions: result.suggestions || [],
    filters: {
      department: filters.department || null,
      title: filters.title || null,
      skills: filters.skills || null,
      includeInactive: options.includeInactive,
    },
    meta: {
      responseTime: `${responseTime}ms`,
      cached,
      resultCount: result.results.length,
      searchTypes: [...new Set(result.results.map((r: any) => r.matchType))],
    },
  };

  // Add "no results" message if appropriate
  if (result.total === 0) {
    response.message = result.suggestions && result.suggestions.length > 0
      ? `No results found for "${query}". Did you mean: ${result.suggestions.join(', ')}?`
      : `No results found for "${query}". Try different keywords or check spelling.`;
  }

  res.json(response);
}));

/**
 * GET /api/search/suggestions - Get search suggestions
 */
router.get('/suggestions', asyncHandler(async (req: Request, res: Response) => {
  const query = req.query.q as string || '';
  const limit = Math.min(10, Math.max(1, parseInt(req.query.limit as string) || 5));

  if (!query || query.length < 2) {
    return res.json({
      suggestions: [],
      query,
      message: query.length === 0 ? 'Enter at least 2 characters' : 'Query too short',
    });
  }

  // Use the search service to get suggestions
  const searchResult = await SearchService.search(req.tenant!.id, {
    query,
    pagination: { page: 1, pageSize: 1 }, // We only need suggestions
  });

  res.json({
    suggestions: searchResult.suggestions?.slice(0, limit) || [],
    query,
    count: searchResult.suggestions?.length || 0,
  });
}));

/**
 * GET /api/search/autocomplete - Get autocomplete suggestions based on existing data
 */
router.get('/autocomplete', asyncHandler(async (req: Request, res: Response) => {
  const query = req.query.q as string || '';
  const type = req.query.type as string || 'all'; // 'names', 'titles', 'departments', 'skills', 'all'
  const limit = Math.min(10, Math.max(1, parseInt(req.query.limit as string) || 5));

  if (!query || query.length < 2) {
    return res.json({
      suggestions: [],
      query,
      type,
    });
  }

  // Get autocomplete suggestions from database
  let suggestions: string[] = [];

  try {
    if (type === 'names' || type === 'all') {
      const nameResults = await prisma.$queryRaw<Array<{ suggestion: string }>>`
        SELECT DISTINCT first_name as suggestion
        FROM employees 
        WHERE tenant_id = ${req.tenant!.id}::uuid
          AND is_active = true
          AND first_name ILIKE ${query + '%'}
        UNION
        SELECT DISTINCT last_name as suggestion
        FROM employees 
        WHERE tenant_id = ${req.tenant!.id}::uuid
          AND is_active = true
          AND last_name ILIKE ${query + '%'}
        ORDER BY suggestion
        LIMIT ${limit}
      `;
      suggestions.push(...nameResults.map((r: any) => r.suggestion));
    }

    if (type === 'titles' || type === 'all') {
      const titleResults = await prisma.$queryRaw<Array<{ suggestion: string }>>`
        SELECT DISTINCT title as suggestion
        FROM employees 
        WHERE tenant_id = ${req.tenant!.id}::uuid
          AND is_active = true
          AND title IS NOT NULL
          AND title ILIKE ${query + '%'}
        ORDER BY suggestion
        LIMIT ${limit}
      `;
      suggestions.push(...titleResults.map((r: any) => r.suggestion));
    }

    if (type === 'departments' || type === 'all') {
      const deptResults = await prisma.$queryRaw<Array<{ suggestion: string }>>`
        SELECT DISTINCT department as suggestion
        FROM employees 
        WHERE tenant_id = ${req.tenant!.id}::uuid
          AND is_active = true
          AND department IS NOT NULL
          AND department ILIKE ${query + '%'}
        ORDER by suggestion
        LIMIT ${limit}
      `;
      suggestions.push(...deptResults.map((r: any) => r.suggestion));
    }

    // Remove duplicates and limit results
    suggestions = [...new Set(suggestions)].slice(0, limit);

  } catch (error) {
    console.warn('Autocomplete query failed:', error);
    suggestions = [];
  }

  res.json({
    suggestions,
    query,
    type,
    count: suggestions.length,
  });
}));

/**
 * POST /api/search/track - Track search analytics (for click tracking)
 */
router.post('/track', asyncHandler(async (req: Request, res: Response) => {
  const { query, resultCount, clickedResult } = req.body;
  const user = req.user as AuthenticatedUser;

  if (!query || typeof query !== 'string') {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Query is required',
        requestId: req.headers['x-request-id'],
      },
    });
  }

  // Track search click analytics using the new analytics service
  try {
    await AnalyticsService.trackSearchQuery(
      req.tenant!.id,
      user?.id,
      {
        query: query.trim(),
        resultCount: parseInt(resultCount) || 0,
        executionTime: 0, // Not available for click tracking
        clickedResult: clickedResult || null,
      }
    );

    res.json({
      message: 'Search analytics tracked successfully',
    });
  } catch (error) {
    console.warn('Failed to track search analytics:', error);
    res.status(500).json({
      error: {
        code: 'ANALYTICS_ERROR',
        message: 'Failed to track search analytics',
        requestId: req.headers['x-request-id'],
      },
    });
  }
}));

/**
 * DELETE /api/search/cache - Clear search cache (admin only)
 */
router.delete('/cache', asyncHandler(async (req: Request, res: Response) => {
  const user = req.user as AuthenticatedUser;

  // Check admin permissions
  if (user.role !== 'admin' && user.role !== 'super_admin') {
    return res.status(403).json({
      error: {
        code: 'FORBIDDEN',
        message: 'Admin access required to clear search cache',
        requestId: req.headers['x-request-id'],
      },
    });
  }

  if (!redisClient) {
    return res.json({
      message: 'No cache to clear (Redis not available)',
    });
  }

  try {
    // Clear all search cache keys for this tenant
    const pattern = `search:${req.tenant!.id}:*`;
    const keys = await redisClient.keys(pattern);
    
    if (keys.length > 0) {
      await redisClient.del(keys);
    }

    res.json({
      message: `Search cache cleared successfully (${keys.length} entries removed)`,
      keysCleared: keys.length,
    });
  } catch (error) {
    console.error('Failed to clear search cache:', error);
    res.status(500).json({
      error: {
        code: 'CACHE_ERROR',
        message: 'Failed to clear search cache',
        requestId: req.headers['x-request-id'],
      },
    });
  }
}));

/**
 * GET /api/search/stats - Get search statistics (admin only)
 */
router.get('/stats', asyncHandler(async (req: Request, res: Response) => {
  const user = req.user as AuthenticatedUser;

  // Check admin permissions
  if (user.role !== 'admin' && user.role !== 'super_admin') {
    return res.status(403).json({
      error: {
        code: 'FORBIDDEN',
        message: 'Admin access required to view search statistics',
        requestId: req.headers['x-request-id'],
      },
    });
  }

  const days = Math.min(365, Math.max(1, parseInt(req.query.days as string) || 30));

  try {
    // Get search statistics from analytics events using the new analytics service
    const searchAnalytics = await AnalyticsService.getSearchAnalytics(req.tenant!.id, days);

    res.json({
      period: searchAnalytics.period,
      statistics: searchAnalytics.statistics,
      topQueries: searchAnalytics.topQueries,
      trends: searchAnalytics.trends,
      cacheStatus: {
        enabled: !!redisClient,
        connected: redisClient ? await redisClient.ping() === 'PONG' : false,
      },
    });
  } catch (error) {
    console.error('Failed to get search statistics:', error);
    res.status(500).json({
      error: {
        code: 'STATS_ERROR',
        message: 'Failed to retrieve search statistics',
        requestId: req.headers['x-request-id'],
      },
    });
  }
}));

export default router;