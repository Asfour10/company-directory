import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export class SubscriptionService {
  /**
   * Check if tenant can add more users
   */
  async canAddUser(tenantId: string): Promise<{ canAdd: boolean; currentCount: number; limit: number; message?: string }> {
    try {
      // Get tenant with current user limit
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: {
          userLimit: true,
          subscriptionTier: true,
          subscriptionStatus: true,
        },
      });

      if (!tenant) {
        throw new Error('Tenant not found');
      }

      // Count current active users
      const currentUserCount = await prisma.user.count({
        where: {
          tenantId,
          isActive: true,
        },
      });

      const canAdd = currentUserCount < tenant.userLimit;
      
      let message: string | undefined;
      if (!canAdd) {
        message = `User limit reached. Your ${tenant.subscriptionTier} plan allows up to ${tenant.userLimit} users. Please upgrade your subscription to add more users.`;
      }

      return {
        canAdd,
        currentCount: currentUserCount,
        limit: tenant.userLimit,
        message,
      };
    } catch (error) {
      console.error('Error checking user limit:', error);
      throw error;
    }
  }

  /**
   * Check if tenant can add more employees
   */
  async canAddEmployee(tenantId: string): Promise<{ canAdd: boolean; currentCount: number; limit: number; message?: string }> {
    try {
      // Get tenant with current user limit
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: {
          userLimit: true,
          subscriptionTier: true,
          subscriptionStatus: true,
        },
      });

      if (!tenant) {
        throw new Error('Tenant not found');
      }

      // Count current active employees
      const currentEmployeeCount = await prisma.employee.count({
        where: {
          tenantId,
          isActive: true,
        },
      });

      const canAdd = currentEmployeeCount < tenant.userLimit;
      
      let message: string | undefined;
      if (!canAdd) {
        message = `Employee limit reached. Your ${tenant.subscriptionTier} plan allows up to ${tenant.userLimit} employees. Please upgrade your subscription to add more employees.`;
      }

      return {
        canAdd,
        currentCount: currentEmployeeCount,
        limit: tenant.userLimit,
        message,
      };
    } catch (error) {
      console.error('Error checking employee limit:', error);
      throw error;
    }
  }

  /**
   * Get subscription usage statistics
   */
  async getUsageStats(tenantId: string) {
    try {
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: {
          userLimit: true,
          subscriptionTier: true,
          subscriptionStatus: true,
          currentPeriodEnd: true,
        },
      });

      if (!tenant) {
        throw new Error('Tenant not found');
      }

      const [userCount, employeeCount] = await Promise.all([
        prisma.user.count({
          where: { tenantId, isActive: true },
        }),
        prisma.employee.count({
          where: { tenantId, isActive: true },
        }),
      ]);

      const usagePercentage = Math.round((Math.max(userCount, employeeCount) / tenant.userLimit) * 100);

      return {
        subscriptionTier: tenant.subscriptionTier,
        subscriptionStatus: tenant.subscriptionStatus,
        userLimit: tenant.userLimit,
        currentUsers: userCount,
        currentEmployees: employeeCount,
        usagePercentage,
        currentPeriodEnd: tenant.currentPeriodEnd,
        isNearLimit: usagePercentage >= 80,
        isAtLimit: Math.max(userCount, employeeCount) >= tenant.userLimit,
      };
    } catch (error) {
      console.error('Error getting usage stats:', error);
      throw error;
    }
  }

  /**
   * Get upgrade recommendations based on current usage
   */
  async getUpgradeRecommendations(tenantId: string) {
    try {
      const stats = await this.getUsageStats(tenantId);
      
      const recommendations = [];

      if (stats.isAtLimit) {
        recommendations.push({
          type: 'urgent',
          title: 'Upgrade Required',
          message: 'You have reached your user limit. Upgrade now to add more employees.',
          action: 'upgrade',
        });
      } else if (stats.isNearLimit) {
        recommendations.push({
          type: 'warning',
          title: 'Approaching Limit',
          message: `You are using ${stats.usagePercentage}% of your user limit. Consider upgrading soon.`,
          action: 'consider_upgrade',
        });
      }

      // Suggest higher tiers based on current tier
      const availableUpgrades = this.getAvailableUpgrades(stats.subscriptionTier);
      
      return {
        currentStats: stats,
        recommendations,
        availableUpgrades,
      };
    } catch (error) {
      console.error('Error getting upgrade recommendations:', error);
      throw error;
    }
  }

  private getAvailableUpgrades(currentTier: string) {
    const tiers = [
      { tier: 'free', name: 'Free', userLimit: 10, monthlyPrice: 0 },
      { tier: 'starter', name: 'Starter', userLimit: 50, monthlyPrice: 9.99 },
      { tier: 'professional', name: 'Professional', userLimit: 200, monthlyPrice: 29.99 },
      { tier: 'enterprise', name: 'Enterprise', userLimit: 1000, monthlyPrice: 99.99 },
    ];

    const currentIndex = tiers.findIndex(t => t.tier === currentTier);
    return tiers.slice(currentIndex + 1);
  }
}

export const subscriptionService = new SubscriptionService();