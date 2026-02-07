import { prisma } from '../lib/database';
import { clearTenantCache } from '../middleware/tenant.middleware';
import { FileUploadService, UploadConfig } from './file-upload.service';
import { AppError, ValidationError } from '../utils/errors';
import { redisClient } from '../lib/redis';

export interface CreateTenantData {
  name: string;
  subdomain: string;
  subscriptionTier: string;
  userLimit: number;
  ssoProvider?: string;
  ssoConfig?: any;
  logoUrl?: string;
  primaryColor?: string;
  accentColor?: string;
}

export interface UpdateTenantData {
  name?: string;
  logoUrl?: string;
  primaryColor?: string;
  accentColor?: string;
  subscriptionTier?: string;
  userLimit?: number;
  ssoProvider?: string;
  ssoConfig?: any;
  dataRetentionDays?: number;
}

/**
 * Configuration for tenant logo uploads
 */
export const tenantLogoConfig: UploadConfig = {
  maxFileSize: 2 * 1024 * 1024, // 2MB as per requirement 12.1
  allowedMimeTypes: [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/svg+xml',
  ],
  allowedExtensions: ['.jpg', '.jpeg', '.png', '.webp', '.svg'],
  destination: (process.env.UPLOAD_DESTINATION as 'local' | 's3' | 'azure') || 'local',
  s3Config: process.env.AWS_S3_BUCKET ? {
    bucket: process.env.AWS_S3_BUCKET,
    region: process.env.AWS_REGION || 'us-east-1',
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  } : undefined,
  localConfig: {
    uploadPath: process.env.UPLOAD_PATH || 'uploads/tenant-logos',
    baseUrl: process.env.UPLOAD_BASE_URL || '/uploads/tenant-logos',
  },
};

/**
 * File upload service instance for tenant logos
 */
export const tenantLogoUploadService = new FileUploadService(tenantLogoConfig);

/**
 * Service for managing tenant operations
 */
export class TenantService {
  /**
   * Create a new tenant
   */
  static async createTenant(data: CreateTenantData) {
    // Validate subdomain format
    if (!this.isValidSubdomain(data.subdomain)) {
      throw new Error('Invalid subdomain format. Use only lowercase letters, numbers, and hyphens.');
    }

    // Check if subdomain is already taken
    const existingTenant = await prisma.tenant.findUnique({
      where: { subdomain: data.subdomain },
    });

    if (existingTenant) {
      throw new Error(`Subdomain '${data.subdomain}' is already taken`);
    }

    // Create the tenant
    const tenant = await prisma.tenant.create({
      data: {
        name: data.name,
        subdomain: data.subdomain,
        subscriptionTier: data.subscriptionTier,
        userLimit: data.userLimit,
        ssoProvider: data.ssoProvider,
        ssoConfig: data.ssoConfig,
        logoUrl: data.logoUrl,
        primaryColor: data.primaryColor,
        accentColor: data.accentColor,
      },
    });

    return tenant;
  }

  /**
   * Get tenant by ID with Redis caching
   */
  static async getTenantById(tenantId: string) {
    // Try to get from cache first
    const cachedTenant = await redisClient.getTenantConfig(tenantId);
    if (cachedTenant) {
      return cachedTenant;
    }

    // Get from database if not in cache
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    if (tenant) {
      // Cache the tenant configuration
      await redisClient.setTenantConfig(tenantId, tenant);
    }

    return tenant;
  }

  /**
   * Get tenant by subdomain with Redis caching
   */
  static async getTenantBySubdomain(subdomain: string) {
    // Try to get from cache first using subdomain as key
    const cacheKey = `tenant_by_subdomain:${subdomain}`;
    const cachedTenant = await redisClient.get(cacheKey);
    if (cachedTenant) {
      return cachedTenant;
    }

    // Get from database if not in cache
    const tenant = await prisma.tenant.findUnique({
      where: { subdomain },
    });

    if (tenant) {
      // Cache the tenant configuration with both ID and subdomain keys
      await redisClient.setTenantConfig(tenant.id, tenant);
      await redisClient.set(cacheKey, tenant, 3600); // 1 hour TTL
    }

    return tenant;
  }

  /**
   * Update tenant configuration with cache invalidation
   */
  static async updateTenant(tenantId: string, data: UpdateTenantData) {
    const tenant = await prisma.tenant.update({
      where: { id: tenantId },
      data,
    });

    // Clear cache for this tenant
    clearTenantCache(tenantId);
    clearTenantCache(tenant.subdomain);

    // Invalidate Redis cache
    await redisClient.invalidateTenantConfig(tenantId);
    const subdomainCacheKey = `tenant_by_subdomain:${tenant.subdomain}`;
    await redisClient.del(subdomainCacheKey);

    return tenant;
  }

  /**
   * Update tenant branding with cache invalidation
   */
  static async updateBranding(
    tenantId: string,
    branding: {
      logoUrl?: string;
      primaryColor?: string;
      accentColor?: string;
    }
  ) {
    // Validate color formats if provided
    if (branding.primaryColor && !this.isValidHexColor(branding.primaryColor)) {
      throw new ValidationError('Invalid primary color format. Use hex format like #FF0000', 'primaryColor', branding.primaryColor);
    }

    if (branding.accentColor && !this.isValidHexColor(branding.accentColor)) {
      throw new ValidationError('Invalid accent color format. Use hex format like #FF0000', 'accentColor', branding.accentColor);
    }

    return this.updateTenant(tenantId, branding);
  }

  /**
   * Get tenant branding configuration with Redis caching
   */
  static async getTenantBranding(tenantId: string) {
    // Try to get from cache first
    const cachedBranding = await redisClient.getTenantBranding(tenantId);
    if (cachedBranding) {
      return cachedBranding;
    }

    // Get from database if not in cache
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        name: true,
        logoUrl: true,
        primaryColor: true,
        accentColor: true,
        subdomain: true,
      },
    });

    if (tenant) {
      // Cache the branding configuration
      await redisClient.setTenantBranding(tenantId, tenant);
    }

    return tenant;
  }

  /**
   * Upload and update tenant logo
   */
  static async uploadLogo(tenantId: string, file: Express.Multer.File): Promise<string> {
    if (!file) {
      throw new ValidationError('No logo file provided', 'logo');
    }

    // Validate file size (2MB max as per requirement 12.1)
    if (file.size > tenantLogoConfig.maxFileSize) {
      throw new ValidationError(
        `Logo file size exceeds maximum allowed size of ${tenantLogoConfig.maxFileSize / (1024 * 1024)}MB`,
        'logo',
        `${file.size} bytes`
      );
    }

    // Get current tenant to check for existing logo
    const currentTenant = await this.getTenantById(tenantId);
    if (!currentTenant) {
      throw new AppError('Tenant not found', 404, 'TENANT_NOT_FOUND');
    }

    try {
      // Upload new logo
      const uploadResult = await tenantLogoUploadService.uploadFile(file, tenantId);

      // Update tenant with new logo URL
      await this.updateTenant(tenantId, {
        logoUrl: uploadResult.url,
      });

      // Delete old logo if it exists and is different
      if (currentTenant.logoUrl && currentTenant.logoUrl !== uploadResult.url) {
        try {
          await tenantLogoUploadService.deleteFile(currentTenant.logoUrl, uploadResult.key);
        } catch (deleteError) {
          // Log error but don't fail the operation
          console.warn(`Failed to delete old logo: ${(deleteError as Error).message}`);
        }
      }

      return uploadResult.url;
    } catch (error) {
      throw new AppError(
        `Failed to upload tenant logo: ${(error as Error).message}`,
        500,
        'LOGO_UPLOAD_ERROR'
      );
    }
  }

  /**
   * Delete tenant logo
   */
  static async deleteLogo(tenantId: string): Promise<void> {
    const tenant = await this.getTenantById(tenantId);
    if (!tenant) {
      throw new AppError('Tenant not found', 404, 'TENANT_NOT_FOUND');
    }

    if (!tenant.logoUrl) {
      throw new AppError('No logo to delete', 400, 'NO_LOGO_EXISTS');
    }

    try {
      // Delete logo file
      await tenantLogoUploadService.deleteFile(tenant.logoUrl);

      // Update tenant to remove logo URL
      await this.updateTenant(tenantId, {
        logoUrl: undefined,
      });
    } catch (error) {
      throw new AppError(
        `Failed to delete tenant logo: ${(error as Error).message}`,
        500,
        'LOGO_DELETE_ERROR'
      );
    }
  }

  /**
   * Update SSO configuration
   */
  static async updateSSOConfig(
    tenantId: string,
    ssoConfig: {
      provider?: string;
      config?: any;
    }
  ) {
    return this.updateTenant(tenantId, {
      ssoProvider: ssoConfig.provider,
      ssoConfig: ssoConfig.config,
    });
  }

  /**
   * Get tenant statistics
   */
  static async getTenantStats(tenantId: string) {
    const [userCount, employeeCount, activeUsers] = await Promise.all([
      // Total users
      prisma.user.count({
        where: { tenantId },
      }),
      // Total employees
      prisma.employee.count({
        where: { tenantId, isActive: true },
      }),
      // Active users (logged in within last 30 days)
      prisma.user.count({
        where: {
          tenantId,
          lastLoginAt: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          },
        },
      }),
    ]);

    const tenant = await this.getTenantById(tenantId);

    return {
      userCount,
      employeeCount,
      activeUsers,
      userLimit: tenant?.userLimit || 0,
      subscriptionTier: tenant?.subscriptionTier || 'unknown',
      utilizationPercentage: tenant?.userLimit 
        ? Math.round((userCount / tenant.userLimit) * 100)
        : 0,
    };
  }

  /**
   * Check if tenant is at user limit
   */
  static async isAtUserLimit(tenantId: string): Promise<boolean> {
    const tenant = await this.getTenantById(tenantId);
    if (!tenant) {
      throw new Error('Tenant not found');
    }

    const userCount = await prisma.user.count({
      where: { tenantId, isActive: true },
    });

    return userCount >= tenant.userLimit;
  }

  /**
   * Check if tenant can add more users with detailed response
   */
  static async checkUserLimit(tenantId: string) {
    const tenant = await this.getTenantById(tenantId);
    if (!tenant) {
      throw new Error('Tenant not found');
    }

    const userCount = await prisma.user.count({
      where: { tenantId, isActive: true },
    });

    const canAdd = userCount < tenant.userLimit;
    const usagePercentage = Math.round((userCount / tenant.userLimit) * 100);

    return {
      canAdd,
      currentCount: userCount,
      limit: tenant.userLimit,
      usagePercentage,
      subscriptionTier: tenant.subscriptionTier,
      isNearLimit: usagePercentage >= 80,
      upgradeRequired: !canAdd,
      message: !canAdd 
        ? `User limit reached. Your ${tenant.subscriptionTier} plan allows up to ${tenant.userLimit} users. Please upgrade your subscription to add more users.`
        : usagePercentage >= 80 
        ? `You are using ${usagePercentage}% of your user limit. Consider upgrading soon.`
        : undefined,
    };
  }

  /**
   * Get tenant usage analytics
   */
  static async getTenantUsage(tenantId: string, days: number = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const [searchEvents, profileViews, logins] = await Promise.all([
      // Search events
      prisma.analyticsEvent.count({
        where: {
          tenantId,
          eventType: 'search',
          createdAt: { gte: startDate },
        },
      }),
      // Profile views
      prisma.analyticsEvent.count({
        where: {
          tenantId,
          eventType: 'profile_view',
          createdAt: { gte: startDate },
        },
      }),
      // Login events (from audit logs)
      prisma.auditLog.count({
        where: {
          tenantId,
          action: 'LOGIN',
          createdAt: { gte: startDate },
        },
      }),
    ]);

    return {
      searchEvents,
      profileViews,
      logins,
      period: `${days} days`,
    };
  }

  /**
   * List all tenants (admin function)
   */
  static async listTenants(params: {
    page?: number;
    pageSize?: number;
    search?: string;
  } = {}) {
    const { page = 1, pageSize = 20, search } = params;

    const where: any = {};
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { subdomain: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [tenants, total] = await Promise.all([
      prisma.tenant.findMany({
        where,
        select: {
          id: true,
          name: true,
          subdomain: true,
          subscriptionTier: true,
          userLimit: true,
          createdAt: true,
          _count: {
            select: {
              users: true,
              employees: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.tenant.count({ where }),
    ]);

    return {
      tenants,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  /**
   * Delete tenant (admin function - use with caution)
   */
  static async deleteTenant(tenantId: string) {
    // This is a destructive operation - all tenant data will be deleted
    // due to foreign key constraints
    
    const tenant = await prisma.tenant.delete({
      where: { id: tenantId },
    });

    // Clear cache
    clearTenantCache(tenantId);
    clearTenantCache(tenant.subdomain);

    return tenant;
  }

  /**
   * Validate subdomain format
   */
  private static isValidSubdomain(subdomain: string): boolean {
    // Subdomain rules:
    // - 3-63 characters
    // - Only lowercase letters, numbers, and hyphens
    // - Cannot start or end with hyphen
    // - Cannot contain consecutive hyphens
    const subdomainRegex = /^[a-z0-9]([a-z0-9-]{1,61}[a-z0-9])?$/;
    
    // Reserved subdomains
    const reserved = [
      'www', 'api', 'admin', 'app', 'mail', 'ftp', 'localhost',
      'staging', 'dev', 'test', 'demo', 'support', 'help',
      'blog', 'docs', 'status', 'cdn', 'assets', 'static'
    ];

    return subdomainRegex.test(subdomain) && !reserved.includes(subdomain);
  }

  /**
   * Validate hex color format
   */
  private static isValidHexColor(color: string): boolean {
    const hexColorRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
    return hexColorRegex.test(color);
  }

  /**
   * Generate available subdomain suggestions
   */
  static async generateSubdomainSuggestions(baseName: string): Promise<string[]> {
    const suggestions: string[] = [];
    const cleanBase = baseName
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .substring(0, 20);

    // Try the base name first
    if (this.isValidSubdomain(cleanBase)) {
      const exists = await this.getTenantBySubdomain(cleanBase);
      if (!exists) {
        suggestions.push(cleanBase);
      }
    }

    // Generate variations
    const variations = [
      `${cleanBase}co`,
      `${cleanBase}inc`,
      `${cleanBase}ltd`,
      `${cleanBase}corp`,
      `${cleanBase}team`,
      `${cleanBase}group`,
    ];

    for (const variation of variations) {
      if (suggestions.length >= 5) break;
      
      if (this.isValidSubdomain(variation)) {
        const exists = await this.getTenantBySubdomain(variation);
        if (!exists) {
          suggestions.push(variation);
        }
      }
    }

    // Add numbered variations if needed
    for (let i = 1; suggestions.length < 5 && i <= 99; i++) {
      const numbered = `${cleanBase}${i}`;
      if (this.isValidSubdomain(numbered)) {
        const exists = await this.getTenantBySubdomain(numbered);
        if (!exists) {
          suggestions.push(numbered);
        }
      }
    }

    return suggestions;
  }
}