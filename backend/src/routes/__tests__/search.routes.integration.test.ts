import request from 'supertest';
import express from 'express';
import searchRoutes from '../search.routes';
import { prisma } from '../../lib/database';
import { createErrorHandler } from '../../utils/errors';

// Mock the search service
jest.mock('../../services/search.service', () => ({
  SearchService: {
    search: jest.fn(),
    searchSuggestions: jest.fn(),
    getPopularSearches: jest.fn(),
    clearSearchCache: jest.fn(),
  },
}));

// Mock the analytics service for tracking
jest.mock('../../services/analytics.service', () => ({
  AnalyticsService: {
    trackSearchQuery: jest.fn(),
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

import { SearchService } from '../../services/search.service';
import { AnalyticsService } from '../../services/analytics.service';

const mockSearchService = SearchService as jest.Mocked<typeof SearchService>;
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
    email: 'user@test.com', 
    role: 'user',
    tenantId: 'test-tenant-id'
  };
  next();
});

app.use('/api/search', searchRoutes);
app.use(createErrorHandler());

describe('Search Routes Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/search', () => {
    it('should perform basic search', async () => {
      const mockSearchResults = {
        results: [
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
            rank: 0.9,
            matchType: 'exact' as const,
            matchedFields: ['firstName', 'lastName'],
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
            rank: 0.7,
            matchType: 'partial' as const,
            matchedFields: ['lastName'],
          },
        ],
        total: 2,
        page: 1,
        pageSize: 10,
        hasMore: false,
        query: 'john doe',
        executionTime: 45,
      };

      mockSearchService.search.mockResolvedValue(mockSearchResults);

      const response = await request(app)
        .get('/api/search')
        .query({ q: 'john doe' })
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: mockSearchResults,
      });

      expect(mockSearchService.search).toHaveBeenCalledWith('test-tenant-id', {
        query: 'john doe',
        pagination: { page: 1, pageSize: 10 },
      });

      expect(mockAnalyticsService.trackSearchQuery).toHaveBeenCalledWith(
        'test-tenant-id',
        'test-user-id',
        {
          query: 'john doe',
          resultCount: 2,
          executionTime: 45,
        }
      );
    });

    it('should apply filters', async () => {
      const mockSearchResults = {
        results: [
          {
            id: 'employee-1',
            firstName: 'John',
            lastName: 'Smith',
            title: 'Software Engineer',
            department: 'Engineering',
            email: 'john.smith@example.com',
            photoUrl: null,
            skills: ['JavaScript', 'React'],
            isActive: true,
            rank: 0.95,
            matchType: 'exact' as const,
            matchedFields: ['firstName', 'title'],
          },
        ],
        total: 1,
        page: 1,
        pageSize: 10,
        hasMore: false,
        query: 'john',
        executionTime: 32,
      };

      mockSearchService.search.mockResolvedValue(mockSearchResults);

      const response = await request(app)
        .get('/api/search')
        .query({
          q: 'john',
          department: 'Engineering',
          title: 'Software Engineer',
          skills: 'JavaScript,React',
        })
        .expect(200);

      expect(mockSearchService.search).toHaveBeenCalledWith('test-tenant-id', {
        query: 'john',
        filters: {
          department: 'Engineering',
          title: 'Software Engineer',
          skills: ['JavaScript', 'React'],
        },
        pagination: { page: 1, pageSize: 10 },
      });
    });

    it('should handle pagination parameters', async () => {
      const mockSearchResults = {
        results: [],
        total: 50,
        page: 3,
        pageSize: 5,
        hasMore: true,
        query: 'engineer',
        executionTime: 28,
      };

      mockSearchService.search.mockResolvedValue(mockSearchResults);

      const response = await request(app)
        .get('/api/search')
        .query({
          q: 'engineer',
          page: '3',
          pageSize: '5',
        })
        .expect(200);

      expect(mockSearchService.search).toHaveBeenCalledWith('test-tenant-id', {
        query: 'engineer',
        pagination: { page: 3, pageSize: 5 },
      });
    });

    it('should handle search options', async () => {
      const mockSearchResults = {
        results: [
          {
            id: 'employee-1',
            firstName: 'John',
            lastName: 'Doe',
            title: 'Software Engineer',
            department: 'Engineering',
            email: 'john.doe@example.com',
            photoUrl: null,
            skills: ['JavaScript'],
            isActive: true,
            rank: 0.8,
            matchType: 'fuzzy' as const,
            matchedFields: ['firstName'],
          },
        ],
        total: 1,
        page: 1,
        pageSize: 10,
        hasMore: false,
        query: 'jhon', // Misspelled
        executionTime: 55,
      };

      mockSearchService.search.mockResolvedValue(mockSearchResults);

      const response = await request(app)
        .get('/api/search')
        .query({
          q: 'jhon',
          fuzzyThreshold: '0.7',
          includeInactive: 'true',
        })
        .expect(200);

      expect(mockSearchService.search).toHaveBeenCalledWith('test-tenant-id', {
        query: 'jhon',
        options: {
          fuzzyThreshold: 0.7,
          includeInactive: true,
        },
        pagination: { page: 1, pageSize: 10 },
      });
    });

    it('should return 400 for missing query parameter', async () => {
      const response = await request(app)
        .get('/api/search')
        .expect(400);

      expect(response.body).toEqual({
        success: false,
        error: {
          message: 'Search query is required',
          code: 'VALIDATION_ERROR',
        },
      });

      expect(mockSearchService.search).not.toHaveBeenCalled();
    });

    it('should return 400 for empty query', async () => {
      const response = await request(app)
        .get('/api/search')
        .query({ q: '' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 for query too long', async () => {
      const longQuery = 'a'.repeat(101); // Exceeds 100 character limit

      const response = await request(app)
        .get('/api/search')
        .query({ q: longQuery })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should handle search service errors', async () => {
      mockSearchService.search.mockRejectedValue(new Error('Database connection failed'));

      const response = await request(app)
        .get('/api/search')
        .query({ q: 'test' })
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toBe('Database connection failed');
    });

    it('should track search analytics even on errors', async () => {
      mockSearchService.search.mockRejectedValue(new Error('Search failed'));

      await request(app)
        .get('/api/search')
        .query({ q: 'test query' })
        .expect(500);

      expect(mockAnalyticsService.trackSearchQuery).toHaveBeenCalledWith(
        'test-tenant-id',
        'test-user-id',
        {
          query: 'test query',
          resultCount: 0,
          executionTime: expect.any(Number),
          error: 'Search failed',
        }
      );
    });
  });

  describe('GET /api/search/suggestions', () => {
    it('should return search suggestions', async () => {
      const mockSuggestions = [
        { suggestion: 'john doe', count: 5, type: 'name' },
        { suggestion: 'software engineer', count: 3, type: 'title' },
        { suggestion: 'engineering', count: 8, type: 'department' },
      ];

      mockSearchService.searchSuggestions.mockResolvedValue(mockSuggestions);

      const response = await request(app)
        .get('/api/search/suggestions')
        .query({ q: 'jo' })
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: mockSuggestions,
      });

      expect(mockSearchService.searchSuggestions).toHaveBeenCalledWith('test-tenant-id', 'jo');
    });

    it('should return 400 for missing query parameter', async () => {
      const response = await request(app)
        .get('/api/search/suggestions')
        .expect(400);

      expect(response.body).toEqual({
        success: false,
        error: {
          message: 'Query parameter is required',
          code: 'VALIDATION_ERROR',
        },
      });
    });

    it('should return 400 for query too short', async () => {
      const response = await request(app)
        .get('/api/search/suggestions')
        .query({ q: 'a' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET /api/search/popular', () => {
    it('should return popular searches', async () => {
      const mockPopularSearches = [
        { query: 'john doe', count: 25 },
        { query: 'software engineer', count: 18 },
        { query: 'marketing', count: 12 },
        { query: 'design', count: 10 },
        { query: 'product manager', count: 8 },
      ];

      mockSearchService.getPopularSearches.mockResolvedValue(mockPopularSearches);

      const response = await request(app)
        .get('/api/search/popular')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: mockPopularSearches,
      });

      expect(mockSearchService.getPopularSearches).toHaveBeenCalledWith('test-tenant-id', 10);
    });

    it('should accept custom limit parameter', async () => {
      const mockPopularSearches = [
        { query: 'john doe', count: 25 },
        { query: 'software engineer', count: 18 },
        { query: 'marketing', count: 12 },
      ];

      mockSearchService.getPopularSearches.mockResolvedValue(mockPopularSearches);

      const response = await request(app)
        .get('/api/search/popular')
        .query({ limit: '3' })
        .expect(200);

      expect(mockSearchService.getPopularSearches).toHaveBeenCalledWith('test-tenant-id', 3);
    });

    it('should validate limit parameter', async () => {
      const response = await request(app)
        .get('/api/search/popular')
        .query({ limit: '101' }) // Exceeds maximum
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('DELETE /api/search/cache', () => {
    it('should clear search cache (admin only)', async () => {
      // Override middleware for admin user
      const adminApp = express();
      adminApp.use(express.json());
      adminApp.use((req, res, next) => {
        req.tenant = { id: 'test-tenant-id', name: 'Test Tenant' };
        req.user = { 
          id: 'admin-user-id', 
          email: 'admin@test.com', 
          role: 'admin',
          tenantId: 'test-tenant-id'
        };
        next();
      });
      adminApp.use('/api/search', searchRoutes);
      adminApp.use(createErrorHandler());

      mockSearchService.clearSearchCache.mockResolvedValue(undefined);

      const response = await request(adminApp)
        .delete('/api/search/cache')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        message: 'Search cache cleared successfully',
      });

      expect(mockSearchService.clearSearchCache).toHaveBeenCalledWith('test-tenant-id');
    });

    it('should return 403 for non-admin users', async () => {
      const response = await request(app)
        .delete('/api/search/cache')
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('FORBIDDEN');

      expect(mockSearchService.clearSearchCache).not.toHaveBeenCalled();
    });
  });

  describe('Authentication and Authorization', () => {
    it('should require authentication', async () => {
      // Create app without auth middleware
      const unauthApp = express();
      unauthApp.use(express.json());
      unauthApp.use('/api/search', searchRoutes);
      unauthApp.use(createErrorHandler());

      const response = await request(unauthApp)
        .get('/api/search')
        .query({ q: 'test' })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });

    it('should validate tenant context', async () => {
      // Create app without tenant middleware
      const noTenantApp = express();
      noTenantApp.use(express.json());
      noTenantApp.use((req, res, next) => {
        req.user = { 
          id: 'test-user-id', 
          email: 'user@test.com', 
          role: 'user',
          tenantId: 'test-tenant-id'
        };
        // No tenant context
        next();
      });
      noTenantApp.use('/api/search', searchRoutes);
      noTenantApp.use(createErrorHandler());

      const response = await request(noTenantApp)
        .get('/api/search')
        .query({ q: 'test' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('tenant');
    });
  });

  describe('Rate limiting and performance', () => {
    it('should handle concurrent search requests', async () => {
      const mockSearchResults = {
        results: [],
        total: 0,
        page: 1,
        pageSize: 10,
        hasMore: false,
        query: 'test',
        executionTime: 25,
      };

      mockSearchService.search.mockResolvedValue(mockSearchResults);

      // Make multiple concurrent requests
      const requests = Array(5).fill(null).map(() =>
        request(app)
          .get('/api/search')
          .query({ q: 'test' })
      );

      const responses = await Promise.all(requests);

      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });

      expect(mockSearchService.search).toHaveBeenCalledTimes(5);
    });

    it('should handle search timeout gracefully', async () => {
      // Simulate timeout
      mockSearchService.search.mockImplementation(() => 
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Search timeout')), 100)
        )
      );

      const response = await request(app)
        .get('/api/search')
        .query({ q: 'test' })
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toBe('Search timeout');
    });
  });

  describe('Input validation and sanitization', () => {
    it('should sanitize search query', async () => {
      const mockSearchResults = {
        results: [],
        total: 0,
        page: 1,
        pageSize: 10,
        hasMore: false,
        query: 'test query',
        executionTime: 20,
      };

      mockSearchService.search.mockResolvedValue(mockSearchResults);

      const response = await request(app)
        .get('/api/search')
        .query({ q: '  test query  ' }) // Extra whitespace
        .expect(200);

      expect(mockSearchService.search).toHaveBeenCalledWith('test-tenant-id', {
        query: 'test query', // Trimmed
        pagination: { page: 1, pageSize: 10 },
      });
    });

    it('should validate pagination bounds', async () => {
      const response = await request(app)
        .get('/api/search')
        .query({
          q: 'test',
          page: '0', // Invalid page
          pageSize: '101', // Exceeds maximum
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should handle special characters in query', async () => {
      const mockSearchResults = {
        results: [],
        total: 0,
        page: 1,
        pageSize: 10,
        hasMore: false,
        query: 'john@doe.com',
        executionTime: 30,
      };

      mockSearchService.search.mockResolvedValue(mockSearchResults);

      const response = await request(app)
        .get('/api/search')
        .query({ q: 'john@doe.com' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(mockSearchService.search).toHaveBeenCalledWith('test-tenant-id', {
        query: 'john@doe.com',
        pagination: { page: 1, pageSize: 10 },
      });
    });
  });
});