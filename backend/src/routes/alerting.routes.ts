import { Router, Request, Response } from 'express';
import { alertingService } from '../services/alerting.service';
import { logger } from '../lib/logger';
import { authMiddleware } from '../middleware/auth.middleware';
import { authorizationMiddleware } from '../middleware/authorization.middleware';

const router = Router();

/**
 * POST /webhook/alerts
 * Webhook endpoint for Prometheus Alertmanager
 */
router.post('/webhook/alerts', async (req: Request, res: Response) => {
  try {
    await alertingService.handleWebhookAlert(req.body);
    res.status(200).json({ message: 'Webhook processed successfully' });
  } catch (error) {
    logger.error('Error processing alert webhook', { error: error.message });
    res.status(500).json({ error: 'Failed to process webhook' });
  }
});

/**
 * GET /admin/alerts
 * Get active alerts (admin only)
 */
router.get('/admin/alerts', authMiddleware, authorizationMiddleware(['admin', 'super_admin']), async (req: Request, res: Response) => {
  try {
    const activeAlerts = alertingService.getActiveAlerts();
    res.json({
      alerts: activeAlerts,
      count: activeAlerts.length
    });
  } catch (error) {
    logger.error('Error fetching active alerts', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch alerts' });
  }
});

/**
 * GET /admin/alerts/history
 * Get alert history (admin only)
 */
router.get('/admin/alerts/history', authMiddleware, authorizationMiddleware(['admin', 'super_admin']), async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 100;
    const alertHistory = alertingService.getAlertHistory(limit);
    
    res.json({
      alerts: alertHistory,
      count: alertHistory.length
    });
  } catch (error) {
    logger.error('Error fetching alert history', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch alert history' });
  }
});

/**
 * POST /admin/alerts/:alertName/resolve
 * Manually resolve an alert (admin only)
 */
router.post('/admin/alerts/:alertName/resolve', authMiddleware, authorizationMiddleware(['admin', 'super_admin']), async (req: Request, res: Response) => {
  try {
    const { alertName } = req.params;
    await alertingService.resolveAlert(alertName);
    
    res.json({ message: `Alert ${alertName} resolved successfully` });
  } catch (error) {
    logger.error('Error resolving alert', { error: error.message, alertName: req.params.alertName });
    res.status(500).json({ error: 'Failed to resolve alert' });
  }
});

/**
 * POST /admin/alerts/test
 * Trigger a test alert (admin only, for testing purposes)
 */
router.post('/admin/alerts/test', authMiddleware, authorizationMiddleware(['super_admin']), async (req: Request, res: Response) => {
  try {
    const testAlert = {
      name: 'test_alert',
      severity: 'info' as const,
      message: 'This is a test alert triggered manually',
      details: {
        triggeredBy: req.user?.id,
        timestamp: new Date().toISOString()
      },
      timestamp: new Date()
    };

    await alertingService.triggerAlert(testAlert);
    
    res.json({ message: 'Test alert triggered successfully' });
  } catch (error) {
    logger.error('Error triggering test alert', { error: error.message });
    res.status(500).json({ error: 'Failed to trigger test alert' });
  }
});

export { router as alertingRoutes };