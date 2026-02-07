import { SearchService, SearchQuery, SearchResult } from '../search.service';
import { prisma } from '../../lib/database';
import { redisClient } from '../../lib/redis';
import { ValidationError } from '../../utils/errors';

// Mock dependencies
jest.mock('../../lib/database', () => ({
  prisma: {
    employee: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
    $queryRaw: jest.fn(),
  },
}));

jest.mock('../../lib/redis', () => ({
  redisClient: {
    get: jest.fn(),
    setex: jest.fn(),
    del: jest.fn(),
  },
}));

const mockPrisma = prisma as jest.Mocked<typeof prisma>;
const mockRedis = redisClient as jest.Mocked<typeof redisClient>;

describe('SearchService', () => {
  const testTenantId = 'tenant-123';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('search', () => {
    const basicQuery: SearchQuery = {
      query: 'john doe',
      pagination: { page: 1, pageSize: 10 },
    };

    const mockEmployees = [
      {
        id: 'employee-1',
        firstName: 'John',
        lastName: 'Doe',
        title: 'Software Engineer',
        department: 'Engineering',
        email: 'john.doe@example.com',
        photoUrl: 'https://example.com/photo1.jpg',
        skills: ['JavaScript', 'TypeScript'],
        isActive: true,
      },
      {
        id: 'employee-2',
        firstName: 'Jane',
        lastName: 'Doe',
        title: 'Designer',
        department: 'Design',
        email: 'jane.doe@example.com',
        photoUrl: null,
        skills: ['Figma', 'Sketch'],
        isActive: true,
      },
    ];

    it('should perform basic text search', async () => {
      mockRedis.get.mockResolvedValue(null); // No cache
      mockPrisma.$queryRaw.mockResolvedValue([
        { ...mockEmployees[0], rank: 0.9, match_type: 'exact', matched_fields: ['firstName', 'lastName'] },
        { ...mockEmployees[1], rank: 0.7, match_type: 'partial', matched_fields: ['lastName'] },
      ]);
      mockPrisma.employee.count.mockResolvedValue(2);

      const result = await SearchService.search(testTenantId, basicQuery);

      expect(result.results).toHaveLength(2);
      expect(result.results[0].firstName).toBe('John');
      expect(result.results[0].rank).toBe(0.9);
      expect(result.results[0].matchType).toBe('exact');
      expect(result.results[0].matchedFields).toEqual(['firstName', 'lastName']);
      expect(result.total).toBe(2);
      expect(result.query).toBe('john doe');
      expect(result.hasMore).toBe(false);
    });

    it('should return cached results when available', async () => {
      const cachedResult = {
        results: [mockEmployees[0]],
        total: 1,
        page: 1,
        pageSize: 10,
        hasMore: false,
        query: 'john doe',
        executionTime: 50,
        cached: true,
      };

      mockRedis.get.mockResolvedValue(JSON.stringify(cachedResult));

      const result = await SearchService.search(testTenantId, basicQuery);

      expect(result).toEqual(cachedResult);
      expect(mockPrisma.$queryRaw).not.toHaveBeenCalled();
      expect(result.cached).toBe(true);
    });

    it('should apply department filter', async () => {
      const queryWithFilter: SearchQuery = {
        ...basicQuery,
        filters: { department: 'Engineering' },
      };

      mockRedis.get.mockResolvedValue(null);
      mockPrisma.$queryRaw.mockResolvedValue([
        { ...mockEmployees[0], rank: 0.9, match_type: 'exact', matched_fields: ['firstName'] },
      ]);
      mockPrisma.employee.count.mockResolvedValue(1);

      const result = await SearchService.search(testTenantId, queryWithFilter);

      expect(result.results).toHaveLength(1);
      expect(result.results[0].department).toBe('Engineering');
      expect(mockPrisma.$queryRaw).toHaveBeenCalledWith(
        expect.arrayContaining([expect.stringContaining('department = $')])
      );
    });

    it('should apply title filter', async () => {
      const queryWithFilter: SearchQuery = {
        ...basicQuery,
        filters: { title: 'Software Engineer' },
      };

      mockRedis.get.mockResolvedValue(null);
      mockPrisma.$queryRaw.mockResolvedValue([
        { ...mockEmployees[0], rank: 0.9, match_type: 'exact', matched_fields: ['title'] },
      ]);
      mockPrisma.employee.count.mockResolvedValue(1);

      await SearchService.search(testTenantId, queryWithFilter);

      expect(mockPrisma.$queryRaw).toHaveBeenCalledWith(
        expect.arrayContaining([expect.stringContaining('title ILIKE $')])
      );
    });

    it('should apply skills filter', async () => {
      const queryWithFilter: SearchQuery = {
        ...basicQuery,
        filters: { skills: ['JavaScript', 'TypeScript'] },
      };

      mockRedis.get.mockResolvedValue(null);
      mockPrisma.$queryRaw.mockResolvedValue([
        { ...mockEmployees[0], rank: 0.9, match_type: 'exact', matched_fields: ['skills'] },
      ]);
      mockPrisma.employee.count.mockResolvedValue(1);

      await SearchService.search(testTenantId, queryWithFilter);

      expect(mockPrisma.$queryRaw).toHaveBeenCalledWith(
        expect.arrayContaining([expect.stringContaining('skills && $')])
      );
    });

    it('should handle empty search query', async () => {
      const emptyQuery: SearchQuery = {
        query: '',
        pagination: { page: 1, pageSize: 10 },
      };

      mockPrisma.employee.findMany.mockResolvedValue(mockEmployees);
      mockPrisma.employee.count.mockResolvedValue(2);

      const result = await SearchService.search(testTenantId, emptyQuery);

      expect(result.results).toHaveLength(2);
      expect(mockPrisma.employee.findMany).toHaveBeenCalledWith({
        where: {
          tenantId: testTenantId,
          isActive: true,
        },
        select: expect.any(Object),
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
        skip: 0,
        take: 10,
      });
    });

    it('should cache search results', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockPrisma.$queryRaw.mockResolvedValue([
        { ...mockEmployees[0], rank: 0.9, match_type: 'exact', matched_fields: ['firstName'] },
      ]);
      mockPrisma.employee.count.mockResolvedValue(1);

      await SearchService.search(testTenantId, basicQuery);

      expect(mockRedis.setex).toHaveBeenCalledWith(
        expect.stringContaining('search:'),
        300, // 5 minutes TTL
        expect.any(String)
      );
    });

    it('should handle pagination correctly', async () => {
      const paginatedQuery: SearchQuery = {
        query: 'engineer',
        pagination: { page: 2, pageSize: 5 },
      };

      mockRedis.get.mockResolvedValue(null);
      mockPrisma.$queryRaw.mockResolvedValue([mockEmployees[0]]);
      mockPrisma.employee.count.mockResolvedValue(10);

      const result = await SearchService.search(testTenantId, paginatedQuery);

      expect(result.page).toBe(2);
      expect(result.pageSize).toBe(5);
      expect(result.hasMore).toBe(true);
      expect(mockPrisma.$queryRaw).toHaveBeenCalledWith(
        expect.arrayContaining([expect.stringContaining('OFFSET $')]),
        expect.arrayContaining([5]) // skip = (page - 1) * pageSize
      );
    });

    it('should validate search query length', async () => {
      const longQuery: SearchQuery = {
        query: 'a'.repeat(101), // Exceeds 100 character limit
        pagination: { page: 1, pageSize: 10 },
      };

      await expect(SearchService.search(testTenantId, longQuery)).rejects.toThrow(ValidationError);
      await expect(SearchService.search(testTenantId, longQuery)).rejects.toThrow(
        'Search query must be between 1 and 100 characters'
      );
    });

    it('should validate pagination parameters', async () => {
      const invalidPagination: SearchQuery = {
        query: 'test',
        pagination: { page: 0, pageSize: 101 }, // Invalid page and pageSize
      };

      await expect(SearchService.search(testTenantId, invalidPagination)).rejects.toThrow(ValidationError);
    });

    it('should handle fuzzy matching', async () => {
      const fuzzyQuery: SearchQuery = {
        query: 'jhon doe', // Misspelled
        options: { fuzzyThreshold: 0.7 },
        pagination: { page: 1, pageSize: 10 },
      };

      mockRedis.get.mockResolvedValue(null);
      mockPrisma.$queryRaw.mockResolvedValue([
        { ...mockEmployees[0], rank: 0.8, match_type: 'fuzzy', matched_fields: ['firstName', 'lastName'] },
      ]);
      mockPrisma.employee.count.mockResolvedValue(1);

      const result = await SearchService.search(testTenantId, fuzzyQuery);

      expect(result.results[0].matchType).toBe('fuzzy');
      expect(result.results[0].rank).toBe(0.8);
    });

    it('should include inactive employees when specified', async () => {
      const queryWithInactive: SearchQuery = {
        query: 'john',
        options: { includeInactive: true },
        pagination: { page: 1, pageSize: 10 },
      };

      mockRedis.get.mockResolvedValue(null);
      mockPrisma.$queryRaw.mockResolvedValue([
        { ...mockEmployees[0], rank: 0.9, match_type: 'exact', matched_fields: ['firstName'] },
      ]);
      mockPrisma.employee.count.mockResolvedValue(1);

      await SearchService.search(testTenantId, queryWithInactive);

      // Should not filter by isActive when includeInactive is true
      expect(mockPrisma.$queryRaw).toHaveBeenCalledWith(
        expect.arrayContaining([expect.not.stringContaining('is_active = true')])
      );
    });
  });

  describe('searchSuggestions', () => {
    it('should return search suggestions', async () => {
      const mockSuggestions = [
        { suggestion: 'john doe', count: 5, type: 'name' },
        { suggestion: 'software engineer', count: 3, type: 'title' },
        { suggestion: 'engineering', count: 8, type: 'department' },
      ];

      mockPrisma.$queryRaw.mockResolvedValue(mockSuggestions);

      const result = await SearchService.searchSuggestions(testTenantId, 'jo');

      expect(result).toEqual(mockSuggestions);
      expect(mockPrisma.$queryRaw).toHaveBeenCalledWith(
        expect.arrayContaining([expect.stringContaining('UNION ALL')])
      );
    });

    it('should validate suggestion query length', async () => {
      await expect(SearchService.searchSuggestions(testTenantId, 'a')).rejects.toThrow(ValidationError);
      await expect(SearchService.searchSuggestions(testTenantId, 'a')).rejects.toThrow(
        'Suggestion query must be at least 2 characters'
      );
    });
  });

  describe('getPopularSearches', () => {
    it('should return popular searches from analytics', async () => {
      const mockPopularSearches = [
        { query: 'john doe', count: 25 },
        { query: 'software engineer', count: 18 },
        { query: 'marketing', count: 12 },
      ];

      mockPrisma.$queryRaw.mockResolvedValue(mockPopularSearches);

      const result = await SearchService.getPopularSearches(testTenantId, 10);

      expect(result).toEqual(mockPopularSearches);
      expect(mockPrisma.$queryRaw).toHaveBeenCalledWith(
        expect.arrayContaining([expect.stringContaining('analytics_events')])
      );
    });

    it('should limit results correctly', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([]);

      await SearchService.getPopularSearches(testTenantId, 5);

      expect(mockPrisma.$queryRaw).toHaveBeenCalledWith(
        expect.arrayContaining([expect.stringContaining('LIMIT $')]),
        expect.arrayContaining([5])
      );
    });
  });

  describe('clearSearchCache', () => {
    it('should clear search cache for tenant', async () => {
      mockRedis.del.mockResolvedValue(1);

      await SearchService.clearSearchCache(testTenantId);

      expect(mockRedis.del).toHaveBeenCalledWith(`search:${testTenantId}:*`);
    });
  });

  describe('buildSearchQuery', () => {
    it('should build basic search query', () => {
      const query = 'john doe';
      const result = (SearchService as any).buildSearchQuery(query, {}, {});

      expect(result.sql).toContain('ts_rank');
      expect(result.sql).toContain('to_tsquery');
      expect(result.params).toContain('john & doe');
    });

    it('should handle special characters in query', () => {
      const query = 'john@doe.com';
      const result = (SearchService as any).buildSearchQuery(query, {}, {});

      expect(result.params[0]).toBe('john & doe & com');
    });

    it('should apply ranking weights', () => {
      const query = 'john';
      const options = {
        rankingWeights: {
          exactMatch: 2.0,
          fuzzyMatch: 1.0,
          partialMatch: 0.5,
        },
      };

      const result = (SearchService as any).buildSearchQuery(query, {}, options);

      expect(result.sql).toContain('2.0');
      expect(result.sql).toContain('1.0');
      expect(result.sql).toContain('0.5');
    });
  });

  describe('generateCacheKey', () => {
    it('should generate consistent cache keys', () => {
      const query: SearchQuery = {
        query: 'john doe',
        filters: { department: 'Engineering' },
        pagination: { page: 1, pageSize: 10 },
      };

      const key1 = (SearchService as any).generateCacheKey(testTenantId, query);
      const key2 = (SearchService as any).generateCacheKey(testTenantId, query);

      expect(key1).toBe(key2);
      expect(key1).toContain(testTenantId);
    });

    it('should generate different keys for different queries', () => {
      const query1: SearchQuery = { query: 'john', pagination: { page: 1, pageSize: 10 } };
      const query2: SearchQuery = { query: 'jane', pagination: { page: 1, pageSize: 10 } };

      const key1 = (SearchService as any).generateCacheKey(testTenantId, query1);
      const key2 = (SearchService as any).generateCacheKey(testTenantId, query2);

      expect(key1).not.toBe(key2);
    });
  });

  describe('error handling', () => {
    it('should handle database errors gracefully', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockPrisma.$queryRaw.mockRejectedValue(new Error('Database connection failed'));

      await expect(SearchService.search(testTenantId, basicQuery)).rejects.toThrow(
        'Database connection failed'
      );
    });

    it('should handle Redis errors gracefully', async () => {
      mockRedis.get.mockRejectedValue(new Error('Redis connection failed'));
      mockPrisma.$queryRaw.mockResolvedValue([mockEmployees[0]]);
      mockPrisma.employee.count.mockResolvedValue(1);

      // Should still work without cache
      const result = await SearchService.search(testTenantId, basicQuery);

      expect(result.results).toHaveLength(1);
      expect(result.cached).toBeUndefined();
    });
  });
});