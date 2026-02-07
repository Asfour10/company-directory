# Database Migration Guide

This document outlines the database migration process for the Company Directory application, including automated CI/CD integration and rollback procedures.

## Overview

The application uses Prisma as the ORM and migration tool. All database schema changes are managed through Prisma migrations, which are automatically applied during deployment.

## Migration Workflow

### 1. Development
- Make changes to `backend/prisma/schema.prisma`
- Run `npm run prisma:migrate` to create a new migration
- Test the migration locally
- Commit the migration files to version control

### 2. CI/CD Pipeline
- Migrations are automatically applied during deployment
- Backups are created before applying migrations
- Rollback procedures are available if needed

### 3. Production Deployment
- Blue-green deployment strategy ensures zero downtime
- Database migrations are applied before switching traffic
- Comprehensive health checks validate the deployment

## Migration Scripts

### Automated Migration Script
```bash
# Deploy migrations
./scripts/migrate.sh deploy staging
./scripts/migrate.sh deploy production

# Rollback migrations
./scripts/migrate.sh rollback staging
./scripts/migrate.sh rollback production

# Check migration status
./scripts/migrate.sh status staging
```

### PowerShell (Windows)
```powershell
# Deploy migrations
.\scripts\migrate.ps1 deploy staging
.\scripts\migrate.ps1 deploy production

# Rollback migrations
.\scripts\migrate.ps1 rollback staging
.\scripts\migrate.ps1 rollback production

# Check migration status
.\scripts\migrate.ps1 status staging
```

### Manual Migration Commands
```bash
cd backend

# Generate Prisma client
npm run prisma:generate

# Apply pending migrations
npm run prisma:migrate:deploy

# Check migration status
npm run prisma:migrate:status

# View migration history
npm run migration:status

# Validate migration integrity
npm run migration:validate

# Generate migration report
npm run migration:report
```

## GitHub Actions Workflows

### Automated Deployment
Migrations are automatically applied during the deployment process:
- `.github/workflows/deploy.yml` - Main deployment pipeline
- Includes migration job that runs before application deployment
- Creates backups before applying migrations

### Manual Migration Workflow
For emergency migrations or rollbacks:
- `.github/workflows/migrate.yml` - Manual migration workflow
- Supports deploy, rollback, and status operations
- Can be triggered manually from GitHub Actions UI

## Backup and Rollback Procedures

### Automatic Backups
- Backups are created before every migration
- Stored locally and uploaded to S3/cloud storage
- Backup files are named with timestamp: `backup_YYYYMMDD_HHMMSS.sql`

### Rollback Process
1. **Identify the backup file** from the last successful state
2. **Run the rollback command** with the backup file
3. **Verify the rollback** by checking application functionality
4. **Update the application code** if necessary to match the rolled-back schema

### Emergency Rollback
```bash
# Find the last backup
ls -la backup_*.sql

# Rollback using the migration script
./scripts/migrate.sh rollback production

# Or manually restore from a specific backup
PGPASSWORD=password psql -h host -U user -d database < backup_20240101_120000.sql
```

## Migration Best Practices

### Schema Changes
1. **Always create migrations for schema changes**
2. **Test migrations on staging before production**
3. **Use descriptive migration names**
4. **Avoid breaking changes when possible**

### Data Migrations
1. **Separate schema and data migrations**
2. **Use transactions for data consistency**
3. **Test with production-like data volumes**
4. **Plan for rollback scenarios**

### Deployment Strategy
1. **Apply migrations before code deployment**
2. **Use blue-green deployment for zero downtime**
3. **Monitor application health after migration**
4. **Have rollback plan ready**

## Monitoring and Alerting

### Migration Monitoring
- Migration status is tracked in the `_prisma_migrations` table
- Failed migrations are logged and alerted
- Migration duration is monitored for performance

### Health Checks
- Database connectivity checks
- Migration status validation
- Application functionality verification

### Alerting
- Slack notifications for migration success/failure
- Email alerts for critical migration issues
- Dashboard monitoring for migration metrics

## Troubleshooting

### Common Issues

#### Migration Fails
1. Check the migration logs for specific errors
2. Verify database connectivity and permissions
3. Check for schema conflicts or data issues
4. Consider rolling back and fixing the migration

#### Rollback Fails
1. Verify backup file integrity
2. Check database permissions
3. Ensure sufficient disk space
4. Consider manual data recovery

#### Performance Issues
1. Monitor migration duration
2. Check for blocking queries
3. Consider maintenance windows for large migrations
4. Optimize migration queries if needed

### Debug Commands
```bash
# Check database connection
npm run test:db

# Validate Prisma setup
npm run validate:prisma

# Check migration integrity
npm run migration:validate

# Generate detailed migration report
npm run migration:report
```

## Environment Configuration

### Required Environment Variables
```bash
# Database connection
DATABASE_URL=postgresql://user:password@host:port/database

# AWS credentials for backups (optional)
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_REGION=us-east-1

# Backup bucket
BACKUP_BUCKET=company-directory-db-backups
```

### Staging Environment
- Database: `company_directory_staging`
- Backup bucket: `company-directory-db-backups-staging`
- Automated migrations on every push to main

### Production Environment
- Database: `company_directory_production`
- Backup bucket: `company-directory-db-backups-production`
- Manual approval required for migrations
- Blue-green deployment strategy

## Security Considerations

### Access Control
- Database credentials stored as GitHub secrets
- Limited access to production migration workflows
- Audit logging for all migration activities

### Backup Security
- Backups encrypted at rest
- Access restricted to authorized personnel
- Regular backup integrity checks

### Migration Security
- Code review required for all migrations
- Automated security scanning of migration files
- Principle of least privilege for database access

## Support and Escalation

### Migration Issues
1. Check the migration logs and error messages
2. Consult this documentation for common solutions
3. Contact the development team for assistance
4. Escalate to database administrator if needed

### Emergency Contacts
- Development Team: dev-team@company.com
- Database Administrator: dba@company.com
- DevOps Team: devops@company.com
- On-call Engineer: oncall@company.com