import { Request, Response, NextFunction } from 'express';
import { metricsService } from '../services/metrics.service';
import { logger } from '../lib/logger';

interface RequestWithTenant extends Request {
  tenant?: {
    id: string;
    name: string;
    subdomain: string;
    logoUrl: string | null;
    primaryColor: string;
    accentColor: string;
    subscriptionTier: string;
    userLimit: number;
    stripeCustomerId: string | null;
    stripeSubscriptionId: string | null;
    ssoEnabled: boolean;
    ssoProvider: string | null;
    ssoConfig: any;
    isActive: boolean;
    subscriptionStatus: string | null;
    currentPeriodEnd: Date | null;
    dataRetentionDays: number;
    encryptionKeyId: string | null;
    encryptedDataKey: string | null;
    createdAt: Date;
    updatedAt: Date;
  } | null;
}

export const metricsMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now();
  const typedReq = req as any;
  
  // Increment in-flight requests
  metricsService.incrementRequestsInFlight();

  // Override res.end to capture metrics when response is sent
  const originalEnd = res.end.bind(res);
  res.end = function(chunk?: any, encoding?: any, callback?: any): Response {
    const duration = (Date.now() - startTime) / 1000; // Convert to seconds
    const route = req.route?.path || req.path;
    const method = req.method;
    const statusCode = res.statusCode;
    const tenantId = typedReq.tenant?.id;

    // Record HTTP request metrics
    metricsService.recordHttpRequest(method, route, statusCode, duration, tenantId);
    
    // Decrement in-flight requests
    metricsService.decrementRequestsInFlight();

    // Log slow requests (> 2 seconds)
    if (duration > 2) {
      logger.warn('Slow request detected', {
        method,
        route,
        duration,
        statusCode,
        tenantId
      });
    }

    // Call original end method
    return originalEnd(chunk, encoding, callback);
  };

  next();
};