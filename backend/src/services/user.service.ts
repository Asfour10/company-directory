import { prisma } from '../lib/database';
import { AuditService } from './audit.service';
import { NotFoundError, ValidationError } from '../utils/errors';
import { Role } from '../middleware/authorization.middleware';

export interface UserServiceContext {
  tenantId: string;
  userId?: string;
  userRole?: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface AssignRoleRequest {
  userId: string;
  role: Role;
}

/**
 * Service for user management operations
 */
export class UserService {
  /**
   * Get all users in a tenant
   */
  static async getUsers(context: UserServiceContext) {
    const users = await prisma.user.findMany({
      where: {
        tenantId: context.tenantId,
        isActive: true,
      },
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            title: true,
            department: true,
          },
        },
      },
      orderBy: [
        { role: 'asc' },
        { email: 'asc' },
      ],
    });

    return users.map(user => ({
      id: user.id,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
      employee: user.employee,
    }));
  }

  /**
   * Get user by ID
   */
  static async getUserById(userId: string, context: UserServiceContext) {
    const user = await prisma.user.findFirst({
      where: {
        id: userId,
        tenantId: context.tenantId,
      },
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            title: true,
            department: true,
            email: true,
            phone: true,
            officeLocation: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      employee: user.employee,
    };
  }

  /**
   * Assign role to user (super admin only)
   */
  static async assignRole(
    request: AssignRoleRequest,
    context: UserServiceContext
  ) {
    // Validate role
    if (!Object.values(Role).includes(request.role)) {
      throw new ValidationError(`Invalid role: ${request.role}`, 'role');
    }

    // Get current user data for audit logging
    const currentUser = await this.getUserById(request.userId, context);

    // Update user role
    const updatedUser = await prisma.user.update({
      where: {
        id: request.userId,
        tenantId: context.tenantId,
      },
      data: {
        role: request.role,
        updatedAt: new Date(),
      },
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            title: true,
            department: true,
          },
        },
      },
    });

    // Log the role change
    await AuditService.logChange({
      tenantId: context.tenantId,
      userId: context.userId,
      action: 'UPDATE',
      entityType: 'user',
      entityId: request.userId,
      fieldName: 'role',
      oldValue: currentUser.role,
      newValue: request.role,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });

    // Track analytics event
    await AuditService.trackEvent({
      tenantId: context.tenantId,
      userId: context.userId,
      eventType: 'role_assigned',
      metadata: {
        targetUserId: request.userId,
        oldRole: currentUser.role,
        newRole: request.role,
        targetUserEmail: currentUser.email,
      },
    });

    return {
      id: updatedUser.id,
      email: updatedUser.email,
      role: updatedUser.role,
      isActive: updatedUser.isActive,
      lastLoginAt: updatedUser.lastLoginAt,
      createdAt: updatedUser.createdAt,
      updatedAt: updatedUser.updatedAt,
      employee: updatedUser.employee,
    };
  }

  /**
   * Deactivate user (super admin only)
   */
  static async deactivateUser(userId: string, context: UserServiceContext) {
    // Get current user data for audit logging
    const currentUser = await this.getUserById(userId, context);

    // Deactivate user
    const updatedUser = await prisma.user.update({
      where: {
        id: userId,
        tenantId: context.tenantId,
      },
      data: {
        isActive: false,
        updatedAt: new Date(),
      },
    });

    // Also deactivate associated employee profile if exists
    if (currentUser.employee) {
      await prisma.employee.update({
        where: {
          id: currentUser.employee.id,
        },
        data: {
          isActive: false,
          updatedAt: new Date(),
        },
      });
    }

    // Log the deactivation
    await AuditService.logChange({
      tenantId: context.tenantId,
      userId: context.userId,
      action: 'UPDATE',
      entityType: 'user',
      entityId: userId,
      fieldName: 'isActive',
      oldValue: 'true',
      newValue: 'false',
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });

    // Track analytics event
    await AuditService.trackEvent({
      tenantId: context.tenantId,
      userId: context.userId,
      eventType: 'user_deactivated',
      metadata: {
        targetUserId: userId,
        targetUserEmail: currentUser.email,
        targetUserRole: currentUser.role,
      },
    });

    return {
      id: updatedUser.id,
      email: updatedUser.email,
      role: updatedUser.role,
      isActive: updatedUser.isActive,
      lastLoginAt: updatedUser.lastLoginAt,
      createdAt: updatedUser.createdAt,
      updatedAt: updatedUser.updatedAt,
    };
  }

  /**
   * Reactivate user (super admin only)
   */
  static async reactivateUser(userId: string, context: UserServiceContext) {
    // Get current user data for audit logging
    const currentUser = await prisma.user.findFirst({
      where: {
        id: userId,
        tenantId: context.tenantId,
      },
      include: {
        employee: true,
      },
    });

    if (!currentUser) {
      throw new NotFoundError('User not found');
    }

    // Reactivate user
    const updatedUser = await prisma.user.update({
      where: {
        id: userId,
        tenantId: context.tenantId,
      },
      data: {
        isActive: true,
        updatedAt: new Date(),
      },
    });

    // Also reactivate associated employee profile if exists
    if (currentUser.employee) {
      await prisma.employee.update({
        where: {
          id: currentUser.employee.id,
        },
        data: {
          isActive: true,
          updatedAt: new Date(),
        },
      });
    }

    // Log the reactivation
    await AuditService.logChange({
      tenantId: context.tenantId,
      userId: context.userId,
      action: 'UPDATE',
      entityType: 'user',
      entityId: userId,
      fieldName: 'isActive',
      oldValue: 'false',
      newValue: 'true',
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });

    // Track analytics event
    await AuditService.trackEvent({
      tenantId: context.tenantId,
      userId: context.userId,
      eventType: 'user_reactivated',
      metadata: {
        targetUserId: userId,
        targetUserEmail: currentUser.email,
        targetUserRole: currentUser.role,
      },
    });

    return {
      id: updatedUser.id,
      email: updatedUser.email,
      role: updatedUser.role,
      isActive: updatedUser.isActive,
      lastLoginAt: updatedUser.lastLoginAt,
      createdAt: updatedUser.createdAt,
      updatedAt: updatedUser.updatedAt,
    };
  }

  /**
   * Get role statistics for tenant
   */
  static async getRoleStatistics(context: UserServiceContext) {
    const roleStats = await prisma.user.groupBy({
      by: ['role'],
      where: {
        tenantId: context.tenantId,
        isActive: true,
      },
      _count: {
        id: true,
      },
    });

    const totalUsers = await prisma.user.count({
      where: {
        tenantId: context.tenantId,
        isActive: true,
      },
    });

    return {
      totalUsers,
      roleDistribution: roleStats.map(stat => ({
        role: stat.role,
        count: stat._count.id,
        percentage: Math.round((stat._count.id / totalUsers) * 100),
      })),
    };
  }
}