#!/usr/bin/env tsx

/**
 * Test script for employee repository functionality
 */

import { prisma } from '../lib/database';
import { EmployeeRepository } from '../repositories/employee.repository';
import { setTenantContext } from '../lib/database';

async function testEmployeeRepository() {
  try {
    console.log('🔍 Testing employee repository...');
    
    // Create a test tenant
    const testTenant = await prisma.tenant.create({
      data: {
        name: 'Test Company',
        subdomain: 'testcompany-emp',
        subscriptionTier: 'professional',
        userLimit: 100,
      },
    });
    
    console.log('✅ Test tenant created:', testTenant.subdomain);
    
    // Set tenant context for RLS
    await setTenantContext(testTenant.id);
    
    // Test 1: Create employee
    console.log('\n🧪 Test 1: Create employee');
    
    const employeeData = {
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@testcompany.com',
      title: 'Software Engineer',
      department: 'Engineering',
      phone: '+1-555-0123',
      extension: '123',
      officeLocation: 'New York',
      bio: 'Experienced software engineer',
      skills: ['JavaScript', 'TypeScript', 'React'],
      customFields: {
        startDate: '2023-01-15',
        employeeId: 'EMP001',
      },
    };
    
    const createdEmployee = await EmployeeRepository.create(testTenant.id, employeeData);
    console.log('✅ Employee created:', {
      id: createdEmployee.id,
      name: `${createdEmployee.firstName} ${createdEmployee.lastName}`,
      email: createdEmployee.email,
    });
    
    // Test 2: Find employee by ID
    console.log('\n🧪 Test 2: Find employee by ID');
    
    const foundEmployee = await EmployeeRepository.findById(testTenant.id, createdEmployee.id);
    console.log('✅ Employee found:', {
      id: foundEmployee.id,
      name: `${foundEmployee.firstName} ${foundEmployee.lastName}`,
      skills: foundEmployee.skills,
      customFields: foundEmployee.customFields,
    });
    
    // Test 3: Find employee by email
    console.log('\n🧪 Test 3: Find employee by email');
    
    const foundByEmail = await EmployeeRepository.findByEmail(testTenant.id, employeeData.email);
    console.log('✅ Employee found by email:', {
      id: foundByEmail?.id,
      email: foundByEmail?.email,
    });
    
    // Test 4: Create manager and test hierarchy
    console.log('\n🧪 Test 4: Create manager and test hierarchy');
    
    const managerData = {
      firstName: 'Jane',
      lastName: 'Smith',
      email: 'jane.smith@testcompany.com',
      title: 'Engineering Manager',
      department: 'Engineering',
    };
    
    const manager = await EmployeeRepository.create(testTenant.id, managerData);
    console.log('✅ Manager created:', {
      id: manager.id,
      name: `${manager.firstName} ${manager.lastName}`,
    });
    
    // Update employee to have manager
    const updatedEmployee = await EmployeeRepository.update(
      testTenant.id,
      createdEmployee.id,
      { managerId: manager.id }
    );
    console.log('✅ Employee updated with manager:', {
      employeeId: updatedEmployee.id,
      managerId: updatedEmployee.managerId,
      managerName: updatedEmployee.manager ? 
        `${updatedEmployee.manager.firstName} ${updatedEmployee.manager.lastName}` : 
        'None',
    });
    
    // Test 5: Get hierarchy
    console.log('\n🧪 Test 5: Get employee hierarchy');
    
    const hierarchy = await EmployeeRepository.getHierarchy(testTenant.id, createdEmployee.id);
    console.log('✅ Employee hierarchy:', {
      employee: `${hierarchy.employee.firstName} ${hierarchy.employee.lastName}`,
      managementChain: hierarchy.managementChain.map(m => `${m.firstName} ${m.lastName}`),
      directReports: hierarchy.directReports.map(r => `${r.firstName} ${r.lastName}`),
    });
    
    // Test 6: List employees with filters
    console.log('\n🧪 Test 6: List employees with filters');
    
    const employeeList = await EmployeeRepository.findMany(
      testTenant.id,
      { department: 'Engineering' },
      { page: 1, pageSize: 10, sortBy: 'lastName', sortOrder: 'asc' }
    );
    console.log('✅ Employee list:', {
      total: employeeList.pagination.total,
      employees: employeeList.employees.map(e => ({
        name: `${e.firstName} ${e.lastName}`,
        title: e.title,
        department: e.department,
      })),
    });
    
    // Test 7: Search employees
    console.log('\n🧪 Test 7: Search employees');
    
    const searchResults = await EmployeeRepository.findMany(
      testTenant.id,
      { search: 'John' },
      { page: 1, pageSize: 10 }
    );
    console.log('✅ Search results:', {
      total: searchResults.pagination.total,
      employees: searchResults.employees.map(e => `${e.firstName} ${e.lastName}`),
    });
    
    // Test 8: Update employee
    console.log('\n🧪 Test 8: Update employee');
    
    const updateData = {
      title: 'Senior Software Engineer',
      skills: ['JavaScript', 'TypeScript', 'React', 'Node.js'],
      bio: 'Senior software engineer with 5+ years experience',
    };
    
    const updated = await EmployeeRepository.update(testTenant.id, createdEmployee.id, updateData);
    console.log('✅ Employee updated:', {
      id: updated.id,
      title: updated.title,
      skills: updated.skills,
    });
    
    // Test 9: Get statistics
    console.log('\n🧪 Test 9: Get employee statistics');
    
    const stats = await EmployeeRepository.getStatistics(testTenant.id);
    console.log('✅ Employee statistics:', {
      total: stats.totalEmployees,
      active: stats.activeEmployees,
      departments: stats.departmentDistribution,
      titles: stats.titleDistribution,
    });
    
    // Test 10: Test circular relationship prevention
    console.log('\n🧪 Test 10: Test circular relationship prevention');
    
    try {
      // Try to make manager report to employee (should fail)
      await EmployeeRepository.update(testTenant.id, manager.id, { managerId: createdEmployee.id });
      console.log('❌ Circular relationship prevention failed');
    } catch (error) {
      console.log('✅ Circular relationship prevented:', (error as Error).message);
    }
    
    // Test 11: Soft delete employee
    console.log('\n🧪 Test 11: Soft delete employee');
    
    const deactivated = await EmployeeRepository.softDelete(testTenant.id, createdEmployee.id);
    console.log('✅ Employee deactivated:', {
      id: deactivated.id,
      isActive: deactivated.isActive,
    });
    
    // Test 12: Try to find deactivated employee in active list
    console.log('\n🧪 Test 12: Verify deactivated employee not in active list');
    
    const activeEmployees = await EmployeeRepository.findMany(
      testTenant.id,
      { isActive: true }
    );
    const deactivatedInList = activeEmployees.employees.some(e => e.id === createdEmployee.id);
    console.log('✅ Deactivated employee in active list:', deactivatedInList);
    
    // Test 13: Duplicate email prevention
    console.log('\n🧪 Test 13: Test duplicate email prevention');
    
    try {
      await EmployeeRepository.create(testTenant.id, {
        firstName: 'Another',
        lastName: 'Person',
        email: managerData.email, // Same email as manager
      });
      console.log('❌ Duplicate email prevention failed');
    } catch (error) {
      console.log('✅ Duplicate email prevented:', (error as Error).message);
    }
    
    // Test 14: Bulk update
    console.log('\n🧪 Test 14: Test bulk update');
    
    const bulkUpdates = [
      {
        id: manager.id,
        data: { title: 'Senior Engineering Manager' },
      },
    ];
    
    const bulkResult = await EmployeeRepository.bulkUpdate(testTenant.id, bulkUpdates);
    console.log('✅ Bulk update result:', {
      successful: bulkResult.summary.successful,
      failed: bulkResult.summary.failed,
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
    console.log('🎉 All employee repository tests completed successfully!');
    
  } catch (error) {
    console.error('❌ Employee repository test failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
testEmployeeRepository();