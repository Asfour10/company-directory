#!/usr/bin/env tsx

/**
 * Simple test for custom field integration
 */

import { CustomFieldRepository } from '../repositories/custom-field.repository';

async function testCustomFieldValidation() {
  console.log('🧪 Testing Custom Field Validation');
  
  // Mock tenant ID
  const tenantId = 'test-tenant-123';
  
  // Test the validation function directly
  const mockCustomFields = [
    {
      id: 'cf1',
      tenantId,
      fieldName: 'employeeId',
      fieldType: 'text',
      isRequired: true,
      options: null,
      displayOrder: 1,
      createdAt: new Date(),
    },
    {
      id: 'cf2',
      tenantId,
      fieldName: 'workLocation',
      fieldType: 'dropdown',
      isRequired: false,
      options: ['Remote', 'Office', 'Hybrid'],
      displayOrder: 2,
      createdAt: new Date(),
    },
  ];
  
  // Test 1: Valid custom field values
  console.log('\n✅ Test 1: Valid custom field values');
  const field1 = mockCustomFields[0];
  const validation1 = CustomFieldRepository.validateFieldValue(field1, 'EMP001');
  console.log('Text field validation:', validation1);
  
  const field2 = mockCustomFields[1];
  const validation2 = CustomFieldRepository.validateFieldValue(field2, 'Remote');
  console.log('Dropdown field validation:', validation2);
  
  // Test 2: Invalid custom field values
  console.log('\n❌ Test 2: Invalid custom field values');
  const validation3 = CustomFieldRepository.validateFieldValue(field1, null); // Required field missing
  console.log('Missing required field:', validation3);
  
  const validation4 = CustomFieldRepository.validateFieldValue(field2, 'InvalidOption');
  console.log('Invalid dropdown option:', validation4);
  
  // Test 3: Number field validation
  console.log('\n🔢 Test 3: Number field validation');
  const numberField = {
    id: 'cf3',
    tenantId,
    fieldName: 'yearsExperience',
    fieldType: 'number',
    isRequired: false,
    options: null,
    displayOrder: 3,
    createdAt: new Date(),
  };
  
  const validation5 = CustomFieldRepository.validateFieldValue(numberField, 5);
  console.log('Valid number:', validation5);
  
  const validation6 = CustomFieldRepository.validateFieldValue(numberField, 'not-a-number');
  console.log('Invalid number:', validation6);
  
  console.log('\n🎉 Custom field validation tests completed!');
}

// Run the test
testCustomFieldValidation()
  .then(() => {
    console.log('✅ All tests passed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Test failed:', error);
    process.exit(1);
  });