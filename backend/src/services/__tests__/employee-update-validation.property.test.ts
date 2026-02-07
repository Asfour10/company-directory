import { validateUpdateEmployee } from '../../validators/employee.validator';

describe('Employee Update Validation Property Tests', () => {
  /**
   * Feature: basic-employee-directory, Property 13: Profile Update Validation
   * For any profile update attempt, invalid data should be rejected with validation errors while valid data should be saved successfully
   * Validates: Requirements 4.2, 4.3, 4.4
   */
  describe('Property 13: Profile Update Validation', () => {
    it('should accept valid profile update data', () => {
      const validTestCases = [
        {
          description: 'valid firstName update',
          data: { firstName: 'John' },
          expectedValid: true,
        },
        {
          description: 'valid lastName update',
          data: { lastName: 'Doe' },
          expectedValid: true,
        },
        {
          description: 'valid email update',
          data: { email: 'john.doe@example.com' },
          expectedValid: true,
        },
        {
          description: 'valid title update',
          data: { title: 'Senior Software Engineer' },
          expectedValid: true,
        },
        {
          description: 'valid department update',
          data: { department: 'Engineering' },
          expectedValid: true,
        },
        {
          description: 'valid phone update',
          data: { phone: '+1-555-0123' },
          expectedValid: true,
        },
        {
          description: 'valid multiple fields update',
          data: {
            firstName: 'Jane',
            lastName: 'Smith',
            title: 'Product Manager',
            department: 'Product',
          },
          expectedValid: true,
        },
        {
          description: 'valid bio update',
          data: { bio: 'Experienced software engineer with 10 years in the industry.' },
          expectedValid: true,
        },
        {
          description: 'valid skills update',
          data: { skills: ['JavaScript', 'TypeScript', 'React', 'Node.js'] },
          expectedValid: true,
        },
        {
          description: 'valid officeLocation update',
          data: { officeLocation: 'Building A, Floor 3' },
          expectedValid: true,
        },
        {
          description: 'valid empty optional fields',
          data: { title: '', department: '', phone: '' },
          expectedValid: true,
        },
      ];

      for (const testCase of validTestCases) {
        let isValid = true;
        let validatedData: any = null;

        try {
          validatedData = validateUpdateEmployee(testCase.data);
        } catch (error) {
          isValid = false;
        }

        expect(isValid).toBe(testCase.expectedValid);
        if (isValid && validatedData) {
          expect(validatedData).toBeDefined();
          // Verify the validated data contains the expected fields
          Object.keys(testCase.data).forEach(key => {
            expect(validatedData).toHaveProperty(key);
          });
        }
      }
    });

    it('should reject invalid profile update data with validation errors', () => {
      const invalidTestCases = [
        {
          description: 'empty update object',
          data: {},
          expectedValid: false,
          expectedError: 'At least one field must be provided for update',
        },
        {
          description: 'firstName too long',
          data: { firstName: 'A'.repeat(101) },
          expectedValid: false,
          expectedError: 'First name must not exceed 100 characters',
        },
        {
          description: 'firstName with invalid characters',
          data: { firstName: 'John123' },
          expectedValid: false,
          expectedError: 'First name can only contain letters',
        },
        {
          description: 'lastName too long',
          data: { lastName: 'B'.repeat(101) },
          expectedValid: false,
          expectedError: 'Last name must not exceed 100 characters',
        },
        {
          description: 'lastName with invalid characters',
          data: { lastName: 'Doe@#$' },
          expectedValid: false,
          expectedError: 'Last name can only contain letters',
        },
        {
          description: 'invalid email format',
          data: { email: 'not-an-email' },
          expectedValid: false,
          expectedError: 'Email must be a valid email address',
        },
        {
          description: 'email too long',
          data: { email: 'a'.repeat(250) + '@example.com' },
          expectedValid: false,
          expectedError: 'Email must not exceed 255 characters',
        },
        {
          description: 'title too long',
          data: { title: 'T'.repeat(201) },
          expectedValid: false,
          expectedError: 'Title must not exceed 200 characters',
        },
        {
          description: 'department too long',
          data: { department: 'D'.repeat(201) },
          expectedValid: false,
          expectedError: 'Department must not exceed 200 characters',
        },
        {
          description: 'invalid phone format',
          data: { phone: 'abc-def-ghij' },
          expectedValid: false,
          expectedError: 'Phone number format is invalid',
        },
        {
          description: 'phone too long',
          data: { phone: '1'.repeat(51) },
          expectedValid: false,
          expectedError: 'Phone number must not exceed 50 characters',
        },
        {
          description: 'bio too long',
          data: { bio: 'B'.repeat(1001) },
          expectedValid: false,
          expectedError: 'Bio must not exceed 1000 characters',
        },
        {
          description: 'too many skills',
          data: { skills: Array.from({ length: 21 }, (_, i) => `Skill${i}`) },
          expectedValid: false,
          expectedError: 'Cannot have more than 20 skills',
        },
        {
          description: 'skill too long',
          data: { skills: ['S'.repeat(51)] },
          expectedValid: false,
          expectedError: 'Each skill must not exceed 50 characters',
        },
        {
          description: 'invalid managerId format',
          data: { managerId: 'not-a-uuid' },
          expectedValid: false,
          expectedError: 'Manager ID must be a valid UUID',
        },
        {
          description: 'invalid photoUrl format',
          data: { photoUrl: 'not-a-url' },
          expectedValid: false,
          expectedError: 'must be a valid uri',
        },
        {
          description: 'photoUrl too long',
          data: { photoUrl: 'https://example.com/' + 'a'.repeat(500) },
          expectedValid: false,
          expectedError: 'Photo URL must not exceed 500 characters',
        },
        {
          description: 'officeLocation too long',
          data: { officeLocation: 'O'.repeat(201) },
          expectedValid: false,
          expectedError: 'Office location must not exceed 200 characters',
        },
        {
          description: 'invalid extension format',
          data: { extension: 'ext-abc' },
          expectedValid: false,
          expectedError: 'Extension can only contain numbers',
        },
        {
          description: 'extension too long',
          data: { extension: '1'.repeat(21) },
          expectedValid: false,
          expectedError: 'Extension must not exceed 20 characters',
        },
      ];

      for (const testCase of invalidTestCases) {
        let isValid = true;
        let errorMessage = '';

        try {
          validateUpdateEmployee(testCase.data);
        } catch (error) {
          isValid = false;
          errorMessage = (error as Error).message;
        }

        expect(isValid).toBe(testCase.expectedValid);
        if (!isValid) {
          expect(errorMessage).toContain(testCase.expectedError);
        } else {
          // If test fails, log which case failed
          console.error(`Test case failed: ${testCase.description}`);
          console.error(`Data:`, testCase.data);
        }
      }
    });

    it('should handle edge cases in validation', () => {
      const edgeCaseTests = [
        {
          description: 'firstName with valid special characters',
          data: { firstName: "Mary-Jane O'Connor" },
          expectedValid: true,
        },
        {
          description: 'lastName with valid special characters',
          data: { lastName: "O'Brien-Smith Jr." },
          expectedValid: true,
        },
        {
          description: 'email with plus addressing',
          data: { email: 'user+tag@example.com' },
          expectedValid: true,
        },
        {
          description: 'phone with various formats',
          data: { phone: '+1 (555) 123-4567' },
          expectedValid: true,
        },
        {
          description: 'empty skills array',
          data: { skills: [] },
          expectedValid: true,
        },
        {
          description: 'single skill',
          data: { skills: ['JavaScript'] },
          expectedValid: true,
        },
        {
          description: 'exactly 20 skills',
          data: { skills: Array.from({ length: 20 }, (_, i) => `Skill${i}`) },
          expectedValid: true,
        },
        {
          description: 'null managerId',
          data: { managerId: null },
          expectedValid: true,
        },
        {
          description: 'valid UUID managerId',
          data: { managerId: '123e4567-e89b-12d3-a456-426614174000' },
          expectedValid: true,
        },
        {
          description: 'minimum length firstName',
          data: { firstName: 'A' },
          expectedValid: true,
        },
        {
          description: 'maximum length firstName',
          data: { firstName: 'A'.repeat(100) },
          expectedValid: true,
        },
        {
          description: 'minimum length lastName',
          data: { lastName: 'B' },
          expectedValid: true,
        },
        {
          description: 'maximum length lastName',
          data: { lastName: 'B'.repeat(100) },
          expectedValid: true,
        },
        {
          description: 'maximum length bio',
          data: { bio: 'B'.repeat(1000) },
          expectedValid: true,
        },
        {
          description: 'isActive true',
          data: { isActive: true },
          expectedValid: true,
        },
        {
          description: 'isActive false',
          data: { isActive: false },
          expectedValid: true,
        },
      ];

      for (const testCase of edgeCaseTests) {
        let isValid = true;

        try {
          validateUpdateEmployee(testCase.data);
        } catch (error) {
          isValid = false;
        }

        expect(isValid).toBe(testCase.expectedValid);
      }
    });

    it('should validate multiple field updates together', () => {
      const multiFieldTests = [
        {
          description: 'all valid fields',
          data: {
            firstName: 'John',
            lastName: 'Doe',
            email: 'john.doe@example.com',
            title: 'Software Engineer',
            department: 'Engineering',
            phone: '+1-555-0123',
            bio: 'Experienced developer',
            skills: ['JavaScript', 'TypeScript'],
          },
          expectedValid: true,
        },
        {
          description: 'mix of valid and invalid fields',
          data: {
            firstName: 'John',
            lastName: 'Doe123', // Invalid
            email: 'john.doe@example.com',
          },
          expectedValid: false,
        },
        {
          description: 'multiple invalid fields',
          data: {
            firstName: 'John123', // Invalid
            lastName: 'Doe@#$', // Invalid
            email: 'not-an-email', // Invalid
          },
          expectedValid: false,
        },
      ];

      for (const testCase of multiFieldTests) {
        let isValid = true;

        try {
          validateUpdateEmployee(testCase.data);
        } catch (error) {
          isValid = false;
        }

        expect(isValid).toBe(testCase.expectedValid);
      }
    });

    it('should strip unknown fields from update data', () => {
      const testCases = [
        {
          description: 'unknown field should be stripped',
          data: {
            firstName: 'John',
            unknownField: 'should be removed',
          },
          expectedFields: ['firstName'],
        },
        {
          description: 'multiple unknown fields should be stripped',
          data: {
            firstName: 'John',
            lastName: 'Doe',
            unknownField1: 'remove',
            unknownField2: 'remove',
          },
          expectedFields: ['firstName', 'lastName'],
        },
      ];

      for (const testCase of testCases) {
        const validatedData = validateUpdateEmployee(testCase.data);

        // Verify only expected fields are present
        testCase.expectedFields.forEach(field => {
          expect(validatedData).toHaveProperty(field);
        });

        // Verify unknown fields are not present
        expect(validatedData).not.toHaveProperty('unknownField');
        expect(validatedData).not.toHaveProperty('unknownField1');
        expect(validatedData).not.toHaveProperty('unknownField2');
      }
    });

    it('should handle customFields validation', () => {
      const customFieldTests = [
        {
          description: 'valid string custom field',
          data: { customFields: { department_code: 'ENG-001' } },
          expectedValid: true,
        },
        {
          description: 'valid number custom field',
          data: { customFields: { employee_number: 12345 } },
          expectedValid: true,
        },
        {
          description: 'valid boolean custom field',
          data: { customFields: { is_remote: true } },
          expectedValid: true,
        },
        {
          description: 'valid array custom field',
          data: { customFields: { certifications: ['AWS', 'Azure'] } },
          expectedValid: true,
        },
        {
          description: 'multiple custom fields',
          data: {
            customFields: {
              department_code: 'ENG-001',
              employee_number: 12345,
              is_remote: true,
            },
          },
          expectedValid: true,
        },
        {
          description: 'empty custom fields object',
          data: { customFields: {} },
          expectedValid: true,
        },
      ];

      for (const testCase of customFieldTests) {
        let isValid = true;

        try {
          validateUpdateEmployee(testCase.data);
        } catch (error) {
          isValid = false;
        }

        expect(isValid).toBe(testCase.expectedValid);
      }
    });
  });
});
