import { TenantService, CreateTenantData, UpdateTenantData } from '../tenant.service';
import { prisma } from '../../lib/database';
import { clearTenantCache } from '../../middleware/tenant.middleware';
import { AppError, ValidationError } from '../../utils/errors';

// Mock dependencies
jest.mock('../../lib/database', () => ({
  prisma: {
    tenant: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    user: {
      count: jest.fn(),
    },
    employee: {
      count: jest.fn(),
    },
    analyticsEvent: {
      count: jest.fn(),
    },
    auditLog: {
      count: jest.fn(),
    },
  },
}));

jest.mock('../../middleware/tenant.middleware', () => ({
  clearTenantCache: jest.fn(),
}));

const mockPrisma = prisma as jest.Mocked<typeof prisma>;
const mockClearTenantCache = clearTenantCache as jest.MockedFunction<typeof clearTenantCache>;

describe('TenantService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createTenant', () => {
    const validTenantData: CreateTenantData = {
      name: 'Test Company',
      subdomain: 'test-company',
      subscriptionTier: 'basic',
      userLimit: 100,
      primaryColor: '#FF0000',
      accentColor: '#00FF00',
    };

    it('should create a tenant successfully', async () => {
      const mockTenant = {
        id: 'tenant-1',
        ...validTenantData,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.tenant.findUnique.mockResolvedValue(null);
      mockPrisma.tenant.create.mockResolvedValue(mockTenant);

      const result = await TenantService.createTenant(validTenantData);

      expect(mockPrisma.tenant.findUnique).toHaveBeenCalledWith({
        where: { subdomain: 'test-company' },
      });
      expect(mockPrisma.tenant.create).toHaveBeenCalledWith({
        data: validTenantData,
      });
      expect(result).toEqual(mockTenant);
    });

    it('should throw error for invalid subdomain format', async () => {
      const invalidData = {
        ...validTenantData,
        subdomain: 'Invalid_Subdomain!',
      };

      await expect(TenantService.createTenant(invalidData)).rejects.toThrow(
        'Invalid subdomain format. Use only lowercase letters, numbers, and hyphens.'
      );

      expect(mockPrisma.tenant.findUnique).not.toHaveBeenCalled();
      expect(mockPrisma.tenant.create).not.toHaveBeenCalled();
    });

    it('should throw error for reserved subdomain', async () => {
      const reservedData = {
        ...validTenantData,
        subdomain: 'admin',
      };

      await expect(TenantService.createTenant(reservedData)).rejects.toThrow(
        'Invalid subdomain format. Use only lowercase letters, numbers, and hyphens.'
      );
    });

    it('should throw error if subdomain already exists', async () => {
      const existingTenant = { id: 'existing-tenant', subdomain: 'test-company' };
      mockPrisma.tenant.findUnique.mockResolvedValue(existingTenant as any);

      await expect(TenantService.createTenant(validTenantData)).rejects.toThrow(
        "Subdomain 'test-company' is already taken"
      );

      expect(mockPrisma.tenant.create).not.toHaveBeenCalled();
    });
  });

  describe('getTenantById', () => {
    it('should return tenant by ID', async () => {
      const mockTenant = {
        id: 'tenant-1',
        name: 'Test Company',
        subdomain: 'test-company',
      };

      mockPrisma.tenant.findUnique.mockResolvedValue(mockTenant as any);

      const result = await TenantService.getTenantById('tenant-1');

      expect(mockPrisma.tenant.findUnique).toHaveBeenCalledWith({
        where: { id: 'tenant-1' },
      });
      expect(result).toEqual(mockTenant);
    });

    it('should return null if tenant not found', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue(null);

      const result = await TenantService.getTenantById('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('getTenantBySubdomain', () => {
    it('should return tenant by subdomain', async () => {
      const mockTenant = {
        id: 'tenant-1',
        name: 'Test Company',
        subdomain: 'test-company',
      };

      mockPrisma.tenant.findUnique.mockResolvedValue(mockTenant as any);

      const result = await TenantService.getTenantBySubdomain('test-company');

      expect(mockPrisma.tenant.findUnique).toHaveBeenCalledWith({
        where: { subdomain: 'test-company' },
      });
      expect(result).toEqual(mockTenant);
    });
  });

  describe('updateTenant', () => {
    it('should update tenant successfully', async () => {
      const updateData: UpdateTenantData = {
        name: 'Updated Company',
        primaryColor: '#0000FF',
      };

      const mockUpdatedTenant = {
        id: 'tenant-1',
        subdomain: 'test-company',
        ...updateData,
      };

      mockPrisma.tenant.update.mockResolvedValue(mockUpdatedTenant as any);

      const result = await TenantService.updateTenant('tenant-1', updateData);

      expect(mockPrisma.tenant.update).toHaveBeenCalledWith({
        where: { id: 'tenant-1' },
        data: updateData,
      });
      expect(mockClearTenantCache).toHaveBeenCalledWith('tenant-1');
      expect(mockClearTenantCache).toHaveBeenCalledWith('test-company');
      expect(result).toEqual(mockUpdatedTenant);
    });
  });

  describe('updateBranding', () => {
    it('should update branding with valid colors', async () => {
      const brandingData = {
        logoUrl: 'https://example.com/logo.png',
        primaryColor: '#FF0000',
        accentColor: '#00FF00',
      };

      const mockUpdatedTenant = {
        id: 'tenant-1',
        subdomain: 'test-company',
        ...brandingData,
      };

      mockPrisma.tenant.update.mockResolvedValue(mockUpdatedTenant as any);

      const result = await TenantService.updateBranding('tenant-1', brandingData);

      expect(mockPrisma.tenant.update).toHaveBeenCalledWith({
        where: { id: 'tenant-1' },
        data: brandingData,
      });
      expect(result).toEqual(mockUpdatedTenant);
    });

    it('should throw ValidationError for invalid primary color', async () => {
      const brandingData = {
        primaryColor: 'invalid-color',
      };

      await expect(TenantService.updateBranding('tenant-1', brandingData)).rejects.toThrow(
        ValidationError
      );
      await expect(TenantService.updateBranding('tenant-1', brandingData)).rejects.toThrow(
        'Invalid primary color format. Use hex format like #FF0000'
      );

      expect(mockPrisma.tenant.update).not.toHaveBeenCalled();
    });

    it('should throw ValidationError for invalid accent color', async () => {
      const brandingData = {
        accentColor: 'rgb(255, 0, 0)',
      };

      await expect(TenantService.updateBranding('tenant-1', brandingData)).rejects.toThrow(
        ValidationError
      );
      await expect(TenantService.updateBranding('tenant-1', brandingData)).rejects.toThrow(
        'Invalid accent color format. Use hex format like #FF0000'
      );
    });
  });

  describe('updateSSOConfig', () => {
    it('should update SSO configuration', async () => {
      const ssoConfig = {
        provider: 'azure-ad',
        config: {
          clientId: 'client-123',
          tenantId: 'tenant-456',
        },
      };

      const mockUpdatedTenant = {
        id: 'tenant-1',
        ssoProvider: 'azure-ad',
        ssoConfig: ssoConfig.config,
      };

      mockPrisma.tenant.update.mockResolvedValue(mockUpdatedTenant as any);

      const result = await TenantService.updateSSOConfig('tenant-1', ssoConfig);

      expect(mockPrisma.tenant.update).toHaveBeenCalledWith({
        where: { id: 'tenant-1' },
        data: {
          ssoProvider: 'azure-ad',
          ssoConfig: ssoConfig.config,
        },
      });
      expect(result).toEqual(mockUpdatedTenant);
    });
  });

  describe('getTenantStats', () => {
    it('should return tenant statistics', async () => {
      const mockTenant = {
        id: 'tenant-1',
        userLimit: 100,
        subscriptionTier: 'basic',
      };

      mockPrisma.tenant.findUnique.mockResolvedValue(mockTenant as any);
      mockPrisma.user.count.mockResolvedValueOnce(25); // Total users
      mockPrisma.employee.count.mockResolvedValue(30); // Total employees
      mockPrisma.user.count.mockResolvedValueOnce(20); // Active users

      const result = await TenantService.getTenantStats('tenant-1');

      expect(result).toEqual({
        userCount: 25,
        employeeCount: 30,
        activeUsers: 20,
        userLimit: 100,
        subscriptionTier: 'basic',
        utilizationPercentage: 25,
      });

      expect(mockPrisma.user.count).toHaveBeenCalledTimes(2);
      expect(mockPrisma.employee.count).toHaveBeenCalledWith({
        where: { tenantId: 'tenant-1', isActive: true },
      });
    });
  });

  describe('isAtUserLimit', () => {
    it('should return false when under user limit', async () => {
      const mockTenant = {
        id: 'tenant-1',
        userLimit: 100,
      };

      mockPrisma.tenant.findUnique.mockResolvedValue(mockTenant as any);
      mockPrisma.user.count.mockResolvedValue(50);

      const result = await TenantService.isAtUserLimit('tenant-1');

      expect(result).toBe(false);
    });

    it('should return true when at user limit', async () => {
      const mockTenant = {
        id: 'tenant-1',
        userLimit: 100,
      };

      mockPrisma.tenant.findUnique.mockResolvedValue(mockTenant as any);
      mockPrisma.user.count.mockResolvedValue(100);

      const result = await TenantService.isAtUserLimit('tenant-1');

      expect(result).toBe(true);
    });

    it('should return true when over user limit', async () => {
      const mockTenant = {
        id: 'tenant-1',
        userLimit: 100,
      };

      mockPrisma.tenant.findUnique.mockResolvedValue(mockTenant as any);
      mockPrisma.user.count.mockResolvedValue(150);

      const result = await TenantService.isAtUserLimit('tenant-1');

      expect(result).toBe(true);
    });

    it('should throw error if tenant not found', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue(null);

      await expect(TenantService.isAtUserLimit('non-existent')).rejects.toThrow(
        'Tenant not found'
      );
    });
  });

  describe('getTenantUsage', () => {
    it('should return tenant usage analytics', async () => {
      const tenantId = 'tenant-1';
      const days = 30;

      mockPrisma.analyticsEvent.count
        .mockResolvedValueOnce(100) // search events
        .mockResolvedValueOnce(200); // profile views
      mockPrisma.auditLog.count.mockResolvedValue(50); // logins

      const result = await TenantService.getTenantUsage(tenantId, days);

      expect(result).toEqual({
        searchEvents: 100,
        profileViews: 200,
        logins: 50,
        period: '30 days',
      });

      expect(mockPrisma.analyticsEvent.count).toHaveBeenCalledTimes(2);
      expect(mockPrisma.auditLog.count).toHaveBeenCalledTimes(1);
    });
  });

  describe('listTenants', () => {
    it('should list tenants with pagination', async () => {
      const mockTenants = [
        {
          id: 'tenant-1',
          name: 'Company 1',
          subdomain: 'company1',
          subscriptionTier: 'basic',
          userLimit: 100,
          createdAt: new Date(),
          _count: { users: 25, employees: 30 },
        },
        {
          id: 'tenant-2',
          name: 'Company 2',
          subdomain: 'company2',
          subscriptionTier: 'premium',
          userLimit: 500,
          createdAt: new Date(),
          _count: { users: 150, employees: 200 },
        },
      ];

      mockPrisma.tenant.findMany.mockResolvedValue(mockTenants as any);
      mockPrisma.tenant.count.mockResolvedValue(2);

      const result = await TenantService.listTenants({ page: 1, pageSize: 20 });

      expect(result).toEqual({
        tenants: mockTenants,
        pagination: {
          page: 1,
          pageSize: 20,
          total: 2,
          totalPages: 1,
        },
      });
    });

    it('should filter tenants by search term', async () => {
      const searchTerm = 'test';
      
      mockPrisma.tenant.findMany.mockResolvedValue([]);
      mockPrisma.tenant.count.mockResolvedValue(0);

      await TenantService.listTenants({ search: searchTerm });

      expect(mockPrisma.tenant.findMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { name: { contains: searchTerm, mode: 'insensitive' } },
            { subdomain: { contains: searchTerm, mode: 'insensitive' } },
          ],
        },
        select: expect.any(Object),
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: 20,
      });
    });
  });

  describe('deleteTenant', () => {
    it('should delete tenant and clear cache', async () => {
      const mockTenant = {
        id: 'tenant-1',
        subdomain: 'test-company',
      };

      mockPrisma.tenant.delete.mockResolvedValue(mockTenant as any);

      const result = await TenantService.deleteTenant('tenant-1');

      expect(mockPrisma.tenant.delete).toHaveBeenCalledWith({
        where: { id: 'tenant-1' },
      });
      expect(mockClearTenantCache).toHaveBeenCalledWith('tenant-1');
      expect(mockClearTenantCache).toHaveBeenCalledWith('test-company');
      expect(result).toEqual(mockTenant);
    });
  });

  describe('generateSubdomainSuggestions', () => {
    it('should generate subdomain suggestions', async () => {
      const baseName = 'Test Company';
      
      // Mock that all suggested subdomains are available
      mockPrisma.tenant.findUnique.mockResolvedValue(null);

      const result = await TenantService.generateSubdomainSuggestions(baseName);

      expect(result).toBeInstanceOf(Array);
      expect(result.length).toBeGreaterThan(0);
      expect(result[0]).toBe('testcompany');
    });

    it('should skip existing subdomains', async () => {
      const baseName = 'Test Company';
      
      // Mock that the base subdomain exists
      mockPrisma.tenant.findUnique
        .mockResolvedValueOnce({ id: 'existing' } as any) // testcompany exists
        .mockResolvedValue(null); // other suggestions are available

      const result = await TenantService.generateSubdomainSuggestions(baseName);

      expect(result).toBeInstanceOf(Array);
      expect(result).not.toContain('testcompany');
    });
  });

  describe('subdomain validation', () => {
    it('should validate correct subdomain formats', () => {
      const validSubdomains = [
        'test',
        'test-company',
        'company123',
        'a1b2c3',
        'my-awesome-company',
      ];

      validSubdomains.forEach(subdomain => {
        expect(() => {
          // Access private method through any cast for testing
          (TenantService as any).isValidSubdomain(subdomain);
        }).not.toThrow();
      });
    });

    it('should reject invalid subdomain formats', () => {
      const invalidSubdomains = [
        'ab', // too short
        'Test', // uppercase
        'test_company', // underscore
        'test.company', // dot
        '-test', // starts with hyphen
        'test-', // ends with hyphen
        'test--company', // consecutive hyphens
        'www', // reserved
        'admin', // reserved
      ];

      invalidSubdomains.forEach(subdomain => {
        const isValid = (TenantService as any).isValidSubdomain(subdomain);
        expect(isValid).toBe(false);
      });
    });
  });

  describe('color validation', () => {
    it('should validate correct hex color formats', () => {
      const validColors = ['#FF0000', '#00ff00', '#123', '#ABC', '#123456'];

      validColors.forEach(color => {
        const isValid = (TenantService as any).isValidHexColor(color);
        expect(isValid).toBe(true);
      });
    });

    it('should reject invalid hex color formats', () => {
      const invalidColors = [
        'FF0000', // missing #
        '#GG0000', // invalid hex characters
        '#12345', // wrong length
        'rgb(255,0,0)', // not hex format
        '#1234567', // too long
      ];

      invalidColors.forEach(color => {
        const isValid = (TenantService as any).isValidHexColor(color);
        expect(isValid).toBe(false);
      });
    });
  });
});