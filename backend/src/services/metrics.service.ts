import { register, collectDefaultMetrics, Counter, Histogram, Gauge } from 'prom-client';
import { logger } from '../lib/logger';

class MetricsService {
  private httpRequestsTotal: Counter<string>;
  private httpRequestDuration: Histogram<string>;
  private httpRequestsInFlight: Gauge<string>;
  private cacheHits: Counter<string>;
  private cacheMisses: Counter<string>;
  private dbQueryDuration: Histogram<string>;
  private dbConnectionsActive: Gauge<string>;
  private redisConnectionsActive: Gauge<string>;

  constructor() {
    // Collect default metrics (CPU, memory, etc.)
    collectDefaultMetrics({ register });

    // HTTP request metrics
    this.httpRequestsTotal = new Counter({
      name: 'http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'route', 'status_code', 'tenant_id'],
      registers: [register]
    });

    this.httpRequestDuration = new Histogram({
      name: 'http_request_duration_seconds',
      help: 'Duration of HTTP requests in seconds',
      labelNames: ['method', 'route', 'status_code', 'tenant_id'],
      buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10],
      registers: [register]
    });

    this.httpRequestsInFlight = new Gauge({
      name: 'http_requests_in_flight',
      help: 'Number of HTTP requests currently being processed',
      registers: [register]
    });

    // Cache metrics
    this.cacheHits = new Counter({
      name: 'cache_hits_total',
      help: 'Total number of cache hits',
      labelNames: ['cache_type', 'tenant_id'],
      registers: [register]
    });

    this.cacheMisses = new Counter({
      name: 'cache_misses_total',
      help: 'Total number of cache misses',
      labelNames: ['cache_type', 'tenant_id'],
      registers: [register]
    });

    // Database metrics
    this.dbQueryDuration = new Histogram({
      name: 'db_query_duration_seconds',
      help: 'Duration of database queries in seconds',
      labelNames: ['operation', 'table', 'tenant_id'],
      buckets: [0.01, 0.05, 0.1, 0.3, 0.5, 1, 2, 5],
      registers: [register]
    });

    this.dbConnectionsActive = new Gauge({
      name: 'db_connections_active',
      help: 'Number of active database connections',
      registers: [register]
    });

    this.redisConnectionsActive = new Gauge({
      name: 'redis_connections_active',
      help: 'Number of active Redis connections',
      registers: [register]
    });

    logger.info('Metrics service initialized');
  }

  // HTTP request metrics
  recordHttpRequest(method: string, route: string, statusCode: number, duration: number, tenantId?: string) {
    const labels = {
      method,
      route,
      status_code: statusCode.toString(),
      tenant_id: tenantId || 'unknown'
    };

    this.httpRequestsTotal.inc(labels);
    this.httpRequestDuration.observe(labels, duration);
  }

  incrementRequestsInFlight() {
    this.httpRequestsInFlight.inc();
  }

  decrementRequestsInFlight() {
    this.httpRequestsInFlight.dec();
  }

  // Cache metrics
  recordCacheHit(cacheType: string, tenantId?: string) {
    this.cacheHits.inc({
      cache_type: cacheType,
      tenant_id: tenantId || 'unknown'
    });
  }

  recordCacheMiss(cacheType: string, tenantId?: string) {
    this.cacheMisses.inc({
      cache_type: cacheType,
      tenant_id: tenantId || 'unknown'
    });
  }

  // Database metrics
  recordDbQuery(operation: string, table: string, duration: number, tenantId?: string) {
    this.dbQueryDuration.observe({
      operation,
      table,
      tenant_id: tenantId || 'unknown'
    }, duration);
  }

  setDbConnectionsActive(count: number) {
    this.dbConnectionsActive.set(count);
  }

  setRedisConnectionsActive(count: number) {
    this.redisConnectionsActive.set(count);
  }

  // Get metrics for Prometheus scraping
  getMetrics() {
    return register.metrics();
  }

  // Get registry for custom metrics
  getRegister() {
    return register;
  }

  // Clear all metrics (useful for testing)
  clearMetrics() {
    register.clear();
  }
}

export const metricsService = new MetricsService();