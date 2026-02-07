import { EmployeeService } from '../employee.service';
import { CustomFieldRepository } from '../../repositories/custom-field.repository';
import { EmployeeRepository } from '../../repositories/employee.repository';
import { ValidationError } from '../../utils/errors';

// Mock the dependencies
jest.mock('../../repositories/custom-field.repository');
jest.mock('../../repositories/employee.repository');
jest.mock('../audit.service');
jest.mock('../tenant.service');
jest.mock('../../middleware/authorization.middleware');

const mockCustomFieldRepository = CustomFieldRepository as jest.Mocked<typeof CustomFieldRepository>;
const mockEmployeeRepository = EmployeeRepository as jest.Mocked<typeof EmployeeRepository>;

describe('EmployeeService - Custom Fields Integration', () => {
  const mockContext = {
    tenantId: 'test-tenant-id',
    userId: 'test-user-id',
    userRole: 'admin' as const,
    ipAddress: '127.0.0.1',
    userAgent: 'test-agent',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createEmployee with custom fields', () => {
    it('should create employee with valid custom fields', async () => {
      // Mock custom field validation to pass
      mockCustomFieldRepository.validateCustomFieldValues.mockResolvedValue({
        isValid: true,
        errors: [],
      });

      // Mock tenant service
      const TenantService = require('../tenant.service').TenantService;
      TenantService.isAtUserLimit = jest.fn().mockResolvedValue(false);

      // Mock employee creation
      const mockEmployee = {
        id: 'employee-id',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@test.com',
        customFields: {
          employeeId: 'EMP001',
          workLocation: 'Remote',
        },
      };
      mockEmployeeRepository.create.mockResolvedValue(mockEmployee as any);

      // Mock audit service
      const AuditService = require('../audit.service').AuditService;
      AuditService.logChange = jest.fn().mockResolvedValue(undefined);
      AuditService.trackEvent = jest.fn().mockResolvedValue(undefined);

      const result = await EmployeeService.createEmployee({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@test.com',
        customFields: {
          employeeId: 'EMP001',
          workLocation: 'Remote',
        },
      }, mockContext);

      expect(mockCustomFieldRepository.validateCustomFieldValues).toHaveBeenCalledWith(
        mockContext.tenantId,
        {
          employeeId: 'EMP001',
          workLocation: 'Remote',
        }
      );
      expect(mockEmployeeRepository.create).toHaveBeenCalled();
      expect(result).toEqual(mockEmployee);
    });

    it('should reject employee creation with invalid custom fields', async () => {
      // Mock custom field validation to fail
      mockCustomFieldRepository.validateCustomFieldValues.mockResolvedValue({
        isValid: false,
        errors: ['employeeId is required', 'workLocation must be one of: Remote, Office, Hybrid'],
      });

      // Mock tenant service
      const TenantService = require('../tenant.service').TenantService;
      TenantService.isAtUserLimit = jest.fn().mockResolvedValue(false);

      await expect(EmployeeService.createEmployee({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@test.com',
        customFields: {
          workLocation: 'InvalidLocation',
        },
      }, mockContext)).rejects.toThrow(ValidationError);

      expect(mockCustomFieldRepository.validateCustomFieldValues).toHaveBeenCalled();
      expect(mockEmployeeRepository.create).not.toHaveBeenCalled();
    });

    it('should create employee without custom fields', async () => {
      // Mock tenant service
      const TenantService = require('../tenant.service').TenantService;
      TenantService.isAtUserLimit = jest.fn().mockResolvedValue(false);

      // Mock employee creation
      const mockEmployee = {
        id: 'employee-id',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@test.com',
        customFields: {},
      };
      mockEmployeeRepository.create.mockResolvedValue(mockEmployee as any);

      // Mock audit service
      const AuditService = require('../audit.service').AuditService;
      AuditService.logChange = jest.fn().mockResolvedValue(undefined);
      AuditService.trackEvent = jest.fn().mockResolvedValue(undefined);

      const result = await EmployeeService.createEmployee({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@test.com',
      }, mockContext);

      expect(mockCustomFieldRepository.validateCustomFieldValues).not.toHaveBeenCalled();
      expect(mockEmployeeRepository.create).toHaveBeenCalled();
      expect(result).toEqual(mockEmployee);
    });
  });

  describe('updateEmployee with custom fields', () => {
    it('should update employee with valid custom fields', async () => {
      // Mock custom field validation to pass
      mockCustomFieldRepository.validateCustomFieldValues.mockResolvedValue({
        isValid: true,
        errors: [],
      });

      // Mock existing employee
      const mockCurrentEmployee = {
        id: 'employee-id',
        firstName: 'John',
        lastName: 'Doe',
        customFields: { employeeId: 'EMP001' },
      };
      mockEmployeeRepository.findById.mockResolvedValue(mockCurrentEmployee as any);

      // Mock updated employee
      const mockUpdatedEmployee = {
        ...mockCurrentEmployee,
        customFields: { employeeId: 'EMP001-UPDATED', workLocation: 'Office' },
      };
      mockEmployeeRepository.update.mockResolvedValue(mockUpdatedEmployee as any);

      // Mock authorization
      const AuthorizationService = require('../../middleware/authorization.middleware').AuthorizationService;
      AuthorizationService.canEditEmployee = jest.fn().mockResolvedValue(true);

      // Mock audit service
      const AuditService = require('../audit.service').AuditService;
      AuditService.logFieldChanges = jest.fn().mockResolvedValue(undefined);
      AuditService.trackEvent = jest.fn().mockResolvedValue(undefined);

      const result = await EmployeeService.updateEmployee('employee-id', {
        customFields: {
          employeeId: 'EMP001-UPDATED',
          workLocation: 'Office',
        },
      }, mockContext);

      expect(mockCustomFieldRepository.validateCustomFieldValues).toHaveBeenCalledWith(
        mockContext.tenantId,
        {
          employeeId: 'EMP001-UPDATED',
          workLocation: 'Office',
        }
      );
      expect(mockEmployeeRepository.update).toHaveBeenCalled();
      expect(result).toEqual(mockUpdatedEmployee);
    });

    it('should reject employee update with invalid custom fields', async () => {
      // Mock custom field validation to fail
      mockCustomFieldRepository.validateCustomFieldValues.mockResolvedValue({
        isValid: false,
        errors: ['workLocation must be one of: Remote, Office, Hybrid'],
      });

      await expect(EmployeeService.updateEmployee('employee-id', {
        customFields: {
          workLocation: 'InvalidLocation',
        },
      }, mockContext)).rejects.toThrow(ValidationError);

      expect(mockCustomFieldRepository.validateCustomFieldValues).toHaveBeenCalled();
      expect(mockEmployeeRepository.findById).not.toHaveBeenCalled();
    });
  });

  describe('getEmployeeByIdWithCustomFields', () => {
    it('should return employee with custom field definitions', async () => {
      const mockEmployee = {
        id: 'employee-id',
        firstName: 'John',
        lastName: 'Doe',
        customFields: { employeeId: 'EMP001' },
      };

      const mockCustomFields = [
        {
          id: 'cf1',
          fieldName: 'employeeId',
          fieldType: 'text',
          isRequired: true,
        },
        {
          id: 'cf2',
          fieldName: 'workLocation',
          fieldType: 'dropdown',
          isRequired: false,
          options: ['Remote', 'Office', 'Hybrid'],
        },
      ];

      mockEmployeeRepository.findById.mockResolvedValue(mockEmployee as any);
      mockCustomFieldRepository.findMany.mockResolvedValue(mockCustomFields as any);

      // Mock audit service
      const AuditService = require('../audit.service').AuditService;
      AuditService.trackEvent = jest.fn().mockResolvedValue(undefined);

      const result = await EmployeeService.getEmployeeByIdWithCustomFields('employee-id', mockContext);

      expect(result.employee).toEqual(mockEmployee);
      expect(result.customFields).toEqual(mockCustomFields);
      expect(mockEmployeeRepository.findById).toHaveBeenCalledWith(mockContext.tenantId, 'employee-id');
      expect(mockCustomFieldRepository.findMany).toHaveBeenCalledWith(mockContext.tenantId);
    });
  });
});