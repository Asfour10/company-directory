# Infrastructure Documentation

This document describes the production infrastructure setup for the Company Directory application.

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Components](#components)
- [Deployment Options](#deployment-options)
- [Configuration](#configuration)
- [Monitoring](#monitoring)
- [Security](#security)
- [Scaling](#scaling)
- [Backup and Recovery](#backup-and-recovery)
- [Troubleshooting](#troubleshooting)

## Architecture Overview

The Company Directory uses a microservices architecture with the following components:

```
┌─────────────────┐    ┌─────────────────┐
│   Load Balancer │    │   DNS/CDN       │
│   (Nginx)       │    │                 │
└─────────┬───────┘    └─────────────────┘
          │
          ▼
┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend       │
│   (React/Nginx) │    │   (Node.js)     │
└─────────────────┘    └─────────┬───────┘
                                 │
          ┌──────────────────────┼──────────────────────┐
          ▼                      ▼                      ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Database      │    │   Cache         │    │   Object Store  │
│   (PostgreSQL)  │    │   (Redis)       │    │   (S3/MinIO)    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Components

### Load Balancer (Nginx)

**Purpose**: Routes traffic, handles SSL termination, provides rate limiting and security headers.

**Configuration**: `nginx/nginx.conf`

**Features**:
- SSL/TLS termination with modern cipher suites
- Rate limiting (100 req/min per IP)
- Security headers (HSTS, CSP, etc.)
- Gzip compression
- Health check proxying
- Tenant subdomain routing

**Scaling**: Can be deployed behind cloud load balancers (ALB, Azure Load Balancer) for high availability.

### Frontend (React + Nginx)

**Purpose**: Serves the React application and static assets.

**Configuration**: `frontend/nginx.conf`

**Features**:
- Static asset serving with caching
- Client-side routing support
- Gzip compression
- Security headers

**Scaling**: Horizontally scalable, stateless containers.

### Backend (Node.js)

**Purpose**: API server handling business logic, authentication, and data processing.

**Configuration**: Environment variables (see `docs/ENVIRONMENT_VARIABLES.md`)

**Features**:
- RESTful API endpoints
- JWT authentication
- Multi-tenant isolation
- Rate limiting
- Metrics collection
- Health checks

**Scaling**: Horizontally scalable with load balancing.

### Database (PostgreSQL)

**Purpose**: Primary data store with read replicas for scaling.

**Configuration**: `infrastructure/database/postgresql.conf`

**Features**:
- Row-level security for tenant isolation
- Read replicas for scaling
- SSL/TLS encryption
- Automated backups
- Connection pooling

**Scaling**: 
- Read replicas for read-heavy workloads
- Connection pooling
- Partitioning for large datasets

### Cache (Redis)

**Purpose**: Session storage, caching, and temporary data.

**Configuration**: `infrastructure/redis/redis.conf`

**Features**:
- Session management
- Query result caching
- Rate limiting data
- SSL/TLS encryption
- Persistence (RDB + AOF)

**Scaling**:
- Redis Cluster for horizontal scaling
- Read replicas for read-heavy workloads

### Object Storage (S3/MinIO)

**Purpose**: File storage for profile photos and uploads.

**Features**:
- S3-compatible API
- Encryption at rest
- Access control
- CDN integration

**Scaling**: Virtually unlimited with cloud providers.

## Deployment Options

### Docker Compose (Development/Staging)

**Use Case**: Local development, staging environments, small deployments.

**Files**:
- `docker-compose.yml` - Main application services
- `docker-compose.override.yml` - Development overrides
- `docker-compose.prod.yml` - Production overrides
- `infrastructure/docker-compose.infrastructure.yml` - Infrastructure services

**Deployment**:
```bash
# Development
docker-compose up -d

# Production
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# Infrastructure only
docker-compose -f infrastructure/docker-compose.infrastructure.yml up -d
```

### Kubernetes (Production)

**Use Case**: Production environments, high availability, auto-scaling.

**Files**:
- `infrastructure/k8s/namespace.yaml` - Namespace definition
- `infrastructure/k8s/configmap.yaml` - Configuration
- `infrastructure/k8s/secrets.yaml` - Secrets (template)
- `infrastructure/k8s/backend-deployment.yaml` - Backend deployment
- `infrastructure/k8s/frontend-deployment.yaml` - Frontend deployment
- `infrastructure/k8s/ingress.yaml` - Ingress configuration

**Deployment**:
```bash
# Deploy infrastructure
./scripts/deploy-infrastructure.sh production kubernetes

# Or manually
kubectl apply -f infrastructure/k8s/
```

## Configuration

### Environment Variables

See `docs/ENVIRONMENT_VARIABLES.md` for complete configuration reference.

### Secrets Management

**Development**: `.env` files (gitignored)

**Production Options**:
- AWS Secrets Manager
- Azure Key Vault
- Kubernetes Secrets
- HashiCorp Vault

### SSL/TLS Certificates

**Development**: Self-signed certificates

**Production Options**:
- Let's Encrypt (automated with cert-manager)
- Commercial certificates
- Cloud provider certificates (ACM, Azure Key Vault)

## Monitoring

### Metrics Collection

**Prometheus**: Collects metrics from all services
- Application metrics (request rate, latency, errors)
- Infrastructure metrics (CPU, memory, disk)
- Database metrics (connections, query performance)
- Cache metrics (hit rate, memory usage)

**Configuration**: `backend/prometheus/prometheus.yml`

### Visualization

**Grafana**: Dashboards for metrics visualization
- Application performance dashboard
- Infrastructure monitoring dashboard
- Business metrics dashboard

**Configuration**: `backend/grafana/provisioning/`

### Alerting

**Alertmanager**: Handles alerts from Prometheus
- High error rates
- Performance degradation
- Infrastructure issues
- Security events

**Configuration**: `backend/prometheus/alertmanager.yml`

### Logging

**Structured Logging**: JSON format with correlation IDs
- Application logs
- Access logs
- Error logs
- Audit logs

**Log Aggregation Options**:
- ELK Stack (Elasticsearch, Logstash, Kibana)
- Fluentd + Elasticsearch
- Cloud logging (CloudWatch, Azure Monitor)

## Security

### Network Security

- **TLS 1.2+**: All communications encrypted
- **Security Headers**: HSTS, CSP, X-Frame-Options
- **Rate Limiting**: Protection against abuse
- **IP Whitelisting**: Restrict admin access

### Application Security

- **JWT Authentication**: Secure token-based auth
- **Row-Level Security**: Database-level tenant isolation
- **Input Validation**: Prevent injection attacks
- **CORS Configuration**: Restrict cross-origin requests

### Data Security

- **Encryption at Rest**: Database and file storage
- **Encryption in Transit**: TLS for all connections
- **Field-Level Encryption**: Sensitive data fields
- **Key Management**: Separate key storage

### Access Control

- **Role-Based Access**: User, Manager, Admin, Super Admin
- **Principle of Least Privilege**: Minimal required permissions
- **Audit Logging**: Track all access and changes
- **Session Management**: Secure session handling

## Scaling

### Horizontal Scaling

**Frontend**: Stateless, easily scalable
- Multiple container instances
- CDN for static assets
- Geographic distribution

**Backend**: Stateless API servers
- Load balancing across instances
- Auto-scaling based on CPU/memory
- Circuit breakers for resilience

### Database Scaling

**Read Replicas**: Scale read operations
- Separate read and write traffic
- Geographic distribution
- Automatic failover

**Connection Pooling**: Efficient connection management
- PgBouncer or built-in pooling
- Connection limits per service
- Connection health monitoring

**Partitioning**: Handle large datasets
- Tenant-based partitioning
- Time-based partitioning
- Automatic partition management

### Cache Scaling

**Redis Cluster**: Horizontal scaling
- Automatic sharding
- High availability
- Consistent hashing

**Cache Strategies**:
- Write-through caching
- Cache-aside pattern
- TTL-based expiration

## Backup and Recovery

### Database Backups

**Automated Backups**:
- Daily full backups
- Continuous WAL archiving
- Point-in-time recovery
- Cross-region replication

**Backup Verification**:
- Regular restore tests
- Backup integrity checks
- Recovery time testing

### File Storage Backups

**Object Storage**:
- Versioning enabled
- Cross-region replication
- Lifecycle policies
- Backup verification

### Disaster Recovery

**RTO/RPO Targets**:
- RTO: 4 hours (Recovery Time Objective)
- RPO: 1 hour (Recovery Point Objective)

**Recovery Procedures**:
- Documented runbooks
- Regular DR testing
- Automated failover
- Data consistency checks

## Troubleshooting

### Common Issues

#### High CPU Usage
```bash
# Check container resources
docker stats

# Check Kubernetes resources
kubectl top pods -n company-directory

# Check application metrics
curl http://localhost:9090/metrics
```

#### Database Connection Issues
```bash
# Check connection pool
SELECT * FROM pg_stat_activity;

# Check connection limits
SHOW max_connections;

# Check database logs
tail -f /var/log/postgresql/postgresql.log
```

#### Cache Issues
```bash
# Check Redis status
redis-cli info

# Check memory usage
redis-cli info memory

# Check connection count
redis-cli info clients
```

### Monitoring Commands

```bash
# Docker health checks
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

# Kubernetes status
kubectl get pods -n company-directory
kubectl describe pod <pod-name> -n company-directory

# Service logs
docker logs <container-name>
kubectl logs <pod-name> -n company-directory

# Resource usage
docker stats
kubectl top pods -n company-directory
```

### Performance Tuning

#### Database Optimization
- Query optimization with EXPLAIN ANALYZE
- Index optimization
- Connection pool tuning
- Vacuum and analyze scheduling

#### Cache Optimization
- Cache hit rate monitoring
- TTL optimization
- Memory usage optimization
- Eviction policy tuning

#### Application Optimization
- Response time monitoring
- Memory leak detection
- CPU profiling
- Database query optimization

## Deployment Scripts

### Infrastructure Deployment
```bash
# Deploy with Docker
./scripts/deploy-infrastructure.sh staging docker

# Deploy with Kubernetes
./scripts/deploy-infrastructure.sh production kubernetes
```

### Application Deployment
```bash
# Build and deploy
./scripts/deploy.sh production

# Rolling update
kubectl rollout restart deployment/company-directory-backend -n company-directory
```

### Secrets Management
```bash
# Generate development secrets
./scripts/setup-secrets.sh development

# Production secrets (manual process)
./scripts/setup-secrets.sh production
```

For more detailed deployment instructions, see the [Deployment Guide](./DEPLOYMENT.md).