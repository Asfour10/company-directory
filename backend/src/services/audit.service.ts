import { prisma } from '../lib/database';

export interface AuditLogEntry {
  tenantId: string;
  userId?: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  entityType: string;
  entityId: string;
  fieldName?: string;
  oldValue?: string;
  newValue?: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface AnalyticsEvent {
  tenantId: string;
  userId?: string;
  eventType: string;
  metadata?: Record<string, any>;
}

/**
 * Service for managing audit logs and analytics events
 * Ensures immutability and compliance with audit requirements
 */
export class AuditService {
  /**
   * Log a change to the audit trail
   * This creates an immutable record that cannot be modified
   */
  static async logChange(entry: AuditLogEntry): Promise<void> {
    try {
      await prisma.auditLog.create({
        data: {
          tenantId: entry.tenantId,
          userId: entry.userId,
          action: entry.action,
          entityType: entry.entityType,
          entityId: entry.entityId,
          fieldName: entry.fieldName,
          oldValue: entry.oldValue,
          newValue: entry.newValue,
          ipAddress: entry.ipAddress,
          userAgent: entry.userAgent,
        },
      });
    } catch (error) {
      // Log audit failures but don't throw to avoid breaking business operations
      console.error('Failed to create audit log entry:', error);
    }
  }

  /**
   * Log multiple field changes for a single entity update
   */
  static async logFieldChanges(
    baseEntry: Omit<AuditLogEntry, 'fieldName' | 'oldValue' | 'newValue'>,
    changes: Array<{
      fieldName: string;
      oldValue?: string;
      newValue?: string;
    }>
  ): Promise<void> {
    const entries = changes.map(change => ({
      ...baseEntry,
      ...change,
    }));

    // Log all changes in parallel
    await Promise.allSettled(
      entries.map(entry => this.logChange(entry))
    );
  }

  /**
   * Track an analytics event
   */
  static async trackEvent(event: AnalyticsEvent): Promise<void> {
    try {
      await prisma.analyticsEvent.create({
        data: {
          tenantId: event.tenantId,
          userId: event.userId,
          eventType: event.eventType,
          metadata: event.metadata,
        },
      });
    } catch (error) {
      // Log analytics failures but don't throw
      console.error('Failed to track analytics event:', error);
    }
  }

  /**
   * Get audit logs with filtering and pagination
   */
  static async getAuditLogs(params: {
    tenantId: string;
    userId?: string;
    entityType?: string;
    entityId?: string;
    action?: string;
    fieldName?: string;
    startDate?: Date;
    endDate?: Date;
    page?: number;
    pageSize?: number;
  }) {
    const {
      tenantId,
      userId,
      entityType,
      entityId,
      action,
      fieldName,
      startDate,
      endDate,
      page = 1,
      pageSize = 50,
    } = params;

    const where: any = { tenantId };

    if (userId) where.userId = userId;
    if (entityType) where.entityType = entityType;
    if (entityId) where.entityId = entityId;
    if (action) where.action = action;
    if (fieldName) where.fieldName = fieldName;
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = startDate;
      if (endDate) where.createdAt.lte = endDate;
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              email: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.auditLog.count({ where }),
    ]);

    return {
      logs,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  /**
   * Get analytics events with filtering and aggregation
   */
  static async getAnalyticsEvents(params: {
    tenantId: string;
    eventType?: string;
    userId?: string;
    startDate?: Date;
    endDate?: Date;
    page?: number;
    pageSize?: number;
  }) {
    const {
      tenantId,
      eventType,
      userId,
      startDate,
      endDate,
      page = 1,
      pageSize = 100,
    } = params;

    const where: any = { tenantId };

    if (eventType) where.eventType = eventType;
    if (userId) where.userId = userId;
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = startDate;
      if (endDate) where.createdAt.lte = endDate;
    }

    const [events, total] = await Promise.all([
      prisma.analyticsEvent.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              email: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.analyticsEvent.count({ where }),
    ]);

    return {
      events,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  /**
   * Clean up expired audit logs based on tenant retention policy
   */
  static async cleanupExpiredLogs(tenantId: string): Promise<number> {
    // Get tenant retention policy
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { dataRetentionDays: true },
    });

    if (!tenant) {
      throw new Error('Tenant not found');
    }

    // Use raw SQL to call the cleanup function
    const result = await prisma.$queryRaw<[{ cleanup_expired_audit_logs: number }]>`
      SELECT cleanup_expired_audit_logs(${tenant.dataRetentionDays})
    `;

    return result[0].cleanup_expired_audit_logs;
  }

  /**
   * Clean up expired analytics events (shorter retention)
   */
  static async cleanupExpiredAnalytics(retentionDays: number = 90): Promise<number> {
    const result = await prisma.$queryRaw<[{ cleanup_expired_analytics_events: number }]>`
      SELECT cleanup_expired_analytics_events(${retentionDays})
    `;

    return result[0].cleanup_expired_analytics_events;
  }

  /**
   * Get audit statistics for a tenant
   */
  static async getAuditStatistics(tenantId: string, days: number = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const stats = await prisma.auditLog.groupBy({
      by: ['action', 'entityType'],
      where: {
        tenantId,
        createdAt: {
          gte: startDate,
        },
      },
      _count: {
        id: true,
      },
    });

    return stats.map(stat => ({
      action: stat.action,
      entityType: stat.entityType,
      count: stat._count.id,
    }));
  }

  /**
   * Get analytics statistics for a tenant
   */
  static async getAnalyticsStatistics(tenantId: string, days: number = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const stats = await prisma.analyticsEvent.groupBy({
      by: ['eventType'],
      where: {
        tenantId,
        createdAt: {
          gte: startDate,
        },
      },
      _count: {
        id: true,
      },
    });

    return stats.map(stat => ({
      eventType: stat.eventType,
      count: stat._count.id,
    }));
  }

  /**
   * Export audit logs to CSV format
   */
  static async exportAuditLogs(params: {
    tenantId: string;
    userId?: string;
    entityType?: string;
    entityId?: string;
    action?: string;
    fieldName?: string;
    startDate?: Date;
    endDate?: Date;
  }): Promise<string> {
    const {
      tenantId,
      userId,
      entityType,
      entityId,
      action,
      fieldName,
      startDate,
      endDate,
    } = params;

    const where: any = { tenantId };

    if (userId) where.userId = userId;
    if (entityType) where.entityType = entityType;
    if (entityId) where.entityId = entityId;
    if (action) where.action = action;
    if (fieldName) where.fieldName = fieldName;
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = startDate;
      if (endDate) where.createdAt.lte = endDate;
    }

    // Get all matching audit logs (no pagination for export)
    const logs = await prisma.auditLog.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // CSV headers
    const headers = [
      'ID',
      'Timestamp',
      'User ID',
      'User Email',
      'Action',
      'Entity Type',
      'Entity ID',
      'Field Name',
      'Old Value',
      'New Value',
      'IP Address',
      'User Agent',
    ];

    // Convert logs to CSV rows
    const rows = logs.map(log => [
      log.id,
      log.createdAt.toISOString(),
      log.userId || '',
      log.user?.email || '',
      log.action,
      log.entityType,
      log.entityId,
      log.fieldName || '',
      log.oldValue || '',
      log.newValue || '',
      log.ipAddress || '',
      log.userAgent || '',
    ]);

    // Escape CSV values (handle commas, quotes, newlines)
    const escapeCSV = (value: string): string => {
      if (value.includes(',') || value.includes('"') || value.includes('\n')) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    };

    // Build CSV content
    const csvLines = [
      headers.join(','),
      ...rows.map(row => row.map(cell => escapeCSV(cell.toString())).join(',')),
    ];

    return csvLines.join('\n');
  }
}