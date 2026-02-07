import express from 'express';
import https from 'https';
import http from 'http';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import passport from 'passport';
import { v4 as uuidv4 } from 'uuid';
import { redisClient } from './lib/redis';
import authRoutes from './routes/auth.routes';
import employeeRoutes from './routes/employee.routes';
import searchRoutes from './routes/search.routes';
import adminRoutes from './routes/admin.routes';
import userRoutes from './routes/user.routes';
import scimRoutes from './routes/scim.routes';
import orgChartRoutes from './routes/org-chart.routes';
import tenantRoutes from './routes/tenant.routes';
import analyticsRoutes from './routes/analytics.routes';
import { createErrorHandler } from './utils/errors';
import { extractTenant, addTenantBranding } from './middleware/tenant.middleware';
import { scheduleAuditLogCleanup } from './utils/audit-cleanup';
import { 
  httpsEnforcementMiddleware, 
  defaultHttpsConfig, 
  createHttpsServer,
  verifyTlsConfiguration 
} from './middleware/https-enforcement.middleware';

// Load environment variables
dotenv.config();

const app = express();
const HTTP_PORT = process.env.PORT || 3000;
const HTTPS_PORT = process.env.HTTPS_PORT || 3443;

// Add request ID middleware
app.use((req, res, next) => {
  req.id = uuidv4();
  next();
});

// HTTPS enforcement middleware (must be first)
app.use(httpsEnforcementMiddleware(defaultHttpsConfig));

// Enhanced security middleware with HTTPS considerations
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https:"],
      fontSrc: ["'self'", "https:"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true
  },
  noSniff: true,
  frameguard: { action: 'deny' },
  xssFilter: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
}));

// CORS configuration with HTTPS considerations
app.use(cors({
  origin: process.env.FRONTEND_URL || 'https://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  optionsSuccessStatus: 200
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Initialize Passport
app.use(passport.initialize());

// Request logging middleware
app.use((req, res, next) => {
  const protocol = req.secure ? 'HTTPS' : 'HTTP';
  console.log(`${new Date().toISOString()} - ${protocol} ${req.method} ${req.path} - ${req.id}`);
  next();
});

// Tenant extraction middleware (for routes that need tenant context)
app.use('/api', extractTenant);
app.use('/api', addTenantBranding);

// Health check endpoint with TLS information
app.get('/health', async (req, res) => {
  const tlsInfo = await verifyTlsConfiguration();
  
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    protocol: req.secure ? 'HTTPS' : 'HTTP',
    services: {
      redis: redisClient.isReady() ? 'connected' : 'disconnected',
    },
    security: {
      httpsSupported: tlsInfo.httpsSupported,
      hstsEnabled: tlsInfo.hstsEnabled,
      tlsVersion: tlsInfo.tlsVersion
    }
  };

  res.json(health);
});

// Security check endpoint
app.get('/security', async (req, res) => {
  const tlsInfo = await verifyTlsConfiguration();
  
  res.json({
    tls: tlsInfo,
    headers: {
      hsts: res.getHeader('Strict-Transport-Security'),
      csp: res.getHeader('Content-Security-Policy'),
      xContentTypeOptions: res.getHeader('X-Content-Type-Options'),
      xFrameOptions: res.getHeader('X-Frame-Options')
    },
    connection: {
      secure: req.secure,
      protocol: req.protocol,
      encrypted: req.connection.encrypted || false
    }
  });
});

// Ready check endpoint (for Kubernetes)
app.get('/ready', async (req, res) => {
  try {
    const isReady = redisClient.isReady();
    
    if (isReady) {
      res.status(200).json({ 
        status: 'ready',
        secure: req.secure,
        protocol: req.protocol
      });
    } else {
      res.status(503).json({ 
        status: 'not ready', 
        reason: 'Services not available',
        secure: req.secure
      });
    }
  } catch (error) {
    res.status(503).json({ 
      status: 'not ready', 
      error: error.message,
      secure: req.secure
    });
  }
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/users', userRoutes);
app.use('/api/org-chart', orgChartRoutes);
app.use('/api/tenant', tenantRoutes);
app.use('/api/analytics', analyticsRoutes);

// SCIM routes (separate from tenant middleware as they have their own auth)
app.use('/scim/v2', scimRoutes);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: 'Endpoint not found',
      requestId: req.id,
      secure: req.secure
    },
  });
});

// Global error handler
app.use(createErrorHandler());

// Initialize services and start servers
async function startServers() {
  try {
    // Connect to Redis (optional - app works without it)
    try {
      await redisClient.connect();
      console.log('✅ Redis connected');
    } catch (error) {
      console.warn('⚠️  Redis connection failed, continuing without cache:', error.message);
    }

    // Verify TLS configuration
    const tlsInfo = await verifyTlsConfiguration();
    console.log('🔐 TLS Configuration:', tlsInfo.details);

    // Create HTTPS server if certificates are available
    const httpsServer = createHttpsServer(app);
    
    if (httpsServer) {
      httpsServer.listen(HTTPS_PORT, () => {
        console.log(`🔒 HTTPS Server running on port ${HTTPS_PORT}`);
        console.log(`🔐 TLS Version: ${tlsInfo.tlsVersion}`);
        console.log(`📊 Health check: https://localhost:${HTTPS_PORT}/health`);
        console.log(`🔒 Security check: https://localhost:${HTTPS_PORT}/security`);
      });
    }

    // Start HTTP server (will redirect to HTTPS in production)
    const httpServer = http.createServer(app);
    httpServer.listen(HTTP_PORT, () => {
      console.log(`🌐 HTTP Server running on port ${HTTP_PORT}`);
      if (process.env.NODE_ENV === 'production') {
        console.log('🔄 HTTP requests will be redirected to HTTPS');
      }
      console.log(`📊 Health check: http://localhost:${HTTP_PORT}/health`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    });

    // Schedule audit log cleanup (only in production)
    if (process.env.NODE_ENV === 'production') {
      scheduleAuditLogCleanup();
      console.log('📋 Audit log cleanup scheduled');
    }

    // Log security status
    console.log('\n🔐 SECURITY STATUS:');
    console.log(`   HTTPS Support: ${tlsInfo.httpsSupported ? 'ENABLED' : 'DISABLED'}`);
    console.log(`   HSTS: ${tlsInfo.hstsEnabled ? 'ENABLED' : 'DISABLED'}`);
    console.log(`   TLS Version: ${tlsInfo.tlsVersion}`);
    console.log(`   Certificate: ${tlsInfo.certificateValid ? 'VALID' : 'NOT CONFIGURED'}`);

  } catch (error) {
    console.error('Failed to start servers:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down gracefully...');
  await redisClient.disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Shutting down gracefully...');
  await redisClient.disconnect();
  process.exit(0);
});

// Start the servers
startServers();

export default app;