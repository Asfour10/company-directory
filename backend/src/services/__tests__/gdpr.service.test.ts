import { PrismaClient } from '@prisma/client';
import { GdprService } from '../gdpr.service';
import { EncryptionKeyService } from '../encryption-key.service';

// Mock Prisma Client
const mockPrisma = {
  user: {
    findFirst: jest.fn(),
  },
  auditLog: {
    findMany: jest.fn(),
  },
  analyticsEvent: {
    findMany: jest.fn(),
  },
  dataDeletionRequest: {
    create: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
  },
  $transaction: jest.fn(),
  $disconnect: jest.fn(),
} as unknown as PrismaClient;

// Mock Encryption Key Service
const mockKeyService = {
  getCachedKey: jest.fn(),
  generateTenantKey: jest.fn(),
} as unknown as EncryptionKeyService;

describe('GdprService', () => {
  let gdprService: GdprService;

  beforeEach(() => {
    gdprService = new GdprService(mockPrisma, mockKeyService);
    jest.clearAllMocks();
  });

  describe('exportUserData', () => {
    it('should export user data successfully', async () => {
      // Mock data
      const mockUser = {
        id: 'user-1',
        employee: {
          id: 'emp-1',
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com',
          title: 'Engineer',
          department: 'IT',
          phone: null,
          personalEmail: null,
          extension: '123',
          officeLocation: 'Office A',
          bio: 'Software engineer',
          skills: ['JavaScript', 'TypeScript'],
          customFields: { hobby: 'reading' },
          photoUrl: 'photo.jpg',
          createdAt: new Date(),
          updatedAt: new Date(),
        }
      };

      const mockAuditLogs = [{
        id: 'audit-1',
        action: 'create',
        entityType: 'employee',
        fieldName: 'firstName',
        oldValue: null,
        newValue: 'John',
        createdAt: new Date(),
      }];

      const mockAnalyticsEvents = [{
        id: 'analytics-1',
        eventType: 'profile_view',
        metadata: { profileId: 'emp-1' },
        createdAt: new Date(),
      }];

      // Setup mocks
      (mockPrisma.user.findFirst as jest.Mock).mockResolvedValue(mockUser);
      (mockPrisma.auditLog.findMany as jest.Mock).mockResolvedValue(mockAuditLogs);
      (mockPrisma.analyticsEvent.findMany as jest.Mock).mockResolvedValue(mockAnalyticsEvents);

      // Execute
      const result = await gdprService.exportUserData('user-1', 'tenant-1');

      // Verify
      expect(result.profile.firstName).toBe('John');
      expect(result.profile.lastName).toBe('Doe');
      expect(result.auditLogs).toHaveLength(1);
      expect(result.analyticsEvents).toHaveLength(1);
    });

    it('should throw error when user not found', async () => {
      (mockPrisma.user.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(gdprService.exportUserData('user-1', 'tenant-1'))
        .rejects.toThrow('User not found');
    });
  });

  describe('requestDataDeletion', () => {
    it('should create deletion request successfully', async () => {
      const mockUser = {
        id: 'user-1',
        employee: { id: 'emp-1' }
      };

      const mockDeletionRequest = {
        id: 'req-1',
        status: 'pending',
        requestedAt: new Date(),
        processedAt: null,
        reason: 'User requested deletion'
      };

      (mockPrisma.user.findFirst as jest.Mock).mockResolvedValue(mockUser);
      (mockPrisma.dataDeletionRequest.findFirst as jest.Mock).mockResolvedValue(null);
      (mockPrisma.dataDeletionRequest.create as jest.Mock).mockResolvedValue(mockDeletionRequest);

      const result = await gdprService.requestDataDeletion('user-1', 'tenant-1', 'User requested deletion');

      expect(result.status).toBe('pending');
      expect(result.reason).toBe('User requested deletion');
    });

    it('should throw error when deletion request already exists', async () => {
      const mockUser = {
        id: 'user-1',
        employee: { id: 'emp-1' }
      };

      const existingRequest = {
        id: 'req-1',
        status: 'pending'
      };

      (mockPrisma.user.findFirst as jest.Mock).mockResolvedValue(mockUser);
      (mockPrisma.dataDeletionRequest.findFirst as jest.Mock).mockResolvedValue(existingRequest);

      await expect(gdprService.requestDataDeletion('user-1', 'tenant-1'))
        .rejects.toThrow('Data deletion request already exists');
    });
  });

  describe('getDeletionRequestStatus', () => {
    it('should return deletion request status', async () => {
      const mockRequest = {
        id: 'req-1',
        status: 'pending',
        requestedAt: new Date(),
        processedAt: null,
        reason: 'User requested deletion'
      };

      (mockPrisma.dataDeletionRequest.findFirst as jest.Mock).mockResolvedValue(mockRequest);

      const result = await gdprService.getDeletionRequestStatus('user-1', 'tenant-1');

      expect(result?.status).toBe('pending');
      expect(result?.reason).toBe('User requested deletion');
    });

    it('should return null when no request found', async () => {
      (mockPrisma.dataDeletionRequest.findFirst as jest.Mock).mockResolvedValue(null);

      const result = await gdprService.getDeletionRequestStatus('user-1', 'tenant-1');

      expect(result).toBeNull();
    });
  });
});