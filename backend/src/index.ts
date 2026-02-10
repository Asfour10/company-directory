import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
// import passport from 'passport'; // Disabled for basic deployment
import { redisClient } from './lib/redis';
import { Logger, setupGlobalErrorHandlers } from './lib/logger';
import { loggingMiddlewareStack } from './middleware/logging.middleware';
import { metricsMiddleware } from './middleware/metrics.middleware';
import authRoutes from './routes/auth.routes';
import employeeRoutes from './routes/employee.routes';
import searchRoutes from './routes/search.routes';
import adminRoutes from './routes/admin.routes';
import userRoutes from './routes/user.routes';
// import scimRoutes from './routes/scim.routes'; // Disabled for basic deployment
import orgChartRoutes from './routes/org-chart.routes';
import tenantRoutes from './routes/tenant.routes';
import analyticsRoutes from './routes/analytics.routes';
import billingRoutes from './routes/billing.routes';
import gdprRoutes from './routes/gdpr.routes';
import { metricsRoutes } from './routes/metrics.routes';
import { healthRoutes } from './routes/health.routes';
import { alertingRoutes } from './routes/alerting.routes';
import { createErrorHandler } from './utils/errors';
import { tenantMiddleware } from './middleware/tenant.middleware';
import { scheduleAuditLogCleanup } from './utils/audit-cleanup';
import { schedulerService } from './services/scheduler.service';
import { RetentionSchedulerService } from './services/retention-scheduler.service';
import { alertingService } from './services/alerting.service';

// Load environment variables
dotenv.config();

// Setup global error handlers
setupGlobalErrorHandlers();

const app = express();
const PORT = process.env.PORT || 3000;

// Logging middleware (must be early in the chain)
app.use(loggingMiddlewareStack);

// Metrics middleware (after logging, before other middleware)
app.use(metricsMiddleware);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

// CORS configuration
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Initialize Passport - Disabled for basic deployment
// app.use(passport.initialize());

// Health check routes (no tenant context needed)
app.use('/', healthRoutes);

// Auth routes (no tenant context needed - tenant is determined during login)
app.use('/api/auth', authRoutes);

// Tenant extraction middleware (for routes that need tenant context)
app.use('/api', tenantMiddleware);

// API routes (these require tenant context)
app.use('/api/employees', employeeRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/users', userRoutes);
app.use('/api/org-chart', orgChartRoutes);
app.use('/api/tenant', tenantRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/gdpr', gdprRoutes);
app.use('/api', billingRoutes);

// SCIM routes (separate from tenant middleware as they have their own auth)
// app.use('/scim/v2', scimRoutes); // Disabled for basic deployment

// Metrics endpoint (for Prometheus scraping)
app.use('/', metricsRoutes);

// Alerting endpoints
app.use('/', alertingRoutes);

// Root route for Render health checks
app.get('/', (req, res) => {
  res.status(200).json({
    status: 'ok',
    message: 'Company Directory API',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      ready: '/ready',
      api: '/api'
    }
  });
});

// 404 handler
app.use('*', (req, res) => {
  Logger.warn('Route not found', {
    method: req.method,
    path: req.path,
    ip: req.ip,
  });
  
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: 'Endpoint not found',
      requestId: req.id,
    },
  });
});

// Global error handler
app.use(createErrorHandler());

// Initialize services and start server
async function startServer() {
  try {
    // Connect to Redis (optional - app works without it)
    try {
      await redisClient.connect();
      Logger.info('Redis connected successfully');
    } catch (error) {
      Logger.warn('Redis connection failed, continuing without cache', { error: error.message });
    }

    // Start server
    app.listen(PORT, () => {
      Logger.info('Server started successfully', {
        port: PORT,
        environment: process.env.NODE_ENV || 'development',
        endpoints: {
          health: `http://localhost:${PORT}/health`,
          auth: `http://localhost:${PORT}/api/auth`,
        },
      });
      
      // Schedule audit log cleanup (only in production)
      if (process.env.NODE_ENV === 'production') {
        scheduleAuditLogCleanup();
        Logger.info('Audit log cleanup scheduled');
        
        // Start billing notification scheduler
        schedulerService.start();
        Logger.info('Billing notifications scheduled');
        
        // Start data retention scheduler
        const retentionScheduler = new RetentionSchedulerService();
        retentionScheduler.start();
        Logger.info('Data retention policies scheduled');
        
        // Start alert rule checking (every 1 minute)
        setInterval(async () => {
          try {
            await alertingService.checkAlertRules();
          } catch (error) {
            Logger.error('Error checking alert rules', { error: error.message });
          }
        }, 60000);
        Logger.info('Alert rule checking scheduled');
      }
    });
  } catch (error) {
    Logger.error('Failed to start server', { error: error.message, stack: error.stack });
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  Logger.info('SIGINT received, shutting down gracefully');
  schedulerService.stop();
  await redisClient.disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  Logger.info('SIGTERM received, shutting down gracefully');
  schedulerService.stop();
  await redisClient.disconnect();
  process.exit(0);
});

// Start the server
startServer();

export default app;
