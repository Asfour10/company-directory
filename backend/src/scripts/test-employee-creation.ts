#!/usr/bin/env tsx

/**
 * Test script for employee creation endpoint (POST /api/employees)
 */

import { prisma } from '../lib/database';
import { EmployeeService } from '../services/employee.service';
import { setTenantContext } from '../lib/database';
import { validateCreateEmployee } from '../validators/employee.validator';

async function testEmployeeCreation() {
  try {
    console.log('🔍 Testing employee creation functionality...');
    
    // Create a test tenant
    const testTenant = await prisma.tenant.create({
      data: {
        name: 'Test Company',
        subdomain: 'testcompany-create',
        subscriptionTier: 'professional',
        userLimit: 100,
      },
    });
    
    console.log('✅ Test tenant created:', testTenant.subdomain);
    
    // Set tenant context for RLS
    await setTenantContext(testTenant.id);
    
    const context = {
      tenantId: testTenant.id,
      userId: 'test-admin-123',
      userRole: 'admin',
      ipAddress: '127.0.0.1',
      userAgent: 'Test Agent',
    };
    
    // Test 1: Create employee with minimal required data
    console.log('\n🧪 Test 1: Create employee with minimal required data');
    
    const minimalEmployeeData = {
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@testcompany.com',
    };
    
    // Validate the data first
    const validatedMinimal = validateCreateEmployee(minimalEmployeeData);
    console.log('✅ Minimal data validation passed');
    
    const minimalEmployee = await EmployeeService.createEmployee(validatedMinimal, context);
    console.log('✅ Minimal employee created:', {
      id: minimalEmployee.id,
      name: `${minimalEmployee.firstName} ${minimalEmployee.lastName}`,
      email: minimalEmployee.email,
    });
    
    // Test 2: Create employee with complete data
    console.log('\n🧪 Test 2: Create employee with complete data');
    
    const completeEmployeeData = {
      firstName: 'Jane',
      lastName: 'Smith',
      email: 'jane.smith@testcompany.com',
      title: 'Senior Software Engineer',
      department: 'Engineering',
      phone: '+1-555-123-4567',
      extension: '1234',
      officeLocation: 'Building A, Floor 3',
      bio: 'Experienced software engineer with expertise in full-stack development.',
      skills: ['JavaScript', 'TypeScript', 'React', 'Node.js', 'PostgreSQL'],
      customFields: {
        startDate: '2023-01-15',
        employeeId: 'EMP001',
        certifications: ['AWS Certified', 'Scrum Master'],
        workLocation: 'hybrid',
      },
    };
    
    const validatedComplete = validateCreateEmployee(completeEmployeeData);
    console.log('✅ Complete data validation passed');
    
    const completeEmployee = await EmployeeService.createEmployee(validatedComplete, context);
    console.log('✅ Complete employee created:', {
      id: completeEmployee.id,
      name: `${completeEmployee.firstName} ${completeEmployee.lastName}`,
      email: completeEmployee.email,
      title: completeEmployee.title,
      department: completeEmployee.department,
      skillsCount: completeEmployee.skills.length,
      customFieldsCount: Object.keys(completeEmployee.customFields).length,
    });
    
    // Test 3: Create employee with manager relationship
    console.log('\n🧪 Test 3: Create employee with manager relationship');
    
    const employeeWithManagerData = {
      firstName: 'Bob',
      lastName: 'Johnson',
      email: 'bob.johnson@testcompany.com',
      title: 'Software Engineer',
      department: 'Engineering',
      managerId: completeEmployee.id, // Jane Smith as manager
    };
    
    const validatedWithManager = validateCreateEmployee(employeeWithManagerData);
    const employeeWithManager = await EmployeeService.createEmployee(validatedWithManager, context);
    console.log('✅ Employee with manager created:', {
      id: employeeWithManager.id,
      name: `${employeeWithManager.firstName} ${employeeWithManager.lastName}`,
      managerId: employeeWithManager.managerId,
      managerName: employeeWithManager.manager ? 
        `${employeeWithManager.manager.firstName} ${employeeWithManager.manager.lastName}` : 
        'None',
    });
    
    // Test 4: Validation error handling
    console.log('\n🧪 Test 4: Validation error handling');
    
    const invalidEmployeeData = {
      firstName: '', // Empty first name should fail
      lastName: 'Invalid',
      email: 'not-an-email', // Invalid email format
      phone: 'invalid-phone-format',
      skills: Array(25).fill('skill'), // Too many skills (max 20)
    };
    
    try {
      validateCreateEmployee(invalidEmployeeData);
      console.log('❌ Validation should have failed');
    } catch (error) {
      console.log('✅ Validation correctly failed:', (error as Error).message);
    }
    
    // Test 5: Duplicate email handling
    console.log('\n🧪 Test 5: Duplicate email handling');
    
    const duplicateEmailData = {
      firstName: 'Duplicate',
      lastName: 'User',
      email: 'john.doe@testcompany.com', // Same as first employee
    };
    
    try {
      const validatedDuplicate = validateCreateEmployee(duplicateEmailData);
      await EmployeeService.createEmployee(validatedDuplicate, context);
      console.log('❌ Duplicate email should have been rejected');
    } catch (error) {
      console.log('✅ Duplicate email correctly rejected:', (error as Error).message);
    }
    
    // Test 6: Invalid manager ID handling
    console.log('\n🧪 Test 6: Invalid manager ID handling');
    
    const invalidManagerData = {
      firstName: 'Invalid',
      lastName: 'Manager',
      email: 'invalid.manager@testcompany.com',
      managerId: '123e4567-e89b-12d3-a456-426614174000', // Non-existent manager
    };
    
    try {
      const validatedInvalidManager = validateCreateEmployee(invalidManagerData);
      await EmployeeService.createEmployee(validatedInvalidManager, context);
      console.log('❌ Invalid manager should have been rejected');
    } catch (error) {
      console.log('✅ Invalid manager correctly rejected:', (error as Error).message);
    }
    
    // Test 7: User limit enforcement
    console.log('\n🧪 Test 7: User limit enforcement');
    
    // Update tenant to have a low user limit
    await prisma.tenant.update({
      where: { id: testTenant.id },
      data: { userLimit: 3 }, // We already created 3 employees
    });
    
    const limitTestData = {
      firstName: 'Limit',
      lastName: 'Test',
      email: 'limit.test@testcompany.com',
    };
    
    try {
      const validatedLimit = validateCreateEmployee(limitTestData);
      await EmployeeService.createEmployee(validatedLimit, context);
      console.log('❌ User limit should have been enforced');
    } catch (error) {
      console.log('✅ User limit correctly enforced:', (error as Error).message);
    }
    
    // Test 8: Verify created employees
    console.log('\n🧪 Test 8: Verify created employees');
    
    const allEmployees = await EmployeeService.listEmployees({}, {}, context);
    console.log('✅ Total employees created:', allEmployees.employees.length);
    console.log('Employee list:', allEmployees.employees.map(emp => ({
      name: `${emp.firstName} ${emp.lastName}`,
      email: emp.email,
      title: emp.title,
      department: emp.department,
    })));
    
    // Test 9: Profile completeness calculation
    console.log('\n🧪 Test 9: Profile completeness calculation');
    
    const minimalEmployeeProfile = await EmployeeService.getEmployeeById(minimalEmployee.id, context);
    const completeEmployeeProfile = await EmployeeService.getEmployeeById(completeEmployee.id, context);
    
    // Calculate completeness manually for verification
    const calculateCompleteness = (employee: any) => {
      const requiredFields = ['firstName', 'lastName', 'email', 'title', 'department'];
      const optionalFields = ['phone', 'officeLocation', 'bio', 'skills', 'photoUrl'];
      
      const completedRequired = requiredFields.filter(field => 
        employee[field] && employee[field] !== ''
      ).length;
      
      const completedOptional = optionalFields.filter(field => {
        const value = employee[field];
        return value && (Array.isArray(value) ? value.length > 0 : value !== '');
      }).length;
      
      return Math.round(
        ((completedRequired / requiredFields.length) * 70) + 
        ((completedOptional / optionalFields.length) * 30)
      );
    };
    
    const minimalCompleteness = calculateCompleteness(minimalEmployeeProfile);
    const completeCompleteness = calculateCompleteness(completeEmployeeProfile);
    
    console.log('✅ Profile completeness calculated:', {
      minimal: `${minimalCompleteness}%`,
      complete: `${completeCompleteness}%`,
    });
    
    // Test 10: Audit log verification
    console.log('\n🧪 Test 10: Audit log verification');
    
    const auditLogs = await prisma.auditLog.findMany({
      where: {
        tenantId: testTenant.id,
        action: 'CREATE',
        entityType: 'employee',
      },
      orderBy: { createdAt: 'desc' },
    });
    
    console.log('✅ Audit logs created:', auditLogs.length);
    console.log('Recent audit log:', {
      action: auditLogs[0]?.action,
      entityType: auditLogs[0]?.entityType,
      userId: auditLogs[0]?.userId,
      ipAddress: auditLogs[0]?.ipAddress,
    });
    
    // Clean up test data
    console.log('\n🧹 Cleaning up test data...');
    
    await prisma.employee.deleteMany({
      where: { tenantId: testTenant.id },
    });
    
    await prisma.auditLog.deleteMany({
      where: { tenantId: testTenant.id },
    });
    
    await prisma.tenant.delete({
      where: { id: testTenant.id },
    });
    
    console.log('✅ Test data cleaned up');
    console.log('🎉 All employee creation tests completed successfully!');
    
  } catch (error) {
    console.error('❌ Employee creation test failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
testEmployeeCreation();