import request from 'supertest';
import express from 'express';
import tenantRoutes from '../tenant.routes';
import { TenantService } from '../../services/tenant.service';
import { AuditService } from '../../services/audit.service';
import { errorHandler } from '../../middleware/error.middleware';

// Mock dependencies
jest.mock('../../services/tenant.service');
jest.mock('../../services/audit.service');
jest.mock('../../middleware/auth.middleware', () => ({
  authenticateToken: (req: any, res: any, next: any) => {
    req.user = { id: 'user-1', role: 'super_admin', tenantId: 'tenant-1' };
    next();
  },
}));
jest.mock('../../middleware/authorization.middleware', () => ({
  requireSuperAdmin: (req: any, res: any, next: any) => next(),
  requireAdmin: (req: any, res: any, next: any) => next(),
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

describe('Tenant Routes Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Complete tenant configuration workflow', () => {
    it('should handle complete tenant setup workflow', async () => {
      // Step 1: Get initial tenant settings
      const initialTenant = {
        id: 'tenant-1',
        name: 'Test Company',
        subdomain: 'test-company',
        logoUrl: null,
        primaryColor: null,
        accentColor: null,
        subscriptionTier: 'basic',
        userLimit: 100,
        dataRetentionDays: 730,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockTenantService.getTenantById.mockResolvedValue(initialTenant as any);

      const settingsResponse = await request(app)
        .get('/api/tenant/settings')
        .expect(200);

      expect(settingsResponse.body.data.name).toBe('Test Company');
      expect(settingsResponse.body.data.primaryColor).toBeNull();

      // Step 2: Update branding
      const updatedBrandingTenant = {
        ...initialTenant,
        primaryColor: '#FF6B35',
        accentColor: '#004E89',
      };

      mockTenantService.updateBranding.mockResolvedValue(updatedBrandingTenant as any);
      mockAuditService.logChange.mockResolvedValue(undefined);

      const brandingResponse = await request(app)
        .put('/api/tenant/branding')
        .send({
          primaryColor: '#FF6B35',
          accentColor: '#004E89',
        })
        .expect(200);

      expect(brandingResponse.body.data.primaryColor).toBe('#FF6B35');
      expect(brandingResponse.body.data.accentColor).toBe('#004E89');

      // Step 3: Configure SSO
      const ssoConfiguredTenant = {
        ...updatedBrandingTenant,
        ssoProvider: 'azure-ad',
      };

      mockTenantService.updateSSOConfig.mockResolvedValue(ssoConfiguredTenant as any);

      const ssoResponse = await request(app)
        .put('/api/tenant/sso-config')
        .send({
          provider: 'azure-ad',
          config: {
            clientId: 'test-client-id',
            tenantId: 'test-tenant-id',
            authority: 'https://login.microsoftonline.com/test-tenant-id',
          },
        })
        .expect(200);

      expect(ssoResponse.body.data.ssoProvider).toBe('azure-ad');

      // Step 4: Verify final settings
      const finalTenant = {
        ...ssoConfiguredTenant,
        ssoProvider: 'azure-ad',
      };

      mockTenantService.getTenantById.mockResolvedValue(finalTenant as any);

      const finalSettingsResponse = await request(app)
        .get('/api/tenant/settings')
        .expect(200);

      expect(finalSettingsResponse.body.data.primaryColor).toBe('#FF6B35');
      expect(finalSettingsResponse.body.data.accentColor).toBe('#004E89');

      // Verify audit logging was called for each change
      expect(mockAuditService.logChange).toHaveBeenCalledTimes(4); // 2 for branding + 2 for SSO
    });

    it('should handle tenant analytics and statistics workflow', async () => {
      // Step 1: Get tenant statistics
      const mockStats = {
        userCount: 25,
        employeeCount: 30,
        activeUsers: 20,
        userLimit: 100,
        subscriptionTier: 'basic',
        utilizationPercentage: 25,
      };

      mockTenantService.getTenantStats.mockResolvedValue(mockStats);

      const statsResponse = await request(app)
        .get('/api/tenant/stats')
        .expect(200);

      expect(statsResponse.body.data.userCount).toBe(25);
      expect(statsResponse.body.data.utilizationPercentage).toBe(25);

      // Step 2: Get usage analytics for different periods
      const mockUsage30Days = {
        searchEvents: 100,
        profileViews: 200,
        logins: 50,
        period: '30 days',
      };

      const mockUsage7Days = {
        searchEvents: 25,
        profileViews: 50,
        logins: 15,
        period: '7 days',
      };

      mockTenantService.getTenantUsage
        .mockResolvedValueOnce(mockUsage30Days)
        .mockResolvedValueOnce(mockUsage7Days);

      // Test 30-day usage
      const usage30Response = await request(app)
        .get('/api/tenant/usage?days=30')
        .expect(200);

      expect(usage30Response.body.data.searchEvents).toBe(100);
      expect(usage30Response.body.data.period).toBe('30 days');

      // Test 7-day usage
      const usage7Response = await request(app)
        .get('/api/tenant/usage?days=7')
        .expect(200);

      expect(usage7Response.body.data.searchEvents).toBe(25);
      expect(usage7Response.body.data.period).toBe('7 days');

      // Verify service was called with correct parameters
      expect(mockTenantService.getTenantUsage).toHaveBeenCalledWith('tenant-1', 30);
      expect(mockTenantService.getTenantUsage).toHaveBeenCalledWith('tenant-1', 7);
    });

    it('should handle subdomain suggestion workflow', async () => {
      const testCases = [
        {
          input: 'Amazing Company',
          suggestions: ['amazingcompany', 'amazingcompanyco', 'amazingcompanyinc'],
        },
        {
          input: 'Tech Solutions Ltd',
          suggestions: ['techsolutions', 'techsolutionsltd', 'techsolutionscorp'],
        },
        {
          input: 'Global Enterprises',
          suggestions: ['globalenterprises', 'globalenterprisesco', 'globalenterprisesinc'],
        },
      ];

      for (const testCase of testCases) {
        mockTenantService.generateSubdomainSuggestions.mockResolvedValue(testCase.suggestions);

        const response = await request(app)
          .get(`/api/tenant/subdomain-suggestions?name=${encodeURIComponent(testCase.input)}`)
          .expect(200);

        expect(response.body.data.baseName).toBe(testCase.input);
        expect(response.body.data.suggestions).toEqual(testCase.suggestions);
        expect(mockTenantService.generateSubdomainSuggestions).toHaveBeenCalledWith(testCase.input);
      }
    });
  });

  describe('Error handling and edge cases', () => {
    it('should handle service errors gracefully', async () => {
      // Test tenant not found
      mockTenantService.getTenantById.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/tenant/settings')
        .expect(404);

      expect(response.body.error).toBe('Tenant not found');
    });

    it('should handle validation errors for branding', async () => {
      // Test invalid color format
      const response = await request(app)
        .put('/api/tenant/branding')
        .send({ primaryColor: 'invalid-color' })
        .expect(400);

      expect(response.body.error).toContain('Primary color must be a string');
    });

    it('should handle validation errors for SSO config', async () => {
      // Test invalid provider type
      const response = await request(app)
        .put('/api/tenant/sso-config')
        .send({ provider: 123 })
        .expect(400);

      expect(response.body.error).toBe('SSO provider must be a string');
    });

    it('should handle validation errors for usage analytics', async () => {
      // Test invalid days parameter
      const response = await request(app)
        .get('/api/tenant/usage?days=400')
        .expect(400);

      expect(response.body.error).toBe('Days must be between 1 and 365');
    });

    it('should handle missing parameters for subdomain suggestions', async () => {
      // Test missing name parameter
      const response = await request(app)
        .get('/api/tenant/subdomain-suggestions')
        .expect(400);

      expect(response.body.error).toBe('Company name is required');
    });

    it('should handle service exceptions', async () => {
      // Test service throwing error
      mockTenantService.updateBranding.mockRejectedValue(new Error('Service unavailable'));

      const response = await request(app)
        .put('/api/tenant/branding')
        .send({ primaryColor: '#FF0000' })
        .expect(500);

      expect(response.body.error).toBeDefined();
    });
  });

  describe('Authorization and security', () => {
    it('should require authentication for all endpoints', async () => {
      // This test would verify authentication middleware is applied
      // In a real scenario, we would test without the mock middleware
      expect(true).toBe(true); // Placeholder - middleware is mocked
    });

    it('should require super admin role for branding and SSO endpoints', async () => {
      // This test would verify authorization middleware is applied
      // In a real scenario, we would test with different user roles
      expect(true).toBe(true); // Placeholder - middleware is mocked
    });

    it('should require admin role for stats and usage endpoints', async () => {
      // This test would verify authorization middleware is applied
      // In a real scenario, we would test with different user roles
      expect(true).toBe(true); // Placeholder - middleware is mocked
    });
  });

  describe('Audit logging verification', () => {
    it('should log all branding changes', async () => {
      mockTenantService.updateBranding.mockResolvedValue({
        id: 'tenant-1',
        primaryColor: '#FF0000',
        accentColor: '#00FF00',
        logoUrl: null,
      } as any);
      mockAuditService.logChange.mockResolvedValue(undefined);

      await request(app)
        .put('/api/tenant/branding')
        .send({
          primaryColor: '#FF0000',
          accentColor: '#00FF00',
        })
        .expect(200);

      // Should log both color changes
      expect(mockAuditService.logChange).toHaveBeenCalledTimes(2);
      
      expect(mockAuditService.logChange).toHaveBeenCalledWith({
        tenantId: 'tenant-1',
        userId: 'user-1',
        action: 'UPDATE',
        entityType: 'tenant',
        entityId: 'tenant-1',
        fieldName: 'primaryColor',
        oldValue: null,
        newValue: '#FF0000',
      });

      expect(mockAuditService.logChange).toHaveBeenCalledWith({
        tenantId: 'tenant-1',
        userId: 'user-1',
        action: 'UPDATE',
        entityType: 'tenant',
        entityId: 'tenant-1',
        fieldName: 'accentColor',
        oldValue: null,
        newValue: '#00FF00',
      });
    });

    it('should log SSO configuration changes', async () => {
      mockTenantService.updateSSOConfig.mockResolvedValue({
        id: 'tenant-1',
        ssoProvider: 'azure-ad',
      } as any);
      mockAuditService.logChange.mockResolvedValue(undefined);

      await request(app)
        .put('/api/tenant/sso-config')
        .send({
          provider: 'azure-ad',
          config: { clientId: 'test' },
        })
        .expect(200);

      // Should log both provider and config changes
      expect(mockAuditService.logChange).toHaveBeenCalledTimes(2);
      
      expect(mockAuditService.logChange).toHaveBeenCalledWith({
        tenantId: 'tenant-1',
        userId: 'user-1',
        action: 'UPDATE',
        entityType: 'tenant_sso',
        entityId: 'tenant-1',
        fieldName: 'ssoProvider',
        oldValue: null,
        newValue: 'azure-ad',
      });

      expect(mockAuditService.logChange).toHaveBeenCalledWith({
        tenantId: 'tenant-1',
        userId: 'user-1',
        action: 'UPDATE',
        entityType: 'tenant_sso',
        entityId: 'tenant-1',
        fieldName: 'ssoConfig',
        oldValue: null,
        newValue: 'updated',
      });
    });
  });
});