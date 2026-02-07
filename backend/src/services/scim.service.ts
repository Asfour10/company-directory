import { Employee, User } from '@prisma/client';
import { EmployeeRepository } from '../repositories/employee.repository';
import { UserRepository } from '../repositories/user.repository';
import { SCIMSchemaMapper } from './scim-mapping.service';
import { AuditService } from './audit.service';
import { NotFoundError, ValidationError, ConflictError } from '../utils/errors';
import {
  SCIMUser,
  SCIMListResponse,
  SCIMError,
  SCIM_SCHEMAS,
  SCIM_ERROR_TYPES,
} from '../types/scim.types';

export interface SCIMServiceContext {
  tenantId: string;
  ipAddress?: string;
  userAgent?: string;
  scimClientId?: string; // For audit logging
}

/**
 * SCIM 2.0 Service for user provisioning
 * Handles SCIM operations and integrates with internal employee/user management
 */
export class SCIMService {
  /**
   * Create a new user via SCIM
   */
  static async createUser(scimUser: SCIMUser, context: SCIMServiceContext): Promise<SCIMUser> {
    // Validate SCIM user data
    const validationErrors = SCIMSchemaMapper.validateSCIMUser(scimUser);
    if (validationErrors.length > 0) {
      // Log validation failure
      await AuditService.logChange({
        tenantId: context.tenantId,
        userId: context.scimClientId,
        action: 'CREATE',
        entityType: 'scim_user',
        entityId: 'validation_failed',
        fieldName: 'validation_errors',
        newValue: JSON.stringify(validationErrors),
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      });

      throw new ValidationError(
        `SCIM user validation failed: ${validationErrors.join(', ')}`,
        'scimUser',
        scimUser
      );
    }

    // Convert SCIM user to internal format
    const { employee: employeeData, user: userData } = SCIMSchemaMapper.fromSCIMUser(scimUser);

    // Check if user already exists by email
    const existingEmployee = await EmployeeRepository.findByEmail(context.tenantId, employeeData.email!);
    if (existingEmployee) {
      // Log conflict
      await AuditService.logChange({
        tenantId: context.tenantId,
        userId: context.scimClientId,
        action: 'CREATE',
        entityType: 'scim_user',
        entityId: existingEmployee.id,
        fieldName: 'conflict',
        newValue: `User with email ${employeeData.email} already exists`,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      });

      throw new ConflictError(`User with email ${employeeData.email} already exists`);
    }

    // Create user first if we have user data
    let user: User | undefined;
    if (userData.email) {
      try {
        user = await UserRepository.create(context.tenantId, {
          email: userData.email,
          externalId: userData.externalId,
          role: 'user', // Default role for SCIM provisioned users
          isActive: userData.isActive ?? true,
        });

        // Log user creation
        await AuditService.logChange({
          tenantId: context.tenantId,
          userId: context.scimClientId,
          action: 'CREATE',
          entityType: 'user',
          entityId: user.id,
          newValue: JSON.stringify({
            email: user.email,
            externalId: user.externalId,
            role: user.role,
            source: 'SCIM',
          }),
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
        });
      } catch (error) {
        if (error instanceof ConflictError) {
          // User might already exist, try to find it
          user = await UserRepository.findByEmail(context.tenantId, userData.email);
          
          // Log that we found existing user
          if (user) {
            await AuditService.logChange({
              tenantId: context.tenantId,
              userId: context.scimClientId,
              action: 'CREATE',
              entityType: 'scim_user',
              entityId: user.id,
              fieldName: 'existing_user_found',
              newValue: `Found existing user for email ${userData.email}`,
              ipAddress: context.ipAddress,
              userAgent: context.userAgent,
            });
          }
        } else {
          throw error;
        }
      }
    }

    // Handle manager relationship
    const managerId = SCIMSchemaMapper.getManagerId(scimUser);
    if (managerId) {
      // Verify manager exists
      const manager = await EmployeeRepository.findById(context.tenantId, managerId);
      if (manager) {
        employeeData.managerId = managerId;
      } else {
        // Log manager not found
        await AuditService.logChange({
          tenantId: context.tenantId,
          userId: context.scimClientId,
          action: 'CREATE',
          entityType: 'scim_user',
          entityId: 'manager_validation',
          fieldName: 'manager_not_found',
          newValue: `Manager with id ${managerId} not found`,
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
        });
      }
    }

    // Create employee
    const employee = await EmployeeRepository.create(context.tenantId, {
      ...employeeData,
      userId: user?.id,
    });

    // Log the creation with SCIM context
    await AuditService.logChange({
      tenantId: context.tenantId,
      userId: context.scimClientId,
      action: 'CREATE',
      entityType: 'employee',
      entityId: employee.id,
      newValue: JSON.stringify({
        firstName: employee.firstName,
        lastName: employee.lastName,
        email: employee.email,
        externalId: scimUser.externalId,
        source: 'SCIM',
        scimSchemas: scimUser.schemas,
      }),
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });

    // Track SCIM provisioning event
    await AuditService.trackEvent({
      tenantId: context.tenantId,
      userId: context.scimClientId,
      eventType: 'scim_user_provisioned',
      metadata: {
        employeeId: employee.id,
        userId: user?.id,
        externalId: scimUser.externalId,
        department: employee.department,
        title: employee.title,
        ssoProvider: context.scimClientId?.split('-')[1], // Extract from scim-{provider}
      },
    });

    // Convert back to SCIM format
    return SCIMSchemaMapper.toSCIMUser(employee, user);
  }

  /**
   * Get user by ID via SCIM
   */
  static async getUserById(userId: string, context: SCIMServiceContext): Promise<SCIMUser> {
    const employee = await EmployeeRepository.findById(context.tenantId, userId);
    if (!employee) {
      // Log access attempt for non-existent user
      await AuditService.logChange({
        tenantId: context.tenantId,
        userId: context.scimClientId,
        action: 'READ',
        entityType: 'scim_user',
        entityId: userId,
        fieldName: 'not_found',
        newValue: `User with id ${userId} not found`,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      });

      throw new NotFoundError(`User with id ${userId} not found`);
    }

    // Get associated user if exists
    let user: User | undefined;
    if (employee.userId) {
      user = await UserRepository.findById(employee.userId);
    }

    // Log SCIM user access
    await AuditService.trackEvent({
      tenantId: context.tenantId,
      userId: context.scimClientId,
      eventType: 'scim_user_accessed',
      metadata: {
        employeeId: userId,
        userId: user?.id,
        email: employee.email,
        ssoProvider: context.scimClientId?.split('-')[1],
      },
    });

    return SCIMSchemaMapper.toSCIMUser(employee, user);
  }

  /**
   * Update user via SCIM
   */
  static async updateUser(
    userId: string,
    scimUser: SCIMUser,
    context: SCIMServiceContext
  ): Promise<SCIMUser> {
    // Find existing employee
    const existingEmployee = await EmployeeRepository.findById(context.tenantId, userId);
    if (!existingEmployee) {
      // Log not found
      await AuditService.logChange({
        tenantId: context.tenantId,
        userId: context.scimClientId,
        action: 'UPDATE',
        entityType: 'scim_user',
        entityId: userId,
        fieldName: 'not_found',
        newValue: `User with id ${userId} not found`,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      });

      throw new NotFoundError(`User with id ${userId} not found`);
    }

    // Get associated user if exists
    let existingUser: User | undefined;
    if (existingEmployee.userId) {
      existingUser = await UserRepository.findById(existingEmployee.userId);
    }

    // Validate SCIM user data
    const validationErrors = SCIMSchemaMapper.validateSCIMUser(scimUser);
    if (validationErrors.length > 0) {
      // Log validation failure
      await AuditService.logChange({
        tenantId: context.tenantId,
        userId: context.scimClientId,
        action: 'UPDATE',
        entityType: 'scim_user',
        entityId: userId,
        fieldName: 'validation_errors',
        newValue: JSON.stringify(validationErrors),
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      });

      throw new ValidationError(
        `SCIM user validation failed: ${validationErrors.join(', ')}`,
        'scimUser',
        scimUser
      );
    }

    // Get update data
    const { employee: employeeUpdate, user: userUpdate } = SCIMSchemaMapper.updateFromSCIMUser(
      scimUser,
      existingEmployee,
      existingUser
    );

    // Handle manager relationship
    const managerId = SCIMSchemaMapper.getManagerId(scimUser);
    if (managerId && managerId !== existingEmployee.managerId) {
      // Verify manager exists
      const manager = await EmployeeRepository.findById(context.tenantId, managerId);
      if (manager) {
        employeeUpdate.managerId = managerId;
      } else {
        // Log manager not found
        await AuditService.logChange({
          tenantId: context.tenantId,
          userId: context.scimClientId,
          action: 'UPDATE',
          entityType: 'scim_user',
          entityId: userId,
          fieldName: 'manager_not_found',
          newValue: `Manager with id ${managerId} not found`,
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
        });
      }
    }

    // Update employee if there are changes
    let updatedEmployee = existingEmployee;
    if (Object.keys(employeeUpdate).length > 0) {
      updatedEmployee = await EmployeeRepository.update(context.tenantId, userId, employeeUpdate);

      // Log field-level changes with SCIM context
      for (const [field, newValue] of Object.entries(employeeUpdate)) {
        const oldValue = (existingEmployee as any)[field];
        if (oldValue !== newValue) {
          await AuditService.logChange({
            tenantId: context.tenantId,
            userId: context.scimClientId,
            action: 'UPDATE',
            entityType: 'employee',
            entityId: userId,
            fieldName: field,
            oldValue: oldValue ? String(oldValue) : null,
            newValue: newValue ? String(newValue) : null,
            ipAddress: context.ipAddress,
            userAgent: context.userAgent,
          });
        }
      }

      // Track SCIM update event
      await AuditService.trackEvent({
        tenantId: context.tenantId,
        userId: context.scimClientId,
        eventType: 'scim_user_updated',
        metadata: {
          employeeId: userId,
          userId: existingUser?.id,
          externalId: scimUser.externalId,
          fieldsUpdated: Object.keys(employeeUpdate),
          ssoProvider: context.scimClientId?.split('-')[1],
        },
      });
    }

    // Update user if there are changes and user exists
    let updatedUser = existingUser;
    if (existingUser && Object.keys(userUpdate).length > 0) {
      updatedUser = await UserRepository.update(existingUser.id, userUpdate);

      // Log user changes with SCIM context
      for (const [field, newValue] of Object.entries(userUpdate)) {
        const oldValue = (existingUser as any)[field];
        if (oldValue !== newValue) {
          await AuditService.logChange({
            tenantId: context.tenantId,
            userId: context.scimClientId,
            action: 'UPDATE',
            entityType: 'user',
            entityId: existingUser.id,
            fieldName: field,
            oldValue: oldValue ? String(oldValue) : null,
            newValue: newValue ? String(newValue) : null,
            ipAddress: context.ipAddress,
            userAgent: context.userAgent,
          });
        }
      }
    }

    return SCIMSchemaMapper.toSCIMUser(updatedEmployee, updatedUser);
  }

  /**
   * Deactivate user via SCIM
   */
  static async deactivateUser(userId: string, context: SCIMServiceContext): Promise<void> {
    const existingEmployee = await EmployeeRepository.findById(context.tenantId, userId);
    if (!existingEmployee) {
      // Log not found
      await AuditService.logChange({
        tenantId: context.tenantId,
        userId: context.scimClientId,
        action: 'DELETE',
        entityType: 'scim_user',
        entityId: userId,
        fieldName: 'not_found',
        newValue: `User with id ${userId} not found`,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      });

      throw new NotFoundError(`User with id ${userId} not found`);
    }

    // Log deactivation attempt
    await AuditService.logChange({
      tenantId: context.tenantId,
      userId: context.scimClientId,
      action: 'DELETE',
      entityType: 'scim_user',
      entityId: userId,
      fieldName: 'deactivation_initiated',
      oldValue: JSON.stringify({
        firstName: existingEmployee.firstName,
        lastName: existingEmployee.lastName,
        email: existingEmployee.email,
        isActive: existingEmployee.isActive,
      }),
      newValue: 'SCIM deactivation requested',
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });

    // Deactivate employee
    await EmployeeRepository.update(context.tenantId, userId, { isActive: false });

    // Deactivate associated user if exists
    if (existingEmployee.userId) {
      await UserRepository.update(existingEmployee.userId, { isActive: false });

      // Log user deactivation
      await AuditService.logChange({
        tenantId: context.tenantId,
        userId: context.scimClientId,
        action: 'DELETE',
        entityType: 'user',
        entityId: existingEmployee.userId,
        fieldName: 'isActive',
        oldValue: 'true',
        newValue: 'false',
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      });
    }

    // Log the employee deactivation
    await AuditService.logChange({
      tenantId: context.tenantId,
      userId: context.scimClientId,
      action: 'DELETE',
      entityType: 'employee',
      entityId: userId,
      fieldName: 'isActive',
      oldValue: 'true',
      newValue: 'false',
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });

    // Track SCIM deprovisioning event
    await AuditService.trackEvent({
      tenantId: context.tenantId,
      userId: context.scimClientId,
      eventType: 'scim_user_deprovisioned',
      metadata: {
        employeeId: userId,
        userId: existingEmployee.userId,
        email: existingEmployee.email,
        department: existingEmployee.department,
        title: existingEmployee.title,
        ssoProvider: context.scimClientId?.split('-')[1],
      },
    });
  }

  /**
   * List users via SCIM with pagination and filtering
   */
  static async listUsers(
    context: SCIMServiceContext,
    options: {
      startIndex?: number;
      count?: number;
      filter?: string;
    } = {}
  ): Promise<SCIMListResponse<SCIMUser>> {
    const { startIndex = 1, count = 100, filter } = options;

    // Log SCIM list request
    await AuditService.trackEvent({
      tenantId: context.tenantId,
      userId: context.scimClientId,
      eventType: 'scim_users_listed',
      metadata: {
        startIndex,
        count,
        filter,
        ssoProvider: context.scimClientId?.split('-')[1],
      },
    });

    // Convert SCIM pagination to internal pagination
    const page = Math.ceil(startIndex / count);
    const pageSize = Math.min(count, 1000); // Limit max page size

    // Parse filter if provided (basic implementation)
    let filterOptions: any = {};
    if (filter) {
      // Log filter usage
      await AuditService.logChange({
        tenantId: context.tenantId,
        userId: context.scimClientId,
        action: 'READ',
        entityType: 'scim_users',
        entityId: 'filter_applied',
        fieldName: 'filter',
        newValue: filter,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      });

      // Basic filter parsing for common SCIM filters
      // Example: userName eq "john@example.com" or active eq true
      if (filter.includes('userName eq')) {
        const match = filter.match(/userName eq "([^"]+)"/);
        if (match) {
          filterOptions.email = match[1];
        }
      }
      if (filter.includes('active eq')) {
        const match = filter.match(/active eq (true|false)/);
        if (match) {
          filterOptions.isActive = match[1] === 'true';
        }
      }
    }

    // Get employees with pagination
    const result = await EmployeeRepository.findMany(context.tenantId, filterOptions, {
      page,
      pageSize,
    });

    // Get associated users for employees that have them
    const employeeIds = result.employees.map(emp => emp.userId).filter(Boolean) as string[];
    const users = employeeIds.length > 0 ? await UserRepository.findByIds(employeeIds) : [];
    const userMap = new Map(users.map(user => [user.id, user]));

    // Convert to SCIM format
    const scimUsers = result.employees.map(employee => {
      const user = employee.userId ? userMap.get(employee.userId) : undefined;
      return SCIMSchemaMapper.toSCIMUser(employee, user);
    });

    // Log successful list operation
    await AuditService.logChange({
      tenantId: context.tenantId,
      userId: context.scimClientId,
      action: 'READ',
      entityType: 'scim_users',
      entityId: 'list_success',
      fieldName: 'results_count',
      newValue: scimUsers.length.toString(),
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });

    return {
      schemas: [SCIM_SCHEMAS.LIST_RESPONSE],
      totalResults: result.total,
      startIndex,
      itemsPerPage: scimUsers.length,
      Resources: scimUsers,
    };
  }

  /**
   * Create SCIM error response
   */
  static createError(status: number, scimType?: string, detail?: string): SCIMError {
    return {
      schemas: [SCIM_SCHEMAS.ERROR],
      status: status.toString(),
      scimType,
      detail,
    };
  }
}