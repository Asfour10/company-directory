import { PrismaClient } from '@prisma/client';
import { FieldEncryptionService } from './field-encryption.service';
import { EncryptionKeyService } from './encryption-key.service';

export interface UserDataExport {
  profile: {
    id: string;
    firstName: string;
    lastName: string;
    title?: string;
    department?: string;
    email: string;
    phone?: string;
    personalEmail?: string;
    extension?: string;
    officeLocation?: string;
    bio?: string;
    skills: string[];
    customFields: Record<string, any>;
    photoUrl?: string;
    createdAt: Date;
    updatedAt: Date;
  };
  auditLogs: Array<{
    id: string;
    action: string;
    entityType: string;
    fieldName?: string;
    oldValue?: string;
    newValue?: string;
    createdAt: Date;
  }>;
  analyticsEvents: Array<{
    id: string;
    eventType: string;
    metadata?: Record<string, any>;
    createdAt: Date;
  }>;
}

export interface DataDeletionRequest {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  requestedAt: Date;
  processedAt?: Date;
  reason?: string;
}

export class GdprService {
  private fieldEncryption: FieldEncryptionService;

  constructor(
    private prisma: PrismaClient,
    keyService?: EncryptionKeyService
  ) {
    // Initialize field encryption service with key service
    if (keyService) {
      this.fieldEncryption = new FieldEncryptionService(keyService);
    } else {
      // Create a default key service if none provided
      const defaultConfig = {
        provider: 'local' as const
      };
      const defaultKeyService = new EncryptionKeyService(defaultConfig);
      this.fieldEncryption = new FieldEncryptionService(defaultKeyService);
    }
  }

  /**
   * Export all user data for GDPR compliance
   * Requirement 17.4: Provide data export functionality allowing Users to download their Employee Profile data in JSON format
   */
  async exportUserData(userId: string, tenantId: string): Promise<UserDataExport> {
    // Get user and employee profile
    const user = await this.prisma.user.findFirst({
      where: { id: userId, tenantId },
      include: {
        employee: true
      }
    });

    if (!user) {
      throw new Error('User not found');
    }

    if (!user.employee) {
      throw new Error('Employee profile not found');
    }

    // Decrypt sensitive fields
    let decryptedPhone: string | undefined;
    let decryptedPersonalEmail: string | undefined;

    try {
      if (user.employee.phone && this.fieldEncryption.isFieldEncrypted(user.employee.phone)) {
        decryptedPhone = await this.fieldEncryption.decryptField(user.employee.phone as any, tenantId);
      }
      
      // Check if personalEmail field exists and is encrypted
      const personalEmailField = (user.employee as any).personalEmail;
      if (personalEmailField && this.fieldEncryption.isFieldEncrypted(personalEmailField)) {
        decryptedPersonalEmail = await this.fieldEncryption.decryptField(personalEmailField, tenantId);
      }
    } catch (error) {
      console.warn('Failed to decrypt sensitive fields during export:', error);
      // Continue with export even if decryption fails
    }

    // Get audit logs for this user
    const auditLogs = await this.prisma.auditLog.findMany({
      where: {
        tenantId,
        OR: [
          { userId },
          { entityId: user.employee.id, entityType: 'employee' }
        ]
      },
      select: {
        id: true,
        action: true,
        entityType: true,
        fieldName: true,
        oldValue: true,
        newValue: true,
        createdAt: true
      },
      orderBy: { createdAt: 'desc' }
    });

    // Get analytics events for this user
    const analyticsEvents = await this.prisma.analyticsEvent.findMany({
      where: { userId, tenantId },
      select: {
        id: true,
        eventType: true,
        metadata: true,
        createdAt: true
      },
      orderBy: { createdAt: 'desc' }
    });

    return {
      profile: {
        id: user.employee.id,
        firstName: user.employee.firstName,
        lastName: user.employee.lastName,
        title: user.employee.title || undefined,
        department: user.employee.department || undefined,
        email: user.employee.email,
        phone: decryptedPhone,
        personalEmail: decryptedPersonalEmail,
        extension: user.employee.extension || undefined,
        officeLocation: user.employee.officeLocation || undefined,
        bio: user.employee.bio || undefined,
        skills: user.employee.skills,
        customFields: user.employee.customFields as Record<string, any>,
        photoUrl: user.employee.photoUrl || undefined,
        createdAt: user.employee.createdAt,
        updatedAt: user.employee.updatedAt
      },
      auditLogs: auditLogs.map(log => ({
        id: log.id,
        action: log.action,
        entityType: log.entityType,
        fieldName: log.fieldName || undefined,
        oldValue: log.oldValue || undefined,
        newValue: log.newValue || undefined,
        createdAt: log.createdAt
      })),
      analyticsEvents: analyticsEvents.map(event => ({
        id: event.id,
        eventType: event.eventType,
        metadata: event.metadata as Record<string, any> || undefined,
        createdAt: event.createdAt
      }))
    };
  }

  /**
   * Request data deletion for GDPR compliance
   * Requirement 17.2: Allow Users to request deletion of their personal data through a self-service interface
   * Note: This is a simplified implementation that immediately processes deletion
   */
  async requestDataDeletion(userId: string, tenantId: string, reason?: string): Promise<DataDeletionRequest> {
    // Check if user exists and get employee ID
    const user = await this.prisma.user.findFirst({
      where: { id: userId, tenantId },
      include: { employee: true }
    });

    if (!user) {
      throw new Error('User not found');
    }

    if (!user.employee) {
      throw new Error('Employee profile not found');
    }

    // For now, create a mock deletion request object
    // In a full implementation, this would be stored in the database
    const deletionRequest: DataDeletionRequest = {
      id: `del-${Date.now()}`,
      status: 'pending',
      requestedAt: new Date(),
      reason
    };

    // Log the deletion request in audit logs
    await this.prisma.auditLog.create({
      data: {
        tenantId,
        userId,
        action: 'data_deletion_requested',
        entityType: 'user',
        entityId: userId,
        newValue: reason || 'User requested data deletion'
      }
    });

    return deletionRequest;
  }

  /**
   * Process data deletion request
   * Requirement 17.3: Remove all personal information within 30 days while preserving anonymized audit records
   * Note: This is a simplified implementation for demonstration
   */
  async processDataDeletion(requestId: string, tenantId: string): Promise<void> {
    // In a full implementation, this would look up the actual deletion request
    // For now, we'll simulate the deletion process
    
    console.log(`Processing deletion request ${requestId} for tenant ${tenantId}`);
    
    // This would contain the actual deletion logic:
    // 1. Anonymize audit logs
    // 2. Delete analytics events
    // 3. Delete sessions
    // 4. Delete employee profile
    // 5. Delete user account
    
    // For demonstration, we'll just log the action
    console.log('Data deletion would be processed here');
  }

  /**
   * Get data deletion request status
   * Note: Simplified implementation returns mock status
   */
  async getDeletionRequestStatus(_userId: string, _tenantId: string): Promise<DataDeletionRequest | null> {
    // In a full implementation, this would query the deletion requests table
    // For now, return null to indicate no pending requests
    return null;
  }

  /**
   * Get pending deletion requests for processing
   * Note: Simplified implementation returns empty array
   */
  async getPendingDeletionRequests(_tenantId: string): Promise<DataDeletionRequest[]> {
    // In a full implementation, this would query pending deletion requests
    // For now, return empty array
    return [];
  }
}