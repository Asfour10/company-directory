import { Request, Response, NextFunction } from 'express';
import { metricsService } from '../services/metrics.service';
import { logger } from '../lib/logger';

interface RequestWithTenant extends Request {
  tenant?: {
    id: string;
    name: string;
  };
}

export const metricsMiddleware = (req: RequestWithTenant, res: Response, next: NextFunction) => {
  const startTime = Date.now();
  
  // Increment in-flight requests
  metricsService.incrementRequestsInFlight();

  // Override res.end to capture metrics when response is sent
  const originalEnd = res.end;
  res.end = function(chunk?: any, encoding?: any) {
    const duration = (Date.now() - startTime) / 1000; // Convert to seconds
    const route = req.route?.path || req.path;
    const method = req.method;
    const statusCode = res.statusCode;
    const tenantId = req.tenant?.id;

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
    originalEnd.call(this, chunk, encoding);
  };

  next();
};