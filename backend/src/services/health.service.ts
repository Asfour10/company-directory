import { prisma } from '../lib/database';
import { redisClient } from '../lib/redis';
import { logger } from '../lib/logger';
import { metricsService } from './metrics.service';

export interface HealthStatus {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  uptime: number;
  version: string;
  services: {
    database: ServiceHealth;
    redis: ServiceHealth;
    memory: MemoryHealth;
  };
  checks: HealthCheck[];
}

export interface ServiceHealth {
  status: 'healthy' | 'unhealthy' | 'degraded';
  responseTime?: number;
  error?: string;
  details?: any;
}

export interface MemoryHealth {
  status: 'healthy' | 'unhealthy' | 'degraded';
  used: number;
  total: number;
  percentage: number;
}

export interface HealthCheck {
  name: string;
  status: 'pass' | 'fail' | 'warn';
  responseTime: number;
  error?: string;
}

class HealthService {
  private startTime: number;

  constructor() {
    this.startTime = Date.now();
  }

  async getHealthStatus(): Promise<HealthStatus> {
    const checks: HealthCheck[] = [];
    
    // Check database connectivity
    const dbHealth = await this.checkDatabase();
    checks.push({
      name: 'database',
      status: dbHealth.status === 'healthy' ? 'pass' : 'fail',
      responseTime: dbHealth.responseTime || 0,
      error: dbHealth.error
    });

    // Check Redis connectivity
    const redisHealth = await this.checkRedis();
    checks.push({
      name: 'redis',
      status: redisHealth.status === 'healthy' ? 'pass' : 'warn', // Redis is optional
      responseTime: redisHealth.responseTime || 0,
      error: redisHealth.error
    });

    // Check memory usage
    const memoryHealth = this.checkMemory();
    checks.push({
      name: 'memory',
      status: memoryHealth.status === 'healthy' ? 'pass' : 'warn',
      responseTime: 0
    });

    // Determine overall status
    const hasFailures = checks.some(check => check.status === 'fail');
    const hasWarnings = checks.some(check => check.status === 'warn');
    
    let overallStatus: 'healthy' | 'unhealthy' | 'degraded';
    if (hasFailures) {
      overallStatus = 'unhealthy';
    } else if (hasWarnings) {
      overallStatus = 'degraded';
    } else {
      overallStatus = 'healthy';
    }

    // Update connection metrics
    metricsService.setDbConnectionsActive(dbHealth.status === 'healthy' ? 1 : 0);
    metricsService.setRedisConnectionsActive(redisHealth.status === 'healthy' ? 1 : 0);

    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptime: Date.now() - this.startTime,
      version: process.env.npm_package_version || '1.0.0',
      services: {
        database: dbHealth,
        redis: redisHealth,
        memory: memoryHealth
      },
      checks
    };
  }

  async getReadinessStatus(): Promise<{ ready: boolean; reason?: string }> {
    // For readiness, we only check critical services
    const dbHealth = await this.checkDatabase();
    
    if (dbHealth.status !== 'healthy') {
      return {
        ready: false,
        reason: `Database not available: ${dbHealth.error}`
      };
    }

    return { ready: true };
  }

  private async checkDatabase(): Promise<ServiceHealth> {
    const start = Date.now();
    
    try {
      // Simple query to check database connectivity
      await prisma.$queryRaw`SELECT 1 as test`;
      
      const responseTime = Date.now() - start;
      
      return {
        status: 'healthy',
        responseTime,
        details: {
          connected: true
        }
      };
    } catch (error) {
      const responseTime = Date.now() - start;
      logger.error('Database health check failed', { error: error.message });
      
      return {
        status: 'unhealthy',
        responseTime,
        error: error.message
      };
    }
  }

  private async checkRedis(): Promise<ServiceHealth> {
    const start = Date.now();
    
    try {
      if (!redisClient.isReady()) {
        return {
          status: 'unhealthy',
          responseTime: Date.now() - start,
          error: 'Redis client not connected'
        };
      }

      const pingResult = await redisClient.ping();
      const responseTime = Date.now() - start;
      
      if (pingResult) {
        return {
          status: 'healthy',
          responseTime,
          details: {
            connected: true,
            ping: 'PONG'
          }
        };
      } else {
        return {
          status: 'unhealthy',
          responseTime,
          error: 'Redis ping failed'
        };
      }
    } catch (error) {
      const responseTime = Date.now() - start;
      logger.error('Redis health check failed', { error: error.message });
      
      return {
        status: 'unhealthy',
        responseTime,
        error: error.message
      };
    }
  }

  private checkMemory(): MemoryHealth {
    const memUsage = process.memoryUsage();
    const totalMemory = memUsage.heapTotal;
    const usedMemory = memUsage.heapUsed;
    const percentage = (usedMemory / totalMemory) * 100;

    let status: 'healthy' | 'unhealthy' | 'degraded';
    if (percentage > 90) {
      status = 'unhealthy';
    } else if (percentage > 75) {
      status = 'degraded';
    } else {
      status = 'healthy';
    }

    return {
      status,
      used: usedMemory,
      total: totalMemory,
      percentage: Math.round(percentage * 100) / 100
    };
  }

  // Get detailed system information
  getSystemInfo() {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    return {
      node: {
        version: process.version,
        platform: process.platform,
        arch: process.arch,
        uptime: process.uptime()
      },
      memory: {
        rss: memUsage.rss,
        heapTotal: memUsage.heapTotal,
        heapUsed: memUsage.heapUsed,
        external: memUsage.external,
        arrayBuffers: memUsage.arrayBuffers
      },
      cpu: {
        user: cpuUsage.user,
        system: cpuUsage.system
      },
      environment: process.env.NODE_ENV || 'development'
    };
  }
}

export const healthService = new HealthService();