import { Router, Request, Response } from 'express';
import { metricsService } from '../services/metrics.service';
import { logger } from '../lib/logger';

const router = Router();

/**
 * GET /metrics
 * Prometheus metrics endpoint
 */
router.get('/metrics', async (req: Request, res: Response) => {
  try {
    const metrics = await metricsService.getMetrics();
    
    res.set('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
    res.send(metrics);
  } catch (error) {
    logger.error('Error generating metrics', { error });
    res.status(500).json({ error: 'Failed to generate metrics' });
  }
});

export { router as metricsRoutes };