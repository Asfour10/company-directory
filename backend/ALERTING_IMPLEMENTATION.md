# Alerting System Implementation

## Overview

The Company Directory alerting system provides comprehensive monitoring and alerting capabilities using Prometheus, Alertmanager, and custom application-level alerting. The system monitors application performance, infrastructure health, and business metrics to ensure reliable service operation.

## Architecture

### Components

1. **Prometheus** - Metrics collection and alerting rules evaluation
2. **Alertmanager** - Alert routing, grouping, and notification delivery
3. **Application Alerting Service** - Custom business logic alerts and webhook handling
4. **Grafana** - Visualization and dashboards (optional)
5. **Exporters** - System, database, and cache metrics collection

### Alert Flow

```
Application Metrics → Prometheus → Alerting Rules → Alertmanager → Notifications
                                                                 ↓
Custom Alerts → Application Alerting Service → Email/Webhook → Admin Interface
```

## Implementation Details

### 1. Prometheus Alerting Rules

**File**: `backend/prometheus/alerting-rules.yml`

**Key Alerts**:
- **HighErrorRate**: Triggers when HTTP error rate > 5% for 2 minutes
- **HighAPILatency**: Triggers when 95th percentile latency > 2 seconds for 3 minutes
- **DatabaseConnectionDown**: Triggers when no active database connections for 1 minute
- **RedisConnectionDown**: Triggers when no active Redis connections for 2 minutes
- **ServiceDown**: Triggers when service is unreachable for 1 minute
- **HighMemoryUsage**: Triggers when memory usage > 1GB for 5 minutes
- **HighRequestRate**: Triggers when request rate > 1000 req/s for 2 minutes
- **LowCacheHitRate**: Triggers when cache hit rate < 70% for 5 minutes
- **HighDatabaseLatency**: Triggers when DB query latency > 1s for 3 minutes
- **HealthCheckFailure**: Triggers when health check returns non-200 status

### 2. Alertmanager Configuration

**File**: `backend/prometheus/alertmanager.yml`

**Features**:
- **Routing**: Critical alerts go to on-call team, warnings to dev team
- **Grouping**: Alerts grouped by name and severity
- **Inhibition**: Warning alerts suppressed when critical alerts are active
- **Notifications**: Email and webhook delivery
- **Templates**: Custom formatting for different alert types

### 3. Application Alerting Service

**File**: `backend/src/services/alerting.service.ts`

**Capabilities**:
- Custom business logic alerts
- Webhook handling from Alertmanager
- Alert history and management
- Email notifications
- Alert resolution tracking
- Cooldown periods to prevent spam

### 4. Monitoring Stack

**File**: `backend/docker-compose.monitoring.yml`

**Services**:
- **Prometheus**: Metrics collection and alerting
- **Alertmanager**: Alert routing and notifications
- **Grafana**: Visualization dashboards
- **Node Exporter**: System metrics
- **PostgreSQL Exporter**: Database metrics
- **Redis Exporter**: Cache metrics

## Configuration

### Environment Variables

```bash
# Alert recipients (comma-separated)
ALERT_RECIPIENTS=admin@company.com,oncall@company.com

# SMTP configuration for email alerts
SMTP_HOST=smtp.company.com
SMTP_PORT=587
SMTP_USER=alerts@company.com
SMTP_PASS=your-smtp-password
SMTP_FROM=alerts@company.com
```

### Prometheus Configuration

**File**: `backend/prometheus/prometheus.yml`

- Scrapes application metrics from `/metrics` endpoint
- Evaluates alerting rules every 15 seconds
- Sends alerts to Alertmanager

### Alertmanager Setup

1. **Email Configuration**: Update SMTP settings in `alertmanager.yml`
2. **Recipients**: Configure different recipients for different severity levels
3. **Webhook**: Points to application webhook endpoint for internal processing

## API Endpoints

### Webhook Endpoint
```
POST /webhook/alerts
```
Receives alerts from Alertmanager for internal processing.

### Admin Endpoints
```
GET /admin/alerts              # Get active alerts
GET /admin/alerts/history      # Get alert history
POST /admin/alerts/:name/resolve  # Manually resolve alert
POST /admin/alerts/test        # Trigger test alert
```

## Deployment

### 1. Start Monitoring Stack

```bash
# Start the monitoring services
docker-compose -f docker-compose.monitoring.yml up -d

# Verify services are running
docker-compose -f docker-compose.monitoring.yml ps
```

### 2. Access Dashboards

- **Prometheus**: http://localhost:9090
- **Alertmanager**: http://localhost:9093
- **Grafana**: http://localhost:3001 (admin/admin123)

### 3. Test Alerting

```bash
# Run the alerting test script
npm run test:alerting

# Trigger a test alert via API
curl -X POST http://localhost:3000/admin/alerts/test \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Alert Runbooks

### High Error Rate
1. Check application logs for error patterns
2. Verify database connectivity
3. Check for recent deployments
4. Scale application if needed

### High API Latency
1. Check database query performance
2. Verify cache hit rates
3. Monitor system resources
4. Check for slow queries

### Database Connection Issues
1. Verify database server status
2. Check connection pool settings
3. Review database logs
4. Restart application if needed

### Service Down
1. Check application health endpoint
2. Verify container/process status
3. Check system resources
4. Review application logs

## Monitoring Best Practices

### 1. Alert Fatigue Prevention
- Use appropriate thresholds
- Implement cooldown periods
- Group related alerts
- Suppress lower-priority alerts when critical alerts are active

### 2. Escalation
- Critical alerts go to on-call team immediately
- Warning alerts go to development team
- Info alerts logged but not sent

### 3. Documentation
- Each alert includes runbook URL
- Clear descriptions and remediation steps
- Regular review and tuning of thresholds

### 4. Testing
- Regular testing of alert delivery
- Verify webhook endpoints
- Test email notifications
- Validate alert resolution

## Metrics Collected

### Application Metrics
- HTTP request rate, latency, and errors
- Database query duration
- Cache hit/miss rates
- Active connections

### System Metrics
- CPU usage and load
- Memory usage
- Disk usage and I/O
- Network traffic

### Business Metrics
- User activity
- Search performance
- Profile completeness
- Tenant usage

## Troubleshooting

### Common Issues

1. **Alerts not firing**
   - Check Prometheus targets are up
   - Verify alerting rules syntax
   - Check evaluation interval

2. **Notifications not delivered**
   - Verify SMTP configuration
   - Check Alertmanager logs
   - Test webhook endpoints

3. **False positives**
   - Adjust alert thresholds
   - Increase evaluation duration
   - Add inhibition rules

### Logs and Debugging

```bash
# Check Prometheus logs
docker logs company-directory-prometheus

# Check Alertmanager logs
docker logs company-directory-alertmanager

# Check application alerting logs
grep "alerting" backend/logs/app.log
```

## Future Enhancements

1. **PagerDuty Integration**: Add PagerDuty for critical alert escalation
2. **Slack Notifications**: Add Slack webhook for team notifications
3. **Custom Dashboards**: Create tenant-specific monitoring dashboards
4. **Predictive Alerts**: Implement ML-based anomaly detection
5. **SLA Monitoring**: Add SLA tracking and alerting
6. **Mobile Alerts**: SMS notifications for critical alerts

## Testing

The alerting system includes comprehensive tests:

```bash
# Run alerting system tests
npm run test:alerting

# Test specific alert rules
npm run test:alert-rules

# Test webhook handling
npm run test:webhooks
```

## Compliance

The alerting system supports compliance requirements:

- **Audit Trail**: All alerts logged with timestamps
- **Data Retention**: Alert history retained per tenant policy
- **Access Control**: Admin-only access to alert management
- **Encryption**: All alert data encrypted in transit and at rest