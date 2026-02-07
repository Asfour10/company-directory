import { Request, Response, NextFunction } from 'express';
import { prisma, setTenantContext } from '../lib/database';
import jwt from 'jsonwebtoken';
import { Logger } from '../lib/logger';
import { 
  TenantNotFoundError, 
  TenantInactiveError,
  DatabaseError,
  TenantErrorHandler,
  formatErrorResponse
} from '../utils/errors';

interface TenantCache {
  [key: string]: {
    tenant: any;
    timestamp: number;
  };
}

// In-memory cache for tenant data (5 minute TTL)
const tenantCache: TenantCache = {};
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Middleware to extract and validate tenant information
 * Supports extraction from:
 * 1. Subdomain (company.directory-platform.com)
 * 2. JWT token claims
 * 3. Custom header (for development/testing)
 */
export const tenantMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    let tenantIdentifier: string | null = null;
    let extractionMethod = '';

    // Method 1: Extract from subdomain
    const host = req.get('host') || '';
    const subdomain = extractSubdomainFromHost(host);
    
    if (subdomain && subdomain !== 'www' && subdomain !== 'api') {
      tenantIdentifier = subdomain;
      extractionMethod = 'subdomain';
    }

    // Method 2: Extract from JWT token (if Authorization header present)
    if (!tenantIdentifier) {
      const authHeader = req.get('Authorization');
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        try {
          const decoded = jwt.decode(token) as any;
          if (decoded && decoded.tenantId) {
            tenantIdentifier = decoded.tenantId;
            extractionMethod = 'jwt';
          }
        } catch (error) {
          // JWT decode failed, continue with other methods
        }
      }
    }

    // Method 3: Extract from custom header (for development/testing)
    if (!tenantIdentifier) {
      const headerTenant = req.get('X-Tenant-ID');
      if (headerTenant) {
        tenantIdentifier = headerTenant;
        extractionMethod = 'header';
      }
    }

    // If no tenant identifier found, return 404
    if (!tenantIdentifier) {
      const error = new TenantNotFoundError();
      const errorResponse = formatErrorResponse(error, req.path);
      res.status(error.statusCode).json(errorResponse);
      return;
    }

    // Validate tenant identifier format
    if (!isValidTenantIdentifier(tenantIdentifier, extractionMethod)) {
      const error = new TenantNotFoundError(tenantIdentifier);
      const errorResponse = formatErrorResponse(error, req.path);
      res.status(error.statusCode).json(errorResponse);
      return;
    }

    // Load tenant configuration (with caching)
    const tenant = await loadTenantWithCache(tenantIdentifier, extractionMethod);

    if (!tenant) {
      const error = new TenantNotFoundError(tenantIdentifier);
      const errorResponse = formatErrorResponse(error, req.path);
      res.status(error.statusCode).json(errorResponse);
      return;
    }

    // Check if tenant is active (if we add an isActive field later)
    if (tenant.isActive === false) {
      const error = new TenantInactiveError(tenant.name);
      const errorResponse = formatErrorResponse(error, req.path);
      res.status(error.statusCode).json(errorResponse);
      return;
    }

    // Set tenant context for Row-Level Security
    await setTenantContext(tenant.id);

    // Add tenant information to request object
    req.tenant = tenant;
    req.tenantId = tenant.id;

    // Add tenant info to response headers (for debugging)
    if (process.env.NODE_ENV === 'development') {
      res.set('X-Tenant-ID', tenant.id);
      res.set('X-Tenant-Subdomain', tenant.subdomain);
      res.set('X-Extraction-Method', extractionMethod);
    }

    next();
  } catch (error) {
    Logger.error('Tenant extraction error', {
      error: (error as Error).message,
      path: req.path,
      method: req.method,
      headers: {
        host: req.get('host'),
        authorization: req.get('Authorization') ? '[REDACTED]' : undefined,
        'x-tenant-id': req.get('X-Tenant-ID'),
      },
    });

    const appError = TenantErrorHandler.handleExtractionError(error);
    const errorResponse = formatErrorResponse(appError, req.path);
    res.status(appError.statusCode).json(errorResponse);
  }
};

/**
 * Validate tenant identifier format based on extraction method
 */
function isValidTenantIdentifier(identifier: string, method: string): boolean {
  if (!identifier || identifier.trim().length === 0) {
    return false;
  }

  switch (method) {
    case 'subdomain':
      // Subdomain validation: 3-63 chars, alphanumeric and hyphens
      return /^[a-z0-9]([a-z0-9-]{1,61}[a-z0-9])?$/.test(identifier);
    
    case 'jwt':
    case 'header':
      // UUID validation for tenant IDs
      return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(identifier);
    
    default:
      return false;
  }
}

/**
 * Extract subdomain from host header
 */
function extractSubdomainFromHost(host: string): string | null {
  if (!host) return null;

  // Remove port if present
  const hostname = host.split(':')[0];
  
  // Split by dots
  const parts = hostname.split('.');
  
  // For localhost development, check for patterns like:
  // - tenant.localhost
  // - tenant.local
  if (hostname.includes('localhost') || hostname.includes('.local')) {
    if (parts.length >= 2) {
      return parts[0];
    }
    return null;
  }
  
  // For production domains like tenant.directory-platform.com
  // We expect at least 3 parts: [subdomain, domain, tld]
  if (parts.length >= 3) {
    return parts[0];
  }
  
  return null;
}

/**
 * Load tenant configuration with caching and error handling
 */
async function loadTenantWithCache(
  identifier: string, 
  method: string
): Promise<any | null> {
  const cacheKey = `${method}:${identifier}`;
  const now = Date.now();
  
  // Check cache first
  if (tenantCache[cacheKey]) {
    const cached = tenantCache[cacheKey];
    if (now - cached.timestamp < CACHE_TTL) {
      return cached.tenant;
    }
    // Cache expired, remove it
    delete tenantCache[cacheKey];
  }
  
  let tenant = null;
  
  try {
    if (method === 'subdomain') {
      // Load by subdomain
      tenant = await prisma.tenant.findUnique({
        where: { subdomain: identifier },
        select: {
          id: true,
          name: true,
          subdomain: true,
          subscriptionTier: true,
          userLimit: true,
          ssoProvider: true,
          ssoConfig: true,
          // Add isActive field when it's added to schema
          // isActive: true,
        },
      });
    } else {
      // Load by ID (for JWT/header methods)
      tenant = await prisma.tenant.findUnique({
        where: { id: identifier },
        select: {
          id: true,
          name: true,
          subdomain: true,
          subscriptionTier: true,
          userLimit: true,
          ssoProvider: true,
          ssoConfig: true,
          // Add isActive field when it's added to schema
          // isActive: true,
        },
      });
    }
    
    // Cache the result (even if null, to avoid repeated DB queries for invalid tenants)
    tenantCache[cacheKey] = {
      tenant,
      timestamp: now,
    };
    
    return tenant;
  } catch (error) {
    Logger.error('Tenant lookup error', {
      error: (error as Error).message,
      identifier,
      method,
      operation: 'loadTenantWithCache',
    });
    
    // Don't cache database errors
    throw new DatabaseError('Failed to load tenant configuration', error as Error);
  }
}

/**
 * Middleware to require tenant context (use after tenantMiddleware)
 */
export const requireTenant = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (!req.tenant || !req.tenantId) {
    res.status(400).json({
      error: 'Tenant required',
      message: 'This endpoint requires tenant context',
      code: 'TENANT_REQUIRED'
    });
    return;
  }
  next();
};

/**
 * Middleware to check subscription limits
 */
export const checkSubscriptionLimits = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (!req.tenant) {
    res.status(400).json({
      error: 'Tenant required',
      message: 'Subscription check requires tenant context',
      code: 'TENANT_REQUIRED'
    });
    return;
  }

  // Add subscription tier to request for use in route handlers
  req.subscriptionTier = req.tenant.subscriptionTier;
  req.userLimit = req.tenant.userLimit;

  next();
};

/**
 * Clear tenant cache (useful for testing or when tenant data changes)
 */
export function clearTenantCache(identifier?: string): void {
  if (identifier) {
    // Clear specific tenant from cache
    Object.keys(tenantCache).forEach(key => {
      if (key.includes(identifier)) {
        delete tenantCache[key];
      }
    });
  } else {
    // Clear entire cache
    Object.keys(tenantCache).forEach(key => {
      delete tenantCache[key];
    });
  }
}

/**
 * Get tenant cache statistics (for monitoring)
 */
export function getTenantCacheStats(): {
  size: number;
  keys: string[];
  oldestEntry: number;
  newestEntry: number;
} {
  const keys = Object.keys(tenantCache);
  const timestamps = keys.map(key => tenantCache[key].timestamp);
  
  return {
    size: keys.length,
    keys,
    oldestEntry: timestamps.length > 0 ? Math.min(...timestamps) : 0,
    newestEntry: timestamps.length > 0 ? Math.max(...timestamps) : 0,
  };
}

// Extend Express Request interface for subscription info
declare global {
  namespace Express {
    interface Request {
      subscriptionTier?: string;
      userLimit?: number;
    }
  }
}