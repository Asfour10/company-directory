import { PrismaClient } from '@prisma/client';
import { metricsService } from '../services/metrics.service';

// Global variable to store the Prisma client instance
declare global {
  var __prisma: PrismaClient | undefined;
}

// Create a single instance of PrismaClient with optimized configuration
const prisma = globalThis.__prisma || new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
});

// Add query logging middleware for metrics (only in non-test environment)
if (process.env.NODE_ENV !== 'test' && typeof prisma.$use === 'function') {
  prisma.$use(async (params, next) => {
    const start = Date.now();
    const result = await next(params);
    const duration = (Date.now() - start) / 1000; // Convert to seconds
    
    // Record database query metrics
    metricsService.recordDbQuery(params.action, params.model || 'unknown', duration);
    
    return result;
  });
}

// In development, store the client on the global object to prevent
// creating multiple instances during hot reloads
if (process.env.NODE_ENV === 'development') {
  globalThis.__prisma = prisma;
}

export { prisma };

// Utility function to set tenant context for Row-Level Security
export async function setTenantContext(tenantId: string): Promise<void> {
  await prisma.$executeRaw`SET app.current_tenant = ${tenantId}`;
}

// Utility function to execute queries within a tenant context
export async function withTenantContext<T>(
  tenantId: string,
  operation: () => Promise<T>
): Promise<T> {
  await setTenantContext(tenantId);
  return operation();
}

// Graceful shutdown
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});

process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  process.exit(0);
});