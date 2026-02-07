import { EmployeeRepository, CreateEmployeeData, UpdateEmployeeData, EmployeeFilters, PaginationOptions } from '../repositories/employee.repository';
import { CustomFieldRepository } from '../repositories/custom-field.repository';
import { AuditService } from './audit.service';
import { profilePhotoUploadService } from './file-upload.service';
import { validateCreateEmployee, validateUpdateEmployee, validateEmployeeFilters, validatePagination } from '../validators/employee.validator';
import { ValidationError, UserLimitExceededError } from '../utils/errors';
import { TenantService } from './tenant.service';
import { AuthorizationService } from '../middleware/authorization.middleware';
import { redisClient } from '../lib/redis';
import { SearchService } from './search.service';

export interface EmployeeServiceContext {
  tenantId: string;
  userId?: string;
  userRole?: string;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Service layer for employee operations
 * Handles business logic, validation, audit logging, and file uploads
 */
export class EmployeeService {
  /**
   * Create a new employee
   */
  static async createEmployee(
    data: CreateEmployeeData,
    context: EmployeeServiceContext
  ) {
    // Validate input data
    const validatedData = validateCreateEmployee(data);

    // Validate custom fields against tenant's custom field definitions
    if (validatedData.customFields && Object.keys(validatedData.customFields).length > 0) {
      const customFieldValidation = await CustomFieldRepository.validateCustomFieldValues(
        context.tenantId,
        validatedData.customFields
      );
      
      if (!customFieldValidation.isValid) {
        throw new ValidationError(
          `Custom field validation failed: ${customFieldValidation.errors.join(', ')}`,
          'customFields',
          validatedData.customFields
        );
      }
    }

    // Check tenant user limit
    const isAtLimit = await TenantService.isAtUserLimit(context.tenantId);
    if (isAtLimit) {
      const tenant = await TenantService.getTenantById(context.tenantId);
      throw new UserLimitExceededError(tenant?.userLimit || 0);
    }

    // Create the employee
    const employee = await EmployeeRepository.create(context.tenantId, validatedData);

    // Log the creation
    await AuditService.logChange({
      tenantId: context.tenantId,
      userId: context.userId,
      action: 'CREATE',
      entityType: 'employee',
      entityId: employee.id,
      newValue: JSON.stringify({
        firstName: employee.firstName,
        lastName: employee.lastName,
        email: employee.email,
        title: employee.title,
        department: employee.department,
      }),
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });

    // Track analytics event
    await AuditService.trackEvent({
      tenantId: context.tenantId,
      userId: context.userId,
      eventType: 'employee_created',
      metadata: {
        employeeId: employee.id,
        department: employee.department,
        title: employee.title,
      },
    });

    // Cache the new employee profile
    await redisClient.setEmployeeProfile(context.tenantId, employee.id, employee);

    // Invalidate search cache since we added a new employee
    await SearchService.invalidateSearchCache(context.tenantId);

    return employee;
  }

  /**
   * Get employee by ID with Redis caching
   */
  static async getEmployeeById(
    employeeId: string,
    context: EmployeeServiceContext
  ) {
    // Try to get from cache first
    const cachedEmployee = await redisClient.getEmployeeProfile(context.tenantId, employeeId);
    if (cachedEmployee) {
      // Track profile view
      await AuditService.trackEvent({
        tenantId: context.tenantId,
        userId: context.userId,
        eventType: 'profile_view',
        metadata: {
          profileId: employeeId,
          viewerRole: context.userRole,
          source: 'cache',
        },
      });

      return cachedEmployee;
    }

    // Get from database if not in cache
    const employee = await EmployeeRepository.findById(context.tenantId, employeeId);
    
    if (employee) {
      // Cache the employee profile
      await redisClient.setEmployeeProfile(context.tenantId, employeeId, employee);
    }

    // Track profile view
    await AuditService.trackEvent({
      tenantId: context.tenantId,
      userId: context.userId,
      eventType: 'profile_view',
      metadata: {
        profileId: employeeId,
        viewerRole: context.userRole,
        source: 'database',
      },
    });

    return employee;
  }

  /**
   * Get employee by email
   */
  static async getEmployeeByEmail(
    email: string,
    context: EmployeeServiceContext
  ) {
    return EmployeeRepository.findByEmail(context.tenantId, email);
  }

  /**
   * Get employee by ID with custom field definitions and caching
   */
  static async getEmployeeByIdWithCustomFields(
    employeeId: string,
    context: EmployeeServiceContext
  ) {
    // Try to get from cache first
    const cacheKey = `employee_with_custom_fields:${context.tenantId}:${employeeId}`;
    const cachedData = await redisClient.get(cacheKey);
    
    if (cachedData) {
      // Track profile view
      await AuditService.trackEvent({
        tenantId: context.tenantId,
        userId: context.userId,
        eventType: 'profile_view',
        metadata: {
          profileId: employeeId,
          viewerRole: context.userRole,
          source: 'cache',
        },
      });

      return cachedData;
    }

    // Get from database if not in cache
    const [employee, customFields] = await Promise.all([
      EmployeeRepository.findById(context.tenantId, employeeId),
      CustomFieldRepository.findMany(context.tenantId)
    ]);

    if (!employee) {
      return null;
    }

    // Calculate profile completeness including custom fields
    const profileCompleteness = this.calculateProfileCompleteness(employee, customFields);

    const result = {
      employee: {
        ...employee,
        profileCompleteness,
      },
      customFields,
    };

    // Cache the result
    await redisClient.set(cacheKey, result, 300); // 5 minutes TTL

    // Track profile view
    await AuditService.trackEvent({
      tenantId: context.tenantId,
      userId: context.userId,
      eventType: 'profile_view',
      metadata: {
        profileId: employeeId,
        viewerRole: context.userRole,
        source: 'database',
      },
    });

    return result;
  }

  /**
   * Calculate profile completeness for a single employee including custom fields
   */
  static calculateProfileCompleteness(employee: any, customFields: any[]): number {
    // Standard required fields (70% weight)
    const requiredFields = ['firstName', 'lastName', 'email', 'title', 'department'];
    const completedRequired = requiredFields.filter(field => {
      const value = employee[field];
      return value !== null && value !== undefined && value !== '';
    }).length;

    // Required custom fields
    const requiredCustomFields = customFields.filter(cf => cf.isRequired);
    const completedRequiredCustom = requiredCustomFields.filter(cf => {
      const customFieldValues = employee.customFields || {};
      const value = customFieldValues[cf.fieldName];
      return value !== null && value !== undefined && value !== '';
    }).length;

    const totalRequired = requiredFields.length + requiredCustomFields.length;
    const completedRequiredTotal = completedRequired + completedRequiredCustom;

    // Standard optional fields (30% weight)
    const optionalFields = ['phone', 'officeLocation', 'bio', 'skills', 'photoUrl'];
    const completedOptional = optionalFields.filter(field => {
      const value = employee[field];
      if (field === 'skills') {
        return Array.isArray(value) && value.length > 0;
      }
      return value !== null && value !== undefined && value !== '';
    }).length;

    // Optional custom fields
    const optionalCustomFields = customFields.filter(cf => !cf.isRequired);
    const completedOptionalCustom = optionalCustomFields.filter(cf => {
      const customFieldValues = employee.customFields || {};
      const value = customFieldValues[cf.fieldName];
      return value !== null && value !== undefined && value !== '';
    }).length;

    const totalOptional = optionalFields.length + optionalCustomFields.length;
    const completedOptionalTotal = completedOptional + completedOptionalCustom;

    // Calculate weighted completeness (70% required, 30% optional)
    const completeness = Math.round(
      ((completedRequiredTotal / Math.max(totalRequired, 1)) * 70) + 
      ((completedOptionalTotal / Math.max(totalOptional, 1)) * 30)
    );

    return completeness;
  }

  /**
   * List employees with filtering and pagination
   */
  static async listEmployees(
    filters: EmployeeFilters = {},
    pagination: PaginationOptions = {},
    context: EmployeeServiceContext
  ) {
    // Validate filters and pagination
    const validatedFilters = validateEmployeeFilters(filters);
    const validatedPagination = validatePagination(pagination);

    // Get employees
    const result = await EmployeeRepository.findMany(
      context.tenantId,
      validatedFilters,
      validatedPagination
    );

    // Track search event if search term provided
    if (validatedFilters.search) {
      await AuditService.trackEvent({
        tenantId: context.tenantId,
        userId: context.userId,
        eventType: 'search',
        metadata: {
          query: validatedFilters.search,
          resultsCount: result.employees.length,
          filters: validatedFilters,
        },
      });
    }

    return result;
  }

  /**
   * Update employee
   */
  static async updateEmployee(
    employeeId: string,
    data: UpdateEmployeeData,
    context: EmployeeServiceContext
  ) {
    // Validate input data
    const validatedData = validateUpdateEmployee(data);

    // Validate custom fields against tenant's custom field definitions
    if (validatedData.customFields && Object.keys(validatedData.customFields).length > 0) {
      const customFieldValidation = await CustomFieldRepository.validateCustomFieldValues(
        context.tenantId,
        validatedData.customFields
      );
      
      if (!customFieldValidation.isValid) {
        throw new ValidationError(
          `Custom field validation failed: ${customFieldValidation.errors.join(', ')}`,
          'customFields',
          validatedData.customFields
        );
      }
    }

    // Get current employee data for audit logging
    const currentEmployee = await EmployeeRepository.findById(context.tenantId, employeeId);

    // Check permissions (basic check - more sophisticated authorization would be in middleware)
    await this.checkUpdatePermissions(employeeId, context);

    // Update the employee
    const updatedEmployee = await EmployeeRepository.update(
      context.tenantId,
      employeeId,
      validatedData
    );

    // Log field-level changes
    const changes = this.detectChanges(currentEmployee, updatedEmployee);
    if (changes.length > 0) {
      await AuditService.logFieldChanges(
        {
          tenantId: context.tenantId,
          userId: context.userId,
          action: 'UPDATE',
          entityType: 'employee',
          entityId: employeeId,
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
        },
        changes
      );
    }

    // Track analytics event
    await AuditService.trackEvent({
      tenantId: context.tenantId,
      userId: context.userId,
      eventType: 'profile_updated',
      metadata: {
        profileId: employeeId,
        fieldsChanged: changes.map(c => c.fieldName),
        updaterRole: context.userRole,
      },
    });

    // Invalidate cache for this employee
    await redisClient.invalidateEmployeeProfile(context.tenantId, employeeId);
    
    // Also invalidate the employee with custom fields cache
    const customFieldsCacheKey = `employee_with_custom_fields:${context.tenantId}:${employeeId}`;
    await redisClient.del(customFieldsCacheKey);

    // Invalidate search cache since employee data changed
    await SearchService.invalidateSearchCache(context.tenantId);

    return updatedEmployee;
  }

  /**
   * Upload profile photo
   */
  static async uploadProfilePhoto(
    employeeId: string,
    file: Express.Multer.File,
    context: EmployeeServiceContext
  ) {
    // Check if employee exists
    const employee = await EmployeeRepository.findById(context.tenantId, employeeId);

    // Check permissions
    await this.checkUpdatePermissions(employeeId, context);

    // Validate image
    const validation = await profilePhotoUploadService.validateImage(file);
    if (!validation.isValid) {
      throw new ValidationError(
        `Invalid image: ${validation.errors.join(', ')}`,
        'photo',
        file.originalname
      );
    }

    // Delete old photo if exists
    if (employee.photoUrl) {
      try {
        await profilePhotoUploadService.deleteFile(employee.photoUrl);
      } catch (error) {
        // Log but don't fail the upload if old photo deletion fails
        console.warn('Failed to delete old profile photo:', error);
      }
    }

    // Upload new photo
    const uploadResult = await profilePhotoUploadService.uploadFile(
      file,
      context.tenantId,
      context.userId
    );

    // Update employee with new photo URL
    const updatedEmployee = await EmployeeRepository.update(
      context.tenantId,
      employeeId,
      { photoUrl: uploadResult.url }
    );

    // Log the photo update
    await AuditService.logChange({
      tenantId: context.tenantId,
      userId: context.userId,
      action: 'UPDATE',
      entityType: 'employee',
      entityId: employeeId,
      fieldName: 'photoUrl',
      oldValue: employee.photoUrl || undefined,
      newValue: uploadResult.url,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });

    // Track analytics event
    await AuditService.trackEvent({
      tenantId: context.tenantId,
      userId: context.userId,
      eventType: 'photo_uploaded',
      metadata: {
        profileId: employeeId,
        fileSize: uploadResult.size,
        fileName: uploadResult.filename,
      },
    });

    return {
      employee: updatedEmployee,
      upload: uploadResult,
    };
  }

  /**
   * Delete profile photo
   */
  static async deleteProfilePhoto(
    employeeId: string,
    context: EmployeeServiceContext
  ) {
    // Check if employee exists
    const employee = await EmployeeRepository.findById(context.tenantId, employeeId);

    // Check permissions
    await this.checkUpdatePermissions(employeeId, context);

    if (!employee.photoUrl) {
      throw new ValidationError('Employee has no profile photo to delete', 'photoUrl');
    }

    // Delete photo from storage
    await profilePhotoUploadService.deleteFile(employee.photoUrl);

    // Update employee to remove photo URL
    const updatedEmployee = await EmployeeRepository.update(
      context.tenantId,
      employeeId,
      { photoUrl: undefined }
    );

    // Log the photo deletion
    await AuditService.logChange({
      tenantId: context.tenantId,
      userId: context.userId,
      action: 'UPDATE',
      entityType: 'employee',
      entityId: employeeId,
      fieldName: 'photoUrl',
      oldValue: employee.photoUrl,
      newValue: undefined,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });

    // Invalidate cache for this employee
    await redisClient.invalidateEmployeeProfile(context.tenantId, employeeId);
    
    // Also invalidate the employee with custom fields cache
    const customFieldsCacheKey = `employee_with_custom_fields:${context.tenantId}:${employeeId}`;
    await redisClient.del(customFieldsCacheKey);

    // Invalidate search cache since employee photo changed
    await SearchService.invalidateSearchCache(context.tenantId);

    return updatedEmployee;
  }

  /**
   * Deactivate employee (soft delete)
   */
  static async deactivateEmployee(
    employeeId: string,
    context: EmployeeServiceContext
  ) {
    // Get current employee
    const employee = await EmployeeRepository.findById(context.tenantId, employeeId);

    if (!employee.isActive) {
      throw new ValidationError('Employee is already inactive', 'isActive');
    }

    // Deactivate the employee
    const deactivatedEmployee = await EmployeeRepository.softDelete(context.tenantId, employeeId);

    // Log the deactivation
    await AuditService.logChange({
      tenantId: context.tenantId,
      userId: context.userId,
      action: 'DELETE',
      entityType: 'employee',
      entityId: employeeId,
      oldValue: 'active',
      newValue: 'inactive',
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });

    // Track analytics event
    await AuditService.trackEvent({
      tenantId: context.tenantId,
      userId: context.userId,
      eventType: 'employee_deactivated',
      metadata: {
        employeeId,
        department: employee.department,
        title: employee.title,
      },
    });

    // Invalidate cache for this employee
    await redisClient.invalidateEmployeeProfile(context.tenantId, employeeId);
    
    // Also invalidate the employee with custom fields cache
    const customFieldsCacheKey = `employee_with_custom_fields:${context.tenantId}:${employeeId}`;
    await redisClient.del(customFieldsCacheKey);

    // Invalidate search cache since employee was deactivated
    await SearchService.invalidateSearchCache(context.tenantId);

    return deactivatedEmployee;
  }

  /**
   * Get organizational hierarchy for employee
   */
  static async getEmployeeHierarchy(
    employeeId: string,
    context: EmployeeServiceContext
  ) {
    const hierarchy = await EmployeeRepository.getHierarchy(context.tenantId, employeeId);

    // Track analytics event
    await AuditService.trackEvent({
      tenantId: context.tenantId,
      userId: context.userId,
      eventType: 'hierarchy_viewed',
      metadata: {
        employeeId,
        managementChainLength: hierarchy.managementChain.length,
        directReportsCount: hierarchy.directReports.length,
      },
    });

    return hierarchy;
  }

  /**
   * Get employees by manager
   */
  static async getDirectReports(
    managerId: string,
    context: EmployeeServiceContext
  ) {
    return EmployeeRepository.findByManager(context.tenantId, managerId);
  }

  /**
   * Get employee statistics
   */
  static async getEmployeeStatistics(context: EmployeeServiceContext) {
    return EmployeeRepository.getStatistics(context.tenantId);
  }

  /**
   * Bulk update employees
   */
  static async bulkUpdateEmployees(
    updates: Array<{ id: string; data: UpdateEmployeeData }>,
    context: EmployeeServiceContext
  ) {
    // Validate each update
    const validatedUpdates = updates.map(update => ({
      id: update.id,
      data: validateUpdateEmployee(update.data),
    }));

    // Perform bulk update
    const result = await EmployeeRepository.bulkUpdate(context.tenantId, validatedUpdates);

    // Log successful updates
    for (const success of result.results) {
      await AuditService.logChange({
        tenantId: context.tenantId,
        userId: context.userId,
        action: 'UPDATE',
        entityType: 'employee',
        entityId: success.id,
        newValue: 'bulk_update',
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      });
    }

    // Track analytics event
    await AuditService.trackEvent({
      tenantId: context.tenantId,
      userId: context.userId,
      eventType: 'bulk_update',
      metadata: {
        totalUpdates: updates.length,
        successful: result.summary.successful,
        failed: result.summary.failed,
      },
    });

    return result;
  }

  /**
   * Check update permissions using the authorization service
   */
  private static async checkUpdatePermissions(
    employeeId: string,
    context: EmployeeServiceContext
  ): Promise<void> {
    if (!context.userId) {
      throw new ValidationError('User authentication required', 'userId');
    }

    const user = {
      id: context.userId,
      tenantId: context.tenantId,
      email: '', // Not needed for permission check
      role: context.userRole || 'user',
      isActive: true
    };

    const canEdit = await AuthorizationService.canEditEmployee(user, employeeId, context.tenantId);
    
    if (!canEdit) {
      throw new ValidationError('Insufficient permissions to update this employee', 'permissions');
    }
  }

  /**
   * Detect changes between old and new employee data
   */
  private static detectChanges(
    oldEmployee: any,
    newEmployee: any
  ): Array<{ fieldName: string; oldValue: string; newValue: string }> {
    const changes: Array<{ fieldName: string; oldValue: string; newValue: string }> = [];
    
    const fieldsToCheck = [
      'firstName', 'lastName', 'email', 'title', 'department',
      'phone', 'extension', 'officeLocation', 'managerId', 'bio',
      'skills', 'customFields', 'isActive'
    ];

    fieldsToCheck.forEach(field => {
      const oldValue = oldEmployee[field];
      const newValue = newEmployee[field];

      // Handle different data types
      let oldStr = oldValue;
      let newStr = newValue;

      if (Array.isArray(oldValue) || typeof oldValue === 'object') {
        oldStr = JSON.stringify(oldValue);
      }
      if (Array.isArray(newValue) || typeof newValue === 'object') {
        newStr = JSON.stringify(newValue);
      }

      if (oldStr !== newStr) {
        changes.push({
          fieldName: field,
          oldValue: oldStr?.toString() || '',
          newValue: newStr?.toString() || '',
        });
      }
    });

    return changes;
  }

  /**
   * Search employees with advanced options
   */
  static async searchEmployees(
    searchTerm: string,
    options: {
      filters?: EmployeeFilters;
      pagination?: PaginationOptions;
      includeInactive?: boolean;
    } = {},
    context: EmployeeServiceContext
  ) {
    const filters: EmployeeFilters = {
      search: searchTerm,
      isActive: options.includeInactive ? undefined : true,
      ...options.filters,
    };

    const result = await this.listEmployees(filters, options.pagination, context);

    // Enhanced search analytics
    await AuditService.trackEvent({
      tenantId: context.tenantId,
      userId: context.userId,
      eventType: 'advanced_search',
      metadata: {
        searchTerm,
        filters: options.filters,
        resultsCount: result.employees.length,
        includeInactive: options.includeInactive,
      },
    });

    return result;
  }
}