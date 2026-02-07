# Company Directory Monitoring Setup

This directory contains the configuration files for the Company Directory monitoring and alerting system.

## Quick Start

### 1. Start the Monitoring Stack

```bash
# From the backend directory
docker-compose -f docker-compose.monitoring.yml up -d
```

### 2. Verify Services

```bash
# Check all services are running
docker-compose -f docker-compose.monitoring.yml ps

# Check logs if needed
docker-compose -f docker-compose.monitoring.yml logs prometheus
docker-compose -f docker-compose.monitoring.yml logs alertmanager
```

### 3. Access Dashboards

- **Prometheus**: http://localhost:9090
- **Alertmanager**: http://localhost:9093  
- **Grafana**: http://localhost:3001 (admin/admin123)

### 4. Test the Setup

```bash
# Test the alerting system
npm run test:alerting

# Verify integration
npm run verify:alerting
```

## Configuration Files

### `alerting-rules.yml`
Prometheus alerting rules that define when alerts should fire:
- Error rate monitoring
- Latency monitoring  
- Infrastructure health checks
- Business metric alerts

### `prometheus.yml`
Main Prometheus configuration:
- Scrape targets (application, exporters)
- Alerting rule files
- Alertmanager integration

### `alertmanager.yml`
Alertmanager configuration:
- Email notification setup
- Alert routing and grouping
- Webhook integration with application

## Environment Setup

### Required Environment Variables

```bash
# Email configuration for alerts
ALERT_RECIPIENTS=admin@company.com,oncall@company.com
SMTP_HOST=smtp.company.com
SMTP_PORT=587
SMTP_USER=alerts@company.com
SMTP_PASSWORD=your-smtp-password
SMTP_FROM=alerts@company.com
```

### Optional Configuration

```bash
# Customize alert thresholds
ALERT_ERROR_RATE_THRESHOLD=5
ALERT_LATENCY_THRESHOLD=2
ALERT_MEMORY_THRESHOLD=1073741824  # 1GB in bytes
```

## Alert Types

### Critical Alerts
- **ServiceDown**: Application is unreachable
- **DatabaseConnectionDown**: Database connectivity lost
- **HighErrorRate**: Error rate above threshold
- **HealthCheckFailure**: Health endpoint failing

### Warning Alerts  
- **HighAPILatency**: API response times elevated
- **RedisConnectionDown**: Cache connectivity issues
- **HighMemoryUsage**: Memory usage above threshold
- **LowCacheHitRate**: Cache performance degraded
- **HighDatabaseLatency**: Database queries slow

## Customization

### Adding New Alerts

1. Edit `alerting-rules.yml` to add new alert rules
2. Update `alertmanager.yml` for routing if needed
3. Restart Prometheus: `docker-compose -f docker-compose.monitoring.yml restart prometheus`

### Modifying Thresholds

Edit the alert expressions in `alerting-rules.yml`:

```yaml
# Example: Change error rate threshold from 5% to 3%
- alert: HighErrorRate
  expr: (rate(http_requests_total{status_code=~"5.."}[5m]) / rate(http_requests_total[5m])) * 100 > 3
```

### Custom Notification Channels

Add new receivers in `alertmanager.yml`:

```yaml
receivers:
  - name: 'slack-alerts'
    slack_configs:
      - api_url: 'YOUR_SLACK_WEBHOOK_URL'
        channel: '#alerts'
        title: 'Company Directory Alert'
```

## Troubleshooting

### Common Issues

1. **Alerts not firing**
   ```bash
   # Check Prometheus targets
   curl http://localhost:9090/api/v1/targets
   
   # Check alert rules
   curl http://localhost:9090/api/v1/rules
   ```

2. **Notifications not sent**
   ```bash
   # Check Alertmanager status
   curl http://localhost:9093/api/v1/status
   
   # Check SMTP configuration
   docker logs company-directory-alertmanager
   ```

3. **Metrics not collected**
   ```bash
   # Verify application metrics endpoint
   curl http://localhost:3000/metrics
   
   # Check Prometheus scrape status
   docker logs company-directory-prometheus
   ```

### Log Locations

```bash
# Prometheus logs
docker logs company-directory-prometheus

# Alertmanager logs  
docker logs company-directory-alertmanager

# Grafana logs
docker logs company-directory-grafana

# Application logs
docker logs company-directory-app
```

## Production Deployment

### Security Considerations

1. **Authentication**: Enable authentication for Prometheus and Grafana
2. **TLS**: Configure TLS for all monitoring endpoints
3. **Network**: Restrict access to monitoring ports
4. **Secrets**: Use secrets management for SMTP credentials

### High Availability

1. **Prometheus**: Deploy multiple Prometheus instances
2. **Alertmanager**: Configure Alertmanager clustering
3. **Storage**: Use persistent volumes for data retention

### Backup and Recovery

1. **Prometheus Data**: Regular snapshots of TSDB
2. **Grafana Dashboards**: Export dashboard configurations
3. **Alert Rules**: Version control all configuration files

## Integration with CI/CD

### Automated Testing

```bash
# Add to your CI pipeline
npm run verify:alerting
npm run test:alerting
```

### Configuration Validation

```bash
# Validate Prometheus config
docker run --rm -v $(pwd)/prometheus:/etc/prometheus prom/prometheus:latest promtool check config /etc/prometheus/prometheus.yml

# Validate alert rules
docker run --rm -v $(pwd)/prometheus:/etc/prometheus prom/prometheus:latest promtool check rules /etc/prometheus/alerting-rules.yml
```

## Monitoring Best Practices

1. **Alert Fatigue**: Tune thresholds to reduce false positives
2. **Runbooks**: Document response procedures for each alert
3. **Testing**: Regularly test alert delivery and escalation
4. **Review**: Periodic review of alert effectiveness and thresholds
5. **Documentation**: Keep monitoring documentation up to date

## Support

For issues with the monitoring setup:

1. Check the troubleshooting section above
2. Review application logs for errors
3. Verify configuration files syntax
4. Test individual components in isolation
5. Consult the official documentation for Prometheus and Alertmanager