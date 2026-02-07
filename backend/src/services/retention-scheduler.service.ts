import cron from 'node-cron';
import { PrismaClient } from '@prisma/client';
import { DataRetentionService } from './data-retention.service';
import { GdprService } from './gdpr.service';
import { EncryptionKeyService } from './encryption-key.service';

export class RetentionSchedulerService {
  private dataRetentionService: DataRetentionService;
  private isRunning = false;

  constructor() {
    const prisma = new PrismaClient();
    const keyConfig = { provider: 'local' as const };
    const keyService = new EncryptionKeyService(keyConfig);
    const gdprService = new GdprService(prisma, keyService);
    this.dataRetentionService = new DataRetentionService(prisma, gdprService);
  }

  /**
   * Start the retention policy scheduler
   * Runs daily at 2 AM to enforce retention policies and process deletions
   */
  start(): void {
    if (this.isRunning) {
      console.log('Retention scheduler is already running');
      return;
    }

    // Schedule retention policy enforcement daily at 2 AM
    cron.schedule('0 2 * * *', async () => {
      console.log('Starting scheduled retention policy enforcement...');
      try {
        await this.runRetentionPolicies();
        console.log('Retention policy enforcement completed successfully');
      } catch (error) {
        console.error('Error during retention policy enforcement:', error);
      }
    });

    // Schedule deletion processing every 6 hours
    cron.schedule('0 */6 * * *', async () => {
      console.log('Starting scheduled deletion processing...');
      try {
        await this.processPendingDeletions();
        console.log('Deletion processing completed successfully');
      } catch (error) {
        console.error('Error during deletion processing:', error);
      }
    });

    this.isRunning = true;
    console.log('Retention scheduler started successfully');
  }

  /**
   * Stop the retention policy scheduler
   */
  stop(): void {
    cron.getTasks().forEach(task => task.stop());
    this.isRunning = false;
    console.log('Retention scheduler stopped');
  }

  /**
   * Manually run retention policies
   */
  async runRetentionPolicies(): Promise<void> {
    const startTime = Date.now();
    console.log('Enforcing data retention policies...');

    const results = await this.dataRetentionService.enforceRetentionPolicies();
    
    const totalAuditLogs = results.reduce((sum, r) => sum + r.auditLogsDeleted, 0);
    const totalAnalytics = results.reduce((sum, r) => sum + r.analyticsEventsDeleted, 0);
    const totalSessions = results.reduce((sum, r) => sum + r.sessionsDeleted, 0);
    const totalDeletionRequests = results.reduce((sum, r) => sum + r.deletionRequestsProcessed, 0);

    const duration = Date.now() - startTime;
    
    console.log(`Retention policy enforcement completed in ${duration}ms:`);
    console.log(`- Processed ${results.length} tenants`);
    console.log(`- Deleted ${totalAuditLogs} audit logs`);
    console.log(`- Deleted ${totalAnalytics} analytics events`);
    console.log(`- Deleted ${totalSessions} expired sessions`);
    console.log(`- Cleaned up ${totalDeletionRequests} old deletion requests`);
  }

  /**
   * Manually process pending deletions
   */
  async processPendingDeletions(): Promise<void> {
    const startTime = Date.now();
    console.log('Processing pending data deletions...');

    const processed = await this.dataRetentionService.processPendingDeletions();
    
    const duration = Date.now() - startTime;
    console.log(`Deletion processing completed in ${duration}ms: ${processed} requests processed`);
  }

  /**
   * Get scheduler status
   */
  getStatus(): { isRunning: boolean; scheduledTasks: number } {
    return {
      isRunning: this.isRunning,
      scheduledTasks: cron.getTasks().size
    };
  }
}