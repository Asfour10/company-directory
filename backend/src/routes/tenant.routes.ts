import { Router } from 'express';
import { TenantService, tenantLogoUploadService } from '../services/tenant.service';
import { authenticateToken } from '../middleware/auth.middleware';
import { requireSuperAdmin, requireAdmin } from '../middleware/authorization.middleware';
import { tenantMiddleware } from '../middleware/tenant.middleware';
import { AppError, ValidationError } from '../utils/errors';
import { AuditService } from '../services/audit.service';
import { AuthenticatedUser } from '../types';

const router = Router();

// Apply tenant middleware to all routes
router.use(tenantMiddleware);

/**
 * GET /api/tenant/settings
 * Get tenant configuration and settings
 * Requires: User authentication
 */
router.get('/settings', authenticateToken, async (req, res, next) => {
  try {
    const tenantId = req.tenant?.id;
    if (!tenantId) {
      throw new AppError('Tenant not found', 404, 'TENANT_NOT_FOUND');
    }

    const tenant = await TenantService.getTenantById(tenantId);
    if (!tenant) {
      throw new AppError('Tenant not found', 404, 'TENANT_NOT_FOUND');
    }

    // Return tenant settings (excluding sensitive data)
    const settings = {
      id: tenant.id,
      name: tenant.name,
      subdomain: tenant.subdomain,
      logoUrl: tenant.logoUrl,
      primaryColor: tenant.primaryColor,
      accentColor: tenant.accentColor,
      subscriptionTier: tenant.subscriptionTier,
      userLimit: tenant.userLimit,
      dataRetentionDays: tenant.dataRetentionDays,
      createdAt: tenant.createdAt,
      updatedAt: tenant.updatedAt,
    };

    res.json({
      success: true,
      data: settings,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/tenant/branding
 * Update tenant branding settings (logo, colors)
 * Requires: Super Admin role
 */
router.put('/branding', 
  authenticateToken, 
  requireSuperAdmin, 
  async (req, res, next) => {
    try {
      const tenantId = req.tenant?.id;
      if (!tenantId) {
        throw new AppError('Tenant not found', 404, 'TENANT_NOT_FOUND');
      }

      const { primaryColor, accentColor } = req.body;

      // Validate input
      if (primaryColor && typeof primaryColor !== 'string') {
        throw new ValidationError('Primary color must be a string', 'primaryColor', primaryColor);
      }

      if (accentColor && typeof accentColor !== 'string') {
        throw new ValidationError('Accent color must be a string', 'accentColor', accentColor);
      }

      // Update branding
      const updatedTenant = await TenantService.updateBranding(tenantId, {
        primaryColor,
        accentColor,
      });

      // Log the changes
      if (primaryColor) {
        await AuditService.logChange({
          tenantId,
          userId: (req.user as AuthenticatedUser).id,
          action: 'UPDATE',
          entityType: 'tenant',
          entityId: tenantId,
          fieldName: 'primaryColor',
          oldValue: undefined,
          newValue: primaryColor,
        });
      }

      if (accentColor) {
        await AuditService.logChange({
          tenantId,
          userId: (req.user as AuthenticatedUser).id,
          action: 'UPDATE',
          entityType: 'tenant',
          entityId: tenantId,
          fieldName: 'accentColor',
          oldValue: undefined,
          newValue: accentColor,
        });
      }

      res.json({
        success: true,
        message: 'Branding updated successfully',
        data: {
          id: updatedTenant.id,
          primaryColor: updatedTenant.primaryColor,
          accentColor: updatedTenant.accentColor,
          logoUrl: updatedTenant.logoUrl,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/tenant/logo
 * Upload tenant logo
 * Requires: Super Admin role
 */
router.post('/logo',
  authenticateToken,
  requireSuperAdmin,
  tenantLogoUploadService.createUploadMiddleware('logo'),
  async (req, res, next) => {
    try {
      const tenantId = req.tenant?.id;
      if (!tenantId) {
        throw new AppError('Tenant not found', 404, 'TENANT_NOT_FOUND');
      }

      if (!req.file) {
        throw new ValidationError('No logo file provided', 'logo');
      }

      // Upload logo and update tenant
      const logoUrl = await TenantService.uploadLogo(tenantId, req.file);

      // Log the change
      await AuditService.logChange({
        tenantId,
        userId: (req.user as AuthenticatedUser).id,
        action: 'UPDATE',
        entityType: 'tenant',
        entityId: tenantId,
        fieldName: 'logoUrl',
        oldValue: undefined,
        newValue: logoUrl,
      });

      res.json({
        success: true,
        message: 'Logo uploaded successfully',
        data: {
          logoUrl,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /api/tenant/logo
 * Delete tenant logo
 * Requires: Super Admin role
 */
router.delete('/logo',
  authenticateToken,
  requireSuperAdmin,
  async (req, res, next) => {
    try {
      const tenantId = req.tenant?.id;
      if (!tenantId) {
        throw new AppError('Tenant not found', 404, 'TENANT_NOT_FOUND');
      }

      // Delete logo
      await TenantService.deleteLogo(tenantId);

      // Log the change
      await AuditService.logChange({
        tenantId,
        userId: (req.user as AuthenticatedUser).id,
        action: 'DELETE',
        entityType: 'tenant_logo',
        entityId: tenantId,
        fieldName: 'logoUrl',
        oldValue: 'deleted',
        newValue: undefined,
      });

      res.json({
        success: true,
        message: 'Logo deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PUT /api/tenant/sso-config
 * Update SSO configuration
 * Requires: Super Admin role
 */
router.put('/sso-config',
  authenticateToken,
  requireSuperAdmin,
  async (req, res, next) => {
    try {
      const tenantId = req.tenant?.id;
      if (!tenantId) {
        throw new AppError('Tenant not found', 404, 'TENANT_NOT_FOUND');
      }

      const { provider, config } = req.body;

      // Validate input
      if (provider && typeof provider !== 'string') {
        throw new ValidationError('SSO provider must be a string', 'provider', provider);
      }

      if (config && typeof config !== 'object') {
        throw new ValidationError('SSO config must be an object', 'config', config);
      }

      // Update SSO configuration
      const updatedTenant = await TenantService.updateSSOConfig(tenantId, {
        provider,
        config,
      });

      // Log the changes (without sensitive config details)
      if (provider) {
        await AuditService.logChange({
          tenantId,
          userId: (req.user as AuthenticatedUser).id,
          action: 'UPDATE',
          entityType: 'tenant_sso',
          entityId: tenantId,
          fieldName: 'ssoProvider',
          oldValue: undefined,
          newValue: provider,
        });
      }

      if (config) {
        await AuditService.logChange({
          tenantId,
          userId: (req.user as AuthenticatedUser).id,
          action: 'UPDATE',
          entityType: 'tenant_sso',
          entityId: tenantId,
          fieldName: 'ssoConfig',
          oldValue: undefined,
          newValue: 'updated',
        });
      }

      res.json({
        success: true,
        message: 'SSO configuration updated successfully',
        data: {
          id: updatedTenant.id,
          ssoProvider: updatedTenant.ssoProvider,
          // Don't return sensitive config data
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/tenant/stats
 * Get tenant usage statistics
 * Requires: Admin or Super Admin role
 */
router.get('/stats',
  authenticateToken,
  requireAdmin,
  async (req, res, next) => {
    try {
      const tenantId = req.tenant?.id;
      if (!tenantId) {
        throw new AppError('Tenant not found', 404, 'TENANT_NOT_FOUND');
      }

      const stats = await TenantService.getTenantStats(tenantId);

      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/tenant/usage
 * Get tenant usage analytics
 * Requires: Admin or Super Admin role
 */
router.get('/usage',
  authenticateToken,
  requireAdmin,
  async (req, res, next) => {
    try {
      const tenantId = req.tenant?.id;
      if (!tenantId) {
        throw new AppError('Tenant not found', 404, 'TENANT_NOT_FOUND');
      }

      const days = parseInt(req.query.days as string) || 30;
      
      if (days < 1 || days > 365) {
        throw new ValidationError('Days must be between 1 and 365', 'days', days.toString());
      }

      const usage = await TenantService.getTenantUsage(tenantId, days);

      res.json({
        success: true,
        data: usage,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/tenant/subdomain-suggestions
 * Generate subdomain suggestions based on company name
 * Public endpoint (no auth required)
 */
router.get('/subdomain-suggestions', async (req, res, next) => {
  try {
    const { name } = req.query;

    if (!name || typeof name !== 'string') {
      throw new ValidationError('Company name is required', 'name');
    }

    if (name.length < 2 || name.length > 50) {
      throw new ValidationError('Company name must be between 2 and 50 characters', 'name', name);
    }

    const suggestions = await TenantService.generateSubdomainSuggestions(name);

    res.json({
      success: true,
      data: {
        suggestions,
        baseName: name,
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;