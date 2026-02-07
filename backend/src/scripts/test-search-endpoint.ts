#!/usr/bin/env tsx

/**
 * Test script for search API endpoint
 */

import { prisma } from '../lib/database';
import { EmployeeService } from '../services/employee.service';
import { setTenantContext } from '../lib/database';
import express from 'express';
import request from 'supertest';
import searchRoutes from '../routes/search.routes';

async function testSearchEndpoint() {
  try {
    console.log('🔍 Testing search API endpoint...');
    
    // Create a test tenant
    const testTenant = await prisma.tenant.create({
      data: {
        name: 'Search API Test Company',
        subdomain: 'searchapi',
        subscriptionTier: 'professional',
        userLimit: 100,
      },
    });
    
    console.log('✅ Test tenant created:', testTenant.subdomain);
    
    // Set tenant context for RLS
    await setTenantContext(testTenant.id);
    
    const context = {
      tenantId: testTenant.id,
      userId: 'test-user-123',
      userRole: 'admin',
      ipAddress: '127.0.0.1',
      userAgent: 'Test Agent',
    };
    
    // Create test employees
    console.log('\n📝 Creating test employees...');
    
    const testEmployees = [
      {
        firstName: 'John',
        lastName: 'Smith',
        email: 'john.smith@searchapi.com',
        title: 'Senior Software Engineer',
        department: 'Engineering',
        bio: 'Full-stack developer with React expertise',
        skills: ['JavaScript', 'React', 'Node.js', 'TypeScript'],
      },
      {
        firstName: 'Jane',
        lastName: 'Doe',
        email: 'jane.doe@searchapi.com',
        title: 'Product Manager',
        department: 'Product',
        bio: 'Product strategy and user research expert',
        skills: ['Product Management', 'User Research', 'Analytics'],
      },
      {
        firstName: 'Michael',
        lastName: 'Johnson',
        email: 'michael.johnson@searchapi.com',
        title: 'DevOps Engineer',
        department: 'Engineering',
        bio: 'Infrastructure and deployment specialist',
        skills: ['AWS', 'Docker', 'Kubernetes', 'Python'],
      },
    ];
    
    for (const employeeData of testEmployees) {
      await EmployeeService.createEmployee(employeeData, context);
    }
    
    console.log(`✅ Created ${testEmployees.length} test employees`);
    
    // Create Express app for testing
    const app = express();
    app.use(express.json());
    
    // Mock middleware for testing
    app.use((req, res, next) => {
      req.tenant = { id: testTenant.id };
      req.user = { 
        id: 'test-user-123', 
        role: 'admin',
        email: 'test@example.com',
        isActive: true,
      };
      next();
    });
    
    app.use('/api/search', searchRoutes);
    
    // Test 1: Basic search functionality
    console.log('\n🧪 Test 1: Basic search functionality');
    
    const basicSearchResponse = await request(app)
      .get('/api/search')
      .query({ q: 'Engineer' })
      .expect(200);
    
    console.log('✅ Basic search results:', {
      query: 'Engineer',
      total: basicSearchResponse.body.total,
      resultCount: basicSearchResponse.body.results.length,
      responseTime: basicSearchResponse.body.meta.responseTime,
      cached: basicSearchResponse.body.meta.cached,
    });
    
    // Test 2: Search with filters
    console.log('\n🧪 Test 2: Search with filters');
    
    const filteredSearchResponse = await request(app)
      .get('/api/search')
      .query({ 
        q: 'Engineer',
        department: 'Engineering',
        pageSize: 10,
      })
      .expect(200);
    
    console.log('✅ Filtered search results:', {
      query: 'Engineer + department:Engineering',
      total: filteredSearchResponse.body.total,
      resultCount: filteredSearchResponse.body.results.length,
      filters: filteredSearchResponse.body.filters,
    });
    
    // Test 3: Pagination
    console.log('\n🧪 Test 3: Pagination');
    
    const paginationResponse = await request(app)
      .get('/api/search')
      .query({ 
        q: 'a', // Should match multiple results
        page: 1,
        pageSize: 2,
      })
      .expect(200);
    
    console.log('✅ Pagination results:', {
      query: 'a',
      page: paginationResponse.body.page,
      pageSize: paginationResponse.body.pageSize,
      total: paginationResponse.body.total,
      hasMore: paginationResponse.body.hasMore,
      resultCount: paginationResponse.body.results.length,
    });
    
    // Test 4: Empty query handling
    console.log('\n🧪 Test 4: Empty query handling');
    
    const emptyQueryResponse = await request(app)
      .get('/api/search')
      .query({ q: '' })
      .expect(200);
    
    console.log('✅ Empty query response:', {
      total: emptyQueryResponse.body.total,
      message: emptyQueryResponse.body.message,
    });
    
    // Test 5: No results handling
    console.log('\n🧪 Test 5: No results handling');
    
    const noResultsResponse = await request(app)
      .get('/api/search')
      .query({ q: 'NonExistentTerm' })
      .expect(200);
    
    console.log('✅ No results response:', {
      query: 'NonExistentTerm',
      total: noResultsResponse.body.total,
      message: noResultsResponse.body.message,
      suggestions: noResultsResponse.body.suggestions,
    });
    
    // Test 6: Performance test (should be under 500ms)
    console.log('\n🧪 Test 6: Performance test');
    
    const performanceStart = Date.now();
    const performanceResponse = await request(app)
      .get('/api/search')
      .query({ q: 'Engineer' })
      .expect(200);
    const performanceEnd = Date.now();
    
    const totalResponseTime = performanceEnd - performanceStart;
    const searchExecutionTime = parseInt(performanceResponse.body.meta.responseTime);
    
    console.log('✅ Performance test results:', {
      totalResponseTime: `${totalResponseTime}ms`,
      searchExecutionTime: `${searchExecutionTime}ms`,
      under500ms: totalResponseTime < 500,
      cached: performanceResponse.body.meta.cached,
    });
    
    if (totalResponseTime > 500) {
      console.warn('⚠️  Response time exceeded 500ms requirement');
    }
    
    // Test 7: Search suggestions
    console.log('\n🧪 Test 7: Search suggestions');
    
    const suggestionsResponse = await request(app)
      .get('/api/search/suggestions')
      .query({ q: 'Eng', limit: 5 })
      .expect(200);
    
    console.log('✅ Suggestions response:', {
      query: 'Eng',
      suggestions: suggestionsResponse.body.suggestions,
      count: suggestionsResponse.body.count,
    });
    
    // Test 8: Autocomplete
    console.log('\n🧪 Test 8: Autocomplete');
    
    const autocompleteResponse = await request(app)
      .get('/api/search/autocomplete')
      .query({ q: 'Jo', type: 'names', limit: 5 })
      .expect(200);
    
    console.log('✅ Autocomplete response:', {
      query: 'Jo',
      type: 'names',
      suggestions: autocompleteResponse.body.suggestions,
      count: autocompleteResponse.body.count,
    });
    
    // Test 9: Search analytics tracking
    console.log('\n🧪 Test 9: Search analytics tracking');
    
    const trackingResponse = await request(app)
      .post('/api/search/track')
      .send({
        query: 'Engineer',
        resultCount: 2,
        clickedResult: 'john.smith@searchapi.com',
      })
      .expect(200);
    
    console.log('✅ Analytics tracking response:', {
      message: trackingResponse.body.message,
    });
    
    // Test 10: Cache clearing (admin only)
    console.log('\n🧪 Test 10: Cache clearing');
    
    const cacheClearResponse = await request(app)
      .delete('/api/search/cache')
      .expect(200);
    
    console.log('✅ Cache clear response:', {
      message: cacheClearResponse.body.message,
      keysCleared: cacheClearResponse.body.keysCleared,
    });
    
    // Test 11: Search statistics (admin only)
    console.log('\n🧪 Test 11: Search statistics');
    
    const statsResponse = await request(app)
      .get('/api/search/stats')
      .query({ days: 30 })
      .expect(200);
    
    console.log('✅ Search statistics:', {
      period: statsResponse.body.period,
      statistics: statsResponse.body.statistics,
      topQueries: statsResponse.body.topQueries,
      cacheStatus: statsResponse.body.cacheStatus,
    });
    
    // Test 12: Invalid parameters
    console.log('\n🧪 Test 12: Invalid parameters validation');
    
    // Test invalid page size
    const invalidPageSizeResponse = await request(app)
      .get('/api/search')
      .query({ q: 'test', pageSize: 200 }) // Should be capped at 100
      .expect(200);
    
    console.log('✅ Page size validation:', {
      requestedPageSize: 200,
      actualPageSize: invalidPageSizeResponse.body.pageSize,
      capped: invalidPageSizeResponse.body.pageSize <= 100,
    });
    
    // Test 13: Skills filter
    console.log('\n🧪 Test 13: Skills filter');
    
    const skillsFilterResponse = await request(app)
      .get('/api/search')
      .query({ 
        q: 'Engineer',
        skills: 'JavaScript,React',
      })
      .expect(200);
    
    console.log('✅ Skills filter results:', {
      query: 'Engineer + skills:JavaScript,React',
      total: skillsFilterResponse.body.total,
      filters: skillsFilterResponse.body.filters,
    });
    
    // Test 14: Include inactive employees
    console.log('\n🧪 Test 14: Include inactive employees');
    
    const includeInactiveResponse = await request(app)
      .get('/api/search')
      .query({ 
        q: 'Engineer',
        includeInactive: 'true',
      })
      .expect(200);
    
    console.log('✅ Include inactive results:', {
      query: 'Engineer (include inactive)',
      total: includeInactiveResponse.body.total,
      includeInactive: includeInactiveResponse.body.filters.includeInactive,
    });
    
    // Test 15: Response format validation
    console.log('\n🧪 Test 15: Response format validation');
    
    const formatResponse = await request(app)
      .get('/api/search')
      .query({ q: 'Engineer' })
      .expect(200);
    
    const requiredFields = [
      'results', 'total', 'page', 'pageSize', 'hasMore', 
      'query', 'executionTime', 'suggestions', 'filters', 'meta'
    ];
    
    const missingFields = requiredFields.filter(field => 
      !(field in formatResponse.body)
    );
    
    console.log('✅ Response format validation:', {
      hasAllRequiredFields: missingFields.length === 0,
      missingFields,
      responseKeys: Object.keys(formatResponse.body),
    });
    
    // Clean up test data
    console.log('\n🧹 Cleaning up test data...');
    
    await prisma.analyticsEvent.deleteMany({
      where: { tenantId: testTenant.id },
    });
    
    await prisma.employee.deleteMany({
      where: { tenantId: testTenant.id },
    });
    
    await prisma.tenant.delete({
      where: { id: testTenant.id },
    });
    
    console.log('✅ Test data cleaned up');
    console.log('🎉 All search endpoint tests completed successfully!');
    
  } catch (error) {
    console.error('❌ Search endpoint test failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
testSearchEndpoint();