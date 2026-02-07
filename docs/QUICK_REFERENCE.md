# Production Launch Quick Reference

## Essential Commands

### Generate Secrets
```bash
# Linux/Mac
./scripts/generate-secrets.sh

# Windows PowerShell
.\scripts\generate-secrets.ps1
```

### Database Setup
```bash
# Set connection string
export DATABASE_URL="postgresql://user:pass@host:5432/dbname?sslmode=require"

# Run migrations
cd backend
npm run prisma:migrate deploy

# Verify setup
cd ..
./scripts/verify-database-setup.sh
```

### Application Deployment
```bash
# Build for production
npm run build

# Start with Docker Compose
docker-compose -f docker-compose.prod.yml up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f backend
docker-compose logs -f frontend
```

### Health Checks
```bash
# Check backend health
curl https://api.yourdomain.com/health

# Check database connection
curl https://api.yourdomain.com/health/db

# Check Redis connection
curl https://api.yourdomain.com/health/redis
```

### Backup and Restore
```bash
# Manual backup
./scripts/backup-database.sh

# Restore from backup
pg_restore -h localhost -U dbadmin -d company_directory /path/to/backup.dump

# List backup contents
pg_restore --list /path/to/backup.dump
```

### Monitoring
```bash
# View application metrics
curl https://api.yourdomain.com/metrics

# Check Prometheus
open http://localhost:9090

# Check Grafana
open http://localhost:3001
```

### Troubleshooting
```bash
# Check container logs
docker-compose logs -f backend

# Check database connections
psql "$DATABASE_URL" -c "SELECT count(*) FROM pg_stat_activity;"

# Check Redis
redis-cli -h redis-host -a password ping

# Restart services
docker-compose restart backend
```

## Environment Variables

### Critical Variables
```bash
# Application
NODE_ENV=production
PORT=3000
API_URL=https://api.yourdomain.com
FRONTEND_URL=https://app.yourdomain.com

# Database
DATABASE_URL="postgresql://user:pass@host:5432/db?sslmode=require"

# Redis
REDIS_URL="redis://:password@host:6379/0"

# Security
JWT_SECRET="<generate-with-openssl>"
ENCRYPTION_KEY="<generate-with-openssl>"
SESSION_SECRET="<generate-with-openssl>"
```

## File Locations

### Configuration Files
- `backend/.env.production` - Production environment variables
- `docker-compose.prod.yml` - Production Docker Compose config
- `nginx/nginx.conf` - Nginx configuration
- `infrastructure/database/postgresql.conf` - PostgreSQL config

### Documentation
- `docs/PRODUCTION_SETUP_GUIDE.md` - Complete setup guide
- `docs/PRODUCTION_LAUNCH_CHECKLIST.md` - Launch checklist
- `docs/DEPLOYMENT_GUIDE.md` - Deployment procedures
- `docs/ENVIRONMENT_VARIABLES.md` - Environment variable reference

### Scripts
- `scripts/generate-secrets.sh` - Generate secrets
- `scripts/verify-database-setup.sh` - Verify database
- `scripts/backup-database.sh` - Backup database
- `scripts/deploy-infrastructure.sh` - Deploy infrastructure

## Common Issues

### Database Connection Failed
```bash
# Check if database is accessible
pg_isready -h <host> -p 5432

# Test connection
psql "$DATABASE_URL" -c "SELECT 1;"

# Check firewall rules
telnet <host> 5432
```

### Application Won't Start
```bash
# Check logs
docker-compose logs backend

# Check environment variables
docker-compose exec backend env | grep DATABASE

# Restart container
docker-compose restart backend
```

### High Memory Usage
```bash
# Check container stats
docker stats

# Check Node.js memory
docker-compose exec backend node -e "console.log(process.memoryUsage())"

# Restart if needed
docker-compose restart backend
```

## Security Checklist

- [ ] All secrets generated with proper entropy
- [ ] Database password is strong (16+ characters)
- [ ] SSL/TLS enabled for all connections
- [ ] CORS configured for production domains only
- [ ] Rate limiting enabled
- [ ] Security headers configured
- [ ] Firewall rules restrict access
- [ ] Secrets stored in secret manager (not .env files)

## Pre-Launch Checklist

- [ ] Database provisioned and configured
- [ ] Redis provisioned and configured
- [ ] Object storage configured
- [ ] Application deployed
- [ ] SSL certificates installed
- [ ] DNS configured
- [ ] Monitoring configured
- [ ] Backups configured and tested
- [ ] All tests passing
- [ ] Documentation complete

## Emergency Contacts

### On-Call Rotation
- Primary: [Name] - [Phone] - [Email]
- Secondary: [Name] - [Phone] - [Email]
- Escalation: [Name] - [Phone] - [Email]

### Service Providers
- Hosting: [Provider] - [Support URL] - [Phone]
- Database: [Provider] - [Support URL] - [Phone]
- DNS: [Provider] - [Support URL] - [Phone]

## Useful Links

- Production Dashboard: https://app.yourdomain.com
- API Documentation: https://api.yourdomain.com/docs
- Monitoring: https://monitoring.yourdomain.com
- Status Page: https://status.yourdomain.com
- GitHub Repository: https://github.com/your-org/company-directory

## Support

For issues or questions:
1. Check documentation in `docs/` directory
2. Review troubleshooting section
3. Check application logs
4. Contact on-call engineer
5. Escalate if needed

---

**Last Updated:** 2024-02-06
