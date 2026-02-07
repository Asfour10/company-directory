import { prisma } from '../lib/database';
import { Prisma } from '@prisma/client';
import { NotFoundError, ValidationError, ConflictError } from '../utils/errors';

export interface CreateEmployeeData {
  firstName: string;
  lastName: string;
  email: string;
  title?: string;
  department?: string;
  phone?: string;
  extension?: string;
  officeLocation?: string;
  managerId?: string;
  photoUrl?: string;
  bio?: string;
  skills?: string[];
  customFields?: Record<string, any>;
  userId?: string;
}

export interface UpdateEmployeeData {
  firstName?: string;
  lastName?: string;
  email?: string;
  title?: string;
  department?: string;
  phone?: string;
  extension?: string;
  officeLocation?: string;
  managerId?: string;
  photoUrl?: string;
  bio?: string;
  skills?: string[];
  customFields?: Record<string, any>;
  isActive?: boolean;
}

export interface EmployeeFilters {
  search?: string;
  department?: string;
  title?: string;
  managerId?: string;
  userId?: string;
  isActive?: boolean;
  skills?: string[];
}

export interface PaginationOptions {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/**
 * Repository for employee data operations
 * All operations are automatically scoped to the current tenant via RLS
 */
export class EmployeeRepository {
  /**
   * Create a new employee
   */
  static async create(tenantId: string, data: CreateEmployeeData) {
    try {
      // Check for email uniqueness within tenant
      const existingEmployee = await prisma.employee.findUnique({
        where: {
          tenantId_email: {
            tenantId,
            email: data.email,
          },
        },
      });

      if (existingEmployee) {
        throw new ConflictError(`Employee with email '${data.email}' already exists`);
      }

      // Validate manager exists if provided
      if (data.managerId) {
        const manager = await prisma.employee.findFirst({
          where: {
            id: data.managerId,
            tenantId,
            isActive: true,
          },
        });

        if (!manager) {
          throw new ValidationError('Manager not found or inactive', 'managerId', data.managerId);
        }
      }

      // Create the employee
      const employee = await prisma.employee.create({
        data: {
          tenantId,
          firstName: data.firstName,
          lastName: data.lastName,
          email: data.email,
          title: data.title,
          department: data.department,
          phone: data.phone,
          extension: data.extension,
          officeLocation: data.officeLocation,
          managerId: data.managerId,
          photoUrl: data.photoUrl,
          bio: data.bio,
          skills: data.skills || [],
          customFields: data.customFields || {},
          userId: data.userId,
        },
        include: {
          manager: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              title: true,
            },
          },
          user: {
            select: {
              id: true,
              email: true,
              role: true,
            },
          },
        },
      });

      return employee;
    } catch (error) {
      if (error instanceof ConflictError || error instanceof ValidationError) {
        throw error;
      }
      throw new Error(`Failed to create employee: ${(error as Error).message}`);
    }
  }

  /**
   * Get employee by ID
   */
  static async findById(tenantId: string, employeeId: string) {
    const employee = await prisma.employee.findFirst({
      where: {
        id: employeeId,
        tenantId,
      },
      include: {
        manager: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            title: true,
            email: true,
          },
        },
        directReports: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            title: true,
            email: true,
          },
          where: {
            isActive: true,
          },
        },
        user: {
          select: {
            id: true,
            email: true,
            role: true,
            lastLoginAt: true,
          },
        },
      },
    });

    if (!employee) {
      throw new NotFoundError('Employee', employeeId);
    }

    return employee;
  }

  /**
   * Get employee by email
   */
  static async findByEmail(tenantId: string, email: string) {
    const employee = await prisma.employee.findUnique({
      where: {
        tenantId_email: {
          tenantId,
          email,
        },
      },
      include: {
        manager: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            title: true,
          },
        },
        user: {
          select: {
            id: true,
            email: true,
            role: true,
          },
        },
      },
    });

    return employee;
  }

  /**
   * List employees with filtering and pagination
   */
  static async findMany(
    tenantId: string,
    filters: EmployeeFilters = {},
    pagination: PaginationOptions = {}
  ) {
    const {
      search,
      department,
      title,
      managerId,
      userId,
      isActive = true,
      skills,
    } = filters;

    const {
      page = 1,
      pageSize = 20,
      sortBy = 'lastName',
      sortOrder = 'asc',
    } = pagination;

    // Build where clause
    const where: Prisma.EmployeeWhereInput = {
      tenantId,
      isActive,
    };

    // Add search filter (text search across multiple fields)
    if (search) {
      where.OR = [
        {
          firstName: {
            contains: search,
            mode: 'insensitive',
          },
        },
        {
          lastName: {
            contains: search,
            mode: 'insensitive',
          },
        },
        {
          email: {
            contains: search,
            mode: 'insensitive',
          },
        },
        {
          title: {
            contains: search,
            mode: 'insensitive',
          },
        },
        {
          department: {
            contains: search,
            mode: 'insensitive',
          },
        },
      ];
    }

    // Add other filters
    if (department) {
      where.department = {
        equals: department,
        mode: 'insensitive',
      };
    }

    if (title) {
      where.title = {
        contains: title,
        mode: 'insensitive',
      };
    }

    if (managerId) {
      where.managerId = managerId;
    }

    if (userId) {
      where.userId = userId;
    }

    if (skills && skills.length > 0) {
      where.skills = {
        hasEvery: skills,
      };
    }

    // Build order by clause
    const orderBy: Prisma.EmployeeOrderByWithRelationInput = {};
    if (sortBy === 'name') {
      orderBy.lastName = sortOrder;
    } else if (sortBy === 'department') {
      orderBy.department = sortOrder;
    } else if (sortBy === 'title') {
      orderBy.title = sortOrder;
    } else if (sortBy === 'createdAt') {
      orderBy.createdAt = sortOrder;
    } else {
      orderBy[sortBy as keyof Prisma.EmployeeOrderByWithRelationInput] = sortOrder;
    }

    // Execute queries
    const [employees, total] = await Promise.all([
      prisma.employee.findMany({
        where,
        include: {
          manager: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              title: true,
            },
          },
          user: {
            select: {
              id: true,
              role: true,
              lastLoginAt: true,
            },
          },
        },
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.employee.count({ where }),
    ]);

    return {
      employees,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  /**
   * Update employee
   */
  static async update(tenantId: string, employeeId: string, data: UpdateEmployeeData) {
    try {
      // Check if employee exists
      const existingEmployee = await this.findById(tenantId, employeeId);

      // Check email uniqueness if email is being updated
      if (data.email && data.email !== existingEmployee.email) {
        const emailExists = await prisma.employee.findUnique({
          where: {
            tenantId_email: {
              tenantId,
              email: data.email,
            },
          },
        });

        if (emailExists) {
          throw new ConflictError(`Employee with email '${data.email}' already exists`);
        }
      }

      // Validate manager if being updated
      if (data.managerId) {
        // Prevent self-management
        if (data.managerId === employeeId) {
          throw new ValidationError('Employee cannot be their own manager', 'managerId', data.managerId);
        }

        // Check manager exists and is active
        const manager = await prisma.employee.findFirst({
          where: {
            id: data.managerId,
            tenantId,
            isActive: true,
          },
        });

        if (!manager) {
          throw new ValidationError('Manager not found or inactive', 'managerId', data.managerId);
        }

        // Prevent circular management relationships
        const wouldCreateCircle = await this.wouldCreateCircularRelationship(
          tenantId,
          employeeId,
          data.managerId
        );

        if (wouldCreateCircle) {
          throw new ValidationError('This would create a circular management relationship', 'managerId', data.managerId);
        }
      }

      // Update the employee
      const updatedEmployee = await prisma.employee.update({
        where: {
          id: employeeId,
        },
        data: {
          firstName: data.firstName,
          lastName: data.lastName,
          email: data.email,
          title: data.title,
          department: data.department,
          phone: data.phone,
          extension: data.extension,
          officeLocation: data.officeLocation,
          managerId: data.managerId,
          photoUrl: data.photoUrl,
          bio: data.bio,
          skills: data.skills,
          customFields: data.customFields,
          isActive: data.isActive,
        },
        include: {
          manager: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              title: true,
            },
          },
          user: {
            select: {
              id: true,
              email: true,
              role: true,
            },
          },
        },
      });

      return updatedEmployee;
    } catch (error) {
      if (error instanceof ConflictError || error instanceof ValidationError || error instanceof NotFoundError) {
        throw error;
      }
      throw new Error(`Failed to update employee: ${(error as Error).message}`);
    }
  }

  /**
   * Soft delete employee (deactivate)
   */
  static async softDelete(tenantId: string, employeeId: string) {
    try {
      // Check if employee exists
      await this.findById(tenantId, employeeId);

      // Update to inactive
      const deactivatedEmployee = await prisma.employee.update({
        where: {
          id: employeeId,
        },
        data: {
          isActive: false,
        },
      });

      return deactivatedEmployee;
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      throw new Error(`Failed to deactivate employee: ${(error as Error).message}`);
    }
  }

  /**
   * Hard delete employee (permanent removal)
   */
  static async hardDelete(tenantId: string, employeeId: string) {
    try {
      // Check if employee exists
      await this.findById(tenantId, employeeId);

      // Delete the employee
      const deletedEmployee = await prisma.employee.delete({
        where: {
          id: employeeId,
        },
      });

      return deletedEmployee;
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      throw new Error(`Failed to delete employee: ${(error as Error).message}`);
    }
  }

  /**
   * Get employees by manager
   */
  static async findByManager(tenantId: string, managerId: string) {
    return prisma.employee.findMany({
      where: {
        tenantId,
        managerId,
        isActive: true,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        title: true,
        email: true,
        department: true,
      },
      orderBy: {
        lastName: 'asc',
      },
    });
  }

  /**
   * Get organizational hierarchy for an employee
   */
  static async getHierarchy(tenantId: string, employeeId: string) {
    const employee = await this.findById(tenantId, employeeId);
    
    // Get management chain (upward)
    const managementChain = await this.getManagementChain(tenantId, employeeId);
    
    // Get direct reports (downward)
    const directReports = await this.findByManager(tenantId, employeeId);
    
    return {
      employee,
      managementChain,
      directReports,
    };
  }

  /**
   * Get management chain for an employee
   */
  static async getManagementChain(tenantId: string, employeeId: string): Promise<any[]> {
    const chain: any[] = [];
    let currentEmployeeId: string | null = employeeId;
    const visited = new Set<string>();

    while (currentEmployeeId && !visited.has(currentEmployeeId)) {
      visited.add(currentEmployeeId);

      const employee: any = await prisma.employee.findFirst({
        where: {
          id: currentEmployeeId,
          tenantId,
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          title: true,
          managerId: true,
        },
      });

      if (!employee || !employee.managerId) {
        break;
      }

      const manager: any = await prisma.employee.findFirst({
        where: {
          id: employee.managerId,
          tenantId,
          isActive: true,
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          title: true,
          managerId: true,
        },
      });

      if (manager) {
        chain.push(manager);
        currentEmployeeId = manager.managerId;
      } else {
        break;
      }
    }

    return chain;
  }

  /**
   * Check if updating manager would create circular relationship
   */
  static async wouldCreateCircularRelationship(
    tenantId: string,
    employeeId: string,
    newManagerId: string
  ): Promise<boolean> {
    // Get the management chain of the potential new manager
    const managementChain = await this.getManagementChain(tenantId, newManagerId);
    
    // Check if the employee is anywhere in the new manager's chain
    return managementChain.some(manager => manager.id === employeeId);
  }

  /**
   * Get employee statistics
   */
  static async getStatistics(tenantId: string) {
    const [
      totalEmployees,
      activeEmployees,
      departmentStats,
      titleStats,
    ] = await Promise.all([
      prisma.employee.count({
        where: { tenantId },
      }),
      prisma.employee.count({
        where: { tenantId, isActive: true },
      }),
      prisma.employee.groupBy({
        by: ['department'],
        where: { tenantId, isActive: true },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
      }),
      prisma.employee.groupBy({
        by: ['title'],
        where: { tenantId, isActive: true },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
      }),
    ]);

    return {
      totalEmployees,
      activeEmployees,
      inactiveEmployees: totalEmployees - activeEmployees,
      departmentDistribution: departmentStats.map(stat => ({
        department: stat.department || 'Unassigned',
        count: stat._count.id,
      })),
      titleDistribution: titleStats.slice(0, 10).map(stat => ({
        title: stat.title || 'Unassigned',
        count: stat._count.id,
      })),
    };
  }

  /**
   * Bulk update employees
   */
  static async bulkUpdate(
    tenantId: string,
    updates: Array<{ id: string; data: UpdateEmployeeData }>
  ) {
    const results = [];
    const errors = [];

    for (const update of updates) {
      try {
        const result = await this.update(tenantId, update.id, update.data);
        results.push({ id: update.id, success: true, data: result });
      } catch (error) {
        errors.push({
          id: update.id,
          success: false,
          error: (error as Error).message,
        });
      }
    }

    return {
      results,
      errors,
      summary: {
        total: updates.length,
        successful: results.length,
        failed: errors.length,
      },
    };
  }
}