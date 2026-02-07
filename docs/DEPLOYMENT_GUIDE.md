# Company Directory Deployment Guide

## Table of Contents

- [Prerequisites](#prerequisites)
- [Infrastructure Requirements](#infrastructure-requirements)
- [Environment Setup](#environment-setup)
- [Deployment Options](#deployment-options)
- [Step-by-Step Deployment](#step-by-step-deployment)
- [Post-Deployment Configuration](#post-deployment-configuration)
- [Monitoring and Health Checks](#monitoring-and-health-checks)
- [Troubleshooting](#troubleshooting)
- [Maintenance](#maintenance)

## Prerequisites

### System Requirements

**Minimum Requirements (Development/Staging):**
- CPU: 2 cores
- RAM: 4GB
- Storage: 20GB SSD
- Network: 100 Mbps

**Recommended Requirements (Production):**
- CPU: 4+ cores
- RAM: 8GB+
- Storage: 100GB+ SSD
- Network: 1 Gbps
- Load balancer support

### Software Dependencies

**Required:**
- Docker 20.10+ and Docker Compose 2.0+
- Node.js 18+ (for local development)
- Git 2.30+

**Optional (for Kubernetes deployment):**
- Kubernetes 1.24+
- kubectl CLI
- Helm 3.0+ (recommended)

### External Services

**Required:**
- PostgreSQL 13+ (or managed database service)
- Redis 6+ (or managed cache service)
- Object storage (AWS S3, Azure Blob, or MinIO)

**Optional:**
- Email service (SendGrid, AWS SES, etc.)
- Monitoring service (Prometheus, Grafana)
- SSL certificate provider

## Infrastructure Requirements

### Network Architecture

```
Internet
    │
    ▼
┌─────────────────┐
│ Load Balancer   │ ← SSL Termination, Rate Limiting
│ (Nginx/ALB)     │
└─────────┬───────┘
          │
          ▼
┌─────────────────┐    ┌─────────────────┐
│ Frontend        │    │ Backend         │
│ (Port 80/443)   │    │ (Port 3000)     │
└─────────────────┘    └─────────┬───────┘
                                 │
          ┌──────────────────────┼──────────────────────┐
          ▼                      ▼                      ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│ PostgreSQL      │    │ Redis           │    │ Object Storage  │
│ (Port 5432)     │    │ (Port 6379)     │    │ (S3 API)        │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Security Requirements

**Network Security:**
- All external traffic over HTTPS (TLS 1.2+)
- Internal service communication encrypted
- Database connections over SSL
- VPC/private network isolation

**Access Control:**
- Firewall rules restricting access
- Database access limited to application servers
- Admin interfaces behind VPN/IP restrictions
- Regular security updates

## Environment Setup

### 1. Clone Repository

```bash
git clone https://github.com/your-org/company-directory.git
cd company-directory
```

### 2. Environment Configuration

Create environment files for each environment:

**Development (.env.development):**
```bash
# Copy from example
cp backend/.env.example backend/.env.development

# Edit configuration
nano backend/.env.development
```

**Production (.env.production):**
```bash
# Create production environment file
cp backend/.env.example backend/.env.production

# Configure production values
nano backend/.env.production
```

### 3. SSL Certificates

**Development (Self-signed):**
```bash
# Generate self-signed certificates
openssl req -x509 -newkey rsa:4096 -keyout nginx/ssl/key.pem -out nginx/ssl/cert.pem -days 365 -nodes
```

**Production (Let's Encrypt):**
```bash
# Install certbot
sudo apt-get install certbot

# Generate certificates
sudo certbot certonly --standalone -d yourdomain.com -d *.yourdomain.com
```

## Deployment Options

### Option 1: Docker Compose (Recommended for Small-Medium Scale)

**Pros:**
- Simple setup and management
- Good for single-server deployments
- Easy local development
- Built-in service discovery

**Cons:**
- Limited scaling options
- Single point of failure
- Manual load balancing

### Option 2: Kubernetes (Recommended for Large Scale)

**Pros:**
- Horizontal auto-scaling
- High availability
- Rolling updates
- Service mesh integration

**Cons:**
- Complex setup
- Requires Kubernetes expertise
- Higher resource overhead

### Option 3: Cloud Services (AWS/Azure/GCP)

**Pros:**
- Managed services
- Auto-scaling
- High availability
- Integrated monitoring

**Cons:**
- Vendor lock-in
- Higher costs
- Complex configuration

## Step-by-Step Deployment

### Docker Compose Deployment

#### 1. Prepare Environment

```bash
# Set environment
export ENVIRONMENT=production

# Create necessary directories
mkdir -p logs data/postgres data/redis

# Set permissions
chmod 755 logs data
```

#### 2. Configure Services

```bash
# Edit docker-compose.prod.yml
nano docker-compose.prod.yml

# Key configurations to verify:
# - Database credentials
# - Redis configuration
# - SSL certificate paths
# - Environment variables
```

#### 3. Deploy Infrastructure Services

```bash
# Start infrastructure services first
docker-compose -f infrastructure/docker-compose.infrastructure.yml up -d

# Verify services are running
docker-compose -f infrastructure/docker-compose.infrastructure.yml ps

# Check logs
docker-compose -f infrastructure/docker-compose.infrastructure.yml logs
```

#### 4. Initialize Database

```bash
# Run database migrations
cd backend
npm run migrate:deploy

# Seed initial data (optional)
npm run seed

# Verify database setup
npm run db:status
```

#### 5. Deploy Application

```bash
# Build and start application services
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build

# Verify deployment
docker-compose ps

# Check application logs
docker-compose logs -f backend
docker-compose logs -f frontend
```

#### 6. Configure Load Balancer

```bash
# Start nginx load balancer
docker-compose -f nginx/docker-compose.nginx.yml up -d

# Test load balancer
curl -I https://yourdomain.com
```

### Kubernetes Deployment

#### 1. Prepare Kubernetes Cluster

```bash
# Verify cluster access
kubectl cluster-info

# Create namespace
kubectl create namespace company-directory

# Set default namespace
kubectl config set-context --current --namespace=company-directory
```

#### 2. Configure Secrets

```bash
# Create database secret
kubectl create secret generic database-secret \
  --from-literal=username=postgres \
  --from-literal=password=your-secure-password \
  --from-literal=database=company_directory

# Create JWT secret
kubectl create secret generic jwt-secret \
  --from-literal=secret=your-jwt-secret

# Create SSL certificates
kubectl create secret tls ssl-cert \
  --cert=path/to/cert.pem \
  --key=path/to/key.pem
```

#### 3. Deploy Infrastructure

```bash
# Deploy PostgreSQL
kubectl apply -f infrastructure/k8s/postgres.yaml

# Deploy Redis
kubectl apply -f infrastructure/k8s/redis.yaml

# Wait for services to be ready
kubectl wait --for=condition=ready pod -l app=postgres --timeout=300s
kubectl wait --for=condition=ready pod -l app=redis --timeout=300s
```

#### 4. Deploy Application

```bash
# Deploy backend
kubectl apply -f infrastructure/k8s/backend-deployment.yaml

# Deploy frontend
kubectl apply -f infrastructure/k8s/frontend-deployment.yaml

# Deploy ingress
kubectl apply -f infrastructure/k8s/ingress.yaml

# Check deployment status
kubectl get deployments
kubectl get pods
kubectl get services
```

#### 5. Configure Ingress

```bash
# Install ingress controller (if not already installed)
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.8.1/deploy/static/provider/cloud/deploy.yaml

# Verify ingress
kubectl get ingress
kubectl describe ingress company-directory-ingress
```

### Cloud Deployment (AWS Example)

#### 1. Prepare AWS Resources

```bash
# Create VPC and subnets
aws cloudformation create-stack \
  --stack-name company-directory-vpc \
  --template-body file://infrastructure/aws/vpc.yaml

# Create RDS instance
aws cloudformation create-stack \
  --stack-name company-directory-rds \
  --template-body file://infrastructure/aws/rds.yaml

# Create ElastiCache cluster
aws cloudformation create-stack \
  --stack-name company-directory-redis \
  --template-body file://infrastructure/aws/elasticache.yaml
```

#### 2. Deploy to ECS

```bash
# Create ECS cluster
aws ecs create-cluster --cluster-name company-directory

# Register task definitions
aws ecs register-task-definition --cli-input-json file://infrastructure/aws/backend-task.json
aws ecs register-task-definition --cli-input-json file://infrastructure/aws/frontend-task.json

# Create services
aws ecs create-service \
  --cluster company-directory \
  --service-name backend \
  --task-definition company-directory-backend:1 \
  --desired-count 2

aws ecs create-service \
  --cluster company-directory \
  --service-name frontend \
  --task-definition company-directory-frontend:1 \
  --desired-count 2
```

## Post-Deployment Configuration

### 1. Verify Services

```bash
# Check service health
curl https://yourdomain.com/health
curl https://yourdomain.com/api/health

# Test database connection
curl https://yourdomain.com/api/health/db

# Test Redis connection
curl https://yourdomain.com/api/health/redis
```

### 2. Create Initial Admin User

```bash
# Connect to backend container
docker exec -it company-directory-backend bash

# Run user creation script
npm run create-admin-user -- \
  --email admin@yourdomain.com \
  --password secure-password \
  --tenant-name "Your Company"
```

### 3. Configure SSO (Optional)

```bash
# Update tenant SSO configuration
curl -X PUT https://yourdomain.com/api/tenant/sso-config \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "azure-ad",
    "config": {
      "clientId": "your-client-id",
      "clientSecret": "your-client-secret",
      "tenantId": "your-azure-tenant-id"
    }
  }'
```

### 4. Set Up Monitoring

```bash
# Deploy Prometheus and Grafana
docker-compose -f monitoring/docker-compose.monitoring.yml up -d

# Import Grafana dashboards
curl -X POST http://admin:admin@localhost:3001/api/dashboards/db \
  -H "Content-Type: application/json" \
  -d @monitoring/grafana/dashboards/application-dashboard.json
```

### 5. Configure Backups

```bash
# Set up automated database backups
crontab -e

# Add backup job (daily at 2 AM)
0 2 * * * /opt/company-directory/scripts/backup-database.sh

# Test backup
./scripts/backup-database.sh
```

## Monitoring and Health Checks

### Application Health Endpoints

```bash
# Overall health
GET /health

# Database health
GET /health/db

# Redis health
GET /health/redis

# Detailed health with metrics
GET /health/detailed
```

### Monitoring Metrics

**Application Metrics:**
- Request rate and latency
- Error rates by endpoint
- Database query performance
- Cache hit rates
- Active user sessions

**Infrastructure Metrics:**
- CPU and memory usage
- Disk I/O and space
- Network throughput
- Container health status

### Alerting Rules

**Critical Alerts:**
- Service down (> 1 minute)
- High error rate (> 5%)
- Database connection failures
- High response time (> 2 seconds)

**Warning Alerts:**
- High CPU usage (> 80%)
- High memory usage (> 85%)
- Low disk space (< 20%)
- Cache miss rate (> 50%)

## Troubleshooting

### Common Issues

#### 1. Service Won't Start

```bash
# Check container logs
docker logs company-directory-backend

# Check resource usage
docker stats

# Verify environment variables
docker exec company-directory-backend env | grep -E "(DATABASE|REDIS|JWT)"

# Check network connectivity
docker exec company-directory-backend ping postgres
```

#### 2. Database Connection Issues

```bash
# Test database connection
docker exec company-directory-backend npm run db:test

# Check PostgreSQL logs
docker logs company-directory-db

# Verify database credentials
docker exec company-directory-db psql -U postgres -c "\l"

# Check connection pool
docker exec company-directory-backend npm run db:pool-status
```

#### 3. High Memory Usage

```bash
# Check memory usage by service
docker stats --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}"

# Analyze Node.js memory usage
docker exec company-directory-backend npm run memory-profile

# Check for memory leaks
docker exec company-directory-backend npm run heap-dump
```

#### 4. SSL Certificate Issues

```bash
# Check certificate validity
openssl x509 -in /path/to/cert.pem -text -noout

# Test SSL connection
openssl s_client -connect yourdomain.com:443

# Renew Let's Encrypt certificate
sudo certbot renew --dry-run
```

### Performance Issues

#### 1. Slow Database Queries

```bash
# Enable query logging
docker exec company-directory-db psql -U postgres -c "ALTER SYSTEM SET log_statement = 'all';"

# Analyze slow queries
docker exec company-directory-db psql -U postgres -c "SELECT query, mean_time, calls FROM pg_stat_statements ORDER BY mean_time DESC LIMIT 10;"

# Check database indexes
docker exec company-directory-backend npm run db:analyze-indexes
```

#### 2. High CPU Usage

```bash
# Profile application
docker exec company-directory-backend npm run cpu-profile

# Check for infinite loops
docker exec company-directory-backend npm run debug-cpu

# Scale horizontally
docker-compose up -d --scale backend=3
```

### Recovery Procedures

#### 1. Database Recovery

```bash
# Restore from backup
./scripts/restore-database.sh /path/to/backup.sql

# Point-in-time recovery
./scripts/restore-database-pitr.sh "2024-01-01 12:00:00"

# Verify data integrity
docker exec company-directory-backend npm run db:verify
```

#### 2. Service Recovery

```bash
# Restart all services
docker-compose restart

# Rolling restart (zero downtime)
docker-compose up -d --force-recreate --no-deps backend

# Rollback deployment
docker-compose down
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

## Maintenance

### Regular Maintenance Tasks

#### Daily
- Monitor service health and performance
- Check error logs for issues
- Verify backup completion
- Review security alerts

#### Weekly
- Update security patches
- Analyze performance metrics
- Review and rotate logs
- Test disaster recovery procedures

#### Monthly
- Update dependencies
- Review and optimize database performance
- Audit user access and permissions
- Update documentation

### Update Procedures

#### 1. Application Updates

```bash
# Pull latest code
git pull origin main

# Build new images
docker-compose build

# Deploy with rolling update
docker-compose up -d --no-deps backend
docker-compose up -d --no-deps frontend

# Verify deployment
curl https://yourdomain.com/health
```

#### 2. Database Migrations

```bash
# Backup database before migration
./scripts/backup-database.sh

# Run migrations
docker exec company-directory-backend npm run migrate:deploy

# Verify migration
docker exec company-directory-backend npm run migrate:status
```

#### 3. Security Updates

```bash
# Update base images
docker pull node:18-alpine
docker pull postgres:15-alpine
docker pull redis:7-alpine
docker pull nginx:alpine

# Rebuild with updated images
docker-compose build --no-cache

# Deploy updates
docker-compose up -d
```

### Scaling Procedures

#### Horizontal Scaling

```bash
# Scale backend services
docker-compose up -d --scale backend=3

# Scale with Kubernetes
kubectl scale deployment company-directory-backend --replicas=5

# Auto-scaling with HPA
kubectl autoscale deployment company-directory-backend --cpu-percent=70 --min=2 --max=10
```

#### Database Scaling

```bash
# Add read replica
docker-compose -f docker-compose.yml -f docker-compose.replica.yml up -d

# Configure read/write splitting
# Update backend configuration to use read replica for queries
```

### Backup and Recovery

#### Automated Backups

```bash
# Database backup script
#!/bin/bash
BACKUP_DIR="/opt/backups/$(date +%Y-%m-%d)"
mkdir -p $BACKUP_DIR

# Full database backup
docker exec company-directory-db pg_dump -U postgres company_directory > $BACKUP_DIR/database.sql

# Compress backup
gzip $BACKUP_DIR/database.sql

# Upload to S3 (optional)
aws s3 cp $BACKUP_DIR/database.sql.gz s3://your-backup-bucket/$(date +%Y-%m-%d)/
```

#### Recovery Testing

```bash
# Test restore procedure monthly
./scripts/test-restore.sh

# Verify data integrity
./scripts/verify-backup.sh /path/to/backup.sql.gz
```

For additional support and advanced configuration options, refer to the [Infrastructure Documentation](./INFRASTRUCTURE.md) and [API Documentation](./API_DOCUMENTATION.md).