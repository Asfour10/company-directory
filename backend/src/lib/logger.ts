import winston from 'winston';
import { v4 as uuidv4 } from 'uuid';

/**
 * Log levels configuration
 */
const LOG_LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

/**
 * Log colors for console output
 */
const LOG_COLORS = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white',
};

winston.addColors(LOG_COLORS);

/**
 * Custom format for structured logging
 */
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.printf((info) => {
    const { timestamp, level, message, requestId, tenantId, userId, ...meta } = info;
    
    const logEntry: any = {
      timestamp,
      level,
      message,
    };
    
    if (requestId) logEntry.requestId = requestId;
    if (tenantId) logEntry.tenantId = tenantId;
    if (userId) logEntry.userId = userId;
    if (Object.keys(meta).length > 0) logEntry.meta = meta;

    return JSON.stringify(logEntry);
  })
);

/**
 * Console format for development
 */
const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.colorize({ all: true }),
  winston.format.printf((info) => {
    const { timestamp, level, message, requestId, tenantId, userId, ...meta } = info;
    
    let logMessage = `${timestamp} [${level}]: ${message}`;
    
    if (requestId && typeof requestId === 'string') logMessage += ` [req:${requestId.slice(0, 8)}]`;
    if (tenantId) logMessage += ` [tenant:${tenantId}]`;
    if (userId) logMessage += ` [user:${userId}]`;
    
    if (Object.keys(meta).length > 0) {
      logMessage += ` ${JSON.stringify(meta)}`;
    }
    
    return logMessage;
  })
);

/**
 * Create Winston logger instance
 */
const createLogger = () => {
  const isDevelopment = process.env.NODE_ENV === 'development';
  const logLevel = process.env.LOG_LEVEL || (isDevelopment ? 'debug' : 'info');

  const transports: winston.transport[] = [];

  // Console transport for development
  if (isDevelopment) {
    transports.push(
      new winston.transports.Console({
        level: logLevel,
        format: consoleFormat,
      })
    );
  } else {
    // JSON format for production (for log aggregation)
    transports.push(
      new winston.transports.Console({
        level: logLevel,
        format: logFormat,
      })
    );
  }

  // File transports for production
  if (!isDevelopment) {
    // Error logs
    transports.push(
      new winston.transports.File({
        filename: 'logs/error.log',
        level: 'error',
        format: logFormat,
        maxsize: 5242880, // 5MB
        maxFiles: 5,
      })
    );

    // Combined logs
    transports.push(
      new winston.transports.File({
        filename: 'logs/combined.log',
        format: logFormat,
        maxsize: 5242880, // 5MB
        maxFiles: 5,
      })
    );
  }

  return winston.createLogger({
    level: logLevel,
    levels: LOG_LEVELS,
    format: logFormat,
    transports,
    // Don't exit on handled exceptions
    exitOnError: false,
  });
};

/**
 * Logger instance
 */
export const logger = createLogger();

/**
 * Request context storage for request ID
 */
class RequestContext {
  private static context: Map<string, any> = new Map();

  static set(key: string, value: any): void {
    this.context.set(key, value);
  }

  static get(key: string): any {
    return this.context.get(key);
  }

  static clear(): void {
    this.context.clear();
  }

  static getRequestId(): string | undefined {
    return this.context.get('requestId');
  }

  static getTenantId(): string | undefined {
    return this.context.get('tenantId');
  }

  static getUserId(): string | undefined {
    return this.context.get('userId');
  }
}

/**
 * Enhanced logger with context
 */
export class Logger {
  private static addContext(meta: any = {}): any {
    return {
      ...meta,
      requestId: RequestContext.getRequestId(),
      tenantId: RequestContext.getTenantId(),
      userId: RequestContext.getUserId(),
    };
  }

  static error(message: string, meta?: any): void {
    logger.error(message, this.addContext(meta));
  }

  static warn(message: string, meta?: any): void {
    logger.warn(message, this.addContext(meta));
  }

  static info(message: string, meta?: any): void {
    logger.info(message, this.addContext(meta));
  }

  static http(message: string, meta?: any): void {
    logger.http(message, this.addContext(meta));
  }

  static debug(message: string, meta?: any): void {
    logger.debug(message, this.addContext(meta));
  }

  /**
   * Log business events
   */
  static business(event: string, data?: any): void {
    this.info(`Business Event: ${event}`, {
      event,
      data,
      category: 'business',
    });
  }

  /**
   * Log security events
   */
  static security(event: string, data?: any): void {
    this.warn(`Security Event: ${event}`, {
      event,
      data,
      category: 'security',
    });
  }

  /**
   * Log performance metrics
   */
  static performance(operation: string, duration: number, meta?: any): void {
    this.info(`Performance: ${operation}`, {
      operation,
      duration,
      category: 'performance',
      ...meta,
    });
  }

  /**
   * Log database operations
   */
  static database(operation: string, table?: string, duration?: number): void {
    this.debug(`Database: ${operation}`, {
      operation,
      table,
      duration,
      category: 'database',
    });
  }

  /**
   * Log external service calls
   */
  static external(service: string, operation: string, duration?: number, success?: boolean): void {
    const level = success === false ? 'error' : 'info';
    logger[level](`External Service: ${service} - ${operation}`, this.addContext({
      service,
      operation,
      duration,
      success,
      category: 'external',
    }));
  }

  /**
   * Log authentication events
   */
  static auth(event: string, userId?: string, tenantId?: string, meta?: any): void {
    this.info(`Auth: ${event}`, {
      event,
      userId,
      tenantId,
      category: 'auth',
      ...meta,
    });
  }

  /**
   * Log audit events
   */
  static audit(action: string, resource: string, resourceId?: string, meta?: any): void {
    this.info(`Audit: ${action} ${resource}`, {
      action,
      resource,
      resourceId,
      category: 'audit',
      ...meta,
    });
  }

  /**
   * Set request context
   */
  static setContext(requestId?: string, tenantId?: string, userId?: string): void {
    if (requestId) RequestContext.set('requestId', requestId);
    if (tenantId) RequestContext.set('tenantId', tenantId);
    if (userId) RequestContext.set('userId', userId);
  }

  /**
   * Clear request context
   */
  static clearContext(): void {
    RequestContext.clear();
  }

  /**
   * Generate request ID
   */
  static generateRequestId(): string {
    return uuidv4();
  }
}

/**
 * Stream for Morgan HTTP logging
 */
export const morganStream = {
  write: (message: string) => {
    Logger.http(message.trim());
  },
};

/**
 * Error logging utility (enhanced version)
 */
export class ErrorLogger {
  static log(error: Error, context?: any): void {
    const errorData = {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };

    // Add AppError specific fields
    if (error instanceof Error && 'statusCode' in error) {
      Object.assign(errorData, {
        statusCode: (error as any).statusCode,
        code: (error as any).code,
        isOperational: (error as any).isOperational,
      });
    }

    Logger.error('Application Error', {
      error: errorData,
      context,
    });
  }

  /**
   * Log unhandled errors
   */
  static logUnhandled(error: Error, origin: string): void {
    Logger.error(`Unhandled ${origin}`, {
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
      origin,
      category: 'unhandled',
    });
  }
}

/**
 * Setup global error handlers
 */
export function setupGlobalErrorHandlers(): void {
  // Handle uncaught exceptions
  process.on('uncaughtException', (error: Error) => {
    ErrorLogger.logUnhandled(error, 'uncaughtException');
    console.error('Uncaught Exception:', error);
    process.exit(1);
  });

  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
    const error = reason instanceof Error ? reason : new Error(String(reason));
    ErrorLogger.logUnhandled(error, 'unhandledRejection');
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  });

  // Handle SIGTERM
  process.on('SIGTERM', () => {
    Logger.info('SIGTERM received, shutting down gracefully');
  });

  // Handle SIGINT
  process.on('SIGINT', () => {
    Logger.info('SIGINT received, shutting down gracefully');
  });
}

export default Logger;