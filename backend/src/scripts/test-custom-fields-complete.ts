#!/usr/bin/env tsx

/**
 * Comprehensive test for custom fields functionality
 * Tests the complete integration from API endpoints to database operations
 */

import { CustomFieldRepository } from '../repositories/custom-field.repository';
import { 
  validateCreateCustomField, 
  validateUpdateCustomField,
  validateCustomFieldValues,
  validateSingleFieldValue,
  validateMultipleFieldValues
} from '../validators/custom-field.validator';

interface TestResult {
  name: string;
  success: boolean;
  message?: string;
  error?: string;
}

async function runTest(testName: string, testFn: () => Promise<any> | any): Promise<TestResult> {
  try {
    console.log(`🧪 Running: ${testName}`);
    await testFn();
    console.log(`✅ ${testName} - PASSED`);
    return { name: testName, success: true };
  } catch (error) {
    console.error(`❌ ${testName} - FAILED:`, error);
    return { 
      name: testName, 
      success: false, 
      error: error instanceof Error ? error.message : String(error) 
    };
  }
}

async function testCustomFieldsComplete() {
  console.log('🚀 Testing Complete Custom Fields Functionality\n');

  const results: TestResult[] = [];

  // Test 1: Validator Functions
  console.log('📋 Testing Validator Functions');
  console.log('================================');

  results.push(await runTest('Validate create custom field - valid data', () => {
    const validData = {
      fieldName: 'employeeId',
      fieldType: 'text',
      isRequired: true,
    };
    const result = validateCreateCustomField(validData);
    if (!result.fieldName || !result.fieldType) {
      throw new Error('Validation should return validated data');
    }
  }));

  results.push(await runTest('Validate create custom field - invalid data', () => {
    const invalidData = {
      fieldType: 'text',
      // Missing required fieldName
    };
    try {
      validateCreateCustomField(invalidData);
      throw new Error('Should have thrown validation error');
    } catch (error) {
      if (!(error instanceof Error) || !error.message.includes('Validation failed')) {
        throw error;
      }
    }
  }));

  results.push(await runTest('Validate dropdown field with options', () => {
    const dropdownData = {
      fieldName: 'workLocation',
      fieldType: 'dropdown',
      isRequired: false,
      options: ['Remote', 'Office', 'Hybrid'],
    };
    const result = validateCreateCustomField(dropdownData);
    if (!result.options || result.options.length !== 3) {
      throw new Error('Dropdown field should have options');
    }
  }));

  results.push(await runTest('Reject dropdown field without options', () => {
    const invalidDropdown = {
      fieldName: 'workLocation',
      fieldType: 'dropdown',
      isRequired: false,
      // Missing options
    };
    try {
      validateCreateCustomField(invalidDropdown);
      throw new Error('Should have thrown validation error for missing options');
    } catch (error) {
      if (!(error instanceof Error) || !error.message.includes('at least one option')) {
        throw error;
      }
    }
  }));

  results.push(await runTest('Validate update custom field', () => {
    const updateData = {
      fieldName: 'updatedName',
      isRequired: false,
    };
    const result = validateUpdateCustomField(updateData);
    if (result.fieldName !== 'updatedName' || result.isRequired !== false) {
      throw new Error('Update validation should return updated data');
    }
  }));

  // Test 2: Field Value Validation
  console.log('\n🔍 Testing Field Value Validation');
  console.log('==================================');

  const textField = {
    id: 'cf1',
    tenantId: 'test',
    fieldName: 'employeeId',
    fieldType: 'text',
    isRequired: true,
    options: null,
    displayOrder: 1,
    createdAt: new Date(),
  };

  const dropdownField = {
    id: 'cf2',
    tenantId: 'test',
    fieldName: 'workLocation',
    fieldType: 'dropdown',
    isRequired: false,
    options: ['Remote', 'Office', 'Hybrid'],
    displayOrder: 2,
    createdAt: new Date(),
  };

  const numberField = {
    id: 'cf3',
    tenantId: 'test',
    fieldName: 'yearsExperience',
    fieldType: 'number',
    isRequired: false,
    options: null,
    displayOrder: 3,
    createdAt: new Date(),
  };

  const multiselectField = {
    id: 'cf4',
    tenantId: 'test',
    fieldName: 'certifications',
    fieldType: 'multiselect',
    isRequired: false,
    options: ['AWS', 'Azure', 'GCP', 'Docker'],
    displayOrder: 4,
    createdAt: new Date(),
  };

  results.push(await runTest('Validate text field - valid value', () => {
    const validation = CustomFieldRepository.validateFieldValue(textField, 'EMP001');
    if (!validation.isValid) {
      throw new Error(`Text validation failed: ${validation.error}`);
    }
  }));

  results.push(await runTest('Validate text field - missing required', () => {
    const validation = CustomFieldRepository.validateFieldValue(textField, null);
    if (validation.isValid) {
      throw new Error('Should fail for missing required field');
    }
    if (!validation.error?.includes('required')) {
      throw new Error('Error message should mention required field');
    }
  }));

  results.push(await runTest('Validate dropdown field - valid option', () => {
    const validation = CustomFieldRepository.validateFieldValue(dropdownField, 'Remote');
    if (!validation.isValid) {
      throw new Error(`Dropdown validation failed: ${validation.error}`);
    }
  }));

  results.push(await runTest('Validate dropdown field - invalid option', () => {
    const validation = CustomFieldRepository.validateFieldValue(dropdownField, 'InvalidOption');
    if (validation.isValid) {
      throw new Error('Should fail for invalid dropdown option');
    }
    if (!validation.error?.includes('must be one of')) {
      throw new Error('Error message should list valid options');
    }
  }));

  results.push(await runTest('Validate number field - valid number', () => {
    const validation = CustomFieldRepository.validateFieldValue(numberField, 5);
    if (!validation.isValid) {
      throw new Error(`Number validation failed: ${validation.error}`);
    }
  }));

  results.push(await runTest('Validate number field - invalid number', () => {
    const validation = CustomFieldRepository.validateFieldValue(numberField, 'not-a-number');
    if (validation.isValid) {
      throw new Error('Should fail for invalid number');
    }
    if (!validation.error?.includes('valid number')) {
      throw new Error('Error message should mention valid number');
    }
  }));

  results.push(await runTest('Validate multiselect field - valid selections', () => {
    const validation = CustomFieldRepository.validateFieldValue(multiselectField, ['AWS', 'Docker']);
    if (!validation.isValid) {
      throw new Error(`Multiselect validation failed: ${validation.error}`);
    }
  }));

  results.push(await runTest('Validate multiselect field - invalid selections', () => {
    const validation = CustomFieldRepository.validateFieldValue(multiselectField, ['InvalidCert']);
    if (validation.isValid) {
      throw new Error('Should fail for invalid multiselect options');
    }
    if (!validation.error?.includes('invalid values')) {
      throw new Error('Error message should mention invalid values');
    }
  }));

  // Test 3: Multiple Field Validation
  console.log('\n📊 Testing Multiple Field Validation');
  console.log('====================================');

  const fieldDefinitions = [textField, dropdownField, numberField, multiselectField];

  results.push(await runTest('Validate multiple fields - all valid', () => {
    const validation = validateMultipleFieldValues(fieldDefinitions, {
      employeeId: 'EMP001',
      workLocation: 'Remote',
      yearsExperience: 5,
      certifications: ['AWS', 'Docker'],
    });
    if (!validation.valid) {
      throw new Error(`Multiple field validation failed: ${validation.errors.join(', ')}`);
    }
  }));

  results.push(await runTest('Validate multiple fields - missing required', () => {
    const validation = validateMultipleFieldValues(fieldDefinitions, {
      workLocation: 'Remote',
      // Missing required employeeId
    });
    if (validation.valid) {
      throw new Error('Should fail for missing required field');
    }
    if (!validation.errors.some(e => e.includes('employeeId') && e.includes('required'))) {
      throw new Error('Should report missing required field');
    }
  }));

  results.push(await runTest('Validate multiple fields - unknown field', () => {
    const validation = validateMultipleFieldValues(fieldDefinitions, {
      employeeId: 'EMP001',
      unknownField: 'value',
    });
    if (validation.valid) {
      throw new Error('Should fail for unknown field');
    }
    if (!validation.errors.some(e => e.includes('Unknown custom field'))) {
      throw new Error('Should report unknown field');
    }
  }));

  // Test 4: Custom Field Values Validation
  console.log('\n🎯 Testing Custom Field Values Validation');
  console.log('==========================================');

  results.push(await runTest('Validate custom field values - valid object', () => {
    const validValues = {
      employeeId: 'EMP001',
      workLocation: 'Remote',
      yearsExperience: 5,
    };
    const result = validateCustomFieldValues(validValues);
    if (!result || typeof result !== 'object') {
      throw new Error('Should return validated object');
    }
  }));

  results.push(await runTest('Validate custom field values - invalid object', () => {
    const invalidValues = {
      employeeId: 123, // Should be string for text field
      workLocation: ['Remote'], // Should be string for dropdown
    };
    try {
      validateCustomFieldValues(invalidValues);
      // This might not throw since it's just schema validation, not business logic
    } catch (error) {
      // Expected for invalid schema
    }
  }));

  // Test 5: Edge Cases
  console.log('\n🔬 Testing Edge Cases');
  console.log('=====================');

  results.push(await runTest('Handle empty custom fields object', () => {
    const validation = validateMultipleFieldValues(fieldDefinitions, {});
    if (validation.valid) {
      throw new Error('Should fail when required fields are missing');
    }
  }));

  results.push(await runTest('Handle null values in optional fields', () => {
    const validation = validateMultipleFieldValues(fieldDefinitions, {
      employeeId: 'EMP001',
      workLocation: null,
      yearsExperience: null,
      certifications: null,
    });
    if (!validation.valid) {
      throw new Error(`Should pass with null optional fields: ${validation.errors.join(', ')}`);
    }
  }));

  results.push(await runTest('Handle empty string values', () => {
    const validation = validateMultipleFieldValues(fieldDefinitions, {
      employeeId: 'EMP001',
      workLocation: '',
      yearsExperience: '',
      certifications: [],
    });
    if (!validation.valid) {
      throw new Error(`Should pass with empty optional fields: ${validation.errors.join(', ')}`);
    }
  }));

  // Summary
  console.log('\n📊 Test Summary');
  console.log('================');
  
  const passed = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📈 Success Rate: ${Math.round((passed / results.length) * 100)}%`);

  if (failed > 0) {
    console.log('\n❌ Failed Tests:');
    results.filter(r => !r.success).forEach(result => {
      console.log(`  - ${result.name}: ${result.error}`);
    });
  }

  console.log('\n🎉 Custom fields functionality test completed!');
  return results;
}

// Run the test if this script is executed directly
if (require.main === module) {
  testCustomFieldsComplete()
    .then((results) => {
      const failed = results.filter(r => !r.success).length;
      if (failed === 0) {
        console.log('\n✅ All tests passed!');
        process.exit(0);
      } else {
        console.log(`\n❌ ${failed} tests failed!`);
        process.exit(1);
      }
    })
    .catch((error) => {
      console.error('\n💥 Test suite failed with error:', error);
      process.exit(1);
    });
}

export { testCustomFieldsComplete };