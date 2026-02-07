#!/usr/bin/env tsx

/**
 * Test script for full-text search functionality
 */

import { prisma } from '../lib/database';
import { EmployeeService } from '../services/employee.service';
import { setTenantContext } from '../lib/database';

async function testFullTextSearch() {
  try {
    console.log('🔍 Testing full-text search functionality...');
    
    // Create a test tenant
    const testTenant = await prisma.tenant.create({
      data: {
        name: 'Search Test Company',
        subdomain: 'searchtest',
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
    
    // Create test employees with diverse data for search testing
    console.log('\n📝 Creating test employees...');
    
    const testEmployees = [
      {
        firstName: 'John',
        lastName: 'Smith',
        email: 'john.smith@searchtest.com',
        title: 'Senior Software Engineer',
        department: 'Engineering',
        bio: 'Experienced developer with expertise in JavaScript and React',
        skills: ['JavaScript', 'React', 'Node.js', 'TypeScript'],
      },
      {
        firstName: 'Jane',
        lastName: 'Doe',
        email: 'jane.doe@searchtest.com',
        title: 'Product Manager',
        department: 'Product',
        bio: 'Product management professional focused on user experience',
        skills: ['Product Management', 'User Research', 'Analytics'],
      },
      {
        firstName: 'Michael',
        lastName: 'Johnson',
        email: 'michael.johnson@searchtest.com',
        title: 'DevOps Engineer',
        department: 'Engineering',
        bio: 'Infrastructure and deployment specialist with AWS expertise',
        skills: ['AWS', 'Docker', 'Kubernetes', 'Terraform'],
      },
      {
        firstName: 'Sarah',
        lastName: 'Williams',
        email: 'sarah.williams@searchtest.com',
        title: 'UX Designer',
        department: 'Design',
        bio: 'Creative designer passionate about user-centered design',
        skills: ['UI/UX Design', 'Figma', 'User Research', 'Prototyping'],
      },
      {
        firstName: 'David',
        lastName: 'Brown',
        email: 'david.brown@searchtest.com',
        title: 'Data Scientist',
        department: 'Analytics',
        bio: 'Data analysis expert specializing in machine learning',
        skills: ['Python', 'Machine Learning', 'SQL', 'Statistics'],
      },
    ];
    
    const createdEmployees = [];
    for (const employeeData of testEmployees) {
      const employee = await EmployeeService.createEmployee(employeeData, context);
      createdEmployees.push(employee);
    }
    
    console.log(`✅ Created ${createdEmployees.length} test employees`);
    
    // Test 1: Search by first name
    console.log('\n🧪 Test 1: Search by first name');
    const firstNameResults = await EmployeeService.listEmployees(
      { search: 'John' },
      {},
      context
    );
    console.log('✅ First name search results:', {
      query: 'John',
      count: firstNameResults.employees.length,
      results: firstNameResults.employees.map(e => `${e.firstName} ${e.lastName}`),
    });
    
    // Test 2: Search by last name
    console.log('\n🧪 Test 2: Search by last name');
    const lastNameResults = await EmployeeService.listEmployees(
      { search: 'Smith' },
      {},
      context
    );
    console.log('✅ Last name search results:', {
      query: 'Smith',
      count: lastNameResults.employees.length,
      results: lastNameResults.employees.map(e => `${e.firstName} ${e.lastName}`),
    });
    
    // Test 3: Search by title
    console.log('\n🧪 Test 3: Search by title');
    const titleResults = await EmployeeService.listEmployees(
      { search: 'Engineer' },
      {},
      context
    );
    console.log('✅ Title search results:', {
      query: 'Engineer',
      count: titleResults.employees.length,
      results: titleResults.employees.map(e => `${e.firstName} ${e.lastName} - ${e.title}`),
    });
    
    // Test 4: Search by department
    console.log('\n🧪 Test 4: Search by department');
    const departmentResults = await EmployeeService.listEmployees(
      { search: 'Engineering' },
      {},
      context
    );
    console.log('✅ Department search results:', {
      query: 'Engineering',
      count: departmentResults.employees.length,
      results: departmentResults.employees.map(e => `${e.firstName} ${e.lastName} - ${e.department}`),
    });
    
    // Test 5: Search by skills
    console.log('\n🧪 Test 5: Search by skills');
    const skillsResults = await EmployeeService.listEmployees(
      { search: 'JavaScript' },
      {},
      context
    );
    console.log('✅ Skills search results:', {
      query: 'JavaScript',
      count: skillsResults.employees.length,
      results: skillsResults.employees.map(e => ({
        name: `${e.firstName} ${e.lastName}`,
        skills: e.skills,
      })),
    });
    
    // Test 6: Search by bio content
    console.log('\n🧪 Test 6: Search by bio content');
    const bioResults = await EmployeeService.listEmployees(
      { search: 'expertise' },
      {},
      context
    );
    console.log('✅ Bio search results:', {
      query: 'expertise',
      count: bioResults.employees.length,
      results: bioResults.employees.map(e => ({
        name: `${e.firstName} ${e.lastName}`,
        bio: e.bio?.substring(0, 50) + '...',
      })),
    });
    
    // Test 7: Multi-word search
    console.log('\n🧪 Test 7: Multi-word search');
    const multiWordResults = await EmployeeService.listEmployees(
      { search: 'Software Engineer' },
      {},
      context
    );
    console.log('✅ Multi-word search results:', {
      query: 'Software Engineer',
      count: multiWordResults.employees.length,
      results: multiWordResults.employees.map(e => `${e.firstName} ${e.lastName} - ${e.title}`),
    });
    
    // Test 8: Partial word search
    console.log('\n🧪 Test 8: Partial word search');
    const partialResults = await EmployeeService.listEmployees(
      { search: 'Eng' },
      {},
      context
    );
    console.log('✅ Partial word search results:', {
      query: 'Eng',
      count: partialResults.employees.length,
      results: partialResults.employees.map(e => `${e.firstName} ${e.lastName} - ${e.title || e.department}`),
    });
    
    // Test 9: Email search
    console.log('\n🧪 Test 9: Email search');
    const emailResults = await EmployeeService.listEmployees(
      { search: 'jane.doe' },
      {},
      context
    );
    console.log('✅ Email search results:', {
      query: 'jane.doe',
      count: emailResults.employees.length,
      results: emailResults.employees.map(e => `${e.firstName} ${e.lastName} - ${e.email}`),
    });
    
    // Test 10: Case insensitive search
    console.log('\n🧪 Test 10: Case insensitive search');
    const caseResults = await EmployeeService.listEmployees(
      { search: 'PRODUCT' },
      {},
      context
    );
    console.log('✅ Case insensitive search results:', {
      query: 'PRODUCT',
      count: caseResults.employees.length,
      results: caseResults.employees.map(e => `${e.firstName} ${e.lastName} - ${e.title || e.department}`),
    });
    
    // Test 11: No results search
    console.log('\n🧪 Test 11: No results search');
    const noResults = await EmployeeService.listEmployees(
      { search: 'NonExistentTerm' },
      {},
      context
    );
    console.log('✅ No results search:', {
      query: 'NonExistentTerm',
      count: noResults.employees.length,
    });
    
    // Test 12: Empty search (should return all)
    console.log('\n🧪 Test 12: Empty search');
    const allResults = await EmployeeService.listEmployees(
      { search: '' },
      {},
      context
    );
    console.log('✅ Empty search results:', {
      query: '(empty)',
      count: allResults.employees.length,
    });
    
    // Test 13: Search with filters
    console.log('\n🧪 Test 13: Search with department filter');
    const filteredResults = await EmployeeService.listEmployees(
      { search: 'Engineer', department: 'Engineering' },
      {},
      context
    );
    console.log('✅ Filtered search results:', {
      query: 'Engineer + department:Engineering',
      count: filteredResults.employees.length,
      results: filteredResults.employees.map(e => `${e.firstName} ${e.lastName} - ${e.department}`),
    });
    
    // Test 14: Performance test with pagination
    console.log('\n🧪 Test 14: Performance test with pagination');
    const startTime = Date.now();
    const paginatedResults = await EmployeeService.listEmployees(
      { search: 'Engineer' },
      { page: 1, pageSize: 10 },
      context
    );
    const endTime = Date.now();
    const responseTime = endTime - startTime;
    
    console.log('✅ Performance test results:', {
      query: 'Engineer',
      responseTime: `${responseTime}ms`,
      count: paginatedResults.employees.length,
      pagination: paginatedResults.pagination,
    });
    
    // Test 15: Verify search vector is populated
    console.log('\n🧪 Test 15: Verify search vector is populated');
    const rawEmployee = await prisma.employee.findFirst({
      where: { tenantId: testTenant.id },
      select: {
        firstName: true,
        lastName: true,
        // Note: We can't directly select tsvector in Prisma, but we can verify it exists
      },
    });
    
    // Test the search vector directly with raw SQL
    const searchVectorTest = await prisma.$queryRaw`
      SELECT 
        first_name, 
        last_name, 
        search_vector IS NOT NULL as has_search_vector,
        ts_rank(search_vector, to_tsquery('english', 'Engineer')) as rank
      FROM employees 
      WHERE tenant_id = ${testTenant.id}::uuid 
      AND search_vector @@ to_tsquery('english', 'Engineer')
      ORDER BY rank DESC
      LIMIT 3
    `;
    
    console.log('✅ Search vector verification:', {
      rawSqlResults: searchVectorTest,
    });
    
    // Test 16: Test search ranking
    console.log('\n🧪 Test 16: Test search ranking');
    const rankingTest = await prisma.$queryRaw`
      SELECT 
        first_name, 
        last_name, 
        title,
        ts_rank(search_vector, to_tsquery('english', 'Engineer')) as rank
      FROM employees 
      WHERE tenant_id = ${testTenant.id}::uuid 
      AND search_vector @@ to_tsquery('english', 'Engineer')
      ORDER BY rank DESC
    `;
    
    console.log('✅ Search ranking results:', rankingTest);
    
    // Clean up test data
    console.log('\n🧹 Cleaning up test data...');
    
    await prisma.employee.deleteMany({
      where: { tenantId: testTenant.id },
    });
    
    await prisma.tenant.delete({
      where: { id: testTenant.id },
    });
    
    console.log('✅ Test data cleaned up');
    console.log('🎉 All full-text search tests completed successfully!');
    
  } catch (error) {
    console.error('❌ Full-text search test failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
testFullTextSearch();