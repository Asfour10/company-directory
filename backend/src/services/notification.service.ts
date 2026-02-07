import { PrismaClient } from '@prisma/client';
import { emailService } from './email.service';
import { subscriptionService } from './subscription.service';

const prisma = new PrismaClient();

export class NotificationService {
  /**
   * Check for upcoming renewals and send reminders
   */
  async sendRenewalReminders(): Promise<void> {
    try {
      console.log('🔔 Checking for upcoming renewals...');

      // Find tenants with subscriptions ending in 7 days
      const sevenDaysFromNow = new Date();
      sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

      const tenantsToNotify = await prisma.tenant.findMany({
        where: {
          currentPeriodEnd: {
            gte: new Date(),
            lte: sevenDaysFromNow,
          },
          subscriptionStatus: 'active',
        },
        select: {
          id: true,
          name: true,
          currentPeriodEnd: true,
          subscriptionTier: true,
        },
      });

      console.log(`Found ${tenantsToNotify.length} tenants with upcoming renewals`);

      for (const tenant of tenantsToNotify) {
        if (tenant.currentPeriodEnd) {
          const daysUntilRenewal = Math.ceil(
            (tenant.currentPeriodEnd.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
          );

          if (daysUntilRenewal <= 7 && daysUntilRenewal > 0) {
            await emailService.sendRenewalReminder(tenant.id, daysUntilRenewal);
            console.log(`✅ Sent renewal reminder to ${tenant.name} (${daysUntilRenewal} days)`);
          }
        }
      }
    } catch (error) {
      console.error('Failed to send renewal reminders:', error);
      throw error;
    }
  }

  /**
   * Check for tenants approaching usage limits and send warnings
   */
  async sendUsageLimitWarnings(): Promise<void> {
    try {
      console.log('🔔 Checking for usage limit warnings...');

      // Find all active tenants
      const tenants = await prisma.tenant.findMany({
        where: {
          subscriptionStatus: { not: 'canceled' },
        },
        select: {
          id: true,
          name: true,
          subscriptionTier: true,
          userLimit: true,
        },
      });

      let warningsSent = 0;

      for (const tenant of tenants) {
        const usageStats = await subscriptionService.getUsageStats(tenant.id);

        // Send warning if usage is 80% or higher and not already at limit
        if (usageStats.usagePercentage >= 80 && !usageStats.isAtLimit) {
          // Check if we've already sent a warning recently (within 7 days)
          const recentWarning = await this.hasRecentUsageWarning(tenant.id);
          
          if (!recentWarning) {
            await emailService.sendUsageLimitWarning(
              tenant.id,
              usageStats.usagePercentage,
              Math.max(usageStats.currentUsers, usageStats.currentEmployees),
              usageStats.userLimit
            );

            // Record that we sent a warning
            await this.recordUsageWarning(tenant.id, usageStats.usagePercentage);
            
            warningsSent++;
            console.log(`✅ Sent usage warning to ${tenant.name} (${usageStats.usagePercentage}%)`);
          }
        }
      }

      console.log(`Sent ${warningsSent} usage limit warnings`);
    } catch (error) {
      console.error('Failed to send usage limit warnings:', error);
      throw error;
    }
  }

  /**
   * Handle payment failure notifications
   */
  async handlePaymentFailure(tenantId: string, invoiceId: string, amount: number): Promise<void> {
    try {
      await emailService.sendPaymentFailureNotification(tenantId, invoiceId, amount);
      
      // Record the payment failure for tracking
      await this.recordPaymentFailure(tenantId, invoiceId, amount);
      
      console.log(`✅ Sent payment failure notification for tenant ${tenantId}`);
    } catch (error) {
      console.error('Failed to handle payment failure:', error);
      throw error;
    }
  }

  /**
   * Check if we've sent a usage warning recently
   */
  private async hasRecentUsageWarning(tenantId: string): Promise<boolean> {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recentWarning = await prisma.analyticsEvent.findFirst({
      where: {
        tenantId,
        eventType: 'usage_warning_sent',
        createdAt: {
          gte: sevenDaysAgo,
        },
      },
    });

    return !!recentWarning;
  }

  /**
   * Record that we sent a usage warning
   */
  private async recordUsageWarning(tenantId: string, usagePercentage: number): Promise<void> {
    await prisma.analyticsEvent.create({
      data: {
        tenantId,
        eventType: 'usage_warning_sent',
        metadata: {
          usagePercentage,
          timestamp: new Date().toISOString(),
        },
      },
    });
  }

  /**
   * Record payment failure for tracking
   */
  private async recordPaymentFailure(tenantId: string, invoiceId: string, amount: number): Promise<void> {
    await prisma.analyticsEvent.create({
      data: {
        tenantId,
        eventType: 'payment_failure',
        metadata: {
          invoiceId,
          amount,
          timestamp: new Date().toISOString(),
        },
      },
    });
  }

  /**
   * Run all notification checks (for scheduled jobs)
   */
  async runNotificationChecks(): Promise<void> {
    console.log('🔔 Running notification checks...');
    
    try {
      await Promise.all([
        this.sendRenewalReminders(),
        this.sendUsageLimitWarnings(),
      ]);
      
      console.log('✅ All notification checks completed');
    } catch (error) {
      console.error('❌ Notification checks failed:', error);
      throw error;
    }
  }
}

export const notificationService = new NotificationService();