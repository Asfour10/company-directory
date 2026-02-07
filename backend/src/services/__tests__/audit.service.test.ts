import { AuditService } from '../audit.service';
import { prisma } from '../../lib/database';

// Mock Prisma
jest.mock('../../lib/database', () => ({
  prisma: {
    auditLog: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      groupBy: jest.fn(),
    },
    analyticsEvent: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      groupBy: jest.fn(),
    },
    tenant: {
      findUnique: jest.fn(),
    },
    $queryRaw: jest.fn(),
  },
}));

const mockPrisma = prisma as jest.Mocked<typeof prisma>;

describe('AuditService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('logChange', () => {
    it('should create an audit log entry', async () => {
      const auditEntry = {
        tenantId: 'tenant-1',
        userId: 'user-1',
        action: 'UPDATE' as const,
        entityType: 'employee',
        entityId: 'employee-1',
        fieldName: 'firstName',
        oldValue: 'John',
        newValue: 'Jonathan',
        ipAddress: '192.168.1.1',
        userAgent: 'Test Agent',
      };

      mockPrisma.auditLog.create.mockResolvedValue({
        id: 'audit-1',
        createdAt: new Date(),
        ...auditEntry,
      } as any);

      await AuditService.logChange(auditEntry);

      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
        data: auditEntry,
      });
    });

    it('should not throw if audit logging fails', async () => {
      const auditEntry = {
        tenantId: 'tenant-1',
        userId: 'user-1',
        action: 'UPDATE' as const,
        entityType: 'employee',
        entityId: 'employee-1',
      };

      mockPrisma.auditLog.create.mockRejectedValue(new Error('Database error'));

      // Should not throw
      await expect(AuditService.logChange(auditEntry)).resolves.toBeUndefined();
    });
  });

  describe('logFieldChanges', () => {
    it('should log multiple field changes', async () => {
      const baseEntry = {
        tenantId: 'tenant-1',
        userId: 'user-1',
        action: 'UPDATE' as const,
        entityType: 'employee',
        entityId: 'employee-1',
      };

      const changes = [
        { fieldName: 'firstName', oldValue: 'John', newValue: 'Jonathan' },
        { fieldName: 'lastName', oldValue: 'Doe', newValue: 'Smith' },
      ];

      mockPrisma.auditLog.create.mockResolvedValue({} as any);

      await AuditService.logFieldChanges(baseEntry, changes);

      expect(mockPrisma.auditLog.create).toHaveBeenCalledTimes(2);
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
        data: { ...baseEntry, ...changes[0] },
      });
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
        data: { ...baseEntry, ...changes[1] },
      });
    });
  });

  describe('trackEvent', () => {
    it('should create an analytics event', async () => {
      const event = {
        tenantId: 'tenant-1',
        userId: 'user-1',
        eventType: 'profile_view',
        metadata: { profileId: 'employee-1' },
      };

      mockPrisma.analyticsEvent.create.mockResolvedValue({
        id: 'event-1',
        createdAt: new Date(),
        ...event,
      } as any);

      await AuditService.trackEvent(event);

      expect(mockPrisma.analyticsEvent.create).toHaveBeenCalledWith({
        data: event,
      });
    });
  });

  describe('getAuditLogs', () => {
    it('should retrieve audit logs with pagination', async () => {
      const mockLogs = [
        {
          id: 'audit-1',
          tenantId: 'tenant-1',
          action: 'UPDATE',
          entityType: 'employee',
          createdAt: new Date(),
          user: { id: 'user-1', email: 'user@example.com' },
        },
      ];

      mockPrisma.auditLog.findMany.mockResolvedValue(mockLogs as any);
      mockPrisma.auditLog.count.mockResolvedValue(1);

      const result = await AuditService.getAuditLogs({
        tenantId: 'tenant-1',
        page: 1,
        pageSize: 50,
      });

      expect(result.logs).toEqual(mockLogs);
      expect(result.pagination).toEqual({
        page: 1,
        pageSize: 50,
        total: 1,
        totalPages: 1,
      });
    });

    it('should apply filters correctly', async () => {
      mockPrisma.auditLog.findMany.mockResolvedValue([]);
      mockPrisma.auditLog.count.mockResolvedValue(0);

      await AuditService.getAuditLogs({
        tenantId: 'tenant-1',
        userId: 'user-1',
        entityType: 'employee',
        action: 'UPDATE',
        startDate: new Date('2023-01-01'),
        endDate: new Date('2023-12-31'),
      });

      expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith({
        where: {
          tenantId: 'tenant-1',
          userId: 'user-1',
          entityType: 'employee',
          action: 'UPDATE',
          createdAt: {
            gte: new Date('2023-01-01'),
            lte: new Date('2023-12-31'),
          },
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: 50,
      });
    });
  });

  describe('exportAuditLogs', () => {
    it('should generate CSV content', async () => {
      const mockLogs = [
        {
          id: 'audit-1',
          createdAt: new Date('2023-01-01T10:00:00Z'),
          userId: 'user-1',
          action: 'UPDATE',
          entityType: 'employee',
          entityId: 'employee-1',
          fieldName: 'firstName',
          oldValue: 'John',
          newValue: 'Jonathan',
          ipAddress: '192.168.1.1',
          userAgent: 'Test Agent',
          user: { id: 'user-1', email: 'user@example.com' },
        },
      ];

      mockPrisma.auditLog.findMany.mockResolvedValue(mockLogs as any);

      const csv = await AuditService.exportAuditLogs({
        tenantId: 'tenant-1',
      });

      expect(csv).toContain('ID,Timestamp,User ID,User Email,Action,Entity Type,Entity ID,Field Name,Old Value,New Value,IP Address,User Agent');
      expect(csv).toContain('audit-1,2023-01-01T10:00:00.000Z,user-1,user@example.com,UPDATE,employee,employee-1,firstName,John,Jonathan,192.168.1.1,Test Agent');
    });

    it('should escape CSV values with commas and quotes', async () => {
      const mockLogs = [
        {
          id: 'audit-1',
          createdAt: new Date('2023-01-01T10:00:00Z'),
          userId: 'user-1',
          action: 'UPDATE',
          entityType: 'employee',
          entityId: 'employee-1',
          fieldName: 'bio',
          oldValue: 'John "Johnny" Doe, Manager',
          newValue: 'Jonathan "Jon" Smith, Senior Manager',
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
          user: { id: 'user-1', email: 'user@example.com' },
        },
      ];

      mockPrisma.auditLog.findMany.mockResolvedValue(mockLogs as any);

      const csv = await AuditService.exportAuditLogs({
        tenantId: 'tenant-1',
      });

      expect(csv).toContain('"John ""Johnny"" Doe, Manager"');
      expect(csv).toContain('"Jonathan ""Jon"" Smith, Senior Manager"');
    });
  });

  describe('getAuditStatistics', () => {
    it('should return audit statistics', async () => {
      const mockStats = [
        { action: 'UPDATE', entityType: 'employee', _count: { id: 5 } },
        { action: 'CREATE', entityType: 'employee', _count: { id: 3 } },
      ];

      mockPrisma.auditLog.groupBy.mockResolvedValue(mockStats as any);

      const stats = await AuditService.getAuditStatistics('tenant-1', 30);

      expect(stats).toEqual([
        { action: 'UPDATE', entityType: 'employee', count: 5 },
        { action: 'CREATE', entityType: 'employee', count: 3 },
      ]);
    });
  });

  describe('cleanupExpiredLogs', () => {
    it('should cleanup expired logs using tenant retention policy', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue({
        id: 'tenant-1',
        dataRetentionDays: 730,
      } as any);

      mockPrisma.$queryRaw.mockResolvedValue([{ cleanup_expired_audit_logs: 10 }]);

      const deletedCount = await AuditService.cleanupExpiredLogs('tenant-1');

      expect(deletedCount).toBe(10);
      expect(mockPrisma.$queryRaw).toHaveBeenCalledWith(
        expect.arrayContaining([expect.stringContaining('SELECT cleanup_expired_audit_logs')])
      );
    });

    it('should throw error if tenant not found', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue(null);

      await expect(AuditService.cleanupExpiredLogs('invalid-tenant')).rejects.toThrow('Tenant not found');
    });
  });
});