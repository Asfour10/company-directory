#!/usr/bin/env tsx

/**
 * Test script for custom field integration with employee profiles
 * Tests the complete flow of creating custom fields and using them in employee profiles
 */

import { prisma } from '../lib/database';
import { CustomFieldRepository } from '../repositories/custom-field.repository';
import { EmployeeRepository } from '../repositories/employee.repository';
import { EmployeeService } from '../services/employee.service';

interface TestResult {
  success: boolean;
  message: string;
  data?: any;
  error?: string;
}

async function runTest(testName: string, testFn: () => Promise<any>): Promise<TestResult> {
  try {
    console.log(`\n🧪 Running: ${testName}`);
    const result = await testFn();
    console.log(`✅ ${testName} - PASSED`);
    return { success: true, message: testName, data: result };
  } catch (error) {
    console.error(`❌ ${testName} - FAILED:`, error);
    return { 
      success: false, 
      message: testName, 
      error: error instanceof Error ? error.message : String(error) 
    };
  }
}

async function testCustomFieldIntegration() {
  console.log('🚀 Testing Custom Field Integration with Employee Profiles\n');

  // Get or create a test tenant
  let tenant = await prisma.tenant.findFirst({
    where: { subdomain: 'test-custom-fields' }
  });

  if (!tenant) {
    tenant = await prisma.tenant.create({
      data: {
        name: 'Test Custom Fields Company',
        subdomain: 'test-custom-fields',
        subscriptionTier: 'enterprise',
        userLimit: 100,
      }
    });
  }

  const tenantId = tenant.id;
  console.log(`📋 Using tenant: ${tenant.name} (${tenantId})`);

  const results: TestResult[] = [];

  // Test 1: Create custom fields
  results.push(await runTest('Create text custom field', async () => {
    return await CustomFieldRepository.create(tenantId, {
      fieldName: 'employeeId',
      fieldType: 'text',
      isRequired: true,
    });
  }));

  results.push(await runTest('Create dropdown custom field', async () => {
    return await CustomFieldRepository.create(tenantId, {
      fieldName: 'workLocation',
      fieldType: 'dropdown',
      isRequired: false,
      options: ['Remote', 'Office', 'Hybrid'],
    });
  }));

  results.push(await runTest('Create number custom field', async () => {
    return await CustomFieldRepository.create(tenantId, {
      fieldName: 'yearsExperience',
      fieldType: 'number',
      isRequired: false,
    });
  }));

  results.push(await runTest('Create multiselect custom field', async () => {
    return await CustomFieldRepository.create(tenantId, {
      fieldName: 'certifications',
      fieldType: 'multiselect',
      isRequired: false,
      options: ['AWS', 'Azure', 'GCP', 'Docker', 'Kubernetes'],
    });
  }));

  // Test 2: Create employee with valid custom fields
  results.push(await runTest('Create employee with valid custom fields', async () => {
    const context = {
      tenantId,
      userId: 'test-user-id',
      userRole: 'admin',
    };

    return await EmployeeService.createEmployee({
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@test-custom-fields.com',
      title: 'Software Engineer',
      department: 'Engineering',
      customFields: {
        employeeId: 'EMP001',
        workLocation: 'Remote',
        yearsExperience: 5,
        certifications: ['AWS', 'Docker'],
      },
    }, context);
  }));

  // Test 3: Try to create employee with invalid custom field values
  results.push(await runTest('Reject employee with invalid custom field values', async () => {
    const context = {
      tenantId,
      userId: 'test-user-id',
      userRole: 'admin',
    };

    try {
      await EmployeeService.createEmployee({
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'jane.smith@test-custom-fields.com',
        title: 'Product Manager',
        department: 'Product',
        customFields: {
          workLocation: 'InvalidLocation', // Invalid dropdown value
          yearsExperience: 'not-a-number', // Invalid number
          unknownField: 'value', // Unknown field
        },
      }, context);
      
      throw new Error('Should have failed validation');
    } catch (error) {
      if (error instanceof Error && error.message.includes('Custom field validation failed')) {
        return { validationWorked: true, error: error.message };
      }
      throw error;
    }
  }));

  // Test 4: Update employee with custom fields
  const employees = await EmployeeRepository.findMany(tenantId, {}, { pageSize: 1 });
  if (employees.employees.length > 0) {
    const employeeId = employees.employees[0].id;
    
    results.push(await runTest('Update employee custom fields', async () => {
      const context = {
        tenantId,
        userId: 'test-user-id',
        userRole: 'admin',
      };

      return await EmployeeService.updateEmployee(employeeId, {
        customFields: {
          employeeId: 'EMP001-UPDATED',
          workLocation: 'Hybrid',
          yearsExperience: 6,
          certifications: ['AWS', 'Azure', 'Kubernetes'],
        },
      }, context);
    }));

    // Test 5: Get employee with custom fields
    results.push(await runTest('Get employee with custom fields', async () => {
      const context = {
        tenantId,
        userId: 'test-user-id',
        userRole: 'user',
      };

      return await EmployeeService.getEmployeeByIdWithCustomFields(employeeId, context);
    }));
  }

  // Test 6: Validate custom field values directly
  results.push(await runTest('Validate custom field values', async () => {
    const validation = await CustomFieldRepository.validateCustomFieldValues(tenantId, {
      employeeId: 'EMP002',
      workLocation: 'Office',
      yearsExperience: 3,
      certifications: ['GCP'],
    });

    if (!validation.isValid) {
      throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
    }

    return validation;
  }));

  // Test 7: Test missing required field validation
  results.push(await runTest('Reject missing required custom field', async () => {
    const validation = await CustomFieldRepository.validateCustomFieldValues(tenantId, {
      workLocation: 'Remote',
      // Missing required employeeId field
    });

    if (validation.isValid) {
      throw new Error('Should have failed validation for missing required field');
    }

    return { validationWorked: true, errors: validation.errors };
  }));

  // Summary
  console.log('\n📊 Test Summary:');
  console.log('================');
  
  const passed = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📈 Success Rate: ${Math.round((passed / results.length) * 100)}%`);

  if (failed > 0) {
    console.log('\n❌ Failed Tests:');
    results.filter(r => !r.success).forEach(result => {
      console.log(`  - ${result.message}: ${result.error}`);
    });
  }

  // Cleanup
  console.log('\n🧹 Cleaning up test data...');
  await prisma.employee.deleteMany({ where: { tenantId } });
  await prisma.customField.deleteMany({ where: { tenantId } });
  await prisma.tenant.delete({ where: { id: tenantId } });
  console.log('✅ Cleanup completed');

  return results;
}

// Run the test if this script is executed directly
if (require.main === module) {
  testCustomFieldIntegration()
    .then(() => {
      console.log('\n🎉 Custom field integration test completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Test failed with error:', error);
      process.exit(1);
    });
}

export { testCustomFieldIntegration };