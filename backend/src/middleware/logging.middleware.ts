import { Request, Response, NextFunction } from 'express';
import { Logger } from '../lib/logger';

/**
 * Extended Request interface to include timing and logging data
 */
type LoggingRequest = Request & {
  startTime?: number;
  id?: string;
  tenantId?: string;
  user?: {
    id: string;
    tenantId: string;
    email: string;
    role: string;
    isActive: boolean;
  };
}

/**
 * Sensitive fields to exclude from request/response logging
 */
const SENSITIVE_FIELDS = [
  'password',
  'token',
  'authorization',
  'cookie',
  'session',
  'secret',
  'key',
  'private',
  'ssn',
  'social_security',
  'credit_card',
  'card_number',
  'cvv',
  'pin',
];

/**
 * Sensitive headers to exclude from logging
 */
const SENSITIVE_HEADERS = [
  'authorization',
  'cookie',
  'set-cookie',
  'x-api-key',
  'x-auth-token',
  'x-session-token',
];

/**
 * Check if a field name contains sensitive information
 */
function isSensitiveField(fieldName: string): boolean {
  const lowerField = fieldName.toLowerCase();
  return SENSITIVE_FIELDS.some(sensitive => lowerField.includes(sensitive));
}

/**
 * Sanitize object by removing sensitive fields
 */
function sanitizeObject(obj: any, maxDepth = 3, currentDepth = 0): any {
  if (currentDepth >= maxDepth || obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item, maxDepth, currentDepth + 1));
  }

  const sanitized: any = {};
  for (const [key, value] of Object.entries(obj)) {
    if (isSensitiveField(key)) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeObject(value, maxDepth, currentDepth + 1);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * Sanitize headers by removing sensitive ones
 */
function sanitizeHeaders(headers: any): any {
  const sanitized: any = {};
  for (const [key, value] of Object.entries(headers)) {
    if (SENSITIVE_HEADERS.includes(key.toLowerCase())) {
      sanitized[key] = '[REDACTED]';
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

/**
 * Get client IP address from request
 */
function getClientIP(req: Request): string {
  return (
    (req.headers['x-forwarded-for'] as string)?.split(',')[0] ||
    (req.headers['x-real-ip'] as string) ||
    req.connection.remoteAddress ||
    req.socket.remoteAddress ||
    'unknown'
  );
}

/**
 * Get request size in bytes
 */
function getRequestSize(req: Request): number {
  const contentLength = req.headers['content-length'];
  return contentLength ? parseInt(contentLength, 10) : 0;
}

/**
 * Get response size in bytes
 */
function getResponseSize(res: Response): number {
  const contentLength = res.get('content-length');
  return contentLength ? parseInt(contentLength, 10) : 0;
}

/**
 * Request logging middleware
 * Logs incoming requests with sanitized data
 */
export const requestLogger = (req: LoggingRequest, _res: Response, next: NextFunction): void => {
  // Set start time for duration calculation
  req.startTime = Date.now();

  // Set context for logging
  Logger.setContext(req.id, req.tenantId, req.user?.id);

  // Log incoming request
  Logger.http('Incoming Request', {
    method: req.method,
    url: req.url,
    path: req.path,
    query: sanitizeObject(req.query),
    headers: sanitizeHeaders(req.headers),
    ip: getClientIP(req),
    userAgent: req.headers['user-agent'],
    contentLength: getRequestSize(req),
    ...(req.user && {
      user: {
        id: req.user.id,
        email: req.user.email,
        role: req.user.role,
      },
    }),
    ...(req.tenantId && { tenantId: req.tenantId }),
  });

  // Log request body for POST/PUT/PATCH requests (sanitized)
  if (['POST', 'PUT', 'PATCH'].includes(req.method) && req.body) {
    Logger.debug('Request Body', {
      method: req.method,
      path: req.path,
      body: sanitizeObject(req.body),
    });
  }

  next();
};

/**
 * Response logging middleware
 * Logs outgoing responses with timing and status information
 */
export const responseLogger = (req: LoggingRequest, res: Response, next: NextFunction): void => {
  // Store original res.json and res.send methods
  const originalJson = res.json;
  const originalSend = res.send;

  // Override res.json to capture response data
  res.json = function(body: any) {
    // Log response
    logResponse(req, res, body);
    return originalJson.call(this, body);
  };

  // Override res.send to capture response data
  res.send = function(body: any) {
    // Log response
    logResponse(req, res, body);
    return originalSend.call(this, body);
  };

  next();
};

/**
 * Log response details
 */
function logResponse(req: LoggingRequest, res: Response, body?: any): void {
  const duration = req.startTime ? Date.now() - req.startTime : 0;
  const statusCode = res.statusCode;
  const contentLength = getResponseSize(res);

  // Set context for logging
  Logger.setContext(req.id, req.tenantId, req.user?.id);

  // Determine log level based on status code
  let logLevel: 'info' | 'warn' | 'error' = 'info';
  if (statusCode >= 400 && statusCode < 500) {
    logLevel = 'warn';
  } else if (statusCode >= 500) {
    logLevel = 'error';
  }

  // Log response
  Logger[logLevel]('Outgoing Response', {
    method: req.method,
    url: req.url,
    path: req.path,
    statusCode,
    duration,
    contentLength,
    headers: sanitizeHeaders(res.getHeaders()),
    ...(req.user && {
      user: {
        id: req.user.id,
        email: req.user.email,
        role: req.user.role,
      },
    }),
    ...(req.tenantId && { tenantId: req.tenantId }),
  });

  // Log response body for errors or debug mode
  if (
    (statusCode >= 400 || process.env.LOG_LEVEL === 'debug') &&
    body &&
    typeof body === 'object'
  ) {
    Logger.debug('Response Body', {
      method: req.method,
      path: req.path,
      statusCode,
      body: sanitizeObject(body),
    });
  }

  // Log performance metrics for slow requests
  if (duration > 1000) {
    Logger.performance('Slow Request', duration, {
      method: req.method,
      path: req.path,
      statusCode,
    });
  }

  // Log business events based on endpoints
  logBusinessEvents(req, res, statusCode);
}

/**
 * Log business events based on request patterns
 */
function logBusinessEvents(req: LoggingRequest, _res: Response, statusCode: number): void {
  if (statusCode >= 400) return; // Don't log business events for errors

  const { method, path } = req;

  // Authentication events
  if (path.includes('/auth/login') && method === 'POST') {
    Logger.business('User Login', {
      userId: req.user?.id,
      tenantId: req.tenantId,
    });
  }

  if (path.includes('/auth/logout') && method === 'POST') {
    Logger.business('User Logout', {
      userId: req.user?.id,
      tenantId: req.tenantId,
    });
  }

  // Employee management events
  if (path.includes('/employees') && method === 'POST') {
    Logger.business('Employee Created', {
      userId: req.user?.id,
      tenantId: req.tenantId,
    });
  }

  if (path.includes('/employees') && method === 'PUT') {
    Logger.business('Employee Updated', {
      userId: req.user?.id,
      tenantId: req.tenantId,
      employeeId: path.split('/').pop(),
    });
  }

  if (path.includes('/employees') && method === 'DELETE') {
    Logger.business('Employee Deleted', {
      userId: req.user?.id,
      tenantId: req.tenantId,
      employeeId: path.split('/').pop(),
    });
  }

  // Search events
  if (path.includes('/search') && method === 'GET') {
    Logger.business('Search Performed', {
      userId: req.user?.id,
      tenantId: req.tenantId,
      query: req.query.q,
    });
  }

  // Bulk import events
  if (path.includes('/bulk-import') && method === 'POST') {
    Logger.business('Bulk Import', {
      userId: req.user?.id,
      tenantId: req.tenantId,
    });
  }

  // Admin events
  if (path.includes('/admin') && method === 'GET') {
    Logger.business('Admin Access', {
      userId: req.user?.id,
      tenantId: req.tenantId,
      endpoint: path,
    });
  }
}

/**
 * Security event logging middleware
 */
export const securityLogger = (req: LoggingRequest, res: Response, next: NextFunction): void => {
  // Set context for logging
  Logger.setContext(req.id, req.tenantId, req.user?.id);

  // Log suspicious activities
  const userAgent = req.headers['user-agent'] || '';
  const ip = getClientIP(req);

  // Check for suspicious user agents
  const suspiciousAgents = ['bot', 'crawler', 'spider', 'scraper'];
  if (suspiciousAgents.some(agent => userAgent.toLowerCase().includes(agent))) {
    Logger.security('Suspicious User Agent', {
      ip,
      userAgent,
      path: req.path,
      method: req.method,
    });
  }

  // Log failed authentication attempts
  res.on('finish', () => {
    if (req.path.includes('/auth') && res.statusCode === 401) {
      Logger.security('Failed Authentication', {
        ip,
        userAgent,
        path: req.path,
        method: req.method,
      });
    }

    // Log access to admin endpoints
    if (req.path.includes('/admin') && req.user) {
      Logger.security('Admin Access', {
        userId: req.user.id,
        ip,
        path: req.path,
        method: req.method,
        statusCode: res.statusCode,
      });
    }

    // Log tenant access attempts
    if (res.statusCode === 404 && req.path.includes('/api/')) {
      Logger.security('Tenant Access Attempt', {
        ip,
        tenantId: req.tenantId,
        path: req.path,
        method: req.method,
      });
    }
  });

  next();
};

/**
 * Request ID middleware
 * Generates unique request ID for tracking
 */
export const requestIdMiddleware = (req: LoggingRequest, _res: Response, next: NextFunction): void => {
  // Generate request ID if not present
  if (!req.id) {
    req.id = Logger.generateRequestId();
  }

  // Add request ID to response headers
  _res.setHeader('X-Request-ID', req.id);

  next();
};

/**
 * Combined logging middleware stack
 */
export const loggingMiddlewareStack = [
  requestIdMiddleware,
  requestLogger,
  responseLogger,
  securityLogger,
];

/**
 * API rate limiting logger
 */
export const rateLimitLogger = (req: LoggingRequest, res: Response, next: NextFunction): void => {
  const originalSend = res.send;

  res.send = function(body: any) {
    if (res.statusCode === 429) {
      Logger.setContext(req.id, req.tenantId, req.user?.id);
      Logger.warn('Rate Limit Exceeded', {
        ip: getClientIP(req),
        path: req.path,
        method: req.method,
        userAgent: req.headers['user-agent'],
      });
    }
    return originalSend.call(this, body);
  };

  next();
};

export default {
  requestLogger,
  responseLogger,
  securityLogger,
  requestIdMiddleware,
  loggingMiddlewareStack,
  rateLimitLogger,
};