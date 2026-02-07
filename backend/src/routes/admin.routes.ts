import { Router } from 'express';
import { AuditService } from '../services/audit.service';
import { AnalyticsService } from '../services/analytics.service';
import { CustomFieldRepository } from '../repositories/custom-field.repository';
import { BulkImportService } from '../services/bulk-import.service';
import { CSVImportService } from '../services/csv-import.service';
import { authenticateToken, requireAdmin, requireSuperAdmin } from '../middleware/auth.middleware';
import { requireTenant, tenantMiddleware } from '../middleware/tenant.middleware';
import { AppError } from '../utils/errors';
import { 
  validateCreateCustomField, 
  validateUpdateCustomField, 
  validateCustomFieldFilters,
  validateReorderCustomFields 
} from '../validators/custom-field.validator';
import { AuthenticatedUser } from '../types';
import { EmployeeServiceContext } from '../services/employee.service';
import { redisClient } from '../lib/redis';
import multer from 'multer';

const router = Router();

// Simple async handler utility
const asyncHandler = (fn: Function) => (req: any, res: any, next: any) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// All admin routes require authentication and tenant context
router.use(authenticateToken);
router.use(tenantMiddleware);
router.use(requireTenant);
router.use(requireAdmin);

/**
 * GET /api/admin/audit-logs
 * Get audit logs with filtering and pagination
 */
router.get('/audit-logs', asyncHandler(async (req, res) => {
  try {
    const tenantId = req.tenant!.id;
    const {
      startDate,
      endDate,
      userId,
      entityType,
      entityId,
      fieldName,
      page = '1',
      pageSize = '50',
    } = req.query;

    // Parse and validate query parameters
    const filter: any = {};

    if (startDate) {
      filter.startDate = new Date(startDate as string);
      if (isNaN(filter.startDate.getTime())) {
        throw new AppError('VALIDATION_ERROR', 'Invalid startDate format', 400);
      }
    }

    if (endDate) {
      filter.endDate = new Date(endDate as string);
      if (isNaN(filter.endDate.getTime())) {
        throw new AppError('VALIDATION_ERROR', 'Invalid endDate format', 400);
      }
    }

    if (userId) filter.userId = userId as string;
    if (entityType) filter.entityType = entityType as string;
    if (entityId) filter.entityId = entityId as string;
    if (fieldName) filter.fieldName = fieldName as string;

    const pageNum = parseInt(page as string, 10);
    const pageSizeNum = parseInt(pageSize as string, 10);

    if (isNaN(pageNum) || pageNum < 1) {
      throw new AppError('VALIDATION_ERROR', 'Invalid page number', 400);
    }

    if (isNaN(pageSizeNum) || pageSizeNum < 1 || pageSizeNum > 100) {
      throw new AppError('VALIDATION_ERROR', 'Invalid page size (1-100)', 400);
    }

    filter.page = pageNum;
    filter.pageSize = pageSizeNum;

    const result = await AuditService.getAuditLogs({
      tenantId,
      ...filter,
    });

    res.json({
      success: true,
      data: result,
      requestId: req.id,
    });
  } catch (error) {
    console.error('Failed to get audit logs:', error);
    throw error;
  }
}));

/**
 * GET /api/admin/audit-logs/export
 * Export audit logs to CSV
 */
router.get('/audit-logs/export', asyncHandler(async (req, res) => {
  try {
    const tenantId = req.tenant!.id;
    const {
      startDate,
      endDate,
      userId,
      entityType,
      entityId,
      fieldName,
    } = req.query;

    // Parse query parameters (same as above)
    const filter: any = {};

    if (startDate) {
      filter.startDate = new Date(startDate as string);
      if (isNaN(filter.startDate.getTime())) {
        throw new AppError('VALIDATION_ERROR', 'Invalid startDate format', 400);
      }
    }

    if (endDate) {
      filter.endDate = new Date(endDate as string);
      if (isNaN(filter.endDate.getTime())) {
        throw new AppError('VALIDATION_ERROR', 'Invalid endDate format', 400);
      }
    }

    if (userId) filter.userId = userId as string;
    if (entityType) filter.entityType = entityType as string;
    if (entityId) filter.entityId = entityId as string;
    if (fieldName) filter.fieldName = fieldName as string;

    const csvContent = await AuditService.exportAuditLogs({
      tenantId,
      ...filter,
    });

    // Set CSV headers
    const filename = `audit-logs-${tenantId}-${new Date().toISOString().split('T')[0]}.csv`;
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    res.send(csvContent);
  } catch (error) {
    console.error('Failed to export audit logs:', error);
    throw error;
  }
}));

/**
 * GET /api/admin/audit-logs/statistics
 * Get audit log statistics
 */
router.get('/audit-logs/statistics', asyncHandler(async (req, res) => {
  try {
    const tenantId = req.tenant!.id;
    const { days = '30' } = req.query;

    const daysNum = parseInt(days as string, 10);
    if (isNaN(daysNum) || daysNum < 1 || daysNum > 365) {
      throw new AppError('VALIDATION_ERROR', 'Invalid days parameter (1-365)', 400);
    }

    const statistics = await AuditService.getAuditStatistics(tenantId, daysNum);

    res.json({
      success: true,
      data: statistics,
      requestId: req.id,
    });
  } catch (error) {
    console.error('Failed to get audit statistics:', error);
    throw error;
  }
}));

/**
 * POST /api/admin/audit-logs/cleanup
 * Manually trigger audit log cleanup (super admin only)
 */
router.post('/audit-logs/cleanup', requireSuperAdmin, asyncHandler(async (req, res) => {
  try {
    const tenantId = req.tenant!.id;

    const deletedCount = await AuditService.cleanupExpiredLogs(tenantId);

    res.json({
      success: true,
      data: {
        deletedCount,
      },
      message: `Cleaned up ${deletedCount} expired audit log entries`,
      requestId: req.id,
    });
  } catch (error) {
    console.error('Failed to cleanup audit logs:', error);
    throw error;
  }
}));

// ===== ANALYTICS ENDPOINTS =====

/**
 * GET /api/admin/analytics
 * Get comprehensive dashboard analytics with caching
 * Requirements: 16.2, 16.5
 * - Return dashboard metrics
 * - Use 90-day data window
 * - Cache results for 1 hour
 */
router.get('/analytics', asyncHandler(async (req, res) => {
  try {
    const tenantId = req.tenant!.id;
    const days = Math.min(365, Math.max(1, parseInt(req.query.days as string) || 90));
    
    // Create cache key for this tenant and time period
    const cacheKey = `analytics:dashboard:${tenantId}:${days}`;
    
    // Try to get cached data first
    let analyticsData = await redisClient.get(cacheKey);
    
    if (!analyticsData) {
      // Cache miss - fetch fresh data
      console.log(`Cache miss for analytics dashboard: ${cacheKey}`);
      
      analyticsData = await AnalyticsService.getDashboardAnalytics(tenantId, days);
      
      // Cache for 1 hour (3600 seconds)
      await redisClient.set(cacheKey, analyticsData, 3600);
      
      // Add cache metadata
      analyticsData.cached = false;
      analyticsData.cacheExpiry = new Date(Date.now() + 3600 * 1000).toISOString();
    } else {
      console.log(`Cache hit for analytics dashboard: ${cacheKey}`);
      analyticsData.cached = true;
    }

    res.json({
      success: true,
      data: analyticsData,
      requestId: req.id,
    });
  } catch (error) {
    console.error('Failed to get admin analytics:', error);
    throw error;
  }
}));

// ===== BULK IMPORT ENDPOINTS =====

/**
 * POST /api/admin/employees/bulk-import/validate
 * Validate CSV file before import
 */
router.post('/employees/bulk-import/validate', asyncHandler(async (req, res) => {
  try {
    const user = req.user as AuthenticatedUser;
    const context: EmployeeServiceContext = {
      tenantId: req.tenant!.id,
      userId: user?.id,
      userRole: user?.role,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
    };

    // Configure multer for CSV upload
    const upload = multer({
      storage: multer.memoryStorage(),
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB
      },
      fileFilter: (req, file, cb) => {
        if (file.mimetype === 'text/csv' || file.originalname.toLowerCase().endsWith('.csv')) {
          cb(null, true);
        } else {
          cb(new Error('Only CSV files are allowed'));
        }
      },
    });

    upload.single('csvFile')(req, res, async (err) => {
      if (err) {
        throw new AppError('FILE_UPLOAD_ERROR', err.message, 400);
      }

      if (!req.file) {
        throw new AppError('VALIDATION_ERROR', 'CSV file is required', 400);
      }

      // Validate file
      const fileValidation = CSVImportService.validateFile(req.file);
      if (!fileValidation.isValid) {
        throw new AppError('VALIDATION_ERROR', fileValidation.errors.join(', '), 400);
      }

      // Validate import data
      const validation = await BulkImportService.validateImportData(req.file.buffer, context);

      res.json({
        success: true,
        data: {
          validation: {
            isValid: validation.isValid,
            errors: validation.errors,
            warnings: validation.warnings,
            summary: validation.summary
          },
          fileInfo: {
            name: req.file.originalname,
            size: req.file.size,
            type: req.file.mimetype
          }
        },
        requestId: req.id,
      });
    });
  } catch (error) {
    console.error('Failed to validate CSV import:', error);
    throw error;
  }
}));

/**
 * POST /api/admin/employees/bulk-import
 * Import employees from CSV file
 */
router.post('/employees/bulk-import', asyncHandler(async (req, res) => {
  try {
    const user = req.user as AuthenticatedUser;
    const context: EmployeeServiceContext = {
      tenantId: req.tenant!.id,
      userId: user?.id,
      userRole: user?.role,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
    };

    // Configure multer for CSV upload
    const upload = multer({
      storage: multer.memoryStorage(),
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB
      },
      fileFilter: (req, file, cb) => {
        if (file.mimetype === 'text/csv' || file.originalname.toLowerCase().endsWith('.csv')) {
          cb(null, true);
        } else {
          cb(new Error('Only CSV files are allowed'));
        }
      },
    });

    upload.single('csvFile')(req, res, async (err) => {
      if (err) {
        throw new AppError('FILE_UPLOAD_ERROR', err.message, 400);
      }

      if (!req.file) {
        throw new AppError('VALIDATION_ERROR', 'CSV file is required', 400);
      }

      // Parse import options from request body
      const options = {
        batchSize: parseInt(req.body.batchSize) || 50,
        updateExisting: req.body.updateExisting === 'true' || req.body.updateExisting === true,
        skipInvalidRows: req.body.skipInvalidRows === 'true' || req.body.skipInvalidRows === true,
        validateManagerEmails: req.body.validateManagerEmails === 'true' || req.body.validateManagerEmails === true
      };

      // Validate file
      const fileValidation = CSVImportService.validateFile(req.file);
      if (!fileValidation.isValid) {
        throw new AppError('VALIDATION_ERROR', fileValidation.errors.join(', '), 400);
      }

      // Perform bulk import
      const result = await BulkImportService.importFromCSV(req.file.buffer, context, options);

      res.json({
        success: true,
        data: {
          summary: result.summary,
          results: result.results,
          errors: result.errors,
          options
        },
        message: `Import completed: ${result.summary.created} created, ${result.summary.updated} updated, ${result.summary.failed} failed`,
        requestId: req.id,
      });
    });
  } catch (error) {
    console.error('Failed to import CSV:', error);
    throw error;
  }
}));

/**
 * GET /api/admin/employees/bulk-import/template
 * Download CSV template for employee import
 */
router.get('/employees/bulk-import/template', asyncHandler(async (req, res) => {
  try {
    const csvTemplate = CSVImportService.generateCSVTemplate();

    // Set CSV headers
    const filename = 'employee-import-template.csv';
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    res.send(csvTemplate);
  } catch (error) {
    console.error('Failed to generate CSV template:', error);
    throw error;
  }
}));

/**
 * GET /api/admin/employees/bulk-import/progress/:importId
 * Get import progress status (for future async imports)
 */
router.get('/employees/bulk-import/progress/:importId', asyncHandler(async (req, res) => {
  try {
    const user = req.user as AuthenticatedUser;
    const context: EmployeeServiceContext = {
      tenantId: req.tenant!.id,
      userId: user?.id,
      userRole: user?.role,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
    };

    const { importId } = req.params;
    
    if (!importId) {
      throw new AppError('VALIDATION_ERROR', 'Import ID is required', 400);
    }

    const progress = await BulkImportService.getImportProgress(importId, context);

    res.json({
      success: true,
      data: progress,
      requestId: req.id,
    });
  } catch (error) {
    console.error('Failed to get import progress:', error);
    throw error;
  }
}));

// ===== CUSTOM FIELDS ENDPOINTS =====

/**
 * GET /api/admin/custom-fields
 * Get all custom fields for the tenant
 */
router.get('/custom-fields', asyncHandler(async (req, res) => {
  try {
    const tenantId = req.tenant!.id;
    const filters = validateCustomFieldFilters(req.query);

    const customFields = await CustomFieldRepository.findMany(tenantId, filters);

    res.json({
      success: true,
      data: customFields,
      requestId: req.id,
    });
  } catch (error) {
    console.error('Failed to get custom fields:', error);
    throw error;
  }
}));

/**
 * GET /api/admin/custom-fields/:id
 * Get a specific custom field by ID
 */
router.get('/custom-fields/:id', asyncHandler(async (req, res) => {
  try {
    const tenantId = req.tenant!.id;
    const { id } = req.params;

    if (!id) {
      throw new AppError('VALIDATION_ERROR', 'Custom field ID is required', 400);
    }

    const customField = await CustomFieldRepository.findById(tenantId, id);

    res.json({
      success: true,
      data: customField,
      requestId: req.id,
    });
  } catch (error) {
    console.error('Failed to get custom field:', error);
    throw error;
  }
}));

/**
 * POST /api/admin/custom-fields
 * Create a new custom field
 */
router.post('/custom-fields', asyncHandler(async (req, res) => {
  try {
    const tenantId = req.tenant!.id;
    const validatedData = validateCreateCustomField(req.body);

    const customField = await CustomFieldRepository.create(tenantId, validatedData);

    res.status(201).json({
      success: true,
      data: customField,
      message: 'Custom field created successfully',
      requestId: req.id,
    });
  } catch (error) {
    console.error('Failed to create custom field:', error);
    throw error;
  }
}));

/**
 * PUT /api/admin/custom-fields/:id
 * Update a custom field
 */
router.put('/custom-fields/:id', asyncHandler(async (req, res) => {
  try {
    const tenantId = req.tenant!.id;
    const { id } = req.params;

    if (!id) {
      throw new AppError('VALIDATION_ERROR', 'Custom field ID is required', 400);
    }

    const validatedData = validateUpdateCustomField(req.body);
    const customField = await CustomFieldRepository.update(tenantId, id, validatedData);

    res.json({
      success: true,
      data: customField,
      message: 'Custom field updated successfully',
      requestId: req.id,
    });
  } catch (error) {
    console.error('Failed to update custom field:', error);
    throw error;
  }
}));

/**
 * DELETE /api/admin/custom-fields/:id
 * Delete a custom field
 */
router.delete('/custom-fields/:id', asyncHandler(async (req, res) => {
  try {
    const tenantId = req.tenant!.id;
    const { id } = req.params;

    if (!id) {
      throw new AppError('VALIDATION_ERROR', 'Custom field ID is required', 400);
    }

    await CustomFieldRepository.delete(tenantId, id);

    res.json({
      success: true,
      message: 'Custom field deleted successfully',
      requestId: req.id,
    });
  } catch (error) {
    console.error('Failed to delete custom field:', error);
    throw error;
  }
}));

/**
 * POST /api/admin/custom-fields/reorder
 * Reorder custom fields by updating display order
 */
router.post('/custom-fields/reorder', asyncHandler(async (req, res) => {
  try {
    const tenantId = req.tenant!.id;
    const validatedData = validateReorderCustomFields(req.body);

    const reorderedFields = await CustomFieldRepository.reorder(tenantId, validatedData.fieldOrders);

    res.json({
      success: true,
      data: reorderedFields,
      message: 'Custom fields reordered successfully',
      requestId: req.id,
    });
  } catch (error) {
    console.error('Failed to reorder custom fields:', error);
    throw error;
  }
}));

/**
 * GET /api/admin/custom-fields/statistics
 * Get custom field statistics
 */
router.get('/custom-fields/statistics', asyncHandler(async (req, res) => {
  try {
    const tenantId = req.tenant!.id;

    const statistics = await CustomFieldRepository.getStatistics(tenantId);

    res.json({
      success: true,
      data: statistics,
      requestId: req.id,
    });
  } catch (error) {
    console.error('Failed to get custom field statistics:', error);
    throw error;
  }
}));

export default router;