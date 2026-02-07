import { Logger, ErrorLogger } from '../lib/logger';

/**
 * Custom error classes for the Company Directory application
 */

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly isOperational: boolean;

  constructor(message: string, statusCode: number, code: string, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;

    // Maintains proper stack trace for where our error was thrown
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Tenant-related errors
 */
export class TenantError extends AppError {
  constructor(message: string, code: string, statusCode = 400) {
    super(message, statusCode, code);
  }
}

export class TenantNotFoundError extends TenantError {
  constructor(identifier?: string) {
    const message = identifier 
      ? `Tenant '${identifier}' not found or inactive`
      : 'Tenant not found';
    super(message, 'TENANT_NOT_FOUND', 404);
  }
}

export class TenantInactiveError extends TenantError {
  constructor(tenantName: string) {
    super(`Tenant '${tenantName}' is inactive`, 'TENANT_INACTIVE', 403);
  }
}

export class SubdomainTakenError extends TenantError {
  constructor(subdomain: string) {
    super(`Subdomain '${subdomain}' is already taken`, 'SUBDOMAIN_TAKEN', 409);
  }
}

export class InvalidSubdomainError extends TenantError {
  constructor(subdomain: string) {
    super(
      `Invalid subdomain '${subdomain}'. Use only lowercase letters, numbers, and hyphens.`,
      'INVALID_SUBDOMAIN',
      400
    );
  }
}

export class UserLimitExceededError extends TenantError {
  constructor(limit: number) {
    super(
      `User limit of ${limit} exceeded. Please upgrade your subscription.`,
      'USER_LIMIT_EXCEEDED',
      403
    );
  }
}

/**
 * Authentication and authorization errors
 */
export class AuthError extends AppError {
  constructor(message: string, code: string, statusCode = 401) {
    super(message, statusCode, code);
  }
}

export class UnauthorizedError extends AuthError {
  constructor(message = 'Unauthorized access') {
    super(message, 'UNAUTHORIZED', 401);
  }
}

export class ForbiddenError extends AuthError {
  constructor(message = 'Insufficient permissions') {
    super(message, 'FORBIDDEN', 403);
  }
}

export class InvalidTokenError extends AuthError {
  constructor(message = 'Invalid or expired token') {
    super(message, 'INVALID_TOKEN', 401);
  }
}

/**
 * Validation errors
 */
export class ValidationError extends AppError {
  public readonly field?: string;
  public readonly value?: any;

  constructor(message: string, field?: string, value?: any) {
    super(message, 400, 'VALIDATION_ERROR');
    this.field = field;
    this.value = value;
  }
}

export class RequiredFieldError extends ValidationError {
  constructor(field: string) {
    super(`Field '${field}' is required`, field);
  }
}

export class InvalidFormatError extends ValidationError {
  constructor(field: string, expectedFormat: string) {
    super(`Field '${field}' has invalid format. Expected: ${expectedFormat}`, field);
  }
}

/**
 * Resource errors
 */
export class ResourceError extends AppError {
  constructor(message: string, code: string, statusCode = 404) {
    super(message, statusCode, code);
  }
}

export class NotFoundError extends ResourceError {
  constructor(resource: string, identifier?: string) {
    const message = identifier 
      ? `${resource} with identifier '${identifier}' not found`
      : `${resource} not found`;
    super(message, 'RESOURCE_NOT_FOUND', 404);
  }
}

export class ConflictError extends ResourceError {
  constructor(message: string) {
    super(message, 'RESOURCE_CONFLICT', 409);
  }
}

/**
 * Rate limiting and quota errors
 */
export class RateLimitError extends AppError {
  constructor(message = 'Rate limit exceeded') {
    super(message, 429, 'RATE_LIMIT_EXCEEDED');
  }
}

export class QuotaExceededError extends AppError {
  constructor(resource: string, limit: number) {
    super(
      `${resource} quota of ${limit} exceeded`,
      403,
      'QUOTA_EXCEEDED'
    );
  }
}

/**
 * External service errors
 */
export class ExternalServiceError extends AppError {
  public readonly service: string;

  constructor(service: string, message: string, statusCode = 502) {
    super(`${service} service error: ${message}`, statusCode, 'EXTERNAL_SERVICE_ERROR');
    this.service = service;
  }
}

/**
 * Database errors
 */
export class DatabaseError extends AppError {
  constructor(message: string, originalError?: Error) {
    super(message, 500, 'DATABASE_ERROR', false);
    if (originalError) {
      this.stack = originalError.stack;
    }
  }
}

/**
 * Error response formatter
 */
export interface ErrorResponse {
  error: string;
  message: string;
  code: string;
  statusCode: number;
  timestamp: string;
  path?: string;
  details?: any;
}

export function formatErrorResponse(
  error: Error,
  path?: string,
  includeStack = false
): ErrorResponse {
  const response: ErrorResponse = {
    error: error.name,
    message: error.message,
    code: error instanceof AppError ? error.code : 'INTERNAL_ERROR',
    statusCode: error instanceof AppError ? error.statusCode : 500,
    timestamp: new Date().toISOString(),
  };

  if (path) {
    response.path = path;
  }

  // Add additional details for specific error types
  if (error instanceof ValidationError) {
    response.details = {
      field: error.field,
      value: error.value,
    };
  }

  if (error instanceof ExternalServiceError) {
    response.details = {
      service: error.service,
    };
  }

  // Include stack trace in development
  if (includeStack && process.env.NODE_ENV === 'development') {
    response.details = {
      ...response.details,
      stack: error.stack,
    };
  }

  return response;
}

/**
 * Check if error is operational (safe to expose to client)
 */
export function isOperationalError(error: Error): boolean {
  if (error instanceof AppError) {
    return error.isOperational;
  }
  return false;
}

/**
 * Tenant-specific error handlers
 */
export class TenantErrorHandler {
  /**
   * Handle tenant extraction errors
   */
  static handleExtractionError(error: any, identifier?: string): AppError {
    if (error.code === 'P2025') {
      // Prisma record not found
      return new TenantNotFoundError(identifier);
    }

    if (error.code === 'P2002') {
      // Prisma unique constraint violation
      return new SubdomainTakenError(identifier || 'unknown');
    }

    // Generic database error
    return new DatabaseError('Failed to process tenant information', error);
  }

  /**
   * Handle tenant validation errors
   */
  static handleValidationError(field: string, value: any, rule: string): ValidationError {
    switch (rule) {
      case 'required':
        return new RequiredFieldError(field);
      case 'subdomain_format':
        return new InvalidSubdomainError(value);
      case 'hex_color':
        return new InvalidFormatError(field, 'hex color (#RRGGBB)');
      case 'email':
        return new InvalidFormatError(field, 'valid email address');
      default:
        return new ValidationError(`Invalid ${field}: ${value}`, field, value);
    }
  }

  /**
   * Handle subscription limit errors
   */
  static handleLimitError(type: string, _current: number, limit: number): AppError {
    switch (type) {
      case 'users':
        return new UserLimitExceededError(limit);
      case 'storage':
        return new QuotaExceededError('Storage', limit);
      case 'api_calls':
        return new RateLimitError('API rate limit exceeded');
      default:
        return new QuotaExceededError(type, limit);
    }
  }
}


/**
 * Create error handler middleware factory
 */
export function createErrorHandler() {
  return (error: Error, req: any, res: any, _next: any) => {
    // Set context for logging
    Logger.setContext(req.id, req.tenantId, req.user?.id);
    
    // Log the error using Winston
    ErrorLogger.log(error, {
      path: req.path,
      method: req.method,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
    });

    // Handle operational errors (safe to expose to client)
    if (isOperationalError(error)) {
      const errorResponse = formatErrorResponse(
        error, 
        req.path, 
        process.env.NODE_ENV === 'development'
      );
      res.status((error as AppError).statusCode).json(errorResponse);
      return;
    }

    // Handle programming errors (don't expose details to client)
    const safeError = new AppError(
      'Internal server error',
      500,
      'INTERNAL_ERROR',
      false
    );

    const errorResponse = formatErrorResponse(
      safeError,
      req.path,
      false // Never expose stack traces for programming errors
    );

    res.status(500).json(errorResponse);
  };
}