import { EmployeeService, EmployeeServiceContext } from '../employee.service';
import { EmployeeRepository, CreateEmployeeData, UpdateEmployeeData } from '../../repositories/employee.repository';
import { CustomFieldRepository } from '../../repositories/custom-field.repository';
import { AuditService } from '../audit.service';
import { FileUploadService } from '../file-upload.service';
import { TenantService } from '../tenant.service';
import { SearchService } from '../search.service';
import { NotFoundError, ValidationError, ConflictError, UserLimitExceededError } from '../../utils/errors';

// Mock dependencies
jest.mock('../../repositories/employee.repository');
jest.mock('../../repositories/custom-field.repository');
jest.mock('../audit.service');
jest.mock('../file-upload.service');
jest.mock('../tenant.service');
jest.mock('../search.service');
jest.mock('../../validators/employee.validator');
jest.mock('../../lib/redis');

const mockEmployeeRepository = EmployeeRepository as jest.Mocked<typeof EmployeeRepository>;
const mockCustomFieldRepository = CustomFieldRepository as jest.Mocked<typeof CustomFieldRepository>;
const mockAuditService = AuditService as jest.Mocked<typeof AuditService>;
const mockFileUploadService = FileUploadService as jest.Mocked<typeof FileUploadService>;
const mockTenantService = TenantService as jest.Mocked<typeof TenantService>;
const mockSearchService = SearchService as jest.Mocked<typeof SearchService>;

describe('EmployeeService', () => {
  const testContext: EmployeeServiceContext = {
    tenantId: 'tenant-123',
    userId: 'user-456',
    userRole: 'admin',
    ipAddress: '192.168.1.1',
    userAgent: 'Test Agent',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createEmployee', () => {
    const validEmployeeData: CreateEmployeeData = {
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@example.com',
      title: 'Software Engineer',
      department: 'Engineering',
      phone: '+1-555-0123',
      skills: ['JavaScript', 'TypeScript'],
      customFields: {
        startDate: '2024-01-01',
        employeeId: 'EMP001',
      },
    };

    it('should create employee successfully', async () => {
      const mockEmployee = {
        id: 'employee-123',
        ...validEmployeeData,
        tenantId: testContext.tenantId,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Mock validation
      const { validateCreateEmployee } = require('../../validators/employee.validator');
      validateCreateEmployee.mockReturnValue(validEmployeeData);

      // Mock custom field validation
      mockCustomFieldRepository.validateCustomFieldValues.mockResolvedValue({
        isValid: true,
        errors: [],
      });

      // Mock tenant user limit check
      mockTenantService.isAtUserLimit.mockResolvedValue(false);

      // Mock employee creation
      mockEmployeeRepository.create.mockResolvedValue(mockEmployee);

      // Mock audit logging
      mockAuditService.logChange.mockResolvedValue(undefined);

      const result = await EmployeeService.createEmployee(validEmployeeData, testContext);

      expect(validateCreateEmployee).toHaveBeenCalledWith(validEmployeeData);
      expect(mockCustomFieldRepository.validateCustomFieldValues).toHaveBeenCalledWith(
        testContext.tenantId,
        validEmployeeData.customFields
      );
      expect(mockTenantService.isAtUserLimit).toHaveBeenCalledWith(testContext.tenantId);
      expect(mockEmployeeRepository.create).toHaveBeenCalledWith({
        ...validEmployeeData,
        tenantId: testContext.tenantId,
      });
      expect(mockAuditService.logChange).toHaveBeenCalledWith({
        tenantId: testContext.tenantId,
        userId: testContext.userId,
        action: 'CREATE',
        entityType: 'employee',
        entityId: mockEmployee.id,
        ipAddress: testContext.ipAddress,
        userAgent: testContext.userAgent,
      });
      expect(result).toEqual(mockEmployee);
    });

    it('should throw ValidationError for invalid custom fields', async () => {
      const { validateCreateEmployee } = require('../../validators/employee.validator');
      validateCreateEmployee.mockReturnValue(validEmployeeData);

      mockCustomFieldRepository.validateCustomFieldValues.mockResolvedValue({
        isValid: false,
        errors: ['Invalid date format for startDate'],
      });

      await expect(
        EmployeeService.createEmployee(validEmployeeData, testContext)
      ).rejects.toThrow(ValidationError);
      await expect(
        EmployeeService.createEmployee(validEmployeeData, testContext)
      ).rejects.toThrow('Custom field validation failed: Invalid date format for startDate');

      expect(mockEmployeeRepository.create).not.toHaveBeenCalled();
    });

    it('should throw UserLimitExceededError when at user limit', async () => {
      const { validateCreateEmployee } = require('../../validators/employee.validator');
      validateCreateEmployee.mockReturnValue(validEmployeeData);

      mockCustomFieldRepository.validateCustomFieldValues.mockResolvedValue({
        isValid: true,
        errors: [],
      });

      mockTenantService.isAtUserLimit.mockResolvedValue(true);

      await expect(
        EmployeeService.createEmployee(validEmployeeData, testContext)
      ).rejects.toThrow(UserLimitExceededError);

      expect(mockEmployeeRepository.create).not.toHaveBeenCalled();
    });

    it('should handle employee creation without custom fields', async () => {
      const dataWithoutCustomFields = {
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'jane.smith@example.com',
        title: 'Designer',
        department: 'Design',
      };

      const { validateCreateEmployee } = require('../../validators/employee.validator');
      validateCreateEmployee.mockReturnValue(dataWithoutCustomFields);

      mockTenantService.isAtUserLimit.mockResolvedValue(false);
      mockEmployeeRepository.create.mockResolvedValue({
        id: 'employee-456',
        ...dataWithoutCustomFields,
        tenantId: testContext.tenantId,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await EmployeeService.createEmployee(dataWithoutCustomFields, testContext);

      expect(mockCustomFieldRepository.validateCustomFieldValues).not.toHaveBeenCalled();
      expect(result.id).toBe('employee-456');
    });
  });

  describe('updateEmployee', () => {
    const employeeId = 'employee-123';
    const updateData: UpdateEmployeeData = {
      firstName: 'Jonathan',
      title: 'Senior Software Engineer',
      skills: ['JavaScript', 'TypeScript', 'React'],
    };

    it('should update employee successfully', async () => {
      const existingEmployee = {
        id: employeeId,
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
        title: 'Software Engineer',
        tenantId: testContext.tenantId,
        isActive: true,
      };

      const updatedEmployee = {
        ...existingEmployee,
        ...updateData,
        updatedAt: new Date(),
      };

      const { validateUpdateEmployee } = require('../../validators/employee.validator');
      validateUpdateEmployee.mockReturnValue(updateData);

      mockEmployeeRepository.findById.mockResolvedValue(existingEmployee);
      mockEmployeeRepository.update.mockResolvedValue(updatedEmployee);
      mockAuditService.logFieldChanges.mockResolvedValue(undefined);

      const result = await EmployeeService.updateEmployee(employeeId, updateData, testContext);

      expect(validateUpdateEmployee).toHaveBeenCalledWith(updateData);
      expect(mockEmployeeRepository.findById).toHaveBeenCalledWith(employeeId, testContext.tenantId);
      expect(mockEmployeeRepository.update).toHaveBeenCalledWith(employeeId, updateData);
      expect(mockAuditService.logFieldChanges).toHaveBeenCalledWith(
        {
          tenantId: testContext.tenantId,
          userId: testContext.userId,
          action: 'UPDATE',
          entityType: 'employee',
          entityId: employeeId,
          ipAddress: testContext.ipAddress,
          userAgent: testContext.userAgent,
        },
        [
          { fieldName: 'firstName', oldValue: 'John', newValue: 'Jonathan' },
          { fieldName: 'title', oldValue: 'Software Engineer', newValue: 'Senior Software Engineer' },
          { fieldName: 'skills', oldValue: undefined, newValue: ['JavaScript', 'TypeScript', 'React'] },
        ]
      );
      expect(result).toEqual(updatedEmployee);
    });

    it('should throw NotFoundError for non-existent employee', async () => {
      const { validateUpdateEmployee } = require('../../validators/employee.validator');
      validateUpdateEmployee.mockReturnValue(updateData);

      mockEmployeeRepository.findById.mockResolvedValue(null);

      await expect(
        EmployeeService.updateEmployee(employeeId, updateData, testContext)
      ).rejects.toThrow(NotFoundError);
      await expect(
        EmployeeService.updateEmployee(employeeId, updateData, testContext)
      ).rejects.toThrow('Employee not found');

      expect(mockEmployeeRepository.update).not.toHaveBeenCalled();
    });

    it('should handle custom field updates', async () => {
      const updateWithCustomFields = {
        ...updateData,
        customFields: {
          startDate: '2024-02-01',
          employeeId: 'EMP002',
        },
      };

      const existingEmployee = {
        id: employeeId,
        firstName: 'John',
        customFields: { startDate: '2024-01-01', employeeId: 'EMP001' },
        tenantId: testContext.tenantId,
        isActive: true,
      };

      const { validateUpdateEmployee } = require('../../validators/employee.validator');
      validateUpdateEmployee.mockReturnValue(updateWithCustomFields);

      mockCustomFieldRepository.validateCustomFieldValues.mockResolvedValue({
        isValid: true,
        errors: [],
      });

      mockEmployeeRepository.findById.mockResolvedValue(existingEmployee);
      mockEmployeeRepository.update.mockResolvedValue({
        ...existingEmployee,
        ...updateWithCustomFields,
      });

      const result = await EmployeeService.updateEmployee(employeeId, updateWithCustomFields, testContext);

      expect(mockCustomFieldRepository.validateCustomFieldValues).toHaveBeenCalledWith(
        testContext.tenantId,
        updateWithCustomFields.customFields
      );
      expect(result.customFields).toEqual(updateWithCustomFields.customFields);
    });
  });

  describe('getEmployeeById', () => {
    const employeeId = 'employee-123';

    it('should return employee by ID', async () => {
      const mockEmployee = {
        id: employeeId,
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
        tenantId: testContext.tenantId,
        isActive: true,
      };

      mockEmployeeRepository.findById.mockResolvedValue(mockEmployee);

      const result = await EmployeeService.getEmployeeById(employeeId, testContext.tenantId);

      expect(mockEmployeeRepository.findById).toHaveBeenCalledWith(employeeId, testContext.tenantId);
      expect(result).toEqual(mockEmployee);
    });

    it('should return null for non-existent employee', async () => {
      mockEmployeeRepository.findById.mockResolvedValue(null);

      const result = await EmployeeService.getEmployeeById(employeeId, testContext.tenantId);

      expect(result).toBeNull();
    });
  });

  describe('deleteEmployee', () => {
    const employeeId = 'employee-123';

    it('should soft delete employee successfully', async () => {
      const existingEmployee = {
        id: employeeId,
        firstName: 'John',
        lastName: 'Doe',
        tenantId: testContext.tenantId,
        isActive: true,
      };

      mockEmployeeRepository.findById.mockResolvedValue(existingEmployee);
      mockEmployeeRepository.softDelete.mockResolvedValue({
        ...existingEmployee,
        isActive: false,
        updatedAt: new Date(),
      });
      mockAuditService.logChange.mockResolvedValue(undefined);

      const result = await EmployeeService.deleteEmployee(employeeId, testContext);

      expect(mockEmployeeRepository.findById).toHaveBeenCalledWith(employeeId, testContext.tenantId);
      expect(mockEmployeeRepository.softDelete).toHaveBeenCalledWith(employeeId);
      expect(mockAuditService.logChange).toHaveBeenCalledWith({
        tenantId: testContext.tenantId,
        userId: testContext.userId,
        action: 'DELETE',
        entityType: 'employee',
        entityId: employeeId,
        ipAddress: testContext.ipAddress,
        userAgent: testContext.userAgent,
      });
      expect(result.isActive).toBe(false);
    });

    it('should throw NotFoundError for non-existent employee', async () => {
      mockEmployeeRepository.findById.mockResolvedValue(null);

      await expect(
        EmployeeService.deleteEmployee(employeeId, testContext)
      ).rejects.toThrow(NotFoundError);

      expect(mockEmployeeRepository.softDelete).not.toHaveBeenCalled();
    });
  });

  describe('uploadProfilePhoto', () => {
    const employeeId = 'employee-123';
    const mockFile = {
      buffer: Buffer.from('fake image data'),
      mimetype: 'image/jpeg',
      originalname: 'profile.jpg',
      size: 1024 * 1024, // 1MB
    } as Express.Multer.File;

    it('should upload profile photo successfully', async () => {
      const existingEmployee = {
        id: employeeId,
        firstName: 'John',
        lastName: 'Doe',
        tenantId: testContext.tenantId,
        isActive: true,
      };

      const photoUrl = 'https://storage.example.com/photos/employee-123.jpg';

      mockEmployeeRepository.findById.mockResolvedValue(existingEmployee);
      mockFileUploadService.uploadFile.mockResolvedValue({ url: photoUrl });
      mockEmployeeRepository.update.mockResolvedValue({
        ...existingEmployee,
        photoUrl,
        updatedAt: new Date(),
      });
      mockAuditService.logChange.mockResolvedValue(undefined);

      const result = await EmployeeService.uploadProfilePhoto(employeeId, mockFile, testContext);

      expect(mockEmployeeRepository.findById).toHaveBeenCalledWith(employeeId, testContext.tenantId);
      expect(mockFileUploadService.uploadFile).toHaveBeenCalledWith(
        mockFile,
        `employees/${employeeId}/profile`
      );
      expect(mockEmployeeRepository.update).toHaveBeenCalledWith(employeeId, { photoUrl });
      expect(result.photoUrl).toBe(photoUrl);
    });

    it('should throw NotFoundError for non-existent employee', async () => {
      mockEmployeeRepository.findById.mockResolvedValue(null);

      await expect(
        EmployeeService.uploadProfilePhoto(employeeId, mockFile, testContext)
      ).rejects.toThrow(NotFoundError);

      expect(mockFileUploadService.uploadFile).not.toHaveBeenCalled();
    });
  });

  describe('listEmployees', () => {
    it('should list employees with pagination', async () => {
      const mockEmployees = [
        {
          id: 'employee-1',
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com',
          tenantId: testContext.tenantId,
          isActive: true,
        },
        {
          id: 'employee-2',
          firstName: 'Jane',
          lastName: 'Smith',
          email: 'jane@example.com',
          tenantId: testContext.tenantId,
          isActive: true,
        },
      ];

      const mockResult = {
        employees: mockEmployees,
        pagination: {
          page: 1,
          pageSize: 20,
          total: 2,
          totalPages: 1,
        },
      };

      const { validatePagination } = require('../../validators/employee.validator');
      validatePagination.mockReturnValue({ page: 1, pageSize: 20 });

      mockEmployeeRepository.findMany.mockResolvedValue(mockResult);

      const result = await EmployeeService.listEmployees(
        testContext.tenantId,
        {},
        { page: 1, pageSize: 20 }
      );

      expect(validatePagination).toHaveBeenCalledWith({ page: 1, pageSize: 20 });
      expect(mockEmployeeRepository.findMany).toHaveBeenCalledWith(
        testContext.tenantId,
        {},
        { page: 1, pageSize: 20 }
      );
      expect(result).toEqual(mockResult);
    });

    it('should apply filters correctly', async () => {
      const filters = {
        department: 'Engineering',
        isActive: true,
      };

      const { validateEmployeeFilters, validatePagination } = require('../../validators/employee.validator');
      validateEmployeeFilters.mockReturnValue(filters);
      validatePagination.mockReturnValue({ page: 1, pageSize: 20 });

      mockEmployeeRepository.findMany.mockResolvedValue({
        employees: [],
        pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 },
      });

      await EmployeeService.listEmployees(testContext.tenantId, filters, { page: 1, pageSize: 20 });

      expect(validateEmployeeFilters).toHaveBeenCalledWith(filters);
      expect(mockEmployeeRepository.findMany).toHaveBeenCalledWith(
        testContext.tenantId,
        filters,
        { page: 1, pageSize: 20 }
      );
    });
  });
});