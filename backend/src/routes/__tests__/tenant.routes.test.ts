import request from 'supertest';
import express from 'express';
import tenantRoutes from '../tenant.routes';
import { TenantService } from '../../services/tenant.service';
import { AuditService } from '../../services/audit.service';
import { AppError, ValidationError } from '../../utils/errors';
import { errorHandler } from '../../middleware/error.middleware';

// Mock dependencies
jest.mock('../../services/tenant.service');
jest.mock('../../services/audit.service');
jest.mock('../../middleware/auth.middleware', () => ({
  authMiddleware: (req: any, res: any, next: any) => {
    req.user = { id: 'user-1', role: 'super_admin' };
    next();
  },
}));
jest.mock('../../middleware/authorization.middleware', () => ({
  authorizationMiddleware: (roles: string[]) => (req: any, res: any, next: any) => {
    if (roles.includes(req.user.role)) {
      next();
    } else {
      res.status(403).json({ error: 'Forbidden' });
    }
  },
}));
jest.mock('../../middleware/tenant.middleware', () => ({
  tenantMiddleware: (req: any, res: any, next: any) => {
    req.tenant = { id: 'tenant-1', subdomain: 'test-company' };
    next();
  },
}));

const mockTenantService = TenantService as jest.Mocked<typeof TenantService>;
const mockAuditService = AuditService as jest.Mocked<typeof AuditService>;

// Create test app
const app = express();
app.use(express.json());
app.use('/api/tenant', tenantRoutes);
app.use(errorHandler);

describe('Tenant Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/tenant/settings', () => {
    it('should return tenant settings', async () => {
      const mockTenant = {
        id: 'tenant-1',
        name: 'Test Company',
        subdomain: 'test-company',
        logoUrl: 'https://example.com/logo.png',
        primaryColor: '#FF0000',
        accentColor: '#00FF00',
        subscriptionTier: 'basic',
        userLimit: 100,
        dataRetentionDays: 730,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockTenantService.getTenantById.mockResolvedValue(mockTenant as any);

      const response = await request(app)
        .get('/api/tenant/settings')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: {
          id: mockTenant.id,
          name: mockTenant.name,
          subdomain: mockTenant.subdomain,
          logoUrl: mockTenant.logoUrl,
          primaryColor: mockTenant.primaryColor,
          accentColor: mockTenant.accentColor,
          subscriptionTier: mockTenant.subscriptionTier,
          userLimit: mockTenant.userLimit,
          dataRetentionDays: mockTenant.dataRetentionDays,
          createdAt: mockTenant.createdAt.toISOString(),
          updatedAt: mockTenant.updatedAt.toISOString(),
        },
      });
    });

    it('should return 404 if tenant not found', async () => {
      mockTenantService.getTenantById.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/tenant/settings')
        .expect(404);

      expect(response.body.error).toBe('Tenant not found');
    });
  });

  describe('PUT /api/tenant/branding', () => {
    it('should update tenant branding', async () => {
      const brandingData = {
        primaryColor: '#FF0000',
        accentColor: '#00FF00',
      };

      const mockUpdatedTenant = {
        id: 'tenant-1',
        primaryColor: '#FF0000',
        accentColor: '#00FF00',
        logoUrl: 'https://example.com/logo.png',
      };

      mockTenantService.updateBranding.mockResolvedValue(mockUpdatedTenant as any);
      mockAuditService.logChange.mockResolvedValue(undefined);

      const response = await request(app)
        .put('/api/tenant/branding')
        .send(brandingData)
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        message: 'Branding updated successfully',
        data: {
          id: mockUpdatedTenant.id,
          primaryColor: mockUpdatedTenant.primaryColor,
          accentColor: mockUpdatedTenant.accentColor,
          logoUrl: mockUpdatedTenant.logoUrl,
        },
      });

      expect(mockTenantService.updateBranding).toHaveBeenCalledWith('tenant-1', brandingData);
      expect(mockAuditService.logChange).toHaveBeenCalled();
    });

    it('should validate color input types', async () => {
      const invalidData = {
        primaryColor: 123, // should be string
      };

      const response = await request(app)
        .put('/api/tenant/branding')
        .send(invalidData)
        .expect(400);

      expect(response.body.error).toBe('Primary color must be a string');
      expect(mockTenantService.updateBranding).not.toHaveBeenCalled();
    });

    it('should handle validation errors from service', async () => {
      const brandingData = {
        primaryColor: 'invalid-color',
      };

      mockTenantService.updateBranding.mockRejectedValue(
        new ValidationError('Invalid primary color format. Use hex format like #FF0000', 'primaryColor', 'invalid-color')
      );

      const response = await request(app)
        .put('/api/tenant/branding')
        .send(brandingData)
        .expect(400);

      expect(response.body.error).toBe('Invalid primary color format. Use hex format like #FF0000');
    });
  });

  describe('POST /api/tenant/logo', () => {
    it('should upload tenant logo', async () => {
      const logoUrl = 'https://example.com/new-logo.png';
      
      mockTenantService.uploadLogo.mockResolvedValue(logoUrl);
      mockAuditService.logChange.mockResolvedValue(undefined);

      // Mock multer middleware by adding file to request
      const originalMiddleware = require('../../services/tenant.service').tenantLogoUploadService.createUploadMiddleware;
      jest.spyOn(require('../../services/tenant.service').tenantLogoUploadService, 'createUploadMiddleware')
        .mockImplementation(() => (req: any, res: any, next: any) => {
          req.file = {
            originalname: 'logo.png',
            mimetype: 'image/png',
            size: 1024 * 1024, // 1MB
            buffer: Buffer.from('fake-image-data'),
          };
          next();
        });

      const response = await request(app)
        .post('/api/tenant/logo')
        .attach('logo', Buffer.from('fake-image-data'), 'logo.png')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        message: 'Logo uploaded successfully',
        data: {
          logoUrl,
        },
      });

      expect(mockTenantService.uploadLogo).toHaveBeenCalledWith('tenant-1', expect.any(Object));
      expect(mockAuditService.logChange).toHaveBeenCalled();
    });

    it('should return 400 if no file provided', async () => {
      // Mock multer middleware to not add file
      jest.spyOn(require('../../services/tenant.service').tenantLogoUploadService, 'createUploadMiddleware')
        .mockImplementation(() => (req: any, res: any, next: any) => {
          // No file added
          next();
        });

      const response = await request(app)
        .post('/api/tenant/logo')
        .expect(400);

      expect(response.body.error).toBe('No logo file provided');
      expect(mockTenantService.uploadLogo).not.toHaveBeenCalled();
    });
  });

  describe('DELETE /api/tenant/logo', () => {
    it('should delete tenant logo', async () => {
      mockTenantService.deleteLogo.mockResolvedValue(undefined);
      mockAuditService.logChange.mockResolvedValue(undefined);

      const response = await request(app)
        .delete('/api/tenant/logo')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        message: 'Logo deleted successfully',
      });

      expect(mockTenantService.deleteLogo).toHaveBeenCalledWith('tenant-1');
      expect(mockAuditService.logChange).toHaveBeenCalled();
    });

    it('should handle service errors', async () => {
      mockTenantService.deleteLogo.mockRejectedValue(
        new AppError('No logo to delete', 400, 'NO_LOGO_EXISTS')
      );

      const response = await request(app)
        .delete('/api/tenant/logo')
        .expect(400);

      expect(response.body.error).toBe('No logo to delete');
    });
  });

  describe('PUT /api/tenant/sso-config', () => {
    it('should update SSO configuration', async () => {
      const ssoData = {
        provider: 'azure-ad',
        config: {
          clientId: 'client-123',
          tenantId: 'tenant-456',
        },
      };

      const mockUpdatedTenant = {
        id: 'tenant-1',
        ssoProvider: 'azure-ad',
      };

      mockTenantService.updateSSOConfig.mockResolvedValue(mockUpdatedTenant as any);
      mockAuditService.logChange.mockResolvedValue(undefined);

      const response = await request(app)
        .put('/api/tenant/sso-config')
        .send(ssoData)
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        message: 'SSO configuration updated successfully',
        data: {
          id: mockUpdatedTenant.id,
          ssoProvider: mockUpdatedTenant.ssoProvider,
        },
      });

      expect(mockTenantService.updateSSOConfig).toHaveBeenCalledWith('tenant-1', ssoData);
    });

    it('should validate SSO provider type', async () => {
      const invalidData = {
        provider: 123, // should be string
      };

      const response = await request(app)
        .put('/api/tenant/sso-config')
        .send(invalidData)
        .expect(400);

      expect(response.body.error).toBe('SSO provider must be a string');
    });

    it('should validate SSO config type', async () => {
      const invalidData = {
        config: 'invalid-config', // should be object
      };

      const response = await request(app)
        .put('/api/tenant/sso-config')
        .send(invalidData)
        .expect(400);

      expect(response.body.error).toBe('SSO config must be an object');
    });
  });

  describe('GET /api/tenant/stats', () => {
    it('should return tenant statistics', async () => {
      const mockStats = {
        userCount: 25,
        employeeCount: 30,
        activeUsers: 20,
        userLimit: 100,
        subscriptionTier: 'basic',
        utilizationPercentage: 25,
      };

      mockTenantService.getTenantStats.mockResolvedValue(mockStats);

      const response = await request(app)
        .get('/api/tenant/stats')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: mockStats,
      });

      expect(mockTenantService.getTenantStats).toHaveBeenCalledWith('tenant-1');
    });
  });

  describe('GET /api/tenant/usage', () => {
    it('should return tenant usage analytics', async () => {
      const mockUsage = {
        searchEvents: 100,
        profileViews: 200,
        logins: 50,
        period: '30 days',
      };

      mockTenantService.getTenantUsage.mockResolvedValue(mockUsage);

      const response = await request(app)
        .get('/api/tenant/usage')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: mockUsage,
      });

      expect(mockTenantService.getTenantUsage).toHaveBeenCalledWith('tenant-1', 30);
    });

    it('should accept custom days parameter', async () => {
      const mockUsage = {
        searchEvents: 50,
        profileViews: 100,
        logins: 25,
        period: '7 days',
      };

      mockTenantService.getTenantUsage.mockResolvedValue(mockUsage);

      const response = await request(app)
        .get('/api/tenant/usage?days=7')
        .expect(200);

      expect(mockTenantService.getTenantUsage).toHaveBeenCalledWith('tenant-1', 7);
    });

    it('should validate days parameter range', async () => {
      const response = await request(app)
        .get('/api/tenant/usage?days=400')
        .expect(400);

      expect(response.body.error).toBe('Days must be between 1 and 365');
    });
  });

  describe('GET /api/tenant/subdomain-suggestions', () => {
    it('should generate subdomain suggestions', async () => {
      const mockSuggestions = ['testcompany', 'testcompanyco', 'testcompanyinc'];
      
      mockTenantService.generateSubdomainSuggestions.mockResolvedValue(mockSuggestions);

      const response = await request(app)
        .get('/api/tenant/subdomain-suggestions?name=Test Company')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: {
          suggestions: mockSuggestions,
          baseName: 'Test Company',
        },
      });

      expect(mockTenantService.generateSubdomainSuggestions).toHaveBeenCalledWith('Test Company');
    });

    it('should validate company name parameter', async () => {
      const response = await request(app)
        .get('/api/tenant/subdomain-suggestions')
        .expect(400);

      expect(response.body.error).toBe('Company name is required');
    });

    it('should validate company name length', async () => {
      const response = await request(app)
        .get('/api/tenant/subdomain-suggestions?name=A')
        .expect(400);

      expect(response.body.error).toBe('Company name must be between 2 and 50 characters');
    });
  });
});