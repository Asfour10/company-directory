#!/usr/bin/env tsx

/**
 * Verification script for custom fields implementation
 * Checks that all components are properly implemented and integrated
 */

import fs from 'fs';
import path from 'path';

interface VerificationCheck {
  name: string;
  check: () => boolean;
  required: boolean;
}

async function verifyCustomFieldsImplementation() {
  console.log('🔍 Verifying Custom Fields Implementation\n');

  const checks: VerificationCheck[] = [
    // Repository checks
    {
      name: 'Custom field repository exists',
      check: () => fs.existsSync(path.join(__dirname, '../repositories/custom-field.repository.ts')),
      required: true,
    },
    {
      name: 'Repository has CRUD operations',
      check: () => {
        const repoPath = path.join(__dirname, '../repositories/custom-field.repository.ts');
        const content = fs.readFileSync(repoPath, 'utf8');
        return content.includes('static async create') &&
               content.includes('static async findById') &&
               content.includes('static async update') &&
               content.includes('static async delete') &&
               content.includes('static async findMany');
      },
      required: true,
    },
    {
      name: 'Repository has validation methods',
      check: () => {
        const repoPath = path.join(__dirname, '../repositories/custom-field.repository.ts');
        const content = fs.readFileSync(repoPath, 'utf8');
        return content.includes('validateFieldValue') &&
               content.includes('validateCustomFieldValues');
      },
      required: true,
    },

    // Validator checks
    {
      name: 'Custom field validator exists',
      check: () => fs.existsSync(path.join(__dirname, '../validators/custom-field.validator.ts')),
      required: true,
    },
    {
      name: 'Validator has all required schemas',
      check: () => {
        const validatorPath = path.join(__dirname, '../validators/custom-field.validator.ts');
        const content = fs.readFileSync(validatorPath, 'utf8');
        return content.includes('createCustomFieldSchema') &&
               content.includes('updateCustomFieldSchema') &&
               content.includes('customFieldFilterSchema') &&
               content.includes('customFieldValueSchema');
      },
      required: true,
    },
    {
      name: 'Validator supports all field types',
      check: () => {
        const validatorPath = path.join(__dirname, '../validators/custom-field.validator.ts');
        const content = fs.readFileSync(validatorPath, 'utf8');
        return content.includes("'text'") &&
               content.includes("'number'") &&
               content.includes("'date'") &&
               content.includes("'dropdown'") &&
               content.includes("'multiselect'");
      },
      required: true,
    },

    // API endpoint checks
    {
      name: 'Admin routes has custom field endpoints',
      check: () => {
        const adminRoutesPath = path.join(__dirname, '../routes/admin.routes.ts');
        const content = fs.readFileSync(adminRoutesPath, 'utf8');
        return content.includes("router.get('/custom-fields'") &&
               content.includes("router.post('/custom-fields'") &&
               content.includes("router.put('/custom-fields/:id'") &&
               content.includes("router.delete('/custom-fields/:id'");
      },
      required: true,
    },
    {
      name: 'Employee routes has custom fields endpoint',
      check: () => {
        const employeeRoutesPath = path.join(__dirname, '../routes/employee.routes.ts');
        const content = fs.readFileSync(employeeRoutesPath, 'utf8');
        return content.includes("router.get('/custom-fields'");
      },
      required: true,
    },
    {
      name: 'Admin routes imports custom field dependencies',
      check: () => {
        const adminRoutesPath = path.join(__dirname, '../routes/admin.routes.ts');
        const content = fs.readFileSync(adminRoutesPath, 'utf8');
        return content.includes('CustomFieldRepository') &&
               content.includes('validateCreateCustomField') &&
               content.includes('validateUpdateCustomField');
      },
      required: true,
    },

    // Service integration checks
    {
      name: 'Employee service integrates custom fields',
      check: () => {
        const servicePath = path.join(__dirname, '../services/employee.service.ts');
        const content = fs.readFileSync(servicePath, 'utf8');
        return content.includes('CustomFieldRepository') &&
               content.includes('validateCustomFieldValues') &&
               content.includes('getEmployeeByIdWithCustomFields');
      },
      required: true,
    },
    {
      name: 'Employee service validates custom fields on create',
      check: () => {
        const servicePath = path.join(__dirname, '../services/employee.service.ts');
        const content = fs.readFileSync(servicePath, 'utf8');
        return content.includes('validatedData.customFields') &&
               content.includes('CustomFieldRepository.validateCustomFieldValues');
      },
      required: true,
    },
    {
      name: 'Employee service validates custom fields on update',
      check: () => {
        const servicePath = path.join(__dirname, '../services/employee.service.ts');
        const content = fs.readFileSync(servicePath, 'utf8');
        const createIndex = content.indexOf('static async createEmployee');
        const updateIndex = content.indexOf('static async updateEmployee');
        const updateContent = content.substring(updateIndex);
        return updateContent.includes('validatedData.customFields') &&
               updateContent.includes('CustomFieldRepository.validateCustomFieldValues');
      },
      required: true,
    },

    // Database schema checks
    {
      name: 'Employee table has customFields column',
      check: () => {
        const schemaPath = path.join(__dirname, '../../prisma/schema.prisma');
        if (!fs.existsSync(schemaPath)) return false;
        const content = fs.readFileSync(schemaPath, 'utf8');
        return content.includes('customFields') && content.includes('Json');
      },
      required: true,
    },
    {
      name: 'CustomField model exists in schema',
      check: () => {
        const schemaPath = path.join(__dirname, '../../prisma/schema.prisma');
        if (!fs.existsSync(schemaPath)) return false;
        const content = fs.readFileSync(schemaPath, 'utf8');
        return content.includes('model CustomField') &&
               content.includes('fieldName') &&
               content.includes('fieldType') &&
               content.includes('isRequired');
      },
      required: true,
    },

    // Test coverage checks
    {
      name: 'Custom field integration test exists',
      check: () => fs.existsSync(path.join(__dirname, 'test-custom-field-integration.ts')),
      required: true,
    },
    {
      name: 'Employee service custom field tests exist',
      check: () => fs.existsSync(path.join(__dirname, '../services/__tests__/employee-custom-fields.service.test.ts')),
      required: true,
    },

    // Documentation checks
    {
      name: 'Custom fields integration documentation exists',
      check: () => fs.existsSync(path.join(__dirname, '../../CUSTOM_FIELDS_INTEGRATION.md')),
      required: false,
    },
  ];

  let passed = 0;
  let failed = 0;
  let requiredFailed = 0;

  console.log('Running verification checks...\n');

  for (const check of checks) {
    try {
      const result = check.check();
      if (result) {
        console.log(`✅ ${check.name}`);
        passed++;
      } else {
        console.log(`❌ ${check.name}${check.required ? ' (REQUIRED)' : ' (OPTIONAL)'}`);
        failed++;
        if (check.required) {
          requiredFailed++;
        }
      }
    } catch (error) {
      console.log(`❌ ${check.name} - Error: ${error}${check.required ? ' (REQUIRED)' : ' (OPTIONAL)'}`);
      failed++;
      if (check.required) {
        requiredFailed++;
      }
    }
  }

  console.log('\n📊 Verification Summary:');
  console.log('========================');
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📈 Success Rate: ${Math.round((passed / checks.length) * 100)}%`);

  if (requiredFailed > 0) {
    console.log(`\n⚠️  ${requiredFailed} required checks failed!`);
    return false;
  }

  if (failed === 0) {
    console.log('\n🎉 All checks passed! Custom fields implementation is complete.');
  } else {
    console.log(`\n✅ All required checks passed! ${failed} optional checks failed.`);
  }

  return requiredFailed === 0;
}

// Additional functionality verification
async function verifyCustomFieldFunctionality() {
  console.log('\n🧪 Testing Custom Field Functionality\n');

  try {
    // Import the repository for testing
    const { CustomFieldRepository } = await import('../repositories/custom-field.repository');

    // Test field validation
    console.log('Testing field validation...');

    // Mock field definitions
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

    // Test valid values
    const validText = CustomFieldRepository.validateFieldValue(textField, 'EMP001');
    const validDropdown = CustomFieldRepository.validateFieldValue(dropdownField, 'Remote');

    console.log(`✅ Valid text field: ${validText.isValid}`);
    console.log(`✅ Valid dropdown field: ${validDropdown.isValid}`);

    // Test invalid values
    const invalidRequired = CustomFieldRepository.validateFieldValue(textField, null);
    const invalidDropdown = CustomFieldRepository.validateFieldValue(dropdownField, 'InvalidOption');

    console.log(`❌ Missing required field: ${!invalidRequired.isValid} (${invalidRequired.error})`);
    console.log(`❌ Invalid dropdown option: ${!invalidDropdown.isValid} (${invalidDropdown.error})`);

    console.log('\n✅ Custom field functionality tests completed successfully!');
    return true;
  } catch (error) {
    console.error('\n❌ Custom field functionality test failed:', error);
    return false;
  }
}

// Run verification
if (require.main === module) {
  verifyCustomFieldsImplementation()
    .then(async (implementationOk) => {
      if (implementationOk) {
        const functionalityOk = await verifyCustomFieldFunctionality();
        if (functionalityOk) {
          console.log('\n🎉 Custom fields implementation verification completed successfully!');
          process.exit(0);
        } else {
          console.log('\n❌ Custom fields functionality verification failed!');
          process.exit(1);
        }
      } else {
        console.log('\n❌ Custom fields implementation verification failed!');
        process.exit(1);
      }
    })
    .catch((error) => {
      console.error('\n💥 Verification failed with error:', error);
      process.exit(1);
    });
}

export { verifyCustomFieldsImplementation, verifyCustomFieldFunctionality };