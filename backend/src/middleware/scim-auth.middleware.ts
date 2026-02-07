import { Request, Response, NextFunction } from 'express';
import { TenantService } from '../services/tenant.service';
import { UnauthorizedError, ForbiddenError } from '../utils/errors';
import { SCIMService } from '../services/scim.service';
import { SCIM_ERROR_TYPES } from '../types/scim.types';

/**
 * SCIM Authentication Middleware
 * Handles bearer token authentication for SCIM endpoints
 * Validates SSO provider credentials and sets tenant context
 */

interface SCIMAuthConfig {
  tenantId: string;
  scimToken: string;
  ssoProvider: string;
  isActive: boolean;
}

// In-memory store for SCIM tokens (in production, this should be in database)
// This would typically be configured per tenant with their SSO provider credentials
const scimTokenStore = new Map<string, SCIMAuthConfig>();

/**
 * Initialize SCIM token for a tenant
 * This would typically be called when a tenant configures SCIM
 */
export function initializeSCIMToken(
  tenantId: string,
  scimToken: string,
  ssoProvider: string
): void {
  scimTokenStore.set(scimToken, {
    tenantId,
    scimToken,
    ssoProvider,
    isActive: true,
  });
}

/**
 * Revoke SCIM token for a tenant
 */
export function revokeSCIMToken(scimToken: string): void {
  scimTokenStore.delete(scimToken);
}

/**
 * SCIM Bearer Token Authentication Middleware
 */
export async function scimAuthMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Extract bearer token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json(
        SCIMService.createError(
          401,
          SCIM_ERROR_TYPES.INVALID_VALUE,
          'Bearer token required for SCIM endpoints'
        )
      );
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Validate token
    const authConfig = scimTokenStore.get(token);
    if (!authConfig || !authConfig.isActive) {
      return res.status(401).json(
        SCIMService.createError(
          401,
          SCIM_ERROR_TYPES.INVALID_VALUE,
          'Invalid or expired SCIM token'
        )
      );
    }

    // Get tenant information
    const tenant = await TenantService.getTenantById(authConfig.tenantId);
    if (!tenant) {
      return res.status(401).json(
        SCIMService.createError(
          401,
          SCIM_ERROR_TYPES.INVALID_VALUE,
          'Tenant not found or inactive'
        )
      );
    }

    // Verify SSO provider matches tenant configuration
    if (tenant.ssoProvider !== authConfig.ssoProvider) {
      return res.status(403).json(
        SCIMService.createError(
          403,
          SCIM_ERROR_TYPES.INVALID_VALUE,
          'SSO provider mismatch'
        )
      );
    }

    // Set tenant and auth context on request
    req.tenant = tenant;
    req.user = {
      id: `scim-${authConfig.ssoProvider}`,
      tenantId: tenant.id,
      email: `scim@${tenant.subdomain}.directory.com`,
      role: 'scim_client',
      isActive: true,
    };

    next();
  } catch (error) {
    console.error('SCIM Auth Error:', error);
    return res.status(500).json(
      SCIMService.createError(500, undefined, 'Internal authentication error')
    );
  }
}

/**
 * Basic Authentication Middleware for SCIM (alternative to Bearer token)
 * Some SSO providers prefer Basic Auth
 */
export async function scimBasicAuthMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Extract basic auth from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Basic ')) {
      return res.status(401).json(
        SCIMService.createError(
          401,
          SCIM_ERROR_TYPES.INVALID_VALUE,
          'Basic authentication required for SCIM endpoints'
        )
      );
    }

    const base64Credentials = authHeader.substring(6); // Remove 'Basic ' prefix
    const credentials = Buffer.from(base64Credentials, 'base64').toString('ascii');
    const [username, password] = credentials.split(':');

    if (!username || !password) {
      return res.status(401).json(
        SCIMService.createError(
          401,
          SCIM_ERROR_TYPES.INVALID_VALUE,
          'Invalid basic authentication format'
        )
      );
    }

    // In a real implementation, you would validate these credentials
    // against your tenant's SCIM configuration
    // For now, we'll use a simple format: tenantId:scimSecret
    const tenantId = username;
    const scimSecret = password;

    // Get tenant and validate SCIM configuration
    const tenant = await TenantService.getTenantById(tenantId);
    if (!tenant) {
      return res.status(401).json(
        SCIMService.createError(
          401,
          SCIM_ERROR_TYPES.INVALID_VALUE,
          'Invalid tenant credentials'
        )
      );
    }

    // Validate SCIM secret (in production, this would be stored securely)
    const expectedSecret = tenant.ssoConfig?.scimSecret;
    if (!expectedSecret || expectedSecret !== scimSecret) {
      return res.status(401).json(
        SCIMService.createError(
          401,
          SCIM_ERROR_TYPES.INVALID_VALUE,
          'Invalid SCIM credentials'
        )
      );
    }

    // Set tenant and auth context on request
    req.tenant = tenant;
    req.user = {
      id: `scim-basic-${tenant.id}`,
      tenantId: tenant.id,
      email: `scim@${tenant.subdomain}.directory.com`,
      role: 'scim_client',
      isActive: true,
    };

    next();
  } catch (error) {
    console.error('SCIM Basic Auth Error:', error);
    return res.status(500).json(
      SCIMService.createError(500, undefined, 'Internal authentication error')
    );
  }
}

/**
 * Flexible SCIM authentication middleware that supports both Bearer and Basic auth
 */
export async function scimFlexibleAuthMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json(
      SCIMService.createError(
        401,
        SCIM_ERROR_TYPES.INVALID_VALUE,
        'Authorization header required for SCIM endpoints'
      )
    );
  }

  if (authHeader.startsWith('Bearer ')) {
    return scimAuthMiddleware(req, res, next);
  } else if (authHeader.startsWith('Basic ')) {
    return scimBasicAuthMiddleware(req, res, next);
  } else {
    return res.status(401).json(
      SCIMService.createError(
        401,
        SCIM_ERROR_TYPES.INVALID_VALUE,
        'Unsupported authentication scheme. Use Bearer or Basic authentication.'
      )
    );
  }
}

/**
 * Middleware to validate SCIM content type
 */
export function scimContentTypeMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // SCIM requires application/scim+json or application/json content type
  const contentType = req.headers['content-type'];
  
  if (req.method !== 'GET' && req.method !== 'DELETE') {
    if (!contentType || 
        (!contentType.includes('application/scim+json') && 
         !contentType.includes('application/json'))) {
      return res.status(400).json(
        SCIMService.createError(
          400,
          SCIM_ERROR_TYPES.INVALID_VALUE,
          'Content-Type must be application/scim+json or application/json'
        )
      );
    }
  }

  // Set SCIM response content type
  res.setHeader('Content-Type', 'application/scim+json');
  
  next();
}

/**
 * SCIM rate limiting middleware
 * Prevents abuse of SCIM endpoints
 */
const scimRequestCounts = new Map<string, { count: number; resetTime: number }>();

export function scimRateLimitMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const clientId = req.user?.id || req.ip;
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minute window
  const maxRequests = 100; // Max 100 requests per minute per client

  const clientData = scimRequestCounts.get(clientId);
  
  if (!clientData || now > clientData.resetTime) {
    // Reset or initialize counter
    scimRequestCounts.set(clientId, {
      count: 1,
      resetTime: now + windowMs,
    });
    return next();
  }

  if (clientData.count >= maxRequests) {
    return res.status(429).json(
      SCIMService.createError(
        429,
        SCIM_ERROR_TYPES.TOO_MANY,
        'Rate limit exceeded. Too many SCIM requests.'
      )
    );
  }

  clientData.count++;
  next();
}