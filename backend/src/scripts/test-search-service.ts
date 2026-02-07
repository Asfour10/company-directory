#!/usr/bin/env tsx

/**
 * Test script for advanced search service functionality
 */

import { prisma } from '../lib/database';
import { SearchService } from '../services/search.service';
import { EmployeeService } from '../services/employee.service';
import { setTenantContext } from '../lib/database';

async function testSearchService() {
  try {
    console.log('🔍 Testing advanced search service functionality...');
    
    // Create a test tenant
    const testTenant = await prisma.tenant.create({
      data: {
        name: 'Advanced Search Test Company',
        subdomain: 'advancedsearch',
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
    
    // Create diverse test employees for comprehensive search testing
    console.log('\n📝 Creating test employees for search testing...');
    
    const testEmployees = [
      {
        firstName: 'Alexander',
        lastName: 'Johnson',
        email: 'alexander.johnson@advancedsearch.com',
        title: 'Senior Software Engineer',
        department: 'Engineering',
        bio: 'Full-stack developer with expertise in React and Node.js',
        skills: ['JavaScript', 'React', 'Node.js', 'TypeScript', 'PostgreSQL'],
      },
      {
        firstName: 'Alexandra',
        lastName: 'Smith',
        email: 'alexandra.smith@advancedsearch.com',
        title: 'Software Engineer',
        department: 'Engineering',
        bio: 'Frontend specialist passionate about user experience',
        skills: ['JavaScript', 'Vue.js', 'CSS', 'HTML', 'Figma'],
      },
      {
        firstName: 'Michael',
        lastName: 'Chen',
        email: 'michael.chen@advancedsearch.com',
        title: 'Product Manager',
        department: 'Product',
        bio: 'Product strategy and user research expert',
        skills: ['Product Management', 'User Research', 'Analytics', 'Roadmapping'],
      },
      {
        firstName: 'Michelle',
        lastName: 'Rodriguez',
        email: 'michelle.rodriguez@advancedsearch.com',
        title: 'UX Designer',
        department: 'Design',
        bio: 'Creative designer focused on accessibility and inclusive design',
        skills: ['UI/UX Design', 'Accessibility', 'Figma', 'User Testing'],
      },
      {
        firstName: 'David',
        lastName: 'Kim',
        email: 'david.kim@advancedsearch.com',
        title: 'DevOps Engineer',
        department: 'Engineering',
        bio: 'Infrastructure automation and cloud architecture specialist',
        skills: ['AWS', 'Docker', 'Kubernetes', 'Terraform', 'Python'],
      },
      {
        firstName: 'Sarah',
        lastName: 'Williams',
        email: 'sarah.williams@advancedsearch.com',
        title: 'Data Scientist',
        department: 'Analytics',
        bio: 'Machine learning and statistical analysis expert',
        skills: ['Python', 'Machine Learning', 'SQL', 'R', 'Statistics'],
      },
    ];
    
    const createdEmployees = [];
    for (const employeeData of testEmployees) {
      const employee = await EmployeeService.createEmployee(employeeData, context);
      createdEmployees.push(employee);
    }
    
    console.log(`✅ Created ${createdEmployees.length} test employees`);
    
    // Test 1: Exact match search with ranking
    console.log('\n🧪 Test 1: Exact match search with ts_rank');
    const exactSearch = await SearchService.search(testTenant.id, {
      query: 'Engineer',
      pagination: { page: 1, pageSize: 10 },
    });
    
    console.log('✅ Exact search results:', {
      query: 'Engineer',
      total: exactSearch.total,
      executionTime: `${exactSearch.executionTime}ms`,
      results: exactSearch.results.map(r => ({
        name: `${r.firstName} ${r.lastName}`,
        title: r.title,
        rank: r.rank.toFixed(3),
        matchType: r.matchType,
        matchedFields: r.matchedFields,
      })),
    });
    
    // Test 2: Fuzzy matching with trigram similarity
    console.log('\n🧪 Test 2: Fuzzy matching with pg_trgm');
    const fuzzySearch = await SearchService.search(testTenant.id, {
      query: 'Alexndr', // Misspelled "Alexander"
      pagination: { page: 1, pageSize: 10 },
    });
    
    console.log('✅ Fuzzy search results:', {
      query: 'Alexndr (misspelled)',
      total: fuzzySearch.total,
      executionTime: `${fuzzySearch.executionTime}ms`,
      results: fuzzySearch.results.map(r => ({
        name: `${r.firstName} ${r.lastName}`,
        rank: r.rank.toFixed(3),
        matchType: r.matchType,
        matchedFields: r.matchedFields,
      })),
    });
    
    // Test 3: Partial text matching for names
    console.log('\n🧪 Test 3: Partial text matching for names');
    const partialNameSearch = await SearchService.search(testTenant.id, {
      query: 'Mich',
      pagination: { page: 1, pageSize: 10 },
    });
    
    console.log('✅ Partial name search results:', {
      query: 'Mich',
      total: partialNameSearch.total,
      executionTime: `${partialNameSearch.executionTime}ms`,
      results: partialNameSearch.results.map(r => ({
        name: `${r.firstName} ${r.lastName}`,
        rank: r.rank.toFixed(3),
        matchType: r.matchType,
        matchedFields: r.matchedFields,
      })),
    });
    
    // Test 4: Partial text matching for skills
    console.log('\n🧪 Test 4: Partial text matching for skills');
    const skillsSearch = await SearchService.search(testTenant.id, {
      query: 'JavaScript',
      pagination: { page: 1, pageSize: 10 },
    });
    
    console.log('✅ Skills search results:', {
      query: 'JavaScript',
      total: skillsSearch.total,
      executionTime: `${skillsSearch.executionTime}ms`,
      results: skillsSearch.results.map(r => ({
        name: `${r.firstName} ${r.lastName}`,
        skills: r.skills.filter(s => s.toLowerCase().includes('javascript')),
        rank: r.rank.toFixed(3),
        matchType: r.matchType,
        matchedFields: r.matchedFields,
      })),
    });
    
    // Test 5: Search with filters
    console.log('\n🧪 Test 5: Search with department filter');
    const filteredSearch = await SearchService.search(testTenant.id, {
      query: 'Engineer',
      filters: {
        department: 'Engineering',
      },
      pagination: { page: 1, pageSize: 10 },
    });
    
    console.log('✅ Filtered search results:', {
      query: 'Engineer + department:Engineering',
      total: filteredSearch.total,
      executionTime: `${filteredSearch.executionTime}ms`,
      results: filteredSearch.results.map(r => ({
        name: `${r.firstName} ${r.lastName}`,
        department: r.department,
        rank: r.rank.toFixed(3),
        matchType: r.matchType,
      })),
    });
    
    // Test 6: Multi-word search with ranking
    console.log('\n🧪 Test 6: Multi-word search with ranking');
    const multiWordSearch = await SearchService.search(testTenant.id, {
      query: 'Software Engineer',
      pagination: { page: 1, pageSize: 10 },
    });
    
    console.log('✅ Multi-word search results:', {
      query: 'Software Engineer',
      total: multiWordSearch.total,
      executionTime: `${multiWordSearch.executionTime}ms`,
      results: multiWordSearch.results.map(r => ({
        name: `${r.firstName} ${r.lastName}`,
        title: r.title,
        rank: r.rank.toFixed(3),
        matchType: r.matchType,
        matchedFields: r.matchedFields,
      })),
    });
    
    // Test 7: Search suggestions
    console.log('\n🧪 Test 7: Search suggestions');
    const suggestionsSearch = await SearchService.search(testTenant.id, {
      query: 'Eng',
      pagination: { page: 1, pageSize: 5 },
    });
    
    console.log('✅ Search suggestions:', {
      query: 'Eng',
      suggestions: suggestionsSearch.suggestions,
      total: suggestionsSearch.total,
    });
    
    // Test 8: Custom ranking weights
    console.log('\n🧪 Test 8: Custom ranking weights');
    const customWeightSearch = await SearchService.search(testTenant.id, {
      query: 'Alexander',
      options: {
        rankingWeights: {
          exactMatch: 2.0,
          fuzzyMatch: 1.0,
          partialMatch: 0.2,
        },
      },
      pagination: { page: 1, pageSize: 10 },
    });
    
    console.log('✅ Custom weight search results:', {
      query: 'Alexander (custom weights)',
      total: customWeightSearch.total,
      results: customWeightSearch.results.map(r => ({
        name: `${r.firstName} ${r.lastName}`,
        rank: r.rank.toFixed(3),
        matchType: r.matchType,
      })),
    });
    
    // Test 9: Performance test with larger dataset
    console.log('\n🧪 Test 9: Performance test');
    const performanceStart = Date.now();
    const performanceSearch = await SearchService.search(testTenant.id, {
      query: 'Engineer',
      pagination: { page: 1, pageSize: 50 },
    });
    const performanceEnd = Date.now();
    
    console.log('✅ Performance test results:', {
      query: 'Engineer',
      executionTime: `${performanceEnd - performanceStart}ms`,
      serviceTime: `${performanceSearch.executionTime}ms`,
      total: performanceSearch.total,
      pageSize: performanceSearch.pageSize,
    });
    
    // Test 10: Empty query handling
    console.log('\n🧪 Test 10: Empty query handling');
    try {
      await SearchService.search(testTenant.id, {
        query: '',
        pagination: { page: 1, pageSize: 10 },
      });
      console.log('✅ Empty query handled gracefully');
    } catch (error) {
      console.log('✅ Empty query validation:', (error as Error).message);
    }
    
    // Test 11: Invalid parameters validation
    console.log('\n🧪 Test 11: Parameter validation');
    try {
      SearchService.validateSearchQuery({
        query: 'test',
        pagination: { page: -1, pageSize: 200 },
      });
      console.log('❌ Validation should have failed');
    } catch (error) {
      console.log('✅ Parameter validation:', (error as Error).message);
    }
    
    // Test 12: Search with skills filter
    console.log('\n🧪 Test 12: Search with skills filter');
    const skillsFilterSearch = await SearchService.search(testTenant.id, {
      query: 'Engineer',
      filters: {
        skills: ['JavaScript'],
      },
      pagination: { page: 1, pageSize: 10 },
    });
    
    console.log('✅ Skills filter search results:', {
      query: 'Engineer + skills:JavaScript',
      total: skillsFilterSearch.total,
      results: skillsFilterSearch.results.map(r => ({
        name: `${r.firstName} ${r.lastName}`,
        skills: r.skills,
        rank: r.rank.toFixed(3),
      })),
    });
    
    // Test 13: Pagination test
    console.log('\n🧪 Test 13: Pagination test');
    const page1 = await SearchService.search(testTenant.id, {
      query: 'a', // Should match many names
      pagination: { page: 1, pageSize: 2 },
    });
    
    const page2 = await SearchService.search(testTenant.id, {
      query: 'a',
      pagination: { page: 2, pageSize: 2 },
    });
    
    console.log('✅ Pagination test results:', {
      page1: {
        page: page1.page,
        total: page1.total,
        hasMore: page1.hasMore,
        results: page1.results.map(r => `${r.firstName} ${r.lastName}`),
      },
      page2: {
        page: page2.page,
        total: page2.total,
        hasMore: page2.hasMore,
        results: page2.results.map(r => `${r.firstName} ${r.lastName}`),
      },
    });
    
    // Test 14: Include inactive employees
    console.log('\n🧪 Test 14: Include inactive employees');
    
    // Deactivate one employee
    await EmployeeService.deactivateEmployee(createdEmployees[0].id, context);
    
    const activeOnlySearch = await SearchService.search(testTenant.id, {
      query: 'Alexander',
      pagination: { page: 1, pageSize: 10 },
    });
    
    const includeInactiveSearch = await SearchService.search(testTenant.id, {
      query: 'Alexander',
      options: { includeInactive: true },
      pagination: { page: 1, pageSize: 10 },
    });
    
    console.log('✅ Inactive employee test:', {
      activeOnly: activeOnlySearch.total,
      includeInactive: includeInactiveSearch.total,
      inactiveResults: includeInactiveSearch.results.map(r => ({
        name: `${r.firstName} ${r.lastName}`,
        isActive: r.isActive,
      })),
    });
    
    // Clean up test data
    console.log('\n🧹 Cleaning up test data...');
    
    await prisma.employee.deleteMany({
      where: { tenantId: testTenant.id },
    });
    
    await prisma.tenant.delete({
      where: { id: testTenant.id },
    });
    
    console.log('✅ Test data cleaned up');
    console.log('🎉 All advanced search service tests completed successfully!');
    
  } catch (error) {
    console.error('❌ Advanced search service test failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
testSearchService();