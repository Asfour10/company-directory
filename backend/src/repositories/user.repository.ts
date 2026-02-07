import { prisma } from '../lib/database';
import { User } from '@prisma/client';
import { NotFoundError, ConflictError } from '../utils/errors';

export interface CreateUserData {
  email: string;
  externalId?: string;
  role?: string;
  isActive?: boolean;
}

export interface UpdateUserData {
  email?: string;
  externalId?: string;
  role?: string;
  isActive?: boolean;
  lastLoginAt?: Date;
}

/**
 * Repository for User data access operations
 */
export class UserRepository {
  /**
   * Create a new user
   */
  static async create(tenantId: string, data: CreateUserData): Promise<User> {
    try {
      return await prisma.user.create({
        data: {
          tenantId,
          email: data.email,
          externalId: data.externalId,
          role: data.role || 'user',
          isActive: data.isActive ?? true,
        },
      });
    } catch (error: any) {
      if (error.code === 'P2002') {
        // Unique constraint violation
        if (error.meta?.target?.includes('email')) {
          throw new ConflictError(`User with email ${data.email} already exists in this tenant`);
        }
      }
      throw error;
    }
  }

  /**
   * Find user by ID
   */
  static async findById(userId: string): Promise<User | null> {
    return prisma.user.findUnique({
      where: { id: userId },
    });
  }

  /**
   * Find user by email within a tenant
   */
  static async findByEmail(tenantId: string, email: string): Promise<User | null> {
    return prisma.user.findUnique({
      where: {
        tenantId_email: {
          tenantId,
          email,
        },
      },
    });
  }

  /**
   * Find user by external ID
   */
  static async findByExternalId(externalId: string): Promise<User | null> {
    return prisma.user.findFirst({
      where: { externalId },
    });
  }

  /**
   * Find multiple users by IDs
   */
  static async findByIds(userIds: string[]): Promise<User[]> {
    return prisma.user.findMany({
      where: {
        id: {
          in: userIds,
        },
      },
    });
  }

  /**
   * Update user
   */
  static async update(userId: string, data: UpdateUserData): Promise<User> {
    try {
      const user = await prisma.user.update({
        where: { id: userId },
        data: {
          email: data.email,
          externalId: data.externalId,
          role: data.role,
          isActive: data.isActive,
          lastLoginAt: data.lastLoginAt,
        },
      });

      return user;
    } catch (error: any) {
      if (error.code === 'P2025') {
        throw new NotFoundError(`User with id ${userId} not found`);
      }
      if (error.code === 'P2002') {
        // Unique constraint violation
        if (error.meta?.target?.includes('email')) {
          throw new ConflictError(`User with email ${data.email} already exists in this tenant`);
        }
      }
      throw error;
    }
  }

  /**
   * Delete user (soft delete by setting isActive to false)
   */
  static async delete(userId: string): Promise<User> {
    return this.update(userId, { isActive: false });
  }

  /**
   * Find users by tenant with pagination
   */
  static async findByTenant(
    tenantId: string,
    options: {
      page?: number;
      pageSize?: number;
      isActive?: boolean;
    } = {}
  ): Promise<{ users: User[]; total: number }> {
    const { page = 1, pageSize = 50, isActive } = options;
    const skip = (page - 1) * pageSize;

    const where = {
      tenantId,
      ...(isActive !== undefined && { isActive }),
    };

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.user.count({ where }),
    ]);

    return { users, total };
  }

  /**
   * Count users by tenant
   */
  static async countByTenant(tenantId: string, isActive?: boolean): Promise<number> {
    return prisma.user.count({
      where: {
        tenantId,
        ...(isActive !== undefined && { isActive }),
      },
    });
  }
}