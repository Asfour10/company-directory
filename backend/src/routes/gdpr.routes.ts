import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { GdprService } from '../services/gdpr.service';
import { DataRetentionService } from '../services/data-retention.service';
// import { EncryptionKeyService } from '../services/encryption-key.service'; // Disabled for basic deployment
import { authenticateToken } from '../middleware/auth.middleware';
import { tenantMiddleware } from '../middleware/tenant.middleware';
import { requireRole, Role } from '../middleware/authorization.middleware';

const router = Router();
const prisma = new PrismaClient();
// const keyConfig = { provider: 'local' as const };
// const keyService = new EncryptionKeyService(keyConfig); // Disabled for basic deployment
const gdprService = new GdprService(prisma, null as any); // Encryption disabled for basic deployment
const dataRetentionService = new DataRetentionService(prisma, gdprService);

/**
 * GET /api/gdpr/export
 * Export user's personal data for GDPR compliance
 * Requirement 17.4: Provide data export functionality allowing Users to download their Employee Profile data in JSON format
 */
router.get('/export', authenticateToken, tenantMiddleware, async (req, res) => {
  try {
    const userId = req.user!.id;
    const tenantId = req.tenant!.id;

    const userData = await gdprService.exportUserData(userId, tenantId);

    // Set headers for file download
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="user-data-export-${new Date().toISOString().split('T')[0]}.json"`);

    res.json({
      exportDate: new Date().toISOString(),
      userId,
      tenantId,
      data: userData
    });
  } catch (error) {
    console.error('Error exporting user data:', error);
    res.status(500).json({ 
      error: 'Failed to export user data',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/gdpr/delete-request
 * Request deletion of user's personal data
 * Requirement 17.2: Allow Users to request deletion of their personal data through a self-service interface
 */
router.post('/delete-request', authenticateToken, tenantMiddleware, async (req, res) => {
  try {
    const userId = req.user!.id;
    const tenantId = req.tenant!.id;
    const { reason } = req.body;

    const deletionRequest = await gdprService.requestDataDeletion(userId, tenantId, reason);

    res.json({
      message: 'Data deletion request submitted successfully',
      request: deletionRequest,
      note: 'Your data will be deleted within 30 days as required by GDPR regulations'
    });
  } catch (error) {
    console.error('Error requesting data deletion:', error);
    res.status(400).json({ 
      error: 'Failed to request data deletion',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/gdpr/delete-request/status
 * Get status of user's data deletion request
 */
router.get('/delete-request/status', authenticateToken, tenantMiddleware, async (req, res) => {
  try {
    const userId = req.user!.id;
    const tenantId = req.tenant!.id;

    const status = await gdprService.getDeletionRequestStatus(userId, tenantId);

    if (!status) {
      return res.json({ message: 'No deletion request found' });
    }

    res.json({ request: status });
  } catch (error) {
    console.error('Error getting deletion request status:', error);
    res.status(500).json({ 
      error: 'Failed to get deletion request status',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/gdpr/admin/pending-deletions
 * Get pending deletion requests for admin processing
 * Admin only endpoint
 */
router.get('/admin/pending-deletions', 
  authenticateToken, 
  tenantMiddleware, 
  requireRole(Role.ADMIN, Role.SUPER_ADMIN),
  async (req, res) => {
    try {
      const tenantId = req.tenant!.id;

      const pendingRequests = await gdprService.getPendingDeletionRequests(tenantId);

      res.json({ requests: pendingRequests });
    } catch (error) {
      console.error('Error getting pending deletion requests:', error);
      res.status(500).json({ 
        error: 'Failed to get pending deletion requests',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * POST /api/gdpr/admin/process-deletion/:requestId
 * Process a data deletion request
 * Admin only endpoint
 */
router.post('/admin/process-deletion/:requestId',
  authenticateToken,
  tenantMiddleware,
  requireRole(Role.ADMIN, Role.SUPER_ADMIN),
  async (req, res) => {
    try {
      const { requestId } = req.params;
      const tenantId = req.tenant!.id;

      await gdprService.processDataDeletion(requestId, tenantId);

      res.json({ 
        message: 'Data deletion processed successfully',
        requestId 
      });
    } catch (error) {
      console.error('Error processing data deletion:', error);
      res.status(500).json({ 
        error: 'Failed to process data deletion',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * GET /api/gdpr/admin/retention-stats
 * Get data retention statistics for the tenant
 * Super Admin only endpoint
 */
router.get('/admin/retention-stats',
  authenticateToken,
  tenantMiddleware,
  requireRole(Role.SUPER_ADMIN),
  async (req, res) => {
    try {
      const tenantId = req.tenant!.id;

      const stats = await dataRetentionService.getRetentionStats(tenantId);

      res.json({ stats });
    } catch (error) {
      console.error('Error getting retention stats:', error);
      res.status(500).json({ 
        error: 'Failed to get retention statistics',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * PUT /api/gdpr/admin/retention-policy
 * Update data retention policy for the tenant
 * Super Admin only endpoint
 * Requirement 17.1: Configurable retention with minimum 30 days and maximum 7 years
 */
router.put('/admin/retention-policy',
  authenticateToken,
  tenantMiddleware,
  requireRole(Role.SUPER_ADMIN),
  async (req, res) => {
    try {
      const tenantId = req.tenant!.id;
      const { retentionDays } = req.body;

      if (!retentionDays || typeof retentionDays !== 'number') {
        return res.status(400).json({ 
          error: 'Invalid retention days',
          message: 'retentionDays must be a number'
        });
      }

      await dataRetentionService.updateRetentionPolicy(tenantId, retentionDays);

      res.json({ 
        message: 'Retention policy updated successfully',
        retentionDays 
      });
    } catch (error) {
      console.error('Error updating retention policy:', error);
      res.status(400).json({ 
        error: 'Failed to update retention policy',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

export default router;