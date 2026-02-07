import { AuthorizationService, Role, Permission } from '../authorization.middleware';
import { EmployeeRepository } from '../../repositories/employee.repository';
import { AuthenticatedUser } from '../../types';

// Mock the employee repository
jest.mock('../../repositories/employee.repository');
const mockEmployeeRepository = EmployeeRepository as jest.Mocked<typeof EmployeeRepository>;

describe('AuthorizationService', () => {
  describe('hasPermission', () => {
    it('should return true for user with view employees permission', () => {
      const result = AuthorizationService.hasPermission(Role.USER, Permission.VIEW_EMPLOYEES);
      expect(result).toBe(true);
    });

    it('should return false for user without admin permissions', () => {
      const result = AuthorizationService.hasPermission(Role.USER, Permission.CREATE_EMPLOYEES);
      expect(result).toBe(false);
    });

    it('should return true for admin with create employees permission', () => {
      const result = AuthorizationService.hasPermission(Role.ADMIN, Permission.CREATE_EMPLOYEES);
      expect(result).toBe(true);
    });

    it('should return true for super admin with all permissions', () => {
      const result = AuthorizationService.hasPermission(Role.SUPER_ADMIN, Permission.ASSIGN_ROLES);
      expect(result).toBe(true);
    });
  });

  describe('hasAnyPermission', () => {
    it('should return true if user has at least one permission', () => {
      const result = AuthorizationService.hasAnyPermission(
        Role.USER, 
        [Permission.VIEW_EMPLOYEES, Permission.CREATE_EMPLOYEES]
      );
      expect(result).toBe(true);
    });

    it('should return false if user has none of the permissions', () => {
      const result = AuthorizationService.hasAnyPermission(
        Role.USER, 
        [Permission.CREATE_EMPLOYEES, Permission.DEACTIVATE_EMPLOYEES]
      );
      expect(result).toBe(false);
    });
  });

  describe('hasAllPermissions', () => {
    it('should return true if user has all permissions', () => {
      const result = AuthorizationService.hasAllPermissions(
        Role.ADMIN, 
        [Permission.VIEW_EMPLOYEES, Permission.CREATE_EMPLOYEES]
      );
      expect(result).toBe(true);
    });

    it('should return false if user is missing any permission', () => {
      const result = AuthorizationService.hasAllPermissions(
        Role.USER, 
        [Permission.VIEW_EMPLOYEES, Permission.CREATE_EMPLOYEES]
      );
      expect(result).toBe(false);
    });
  });

  describe('canEditEmployee', () => {
    const mockUser: AuthenticatedUser = {
      id: 'user-1',
      tenantId: 'tenant-1',
      email: 'user@example.com',
      role: Role.USER,
      isActive: true,
    };

    const mockEmployee = {
      id: 'employee-1',
      tenantId: 'tenant-1',
      userId: 'user-1',
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@example.com',
      managerId: null,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should allow admin to edit any employee', async () => {
      const adminUser = { ...mockUser, role: Role.ADMIN };
      mockEmployeeRepository.findById.mockResolvedValue(mockEmployee);

      const result = await AuthorizationService.canEditEmployee(
        adminUser, 
        'employee-1', 
        'tenant-1'
      );

      expect(result).toBe(true);
    });

    it('should allow user to edit their own profile', async () => {
      mockEmployeeRepository.findById.mockResolvedValue(mockEmployee);

      const result = await AuthorizationService.canEditEmployee(
        mockUser, 
        'employee-1', 
        'tenant-1'
      );

      expect(result).toBe(true);
    });

    it('should allow manager to edit direct reports', async () => {
      const managerUser = { ...mockUser, role: Role.MANAGER };
      const managerEmployee = { ...mockEmployee, id: 'manager-1', userId: 'user-1' };
      const reportEmployee = { ...mockEmployee, id: 'employee-2', userId: 'user-2', managerId: 'manager-1' };

      mockEmployeeRepository.findById.mockResolvedValue(reportEmployee);
      mockEmployeeRepository.findMany.mockResolvedValue({
        employees: [managerEmployee],
        pagination: { page: 1, pageSize: 20, total: 1, hasMore: false },
      });

      const result = await AuthorizationService.canEditEmployee(
        managerUser, 
        'employee-2', 
        'tenant-1'
      );

      expect(result).toBe(true);
    });

    it('should deny user from editing other profiles', async () => {
      const otherEmployee = { ...mockEmployee, id: 'employee-2', userId: 'user-2' };
      mockEmployeeRepository.findById.mockResolvedValue(otherEmployee);

      const result = await AuthorizationService.canEditEmployee(
        mockUser, 
        'employee-2', 
        'tenant-1'
      );

      expect(result).toBe(false);
    });
  });

  describe('canViewEmployee', () => {
    const mockUser: AuthenticatedUser = {
      id: 'user-1',
      tenantId: 'tenant-1',
      email: 'user@example.com',
      role: Role.USER,
      isActive: true,
    };

    it('should allow any authenticated user to view employees', async () => {
      const result = await AuthorizationService.canViewEmployee(
        mockUser, 
        'employee-1', 
        'tenant-1'
      );

      expect(result).toBe(true);
    });
  });
});