import { Request, Response, NextFunction } from 'express';
import { AuthenticatedUser } from '../types';
import { EmployeeRepository } from '../repositories/employee.repository';

/**
 * Role hierarchy for permission checking
 */
export enum Role {
  USER = 'user',
  MANAGER = 'manager', 
  ADMIN = 'admin',
  SUPER_ADMIN = 'super_admin'
}

/**
 * Permission types for different operations
 */
export enum Permission {
  // Employee permissions
  VIEW_EMPLOYEES = 'view_employees',
  VIEW_OWN_PROFILE = 'view_own_profile',
  EDIT_OWN_PROFILE = 'edit_own_profile',
  EDIT_DIRECT_REPORTS = 'edit_direct_reports',
  CREATE_EMPLOYEES = 'create_employees',
  EDIT_ANY_EMPLOYEE = 'edit_any_employee',
  DEACTIVATE_EMPLOYEES = 'deactivate_employees',
  
  // Admin permissions
  VIEW_AUDIT_LOGS = 'view_audit_logs',
  EXPORT_AUDIT_LOGS = 'export_audit_logs',
  BULK_IMPORT = 'bulk_import',
  VIEW_ANALYTICS = 'view_analytics',
  MANAGE_CUSTOM_FIELDS = 'manage_custom_fields',
  
  // Super admin permissions
  MANAGE_TENANT_SETTINGS = 'manage_tenant_settings',
  MANAGE_BILLING = 'manage_billing',
  MANAGE_SSO = 'manage_sso',
  ASSIGN_ROLES = 'assign_roles'
}

/**
 * Role-based permission mapping
 */
const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  [Role.USER]: [
    Permission.VIEW_EMPLOYEES,
    Permission.VIEW_OWN_PROFILE,
    Permission.EDIT_OWN_PROFILE
  ],
  [Role.MANAGER]: [
    Permission.VIEW_EMPLOYEES,
    Permission.VIEW_OWN_PROFILE,
    Permission.EDIT_OWN_PROFILE,
    Permission.EDIT_DIRECT_REPORTS
  ],
  [Role.ADMIN]: [
    Permission.VIEW_EMPLOYEES,
    Permission.VIEW_OWN_PROFILE,
    Permission.EDIT_OWN_PROFILE,
    Permission.EDIT_DIRECT_REPORTS,
    Permission.CREATE_EMPLOYEES,
    Permission.EDIT_ANY_EMPLOYEE,
    Permission.DEACTIVATE_EMPLOYEES,
    Permission.VIEW_AUDIT_LOGS,
    Permission.EXPORT_AUDIT_LOGS,
    Permission.BULK_IMPORT,
    Permission.VIEW_ANALYTICS,
    Permission.MANAGE_CUSTOM_FIELDS
  ],
  [Role.SUPER_ADMIN]: [
    Permission.VIEW_EMPLOYEES,
    Permission.VIEW_OWN_PROFILE,
    Permission.EDIT_OWN_PROFILE,
    Permission.EDIT_DIRECT_REPORTS,
    Permission.CREATE_EMPLOYEES,
    Permission.EDIT_ANY_EMPLOYEE,
    Permission.DEACTIVATE_EMPLOYEES,
    Permission.VIEW_AUDIT_LOGS,
    Permission.EXPORT_AUDIT_LOGS,
    Permission.BULK_IMPORT,
    Permission.VIEW_ANALYTICS,
    Permission.MANAGE_CUSTOM_FIELDS,
    Permission.MANAGE_TENANT_SETTINGS,
    Permission.MANAGE_BILLING,
    Permission.MANAGE_SSO,
    Permission.ASSIGN_ROLES
  ]
};

/**
 * Authorization service for checking permissions
 */
export class AuthorizationService {
  /**
   * Check if a user has a specific permission
   */
  static hasPermission(userRole: string, permission: Permission): boolean {
    const role = userRole as Role;
    const permissions = ROLE_PERMISSIONS[role];
    return permissions ? permissions.includes(permission) : false;
  }

  /**
   * Check if a user has any of the specified permissions
   */
  static hasAnyPermission(userRole: string, permissions: Permission[]): boolean {
    return permissions.some(permission => this.hasPermission(userRole, permission));
  }

  /**
   * Check if a user has all of the specified permissions
   */
  static hasAllPermissions(userRole: string, permissions: Permission[]): boolean {
    return permissions.every(permission => this.hasPermission(userRole, permission));
  }

  /**
   * Check if a user can edit a specific employee profile
   */
  static async canEditEmployee(
    user: AuthenticatedUser,
    employeeId: string,
    tenantId: string
  ): Promise<boolean> {
    // Admin and super admin can edit anyone
    if (this.hasPermission(user.role, Permission.EDIT_ANY_EMPLOYEE)) {
      return true;
    }

    // Get the employee being edited
    const employee = await EmployeeRepository.findById(tenantId, employeeId);

    // Users can edit their own profile
    if (employee.userId === user.id) {
      return true;
    }

    // Managers can edit their direct reports
    if (this.hasPermission(user.role, Permission.EDIT_DIRECT_REPORTS)) {
      // Find the manager's employee record
      const managerEmployees = await EmployeeRepository.findMany(
        tenantId,
        { userId: user.id }
      );
      
      if (managerEmployees.employees.length > 0) {
        const managerEmployee = managerEmployees.employees[0];
        return employee.managerId === managerEmployee.id;
      }
    }

    return false;
  }

  /**
   * Check if a user can view a specific employee profile
   */
  static async canViewEmployee(
    user: AuthenticatedUser,
    _employeeId: string,
    _tenantId: string
  ): Promise<boolean> {
    // All authenticated users can view employee profiles within their tenant
    return this.hasPermission(user.role, Permission.VIEW_EMPLOYEES);
  }
}

/**
 * Middleware to check if user has required permission
 */
export function requirePermission(...permissions: Permission[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
          requestId: req.id,
        },
      });
      return;
    }

    const user = req.user as AuthenticatedUser;
    
    // Check if user has any of the required permissions
    const hasPermission = AuthorizationService.hasAnyPermission(user.role, permissions);
    
    if (!hasPermission) {
      res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: 'Insufficient permissions',
          details: `Required permissions: ${permissions.join(', ')}`,
          requestId: req.id,
        },
      });
      return;
    }

    next();
  };
}

/**
 * Middleware to check if user has all required permissions
 */
export function requireAllPermissions(...permissions: Permission[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
          requestId: req.id,
        },
      });
      return;
    }

    const user = req.user as AuthenticatedUser;
    
    // Check if user has all required permissions
    const hasAllPermissions = AuthorizationService.hasAllPermissions(user.role, permissions);
    
    if (!hasAllPermissions) {
      res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: 'Insufficient permissions',
          details: `Required permissions: ${permissions.join(', ')}`,
          requestId: req.id,
        },
      });
      return;
    }

    next();
  };
}

/**
 * Middleware to check if user has required role
 */
export function requireRole(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
          requestId: req.id,
        },
      });
      return;
    }

    const user = req.user as AuthenticatedUser;
    
    if (!roles.includes(user.role as Role)) {
      res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: 'Insufficient permissions',
          details: `Required roles: ${roles.join(', ')}`,
          requestId: req.id,
        },
      });
      return;
    }

    next();
  };
}

/**
 * Middleware to check if user can edit specific employee
 */
export function requireEmployeeEditPermission() {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
          requestId: req.id,
        },
      });
      return;
    }

    const user = req.user as AuthenticatedUser;
    const employeeId = req.params.id;
    const tenantId = req.tenant?.id;

    if (!employeeId || !tenantId) {
      res.status(400).json({
        error: {
          code: 'BAD_REQUEST',
          message: 'Employee ID and tenant context required',
          requestId: req.id,
        },
      });
      return;
    }

    try {
      const canEdit = await AuthorizationService.canEditEmployee(user, employeeId, tenantId);
      
      if (!canEdit) {
        res.status(403).json({
          error: {
            code: 'FORBIDDEN',
            message: 'Insufficient permissions to edit this employee',
            requestId: req.id,
          },
        });
        return;
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Convenience middleware functions for common role checks
 */
export const requireUser = requireRole(Role.USER, Role.MANAGER, Role.ADMIN, Role.SUPER_ADMIN);
export const requireManager = requireRole(Role.MANAGER, Role.ADMIN, Role.SUPER_ADMIN);
export const requireAdmin = requireRole(Role.ADMIN, Role.SUPER_ADMIN);
export const requireSuperAdmin = requireRole(Role.SUPER_ADMIN);

/**
 * Convenience middleware functions for common permission checks
 */
export const requireCreateEmployee = requirePermission(Permission.CREATE_EMPLOYEES);
export const requireEditAnyEmployee = requirePermission(Permission.EDIT_ANY_EMPLOYEE);
export const requireDeactivateEmployee = requirePermission(Permission.DEACTIVATE_EMPLOYEES);
export const requireViewAuditLogs = requirePermission(Permission.VIEW_AUDIT_LOGS);
export const requireExportAuditLogs = requirePermission(Permission.EXPORT_AUDIT_LOGS);
export const requireBulkImport = requirePermission(Permission.BULK_IMPORT);
export const requireViewAnalytics = requirePermission(Permission.VIEW_ANALYTICS);
export const requireManageCustomFields = requirePermission(Permission.MANAGE_CUSTOM_FIELDS);
export const requireManageTenantSettings = requirePermission(Permission.MANAGE_TENANT_SETTINGS);
export const requireManageBilling = requirePermission(Permission.MANAGE_BILLING);
export const requireManageSSO = requirePermission(Permission.MANAGE_SSO);
export const requireAssignRoles = requirePermission(Permission.ASSIGN_ROLES);