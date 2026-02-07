# Production Launch Design

## Overview
This design document outlines the technical approach for launching the Company Directory application to production. It covers infrastructure architecture, security implementation, deployment strategy, monitoring setup, and operational procedures.

## 1. Infrastructure Architecture

### 1.1 Deployment Options

**Option A: Docker Compose (Recommended for MVP/Small Scale)**
- Single server or small cluster
- Simple setup and management
- Good for initial launch with <1000 users
- Lower operational complexity

**Option B: Kubernetes (Recommended for Scale)**
- Multi-node cluster
- Auto-scaling and high availability
- Good for >1000 users or growth expectations
- Higher operational complexity

**Option C: Cloud Managed Services (AWS/Azure/GCP)**
- Fully managed infrastructure
- Highest cost but lowest operational burden
- Good for teams without DevOps expertise

**Recommendation:** Start with Docker Compose for MVP launch, plan migration to Kubernetes as user base grows.

### 1.2 Infrastructure Components

```
┌─────────────────────────────────────────────────────────────┐
│                        Internet                              │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                   Load Balancer / Nginx                      │
│  - SSL Termination                                           │
│  - Rate Limiting                                             │
│  - Static File Serving                                       │
└────────────────────────┬────────────────────────────────────┘
                         │
         ┌───────────────┴───────────────┐
         ▼                               ▼
┌──────────────────┐            ┌──────────────────┐
│   Frontend       │            │   Backend API    │
│   (React SPA)    │            │   (Node.js)      │
│   Port 80/443    │            │   Port 3000      │
└──────────────────┘            └────────┬─────────┘
                                         │
                    ┌────────────────────┼────────────────────┐
                    ▼                    ▼                    ▼
         ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
         │   PostgreSQL     │ │      Redis       │ │  Object Storage  │
         │   Port 5432      │ │    Port 6379     │ │   (S3/MinIO)     │
         │   - Primary DB   │ │   - Sessions     │ │   - Photos       │
         │   - Read Replica │ │   - Cache        │ │   - Logos        │
         └──────────────────┘ └──────────────────┘ └──────────────────┘
```

### 1.3 Network Security

**Network Zones:**
1. **Public Zone:** Load balancer only
2. **Application Zone:** Frontend and Backend (private network)
3. **Data Zone:** Database, Redis, Object Storage (private network)

**Firewall Rules:**
- Internet → Load Balancer: 80, 443
- Load Balancer → Frontend: 80
- Load Balancer → Backend: 3000
- Backend → Database: 5432
- Backend → Redis: 6379
- Backend → Object Storage: 443
- All other traffic: DENY

### 1.4 Resource Sizing

**Minimum Production Setup:**
- Load Balancer: 1 instance (2 vCPU, 2GB RAM)
- Backend: 2 instances (2 vCPU, 4GB RAM each)
- Frontend: 1 instance (1 vCPU, 1GB RAM) or CDN
- PostgreSQL: 1 instance (2 vCPU, 8GB RAM, 100GB SSD)
- Redis: 1 instance (1 vCPU, 2GB RAM)
- Object Storage: 50GB initial

**Recommended Production Setup:**
- Load Balancer: 2 instances (HA)
- Backend: 3+ instances (auto-scaling)
- Frontend: CDN distribution
- PostgreSQL: Primary + 1 Read Replica (4 vCPU, 16GB RAM, 500GB SSD)
- Redis: 2 instances (HA with replication)
- Object Storage: 500GB with CDN

## 2. Security Implementation

### 2.1 Secrets Management Strategy

**Development:** `.env` files (not committed)
**Production:** Environment variables from secret manager

**Secret Manager Options:**
1. **AWS Secrets Manager** (if using AWS)
2. **Azure Key Vault** (if using Azure)
3. **HashiCorp Vault** (cloud-agnostic)
4. **Kubernetes Secrets** (if using K8s)

**Secrets to Manage:**
```
# Application
JWT_SECRET=<256-bit random string>
ENCRYPTION_KEY=<32-byte hex string>
SESSION_SECRET=<256-bit random string>

# Database
DATABASE_URL=postgresql://user:password@host:5432/dbname?sslmode=require

# Redis
REDIS_URL=redis://:password@host:6379

# Object Storage
AWS_ACCESS_KEY_ID=<key>
AWS_SECRET_ACCESS_KEY=<secret>
S3_BUCKET_NAME=<bucket>

# External Services
SENDGRID_API_KEY=<key>
STRIPE_SECRET_KEY=<key>

# SSO (per tenant)
AZURE_AD_CLIENT_SECRET=<secret>
GOOGLE_CLIENT_SECRET=<secret>
```

### 2.2 Rate Limiting Configuration

**Implementation:** Express rate-limit middleware

```typescript
// Global rate limit
app.use(rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // 1000 requests per window
  message: 'Too many requests, please try again later'
}));

// Auth endpoints (stricter)
authRouter.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5, // 5 login attempts per 15 minutes
  skipSuccessfulRequests: true
}));

// API endpoints (per user)
apiRouter.use(rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute per user
  keyGenerator: (req) => req.user?.id || req.ip
}));
```

### 2.3 CORS Configuration

```typescript
const corsOptions = {
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://yourdomain.com', 'https://app.yourdomain.com']
    : ['http://localhost:5173', 'http://localhost:3000'],
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
```

### 2.4 Security Headers

```typescript
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://api.yourdomain.com"]
    }
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));
```

## 3. Deployment Strategy

### 3.1 Deployment Environments

1. **Development:** Local developer machines
2. **Staging:** Production-like environment for testing
3. **Production:** Live environment serving users

### 3.2 Deployment Process

**Blue-Green Deployment Strategy:**

1. **Prepare Green Environment**
   - Deploy new version to green environment
   - Run database migrations
   - Verify health checks pass

2. **Smoke Test Green**
   - Run automated smoke tests
   - Manual verification of critical flows
   - Check logs for errors

3. **Switch Traffic**
   - Update load balancer to route to green
   - Monitor metrics closely
   - Keep blue environment running

4. **Verify Production**
   - Monitor error rates
   - Check user feedback
   - Verify all features working

5. **Decommission Blue**
   - After 24 hours of stable green
   - Keep blue as rollback option for 7 days

**Rollback Procedure:**
- Switch load balancer back to blue environment
- Rollback database migrations if needed
- Investigate and fix issues in green
- Redeploy when ready

### 3.3 Database Migration Strategy

**Migration Process:**
1. Backup database before migration
2. Run migrations in transaction (where possible)
3. Verify migration success
4. Test application with new schema
5. Keep rollback script ready

**Migration Safety:**
- Never drop columns in same release as code changes
- Add columns as nullable first, populate, then make required
- Use feature flags for breaking changes
- Test migrations on staging with production data copy

### 3.4 CI/CD Pipeline

**GitHub Actions Workflow:**

```yaml
# .github/workflows/deploy-production.yml
name: Deploy to Production

on:
  push:
    branches: [main]
  workflow_dispatch:

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - Checkout code
      - Install dependencies
      - Run linting
      - Run unit tests
      - Run integration tests
      - Run security tests
      
  build:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - Build Docker images
      - Push to container registry
      - Tag with version and latest
      
  deploy-staging:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - Deploy to staging environment
      - Run database migrations
      - Run smoke tests
      - Run E2E tests
      
  deploy-production:
    needs: deploy-staging
    runs-on: ubuntu-latest
    environment: production
    steps:
      - Deploy to production (blue-green)
      - Run database migrations
      - Switch traffic to new version
      - Run smoke tests
      - Monitor metrics
```

## 4. Monitoring and Observability

### 4.1 Metrics Collection

**Prometheus Metrics to Track:**

**Application Metrics:**
- `http_requests_total` - Total HTTP requests by method, path, status
- `http_request_duration_seconds` - Request latency histogram
- `http_requests_in_flight` - Current active requests
- `auth_login_attempts_total` - Login attempts by result
- `auth_active_sessions` - Current active user sessions
- `employee_search_queries_total` - Search queries performed
- `database_query_duration_seconds` - Database query latency
- `cache_hits_total` - Cache hits by cache type
- `cache_misses_total` - Cache misses by cache type

**Infrastructure Metrics:**
- `process_cpu_seconds_total` - CPU usage
- `process_resident_memory_bytes` - Memory usage
- `nodejs_heap_size_total_bytes` - Node.js heap size
- `nodejs_heap_size_used_bytes` - Node.js heap used
- `database_connections_active` - Active DB connections
- `database_connections_idle` - Idle DB connections
- `redis_connected_clients` - Redis client connections

### 4.2 Grafana Dashboards

**Dashboard 1: Application Overview**
- Request rate (requests/second)
- Error rate (%)
- Response time (p50, p95, p99)
- Active users
- Top endpoints by traffic

**Dashboard 2: Performance**
- API endpoint latency by route
- Database query performance
- Cache hit rates
- Slow query log
- Resource usage (CPU, memory)

**Dashboard 3: Business Metrics**
- User logins per hour
- Employee searches per hour
- Profile updates per hour
- Most searched terms
- Most viewed profiles

**Dashboard 4: Infrastructure**
- Server CPU and memory
- Database connections
- Redis memory usage
- Disk space
- Network throughput

### 4.3 Alerting Rules

**Critical Alerts (Page immediately):**
```yaml
# Service Down
- alert: ServiceDown
  expr: up{job="company-directory-backend"} == 0
  for: 1m
  annotations:
    summary: "Service {{ $labels.instance }} is down"

# High Error Rate
- alert: HighErrorRate
  expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.05
  for: 5m
  annotations:
    summary: "Error rate above 5% for 5 minutes"

# Database Connection Failure
- alert: DatabaseConnectionFailure
  expr: database_connections_active == 0
  for: 1m
  annotations:
    summary: "No active database connections"
```

**Warning Alerts (Notify but don't page):**
```yaml
# High CPU Usage
- alert: HighCPUUsage
  expr: process_cpu_seconds_total > 0.8
  for: 10m
  annotations:
    summary: "CPU usage above 80% for 10 minutes"

# High Memory Usage
- alert: HighMemoryUsage
  expr: process_resident_memory_bytes / node_memory_total_bytes > 0.85
  for: 10m
  annotations:
    summary: "Memory usage above 85% for 10 minutes"

# Low Cache Hit Rate
- alert: LowCacheHitRate
  expr: rate(cache_hits_total[5m]) / (rate(cache_hits_total[5m]) + rate(cache_misses_total[5m])) < 0.5
  for: 15m
  annotations:
    summary: "Cache hit rate below 50% for 15 minutes"
```

### 4.4 Log Aggregation

**Log Structure:**
```json
{
  "timestamp": "2024-02-06T10:30:00.000Z",
  "level": "info",
  "message": "User login successful",
  "requestId": "req-123-456",
  "userId": "user-789",
  "tenantId": "tenant-001",
  "ip": "192.168.1.1",
  "userAgent": "Mozilla/5.0...",
  "duration": 150,
  "metadata": {
    "method": "POST",
    "path": "/api/auth/login",
    "status": 200
  }
}
```

**Log Levels:**
- **ERROR:** Application errors, exceptions, failures
- **WARN:** Degraded performance, deprecated features
- **INFO:** Important business events (login, profile update)
- **DEBUG:** Detailed diagnostic information (dev only)

**Log Retention:**
- ERROR logs: 90 days
- WARN logs: 60 days
- INFO logs: 30 days
- DEBUG logs: 7 days (staging only)

## 5. Backup and Disaster Recovery

### 5.1 Backup Strategy

**Database Backups:**
- **Full Backup:** Daily at 2 AM UTC
- **Incremental Backup:** Every 6 hours
- **Point-in-Time Recovery:** Enabled (WAL archiving)
- **Retention:** 30 days full, 7 days incremental
- **Storage:** Separate region/availability zone
- **Encryption:** AES-256 encryption at rest

**Backup Script:**
```bash
#!/bin/bash
# scripts/backup-database.sh

BACKUP_DIR="/backups/$(date +%Y-%m-%d)"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/company_directory_$TIMESTAMP.sql"

# Create backup directory
mkdir -p $BACKUP_DIR

# Perform backup
pg_dump -h $DB_HOST -U $DB_USER -d company_directory \
  --format=custom \
  --compress=9 \
  --file=$BACKUP_FILE

# Verify backup
if [ $? -eq 0 ]; then
  echo "Backup successful: $BACKUP_FILE"
  
  # Upload to S3
  aws s3 cp $BACKUP_FILE s3://company-directory-backups/$(date +%Y-%m-%d)/
  
  # Clean up old local backups (keep 7 days)
  find /backups -type f -mtime +7 -delete
else
  echo "Backup failed!"
  exit 1
fi
```

### 5.2 Disaster Recovery Plan

**Recovery Time Objective (RTO):** 4 hours
**Recovery Point Objective (RPO):** 6 hours

**DR Scenarios:**

**Scenario 1: Database Failure**
1. Promote read replica to primary (if available)
2. Or restore from latest backup
3. Update application connection strings
4. Verify data integrity
5. Resume operations

**Scenario 2: Complete Infrastructure Failure**
1. Provision new infrastructure in different region
2. Restore database from backup
3. Deploy application from container registry
4. Update DNS to point to new infrastructure
5. Verify all services operational

**Scenario 3: Data Corruption**
1. Identify corruption time window
2. Restore database to point before corruption
3. Replay transactions from WAL logs
4. Verify data integrity
5. Resume operations

### 5.3 Backup Testing

**Monthly Backup Test:**
1. Restore latest backup to test environment
2. Verify database schema matches production
3. Verify data integrity (row counts, checksums)
4. Test application against restored database
5. Measure restoration time
6. Document any issues

## 6. Performance Optimization

### 6.1 Database Optimization

**Index Strategy:**
```sql
-- Employees table
CREATE INDEX idx_employees_tenant_id ON employees(tenant_id);
CREATE INDEX idx_employees_email ON employees(email);
CREATE INDEX idx_employees_search ON employees USING GIN(search_vector);
CREATE INDEX idx_employees_manager_id ON employees(manager_id);
CREATE INDEX idx_employees_is_active ON employees(is_active) WHERE is_active = true;

-- Audit logs table
CREATE INDEX idx_audit_logs_tenant_id ON audit_logs(tenant_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);

-- Sessions table
CREATE INDEX idx_sessions_token ON sessions(token);
CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_expires_at ON sessions(expires_at);
```

**Connection Pooling:**
```typescript
// Prisma connection pool
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
  pool_timeout = 20
  connection_limit = 20
}

// For 2 backend instances: 20 connections each = 40 total
// PostgreSQL max_connections should be set to 100+
```

**Query Optimization:**
- Use `select` to fetch only needed fields
- Use `include` instead of separate queries
- Implement cursor-based pagination for large lists
- Use database views for complex queries
- Monitor slow query log and optimize

### 6.2 Caching Strategy

**Cache Layers:**

1. **Session Cache (Redis)**
   - TTL: 8 hours
   - Invalidation: On logout
   - Key pattern: `session:{token}`

2. **Employee Profile Cache (Redis)**
   - TTL: 5 minutes
   - Invalidation: On profile update
   - Key pattern: `employee:{tenantId}:{employeeId}`

3. **Search Results Cache (Redis)**
   - TTL: 5 minutes
   - Invalidation: On employee create/update/delete
   - Key pattern: `search:{tenantId}:{queryHash}`

4. **Tenant Config Cache (Redis)**
   - TTL: 1 hour
   - Invalidation: On tenant settings update
   - Key pattern: `tenant:{tenantId}:config`

**Cache Implementation:**
```typescript
// Cache wrapper with automatic invalidation
class CacheService {
  async get<T>(key: string): Promise<T | null> {
    const cached = await redis.get(key);
    return cached ? JSON.parse(cached) : null;
  }

  async set(key: string, value: any, ttl: number): Promise<void> {
    await redis.setex(key, ttl, JSON.stringify(value));
  }

  async invalidate(pattern: string): Promise<void> {
    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  }
}
```

### 6.3 Frontend Optimization

**Build Optimization:**
```typescript
// vite.config.ts
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor': ['react', 'react-dom', 'react-router-dom'],
          'ui': ['@headlessui/react', '@heroicons/react'],
          'utils': ['axios', 'date-fns']
        }
      }
    },
    chunkSizeWarningLimit: 1000
  }
});
```

**Image Optimization:**
- Compress images before upload (max 2MB)
- Serve images through CDN
- Use WebP format where supported
- Implement lazy loading for images
- Generate thumbnails for profile photos

**Code Splitting:**
```typescript
// Lazy load admin pages
const AdminDashboard = lazy(() => import('./pages/AdminDashboardPage'));
const AdminEmployees = lazy(() => import('./pages/AdminEmployeeManagementPage'));

// Wrap in Suspense
<Suspense fallback={<LoadingSpinner />}>
  <AdminDashboard />
</Suspense>
```

## 7. Operational Procedures

### 7.1 Deployment Runbook

**Pre-Deployment Checklist:**
- [ ] All tests passing in CI
- [ ] Staging deployment successful
- [ ] Database migration tested on staging
- [ ] Rollback plan prepared
- [ ] Team notified of deployment
- [ ] Monitoring dashboards open

**Deployment Steps:**
1. Create deployment tag: `git tag v1.0.0`
2. Trigger deployment pipeline
3. Monitor deployment progress
4. Verify health checks pass
5. Run smoke tests
6. Monitor metrics for 30 minutes
7. Announce deployment complete

**Post-Deployment Checklist:**
- [ ] All services healthy
- [ ] Error rate normal
- [ ] Response times normal
- [ ] No alerts firing
- [ ] User feedback positive
- [ ] Document any issues

### 7.2 Incident Response

**Severity Levels:**
- **P0 (Critical):** Service down, data loss, security breach
- **P1 (High):** Major feature broken, high error rate
- **P2 (Medium):** Minor feature broken, degraded performance
- **P3 (Low):** Cosmetic issues, minor bugs

**Incident Response Process:**
1. **Detect:** Alert fires or user report
2. **Assess:** Determine severity and impact
3. **Notify:** Page on-call engineer (P0/P1)
4. **Investigate:** Check logs, metrics, recent changes
5. **Mitigate:** Rollback, hotfix, or workaround
6. **Resolve:** Fix root cause
7. **Document:** Write incident report
8. **Review:** Post-mortem meeting

### 7.3 Maintenance Windows

**Scheduled Maintenance:**
- **Frequency:** Monthly (first Sunday, 2-4 AM UTC)
- **Duration:** 2 hours maximum
- **Activities:** 
  - Database maintenance (VACUUM, ANALYZE)
  - Security patches
  - Infrastructure updates
  - Performance optimization

**Maintenance Notification:**
- Notify users 7 days in advance
- Display banner 24 hours before
- Update status page
- Send email reminder

## 8. Launch Checklist

### 8.1 Infrastructure Checklist
- [ ] Production servers provisioned
- [ ] Database configured with backups
- [ ] Redis configured with persistence
- [ ] Object storage configured
- [ ] Load balancer configured
- [ ] SSL certificates installed
- [ ] DNS records configured
- [ ] Firewall rules configured
- [ ] Monitoring configured
- [ ] Alerting configured
- [ ] Log aggregation configured

### 8.2 Security Checklist
- [ ] All secrets rotated and secured
- [ ] Rate limiting enabled
- [ ] CORS configured for production
- [ ] Security headers enabled
- [ ] Input validation verified
- [ ] SQL injection tests pass
- [ ] XSS tests pass
- [ ] Authentication tests pass
- [ ] Authorization tests pass
- [ ] Tenant isolation verified

### 8.3 Testing Checklist
- [ ] All unit tests pass
- [ ] All integration tests pass
- [ ] All E2E tests pass on staging
- [ ] All security tests pass
- [ ] Load testing completed
- [ ] Performance benchmarks met
- [ ] Browser compatibility tested
- [ ] Mobile responsiveness tested

### 8.4 Documentation Checklist
- [ ] API documentation updated
- [ ] Deployment guide updated
- [ ] User guide complete
- [ ] Admin guide complete
- [ ] Runbooks created
- [ ] Privacy policy published
- [ ] Terms of service published

### 8.5 Operational Checklist
- [ ] Backup system tested
- [ ] Disaster recovery plan tested
- [ ] Monitoring dashboards created
- [ ] Alerts configured and tested
- [ ] On-call rotation established
- [ ] Incident response plan documented
- [ ] Support team trained
- [ ] Status page configured

## 9. Post-Launch Plan

### 9.1 First 24 Hours
- Monitor all metrics continuously
- Respond to any alerts immediately
- Collect user feedback
- Fix critical bugs with hotfixes
- Daily team sync

### 9.2 First Week
- Monitor metrics daily
- Review error logs daily
- Collect and triage user feedback
- Fix high-priority bugs
- Optimize performance issues
- Daily team sync

### 9.3 First Month
- Weekly metrics review
- Weekly user feedback review
- Monthly security review
- Monthly performance optimization
- Monthly backup test
- Post-launch retrospective

## 10. Success Metrics

### 10.1 Technical Metrics
- **Uptime:** >99.9%
- **Response Time:** p95 <2 seconds
- **Error Rate:** <1%
- **Cache Hit Rate:** >70%
- **Database Query Time:** p95 <100ms

### 10.2 Business Metrics
- **User Adoption:** Track daily active users
- **Feature Usage:** Track feature adoption rates
- **User Satisfaction:** Collect NPS scores
- **Support Tickets:** Track volume and resolution time
- **Performance:** Track page load times

### 10.3 Operational Metrics
- **Deployment Frequency:** Track deployments per week
- **Mean Time to Recovery:** Track incident resolution time
- **Change Failure Rate:** Track failed deployments
- **Backup Success Rate:** Track backup completion
- **Alert Noise:** Track false positive alerts
