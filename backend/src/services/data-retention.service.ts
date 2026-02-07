import { PrismaClient } from '@prisma/client';
import { GdprService } from './gdpr.service';

export interface RetentionPolicyResult {
  tenantId: string;
  auditLogsDeleted: number;
  analyticsEventsDeleted: number;
  sessionsDeleted: number;
  deletionRequestsProcessed: number;
}

export class DataRetentionService {
  constructor(
    private prisma: PrismaClient,
    private gdprService: GdprService
  ) {}

  /**
   * Enforce data retention policies for all tenants
   * Requirement 17.1: Provide data retention policies configurable by Super Admins with minimum retention of 30 days and maximum of 7 years
   */
  async enforceRetentionPolicies(): Promise<RetentionPolicyResult[]> {
    const tenants = await this.prisma.tenant.findMany({
      select: {
        id: true,
        dataRetentionDays: true
      }
    });

    const results: RetentionPolicyResult[] = [];

    for (const tenant of tenants) {
      try {
        const result = await this.enforceRetentionPolicyForTenant(
          tenant.id, 
          tenant.dataRetentionDays
        );
        results.push(result);
      } catch (error) {
        console.error(`Error enforcing retention policy for tenant ${tenant.id}:`, error);
        results.push({
          tenantId: tenant.id,
          auditLogsDeleted: 0,
          analyticsEventsDeleted: 0,
          sessionsDeleted: 0,
          deletionRequestsProcessed: 0
        });
      }
    }

    return results;
  }

  /**
   * Enforce retention policy for a specific tenant
   */
  private async enforceRetentionPolicyForTenant(
    tenantId: string, 
    retentionDays: number
  ): Promise<RetentionPolicyResult> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    let auditLogsDeleted = 0;
    let analyticsEventsDeleted = 0;
    let sessionsDeleted = 0;
    let deletionRequestsProcessed = 0;

    await this.prisma.$transaction(async (tx) => {
      // Clean up expired audit logs (but preserve minimum 2 years as per requirement)
      const minRetentionDate = new Date();
      minRetentionDate.setFullYear(minRetentionDate.getFullYear() - 2);
      
      const auditLogCutoff = retentionDays >= 730 ? cutoffDate : minRetentionDate;
      
      const auditLogResult = await tx.auditLog.deleteMany({
        where: {
          tenantId,
          createdAt: { lt: auditLogCutoff }
        }
      });
      auditLogsDeleted = auditLogResult.count;

      // Clean up expired analytics events
      const analyticsResult = await tx.analyticsEvent.deleteMany({
        where: {
          tenantId,
          createdAt: { lt: cutoffDate }
        }
      });
      analyticsEventsDeleted = analyticsResult.count;

      // Clean up expired sessions
      const sessionResult = await tx.session.deleteMany({
        where: {
          user: { tenantId },
          expiresAt: { lt: new Date() }
        }
      });
      sessionsDeleted = sessionResult.count;

      // Clean up old completed/failed deletion requests (keep for 1 year)
      const deletionRequestCutoff = new Date();
      deletionRequestCutoff.setFullYear(deletionRequestCutoff.getFullYear() - 1);

      const deletionRequestResult = await tx.dataDeletionRequest.deleteMany({
        where: {
          tenantId,
          status: { in: ['completed', 'failed'] },
          processedAt: { lt: deletionRequestCutoff }
        }
      });
      deletionRequestsProcessed = deletionRequestResult.count;
    });

    return {
      tenantId,
      auditLogsDeleted,
      analyticsEventsDeleted,
      sessionsDeleted,
      deletionRequestsProcessed
    };
  }

  /**
   * Process pending data deletion requests that are older than 24 hours
   * Requirement 17.3: Complete deletion within 30 days
   */
  async processPendingDeletions(): Promise<number> {
    const tenants = await this.prisma.tenant.findMany({
      select: { id: true }
    });

    let totalProcessed = 0;

    for (const tenant of tenants) {
      try {
        const pendingRequests = await this.gdprService.getPendingDeletionRequests(tenant.id);
        
        for (const request of pendingRequests) {
          try {
            await this.gdprService.processDataDeletion(request.id, tenant.id);
            totalProcessed++;
            console.log(`Processed deletion request ${request.id} for tenant ${tenant.id}`);
          } catch (error) {
            console.error(`Failed to process deletion request ${request.id}:`, error);
          }
        }
      } catch (error) {
        console.error(`Error processing deletions for tenant ${tenant.id}:`, error);
      }
    }

    return totalProcessed;
  }

  /**
   * Get retention policy statistics for a tenant
   */
  async getRetentionStats(tenantId: string): Promise<{
    retentionDays: number;
    auditLogCount: number;
    analyticsEventCount: number;
    oldestAuditLog?: Date;
    oldestAnalyticsEvent?: Date;
  }> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { dataRetentionDays: true }
    });

    if (!tenant) {
      throw new Error('Tenant not found');
    }

    const [auditLogCount, analyticsEventCount, oldestAuditLog, oldestAnalyticsEvent] = await Promise.all([
      this.prisma.auditLog.count({ where: { tenantId } }),
      this.prisma.analyticsEvent.count({ where: { tenantId } }),
      this.prisma.auditLog.findFirst({
        where: { tenantId },
        orderBy: { createdAt: 'asc' },
        select: { createdAt: true }
      }),
      this.prisma.analyticsEvent.findFirst({
        where: { tenantId },
        orderBy: { createdAt: 'asc' },
        select: { createdAt: true }
      })
    ]);

    return {
      retentionDays: tenant.dataRetentionDays,
      auditLogCount,
      analyticsEventCount,
      oldestAuditLog: oldestAuditLog?.createdAt,
      oldestAnalyticsEvent: oldestAnalyticsEvent?.createdAt
    };
  }

  /**
   * Update tenant retention policy
   * Requirement 17.1: Configurable retention with minimum 30 days and maximum 7 years
   */
  async updateRetentionPolicy(tenantId: string, retentionDays: number): Promise<void> {
    // Validate retention period (30 days to 7 years)
    const minDays = 30;
    const maxDays = 7 * 365; // 7 years

    if (retentionDays < minDays || retentionDays > maxDays) {
      throw new Error(`Retention period must be between ${minDays} and ${maxDays} days`);
    }

    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { dataRetentionDays: retentionDays }
    });
  }
}