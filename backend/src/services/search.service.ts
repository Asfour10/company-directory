import { prisma } from '../lib/database';
import { ValidationError } from '../utils/errors';
import { redisClient } from '../lib/redis';
import crypto from 'crypto';

export interface SearchQuery {
  query: string;
  filters?: {
    department?: string;
    title?: string;
    skills?: string[];
    isActive?: boolean;
  };
  pagination?: {
    page?: number;
    pageSize?: number;
  };
  options?: {
    fuzzyThreshold?: number; // 0.1 to 1.0, lower = more fuzzy
    includeInactive?: boolean;
    rankingWeights?: {
      exactMatch: number;
      fuzzyMatch: number;
      partialMatch: number;
    };
  };
}

export interface SearchResult {
  id: string;
  firstName: string;
  lastName: string;
  title?: string;
  department?: string;
  email: string;
  photoUrl?: string;
  skills: string[];
  isActive: boolean;
  rank: number;
  matchType: 'exact' | 'fuzzy' | 'partial';
  matchedFields: string[];
}

export interface SearchResponse {
  results: SearchResult[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
  query: string;
  executionTime: number;
  suggestions?: string[];
}

/**
 * Advanced search service with ranking and fuzzy matching
 */
export class SearchService {
  private static readonly DEFAULT_PAGE_SIZE = 20;
  private static readonly MAX_PAGE_SIZE = 100;

  /**
   * Perform advanced search with ranking and Redis caching
   */
  static async search(
    tenantId: string,
    searchQuery: SearchQuery
  ): Promise<SearchResponse> {
    const startTime = Date.now();
    
    // Generate cache key based on search parameters
    const cacheKey = this.generateSearchCacheKey(tenantId, searchQuery);
    
    // Try to get from cache first
    const cachedResult = await redisClient.getSearchResults(tenantId, cacheKey);
    if (cachedResult) {
      // Update execution time to reflect cache hit
      return {
        ...cachedResult,
        executionTime: Date.now() - startTime,
      };
    }
    
    // Validate and sanitize input
    const sanitizedQuery = this.sanitizeQuery(searchQuery.query);
    if (!sanitizedQuery) {
      return this.emptyResponse(searchQuery, Date.now() - startTime);
    }

    const page = searchQuery.pagination?.page || 1;
    const pageSize = Math.min(
      searchQuery.pagination?.pageSize || this.DEFAULT_PAGE_SIZE,
      this.MAX_PAGE_SIZE
    );
    const offset = (page - 1) * pageSize;

    // Build search queries for different match types
    const queries = this.buildSearchQueries(tenantId, searchQuery, sanitizedQuery);
    
    // Execute searches in parallel
    const [exactResults, fuzzyResults, partialResults] = await Promise.all([
      this.executeExactSearch(queries.exact, pageSize, offset),
      this.executeFuzzySearch(queries.fuzzy, pageSize, offset),
      this.executePartialSearch(queries.partial, pageSize, offset),
    ]);

    // Combine and rank results
    const combinedResults = this.combineAndRankResults(
      exactResults,
      fuzzyResults,
      partialResults,
      searchQuery.options?.rankingWeights
    );

    // Apply pagination to final results
    const paginatedResults = combinedResults.slice(offset, offset + pageSize);
    
    // Get total count for pagination
    const total = combinedResults.length;

    const executionTime = Date.now() - startTime;

    const result: SearchResponse = {
      results: paginatedResults,
      total,
      page,
      pageSize,
      hasMore: offset + pageSize < total,
      query: searchQuery.query,
      executionTime,
      suggestions: await this.generateSuggestions(tenantId, sanitizedQuery),
    };

    // Cache the result
    await redisClient.setSearchResults(tenantId, cacheKey, result);

    return result;
  }

  /**
   * Sanitize search query
   */
  private static sanitizeQuery(query: string): string {
    if (!query || typeof query !== 'string') {
      return '';
    }

    // Remove special characters that could break PostgreSQL queries
    const sanitized = query
      .trim()
      .replace(/[&|!()]/g, ' ') // Remove PostgreSQL FTS operators
      .replace(/\s+/g, ' ') // Normalize whitespace
      .substring(0, 100); // Limit length

    return sanitized;
  }

  /**
   * Generate cache key for search query
   */
  private static generateSearchCacheKey(_tenantId: string, searchQuery: SearchQuery): string {
    // Create a hash of the search parameters for consistent caching
    const searchParams = {
      query: searchQuery.query,
      filters: searchQuery.filters || {},
      pagination: searchQuery.pagination || {},
      options: searchQuery.options || {},
    };
    
    const paramsString = JSON.stringify(searchParams);
    const hash = crypto.createHash('md5').update(paramsString).digest('hex');
    
    return hash;
  }

  /**
   * Build different types of search queries
   */
  private static buildSearchQueries(
    tenantId: string,
    searchQuery: SearchQuery,
    sanitizedQuery: string
  ) {
    const baseWhere: any = {
      tenantId,
      isActive: searchQuery.options?.includeInactive ? undefined : true,
    };

    // Add filters
    if (searchQuery.filters?.department) {
      baseWhere.department = {
        equals: searchQuery.filters.department,
        mode: 'insensitive' as const,
      };
    }

    if (searchQuery.filters?.title) {
      baseWhere.title = {
        contains: searchQuery.filters.title,
        mode: 'insensitive' as const,
      };
    }

    if (searchQuery.filters?.skills && searchQuery.filters.skills.length > 0) {
      baseWhere.skills = {
        hasEvery: searchQuery.filters.skills,
      };
    }

    // Exact match query (full-text search)
    const exactWhere = {
      ...baseWhere,
      searchVector: {
        search: sanitizedQuery.split(' ').join(' & '),
      },
    };

    // Fuzzy match query (trigram similarity)
    const fuzzyWhere = {
      ...baseWhere,
      OR: [
        {
          firstName: {
            search: sanitizedQuery,
          },
        },
        {
          lastName: {
            search: sanitizedQuery,
          },
        },
        {
          title: {
            search: sanitizedQuery,
          },
        },
      ],
    };

    // Partial match query (case-insensitive contains)
    const partialWhere = {
      ...baseWhere,
      OR: [
        {
          firstName: {
            contains: sanitizedQuery,
            mode: 'insensitive' as const,
          },
        },
        {
          lastName: {
            contains: sanitizedQuery,
            mode: 'insensitive' as const,
          },
        },
        {
          email: {
            contains: sanitizedQuery,
            mode: 'insensitive' as const,
          },
        },
        {
          title: {
            contains: sanitizedQuery,
            mode: 'insensitive' as const,
          },
        },
        {
          department: {
            contains: sanitizedQuery,
            mode: 'insensitive' as const,
          },
        },
      ],
    };

    return {
      exact: exactWhere,
      fuzzy: fuzzyWhere,
      partial: partialWhere,
    };
  }

  /**
   * Execute exact search using full-text search
   */
  private static async executeExactSearch(
    where: any,
    limit: number,
    offset: number
  ): Promise<Array<SearchResult & { rawRank: number }>> {
    try {
      // Use raw SQL for ts_rank functionality
      const results = await prisma.$queryRaw<Array<{
        id: string;
        first_name: string;
        last_name: string;
        title: string | null;
        department: string | null;
        email: string;
        photo_url: string | null;
        skills: string[];
        is_active: boolean;
        rank: number;
      }>>`
        SELECT 
          id,
          first_name,
          last_name,
          title,
          department,
          email,
          photo_url,
          skills,
          is_active,
          ts_rank(search_vector, to_tsquery('english', ${where.searchVector.search})) as rank
        FROM employees 
        WHERE tenant_id = ${where.tenantId}::uuid
          AND is_active = ${where.isActive !== undefined ? where.isActive : true}
          AND search_vector @@ to_tsquery('english', ${where.searchVector.search})
        ORDER BY rank DESC
        LIMIT ${limit + offset}
        OFFSET ${offset}
      `;

      return results.map(row => ({
        id: row.id,
        firstName: row.first_name,
        lastName: row.last_name,
        title: row.title || undefined,
        department: row.department || undefined,
        email: row.email,
        photoUrl: row.photo_url || undefined,
        skills: row.skills,
        isActive: row.is_active,
        rank: row.rank,
        rawRank: row.rank,
        matchType: 'exact' as const,
        matchedFields: this.getMatchedFields(row, where.searchVector.search),
      }));
    } catch (error) {
      console.warn('Exact search failed:', error);
      return [];
    }
  }

  /**
   * Execute fuzzy search using trigram similarity
   */
  private static async executeFuzzySearch(
    where: any,
    limit: number,
    offset: number
  ): Promise<Array<SearchResult & { rawRank: number }>> {
    try {
      // Use raw SQL for similarity functionality
      const searchTerm = where.OR[0].firstName.search;
      const results = await prisma.$queryRaw<Array<{
        id: string;
        first_name: string;
        last_name: string;
        title: string | null;
        department: string | null;
        email: string;
        photo_url: string | null;
        skills: string[];
        is_active: boolean;
        similarity: number;
      }>>`
        SELECT 
          id,
          first_name,
          last_name,
          title,
          department,
          email,
          photo_url,
          skills,
          is_active,
          GREATEST(
            similarity(first_name, ${searchTerm}),
            similarity(last_name, ${searchTerm}),
            similarity(COALESCE(title, ''), ${searchTerm})
          ) as similarity
        FROM employees 
        WHERE tenant_id = ${where.tenantId}::uuid
          AND is_active = ${where.isActive !== undefined ? where.isActive : true}
          AND (
            similarity(first_name, ${searchTerm}) > 0.3
            OR similarity(last_name, ${searchTerm}) > 0.3
            OR similarity(COALESCE(title, ''), ${searchTerm}) > 0.3
          )
        ORDER BY similarity DESC
        LIMIT ${limit + offset}
        OFFSET ${offset}
      `;

      return results.map(row => ({
        id: row.id,
        firstName: row.first_name,
        lastName: row.last_name,
        title: row.title || undefined,
        department: row.department || undefined,
        email: row.email,
        photoUrl: row.photo_url || undefined,
        skills: row.skills,
        isActive: row.is_active,
        rank: row.similarity * 0.8, // Weight fuzzy matches lower than exact
        rawRank: row.similarity,
        matchType: 'fuzzy' as const,
        matchedFields: this.getFuzzyMatchedFields(row, searchTerm),
      }));
    } catch (error) {
      console.warn('Fuzzy search failed:', error);
      return [];
    }
  }

  /**
   * Execute partial search using case-insensitive contains
   */
  private static async executePartialSearch(
    where: any,
    limit: number,
    offset: number
  ): Promise<Array<SearchResult & { rawRank: number }>> {
    try {
      const employees = await prisma.employee.findMany({
        where,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          title: true,
          department: true,
          email: true,
          photoUrl: true,
          skills: true,
          isActive: true,
        },
        take: limit + offset,
        skip: offset,
      });

      return employees.map(employee => ({
        id: employee.id,
        firstName: employee.firstName,
        lastName: employee.lastName,
        title: employee.title || undefined,
        department: employee.department || undefined,
        email: employee.email,
        photoUrl: employee.photoUrl || undefined,
        skills: employee.skills,
        isActive: employee.isActive,
        rank: 0.5, // Lower rank for partial matches
        rawRank: 0.5,
        matchType: 'partial' as const,
        matchedFields: this.getPartialMatchedFields(employee, where.OR[0]),
      }));
    } catch (error) {
      console.warn('Partial search failed:', error);
      return [];
    }
  }

  /**
   * Combine and rank results from different search types
   */
  private static combineAndRankResults(
    exactResults: Array<SearchResult & { rawRank: number }>,
    fuzzyResults: Array<SearchResult & { rawRank: number }>,
    partialResults: Array<SearchResult & { rawRank: number }>,
    weights?: { exactMatch: number; fuzzyMatch: number; partialMatch: number }
  ): SearchResult[] {
    const defaultWeights = {
      exactMatch: 1.0,
      fuzzyMatch: 0.7,
      partialMatch: 0.4,
    };

    const finalWeights = { ...defaultWeights, ...weights };

    // Create a map to deduplicate results
    const resultMap = new Map<string, SearchResult>();

    // Add exact results with highest weight
    exactResults.forEach(result => {
      const weightedRank = result.rawRank * finalWeights.exactMatch;
      resultMap.set(result.id, {
        ...result,
        rank: weightedRank,
      });
    });

    // Add fuzzy results (only if not already present with higher rank)
    fuzzyResults.forEach(result => {
      const weightedRank = result.rawRank * finalWeights.fuzzyMatch;
      const existing = resultMap.get(result.id);
      
      if (!existing || existing.rank < weightedRank) {
        resultMap.set(result.id, {
          ...result,
          rank: weightedRank,
        });
      }
    });

    // Add partial results (only if not already present with higher rank)
    partialResults.forEach(result => {
      const weightedRank = result.rawRank * finalWeights.partialMatch;
      const existing = resultMap.get(result.id);
      
      if (!existing || existing.rank < weightedRank) {
        resultMap.set(result.id, {
          ...result,
          rank: weightedRank,
        });
      }
    });

    // Convert to array and sort by rank
    return Array.from(resultMap.values())
      .sort((a, b) => b.rank - a.rank);
  }

  /**
   * Get matched fields for exact search
   */
  private static getMatchedFields(row: any, searchTerm: string): string[] {
    const fields: string[] = [];
    const terms = searchTerm.toLowerCase().split(' & ');

    terms.forEach(term => {
      if (row.first_name?.toLowerCase().includes(term)) fields.push('firstName');
      if (row.last_name?.toLowerCase().includes(term)) fields.push('lastName');
      if (row.title?.toLowerCase().includes(term)) fields.push('title');
      if (row.department?.toLowerCase().includes(term)) fields.push('department');
      if (row.email?.toLowerCase().includes(term)) fields.push('email');
      if (row.skills?.some((skill: string) => skill.toLowerCase().includes(term))) {
        fields.push('skills');
      }
    });

    return [...new Set(fields)]; // Remove duplicates
  }

  /**
   * Get matched fields for fuzzy search
   */
  private static getFuzzyMatchedFields(row: any, searchTerm: string): string[] {
    const fields: string[] = [];
    const term = searchTerm.toLowerCase();

    // Simple similarity check (could be enhanced with actual similarity calculation)
    if (row.first_name?.toLowerCase().includes(term)) fields.push('firstName');
    if (row.last_name?.toLowerCase().includes(term)) fields.push('lastName');
    if (row.title?.toLowerCase().includes(term)) fields.push('title');

    return fields;
  }

  /**
   * Get matched fields for partial search
   */
  private static getPartialMatchedFields(employee: any, orCondition: any): string[] {
    const fields: string[] = [];
    const searchTerm = orCondition.firstName?.contains?.toLowerCase() || '';

    if (employee.firstName?.toLowerCase().includes(searchTerm)) fields.push('firstName');
    if (employee.lastName?.toLowerCase().includes(searchTerm)) fields.push('lastName');
    if (employee.email?.toLowerCase().includes(searchTerm)) fields.push('email');
    if (employee.title?.toLowerCase().includes(searchTerm)) fields.push('title');
    if (employee.department?.toLowerCase().includes(searchTerm)) fields.push('department');

    return fields;
  }

  /**
   * Generate search suggestions
   */
  private static async generateSuggestions(
    tenantId: string,
    query: string
  ): Promise<string[]> {
    if (query.length < 2) return [];

    try {
      // Get common terms from existing data
      const suggestions = await prisma.$queryRaw<Array<{ suggestion: string }>>`
        SELECT DISTINCT 
          CASE 
            WHEN similarity(first_name, ${query}) > 0.3 THEN first_name
            WHEN similarity(last_name, ${query}) > 0.3 THEN last_name
            WHEN similarity(COALESCE(title, ''), ${query}) > 0.3 THEN title
            WHEN similarity(COALESCE(department, ''), ${query}) > 0.3 THEN department
          END as suggestion
        FROM employees 
        WHERE tenant_id = ${tenantId}::uuid
          AND is_active = true
          AND (
            similarity(first_name, ${query}) > 0.3
            OR similarity(last_name, ${query}) > 0.3
            OR similarity(COALESCE(title, ''), ${query}) > 0.3
            OR similarity(COALESCE(department, ''), ${query}) > 0.3
          )
        ORDER BY suggestion
        LIMIT 5
      `;

      return suggestions
        .map(s => s.suggestion)
        .filter(s => s && s !== query)
        .slice(0, 5);
    } catch (error) {
      console.warn('Failed to generate suggestions:', error);
      return [];
    }
  }

  /**
   * Create empty response
   */
  private static emptyResponse(searchQuery: SearchQuery, executionTime: number): SearchResponse {
    return {
      results: [],
      total: 0,
      page: searchQuery.pagination?.page || 1,
      pageSize: searchQuery.pagination?.pageSize || this.DEFAULT_PAGE_SIZE,
      hasMore: false,
      query: searchQuery.query,
      executionTime,
      suggestions: [],
    };
  }

  /**
   * Validate search query
   */
  static validateSearchQuery(query: SearchQuery): void {
    if (!query.query || typeof query.query !== 'string') {
      throw new ValidationError('Search query is required and must be a string', 'query');
    }

    if (query.query.length > 100) {
      throw new ValidationError('Search query must not exceed 100 characters', 'query');
    }

    if (query.pagination?.page && query.pagination.page < 1) {
      throw new ValidationError('Page must be greater than 0', 'page');
    }

    if (query.pagination?.pageSize && (query.pagination.pageSize < 1 || query.pagination.pageSize > 100)) {
      throw new ValidationError('Page size must be between 1 and 100', 'pageSize');
    }

    if (query.options?.fuzzyThreshold && (query.options.fuzzyThreshold < 0.1 || query.options.fuzzyThreshold > 1.0)) {
      throw new ValidationError('Fuzzy threshold must be between 0.1 and 1.0', 'fuzzyThreshold');
    }
  }

  /**
   * Invalidate search cache for a tenant
   */
  static async invalidateSearchCache(tenantId: string): Promise<void> {
    await redisClient.invalidateSearchByTenant(tenantId);
  }
}