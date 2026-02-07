import { Request, Response, NextFunction } from 'express';
import { 
  AppError, 
  formatErrorResponse, 
  isOperationalError
} from '../utils/errors';
import { Logger, ErrorLogger } from '../lib/logger';

/**
 * Global error handling middleware
 * Should be the last middleware in the chain
 */
export const errorHandler = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Set context for logging
  Logger.setContext(req.id, req.tenantId, (req as any).user?.id);
  
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

/**
 * Middleware to handle 404 errors (route not found)
 */
export const notFoundHandler = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const error = new AppError(
    `Route ${req.method} ${req.path} not found`,
    404,
    'ROUTE_NOT_FOUND'
  );

  const errorResponse = formatErrorResponse(error, req.path);
  res.status(404).json(errorResponse);
};

/**
 * Async error wrapper to catch errors in async route handlers
 */
export const asyncHandler = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Validation error handler for request validation
 */
export const validationErrorHandler = (
  error: any,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Handle Joi validation errors
  if (error.isJoi) {
    const validationError = new AppError(
      error.details[0].message,
      400,
      'VALIDATION_ERROR'
    );

    const errorResponse = formatErrorResponse(validationError, req.path);
    errorResponse.details = {
      field: error.details[0].path.join('.'),
      value: error.details[0].context?.value,
    };

    res.status(400).json(errorResponse);
    return;
  }

  // Handle other validation errors
  if (error.name === 'ValidationError') {
    const validationError = new AppError(
      error.message,
      400,
      'VALIDATION_ERROR'
    );

    const errorResponse = formatErrorResponse(validationError, req.path);
    res.status(400).json(errorResponse);
    return;
  }

  // Pass to next error handler
  next(error);
};

/**
 * Database error handler for Prisma errors
 */
export const databaseErrorHandler = (
  error: any,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Handle Prisma errors
  if (error.code && error.code.startsWith('P')) {
    let appError: AppError;

    switch (error.code) {
      case 'P2002':
        // Unique constraint violation
        const field = error.meta?.target?.[0] || 'field';
        appError = new AppError(
          `${field} already exists`,
          409,
          'DUPLICATE_ENTRY'
        );
        break;

      case 'P2025':
        // Record not found
        appError = new AppError(
          'Record not found',
          404,
          'RECORD_NOT_FOUND'
        );
        break;

      case 'P2003':
        // Foreign key constraint violation
        appError = new AppError(
          'Referenced record does not exist',
          400,
          'FOREIGN_KEY_VIOLATION'
        );
        break;

      case 'P2014':
        // Required relation violation
        appError = new AppError(
          'Required relation missing',
          400,
          'REQUIRED_RELATION_MISSING'
        );
        break;

      default:
        // Generic database error
        appError = new AppError(
          'Database operation failed',
          500,
          'DATABASE_ERROR',
          false
        );
    }

    const errorResponse = formatErrorResponse(appError, req.path);
    res.status(appError.statusCode).json(errorResponse);
    return;
  }

  // Pass to next error handler
  next(error);
};

/**
 * Rate limiting error handler
 */
export const rateLimitErrorHandler = (
  error: any,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (error.type === 'rate-limit') {
    const rateLimitError = new AppError(
      'Too many requests, please try again later',
      429,
      'RATE_LIMIT_EXCEEDED'
    );

    const errorResponse = formatErrorResponse(rateLimitError, req.path);
    errorResponse.details = {
      retryAfter: error.retryAfter,
      limit: error.limit,
    };

    res.status(429).json(errorResponse);
    return;
  }

  // Pass to next error handler
  next(error);
};

/**
 * JWT error handler
 */
export const jwtErrorHandler = (
  error: any,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (error.name === 'JsonWebTokenError') {
    const jwtError = new AppError(
      'Invalid token',
      401,
      'INVALID_TOKEN'
    );

    const errorResponse = formatErrorResponse(jwtError, req.path);
    res.status(401).json(errorResponse);
    return;
  }

  if (error.name === 'TokenExpiredError') {
    const expiredError = new AppError(
      'Token expired',
      401,
      'TOKEN_EXPIRED'
    );

    const errorResponse = formatErrorResponse(expiredError, req.path);
    res.status(401).json(errorResponse);
    return;
  }

  // Pass to next error handler
  next(error);
};

/**
 * Multer (file upload) error handler
 */
export const multerErrorHandler = (
  error: any,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (error.code === 'LIMIT_FILE_SIZE') {
    const fileSizeError = new AppError(
      'File too large',
      413,
      'FILE_TOO_LARGE'
    );

    const errorResponse = formatErrorResponse(fileSizeError, req.path);
    errorResponse.details = {
      maxSize: error.limit,
    };

    res.status(413).json(errorResponse);
    return;
  }

  if (error.code === 'LIMIT_FILE_COUNT') {
    const fileCountError = new AppError(
      'Too many files',
      400,
      'TOO_MANY_FILES'
    );

    const errorResponse = formatErrorResponse(fileCountError, req.path);
    res.status(400).json(errorResponse);
    return;
  }

  if (error.code === 'LIMIT_UNEXPECTED_FILE') {
    const unexpectedFileError = new AppError(
      'Unexpected file field',
      400,
      'UNEXPECTED_FILE'
    );

    const errorResponse = formatErrorResponse(unexpectedFileError, req.path);
    res.status(400).json(errorResponse);
    return;
  }

  // Pass to next error handler
  next(error);
};

/**
 * Combine all error handlers into a single middleware stack
 */
export const errorMiddlewareStack = [
  validationErrorHandler,
  databaseErrorHandler,
  rateLimitErrorHandler,
  jwtErrorHandler,
  multerErrorHandler,
  errorHandler, // This should be last
];

/**
 * Health check error handler (for monitoring)
 */
export const healthCheckErrorHandler = (error: Error): {
  status: 'error';
  message: string;
  timestamp: string;
} => {
  ErrorLogger.log(error, { context: 'health-check' });

  return {
    status: 'error',
    message: isOperationalError(error) ? error.message : 'Health check failed',
    timestamp: new Date().toISOString(),
  };
};