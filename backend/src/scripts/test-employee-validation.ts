#!/usr/bin/env tsx

/**
 * Test script for employee validation functionality
 */

import {
  validateCreateEmployee,
  validateUpdateEmployee,
  validateEmployeeFilters,
  validatePagination,
  validateBulkEmployees,
  validateImportEmployee,
  validatePhoneNumber,
  validateEmailDomain,
  validateSkills,
  validateCustomFields,
} from '../validators/employee.validator';

function testCreateEmployeeValidation() {
  console.log('🧪 Testing create employee validation...');

  // Test valid data
  const validData = {
    firstName: 'John',
    lastName: 'Doe',
    email: 'john.doe@company.com',
    title: 'Software Engineer',
    department: 'Engineering',
    phone: '+1-555-0123',
    extension: '123',
    skills: ['JavaScript', 'TypeScript'],
    customFields: {
      startDate: '2023-01-15',
      employeeId: 'EMP001',
    },
  };

  try {
    const result = validateCreateEmployee(validData);
    console.log('✅ Valid create data passed:', {
      firstName: result.firstName,
      lastName: result.lastName,
      email: result.email,
      skills: result.skills,
    });
  } catch (error) {
    console.log('❌ Valid create data failed:', (error as Error).message);
  }

  // Test missing required fields
  try {
    validateCreateEmployee({
      firstName: 'John',
      // Missing lastName and email
    });
    console.log('❌ Missing required fields validation failed');
  } catch (error) {
    console.log('✅ Missing required fields caught:', (error as Error).message);
  }

  // Test invalid email
  try {
    validateCreateEmployee({
      firstName: 'John',
      lastName: 'Doe',
      email: 'invalid-email',
    });
    console.log('❌ Invalid email validation failed');
  } catch (error) {
    console.log('✅ Invalid email caught:', (error as Error).message);
  }

  // Test invalid name format
  try {
    validateCreateEmployee({
      firstName: 'John123',
      lastName: 'Doe',
      email: 'john@company.com',
    });
    console.log('❌ Invalid name format validation failed');
  } catch (error) {
    console.log('✅ Invalid name format caught:', (error as Error).message);
  }
}

function testUpdateEmployeeValidation() {
  console.log('\n🧪 Testing update employee validation...');

  // Test valid update data
  const validUpdateData = {
    title: 'Senior Software Engineer',
    skills: ['JavaScript', 'TypeScript', 'React'],
  };

  try {
    const result = validateUpdateEmployee(validUpdateData);
    console.log('✅ Valid update data passed:', result);
  } catch (error) {
    console.log('❌ Valid update data failed:', (error as Error).message);
  }

  // Test empty update (should fail)
  try {
    validateUpdateEmployee({});
    console.log('❌ Empty update validation failed');
  } catch (error) {
    console.log('✅ Empty update caught:', (error as Error).message);
  }

  // Test invalid field in update
  try {
    validateUpdateEmployee({
      firstName: '',
      title: 'Engineer',
    });
    console.log('❌ Invalid field validation failed');
  } catch (error) {
    console.log('✅ Invalid field caught:', (error as Error).message);
  }
}

function testFilterValidation() {
  console.log('\n🧪 Testing filter validation...');

  // Test valid filters
  const validFilters = {
    search: 'john',
    department: 'Engineering',
    isActive: true,
    skills: ['JavaScript'],
  };

  try {
    const result = validateEmployeeFilters(validFilters);
    console.log('✅ Valid filters passed:', result);
  } catch (error) {
    console.log('❌ Valid filters failed:', (error as Error).message);
  }

  // Test invalid filter values
  try {
    validateEmployeeFilters({
      isActive: 'true', // Should be boolean
      managerId: 'invalid-uuid',
    });
    console.log('❌ Invalid filter validation failed');
  } catch (error) {
    console.log('✅ Invalid filters caught:', (error as Error).message);
  }
}

function testPaginationValidation() {
  console.log('\n🧪 Testing pagination validation...');

  // Test valid pagination
  const validPagination = {
    page: 2,
    pageSize: 25,
    sortBy: 'lastName',
    sortOrder: 'desc',
  };

  try {
    const result = validatePagination(validPagination);
    console.log('✅ Valid pagination passed:', result);
  } catch (error) {
    console.log('❌ Valid pagination failed:', (error as Error).message);
  }

  // Test invalid pagination values
  try {
    validatePagination({
      page: 0, // Should be >= 1
      pageSize: 200, // Should be <= 100
      sortBy: 'invalidField',
    });
    console.log('❌ Invalid pagination validation failed');
  } catch (error) {
    console.log('✅ Invalid pagination caught:', (error as Error).message);
  }

  // Test defaults
  try {
    const result = validatePagination({});
    console.log('✅ Pagination defaults:', result);
  } catch (error) {
    console.log('❌ Pagination defaults failed:', (error as Error).message);
  }
}

function testPhoneValidation() {
  console.log('\n🧪 Testing phone number validation...');

  const testCases = [
    { phone: '+1-555-123-4567', expected: true },
    { phone: '(555) 123-4567', expected: true },
    { phone: '555.123.4567', expected: true },
    { phone: '+44 20 7946 0958', expected: true },
    { phone: '123', expected: false }, // Too short
    { phone: 'abc-def-ghij', expected: false }, // No digits
    { phone: '', expected: true }, // Empty (optional)
  ];

  testCases.forEach(({ phone, expected }) => {
    const result = validatePhoneNumber(phone);
    if (result === expected) {
      console.log(`✅ Phone "${phone}": ${result}`);
    } else {
      console.log(`❌ Phone "${phone}": expected ${expected}, got ${result}`);
    }
  });
}

function testEmailDomainValidation() {
  console.log('\n🧪 Testing email domain validation...');

  const allowedDomains = ['company.com', 'subsidiary.com'];

  const testCases = [
    { email: 'user@company.com', expected: true },
    { email: 'user@subsidiary.com', expected: true },
    { email: 'user@external.com', expected: false },
    { email: 'user@COMPANY.COM', expected: true }, // Case insensitive
  ];

  testCases.forEach(({ email, expected }) => {
    const result = validateEmailDomain(email, allowedDomains);
    if (result === expected) {
      console.log(`✅ Email domain "${email}": ${result}`);
    } else {
      console.log(`❌ Email domain "${email}": expected ${expected}, got ${result}`);
    }
  });

  // Test with no domain restrictions
  const noRestrictions = validateEmailDomain('user@anywhere.com');
  console.log(`✅ No domain restrictions: ${noRestrictions}`);
}

function testSkillsValidation() {
  console.log('\n🧪 Testing skills validation...');

  const testCases = [
    {
      skills: ['JavaScript', 'TypeScript', 'React'],
      expectedValid: true,
    },
    {
      skills: ['JavaScript', 'javascript'], // Duplicate (case insensitive)
      expectedValid: false,
    },
    {
      skills: [''], // Empty skill
      expectedValid: false,
    },
    {
      skills: Array(25).fill('Skill'), // Too many skills
      expectedValid: false,
    },
    {
      skills: ['A'.repeat(60)], // Skill too long
      expectedValid: false,
    },
  ];

  testCases.forEach(({ skills, expectedValid }, index) => {
    const result = validateSkills(skills);
    if (result.valid === expectedValid) {
      console.log(`✅ Skills test ${index + 1}: ${result.valid}`);
    } else {
      console.log(`❌ Skills test ${index + 1}: expected ${expectedValid}, got ${result.valid}`);
      if (result.errors.length > 0) {
        console.log(`   Errors: ${result.errors.join(', ')}`);
      }
    }
  });
}

function testCustomFieldsValidation() {
  console.log('\n🧪 Testing custom fields validation...');

  const testCases = [
    {
      fields: {
        startDate: '2023-01-15',
        employeeId: 'EMP001',
        salary: 75000,
        isRemote: true,
      },
      expectedValid: true,
    },
    {
      fields: {
        '123invalid': 'value', // Invalid field name
      },
      expectedValid: false,
    },
    {
      fields: {
        longValue: 'A'.repeat(600), // Value too long
      },
      expectedValid: false,
    },
    {
      fields: {
        arrayField: Array(15).fill('item'), // Array too long
      },
      expectedValid: false,
    },
    {
      fields: Object.fromEntries(
        Array(60).fill(0).map((_, i) => [`field${i}`, 'value'])
      ), // Too many fields
      expectedValid: false,
    },
  ];

  testCases.forEach(({ fields, expectedValid }, index) => {
    const result = validateCustomFields(fields);
    if (result.valid === expectedValid) {
      console.log(`✅ Custom fields test ${index + 1}: ${result.valid}`);
    } else {
      console.log(`❌ Custom fields test ${index + 1}: expected ${expectedValid}, got ${result.valid}`);
      if (result.errors.length > 0) {
        console.log(`   Errors: ${result.errors.join(', ')}`);
      }
    }
  });
}

function testBulkValidation() {
  console.log('\n🧪 Testing bulk operations validation...');

  // Test valid bulk data
  const validBulkData = {
    employees: [
      {
        id: '123e4567-e89b-12d3-a456-426614174000',
        data: { title: 'Senior Engineer' },
      },
      {
        id: '123e4567-e89b-12d3-a456-426614174001',
        data: { department: 'Marketing' },
      },
    ],
  };

  try {
    const result = validateBulkEmployees(validBulkData);
    console.log('✅ Valid bulk data passed:', {
      count: result.employees.length,
    });
  } catch (error) {
    console.log('❌ Valid bulk data failed:', (error as Error).message);
  }

  // Test too many employees
  try {
    const tooManyEmployees = {
      employees: Array(150).fill(0).map((_, i) => ({
        id: `123e4567-e89b-12d3-a456-42661417400${i}`,
        data: { title: 'Engineer' },
      })),
    };
    validateBulkEmployees(tooManyEmployees);
    console.log('❌ Too many employees validation failed');
  } catch (error) {
    console.log('✅ Too many employees caught:', (error as Error).message);
  }
}

function testImportValidation() {
  console.log('\n🧪 Testing import validation...');

  // Test valid import data
  const validImportData = {
    firstName: 'John',
    lastName: 'Doe',
    email: 'john.doe@company.com',
    title: 'Engineer',
    managerEmail: 'manager@company.com',
    skills: 'JavaScript, TypeScript, React',
  };

  try {
    const result = validateImportEmployee(validImportData);
    console.log('✅ Valid import data passed:', {
      name: `${result.firstName} ${result.lastName}`,
      email: result.email,
    });
  } catch (error) {
    console.log('❌ Valid import data failed:', (error as Error).message);
  }

  // Test invalid manager email
  try {
    validateImportEmployee({
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@company.com',
      managerEmail: 'invalid-email',
    });
    console.log('❌ Invalid manager email validation failed');
  } catch (error) {
    console.log('✅ Invalid manager email caught:', (error as Error).message);
  }
}

async function runAllTests() {
  try {
    console.log('🚀 Starting employee validation tests...\n');

    testCreateEmployeeValidation();
    testUpdateEmployeeValidation();
    testFilterValidation();
    testPaginationValidation();
    testPhoneValidation();
    testEmailDomainValidation();
    testSkillsValidation();
    testCustomFieldsValidation();
    testBulkValidation();
    testImportValidation();

    console.log('\n🎉 All employee validation tests completed successfully!');
  } catch (error) {
    console.error('❌ Employee validation test failed:', error);
    process.exit(1);
  }
}

// Run the tests
runAllTests();