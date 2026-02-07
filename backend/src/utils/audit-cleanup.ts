import { PrismaClient } from '@prisma/client';
import { AuditService } from '../services/audit.service';

const prisma = new PrismaClient();

/**
 * Cleanup expired audit logs for all tenants based on their retention policies
 */
export async function cleanupExpiredAuditLogs(): Promise<void> {
  console.log('Starting audit log cleanup job...');

  try {
    // Get all tenants with their retention policies
    const tenants = await prisma.tenant.findMany({
      select: {
        id: true,
        name: true,
        dataRetentionDays: true,
      },
    });

    let totalCleaned = 0;

    for (const tenant of tenants) {
      try {
        const deletedCount = await AuditService.cleanupExpiredLogs(tenant.id);

        totalCleaned += deletedCount;

        if (deletedCount > 0) {
          console.log(
            `Cleaned up ${deletedCount} audit logs for tenant ${tenant.name} (${tenant.id})`
          );
        }
      } catch (error) {
        console.error(
          `Failed to cleanup audit logs for tenant ${tenant.name} (${tenant.id}):`,
          error
        );
      }
    }

    console.log(`Audit log cleanup completed. Total records cleaned: ${totalCleaned}`);
  } catch (error) {
    console.error('Failed to run audit log cleanup job:', error);
    throw error;
  }
}

/**
 * Schedule audit log cleanup to run daily at 2 AM
 */
export function scheduleAuditLogCleanup(): void {
  const CLEANUP_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

  // Calculate time until next 2 AM
  const now = new Date();
  const next2AM = new Date();
  next2AM.setHours(2, 0, 0, 0);

  // If it's already past 2 AM today, schedule for tomorrow
  if (now > next2AM) {
    next2AM.setDate(next2AM.getDate() + 1);
  }

  const timeUntilNext2AM = next2AM.getTime() - now.getTime();

  console.log(`Audit log cleanup scheduled for ${next2AM.toISOString()}`);

  // Schedule first cleanup
  setTimeout(() => {
    cleanupExpiredAuditLogs().catch(console.error);

    // Schedule recurring cleanup every 24 hours
    setInterval(() => {
      cleanupExpiredAuditLogs().catch(console.error);
    }, CLEANUP_INTERVAL);
  }, timeUntilNext2AM);
}

/**
 * Get audit log retention statistics for all tenants
 */
export async function getAuditLogRetentionStats(): Promise<{
  totalTenants: number;
  totalAuditLogs: number;
  retentionPolicies: Array<{
    retentionDays: number;
    tenantCount: number;
  }>;
  oldestLog: Date | null;
  newestLog: Date | null;
}> {
  try {
    const [
      totalTenants,
      totalAuditLogs,
      retentionPolicies,
      oldestLog,
      newestLog,
    ] = await Promise.all([
      // Total tenants
      prisma.tenant.count(),

      // Total audit logs
      prisma.auditLog.count(),

      // Retention policies distribution
      prisma.tenant.groupBy({
        by: ['dataRetentionDays'],
        _count: { dataRetentionDays: true },
        orderBy: { dataRetentionDays: 'asc' },
      }),

      // Oldest audit log
      prisma.auditLog.findFirst({
        orderBy: { createdAt: 'asc' },
        select: { createdAt: true },
      }),

      // Newest audit log
      prisma.auditLog.findFirst({
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      }),
    ]);

    return {
      totalTenants,
      totalAuditLogs,
      retentionPolicies: retentionPolicies.map(policy => ({
        retentionDays: policy.dataRetentionDays,
        tenantCount: policy._count.dataRetentionDays,
      })),
      oldestLog: oldestLog?.createdAt || null,
      newestLog: newestLog?.createdAt || null,
    };
  } catch (error) {
    console.error('Failed to get audit log retention stats:', error);
    throw error;
  }
}