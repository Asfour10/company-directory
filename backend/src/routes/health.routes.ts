import { Router, Request, Response } from 'express';
import { healthService } from '../services/health.service';
import { logger } from '../lib/logger';

const router = Router();

/**
 * GET /health
 * Liveness probe - indicates if the application is running
 * Returns detailed health information about all services
 */
router.get('/health', async (req: Request, res: Response) => {
  try {
    const healthStatus = await healthService.getHealthStatus();
    
    // Log health check request
    logger.info('Health check requested', {
      status: healthStatus.status,
      uptime: healthStatus.uptime,
      services: Object.keys(healthStatus.services).map(service => ({
        name: service,
        status: healthStatus.services[service as keyof typeof healthStatus.services].status
      }))
    });

    // Return appropriate HTTP status based on health
    const httpStatus = healthStatus.status === 'healthy' ? 200 : 
                      healthStatus.status === 'degraded' ? 200 : 503;

    res.status(httpStatus).json(healthStatus);
  } catch (error) {
    logger.error('Health check error', { error: error.message });
    
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Health check failed',
      details: error.message
    });
  }
});

/**
 * GET /ready
 * Readiness probe - indicates if the application is ready to serve traffic
 * Only checks critical services required for basic functionality
 */
router.get('/ready', async (req: Request, res: Response) => {
  try {
    const readinessStatus = await healthService.getReadinessStatus();
    
    if (readinessStatus.ready) {
      logger.info('Readiness check passed');
      res.status(200).json({
        status: 'ready',
        timestamp: new Date().toISOString(),
        message: 'Application is ready to serve traffic'
      });
    } else {
      logger.warn('Readiness check failed', { reason: readinessStatus.reason });
      res.status(503).json({
        status: 'not ready',
        timestamp: new Date().toISOString(),
        reason: readinessStatus.reason
      });
    }
  } catch (error) {
    logger.error('Readiness check error', { error: error.message });
    
    res.status(503).json({
      status: 'not ready',
      timestamp: new Date().toISOString(),
      error: 'Readiness check failed',
      details: error.message
    });
  }
});

/**
 * GET /health/live
 * Simple liveness check - just returns 200 if the process is running
 */
router.get('/health/live', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'alive',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

/**
 * GET /health/system
 * Detailed system information for debugging
 */
router.get('/health/system', (req: Request, res: Response) => {
  try {
    const systemInfo = healthService.getSystemInfo();
    
    res.status(200).json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      system: systemInfo
    });
  } catch (error) {
    logger.error('System info error', { error: error.message });
    
    res.status(500).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: 'Failed to get system information',
      details: error.message
    });
  }
});

export { router as healthRoutes };