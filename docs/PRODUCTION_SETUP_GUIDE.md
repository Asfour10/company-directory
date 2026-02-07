# Production Setup Guide

## Overview
This guide walks you through setting up production infrastructure for the Company Directory application. Follow these steps in order to ensure a secure and reliable deployment.

## Prerequisites
- Access to a cloud provider (AWS, Azure, GCP) or dedicated servers
- Domain name registered and DNS access
- SSL certificate or ability to generate one (Let's Encrypt)
- Basic knowledge of Docker and database administration

## Phase 1: Database Infrastructure Setup

### Step 1.1: Choose Your Database Hosting Option

**Option A: Managed Database Service (Recommended)**
- **AWS RDS PostgreSQL**
  - Easy setup and management
  - Automated backups and updates
  - Built-in monitoring
  - Cost: ~$50-200/month depending on size
  
- **Azure Database for PostgreSQL**
  - Similar features to AWS RDS
  - Good integration with Azure services
  - Cost: ~$50-200/month
  
- **Google Cloud SQL for PostgreSQL**
  - Similar features to AWS/Azure
  - Good integration with GCP services
  - Cost: ~$50-200/month

**Option B: Self-Hosted PostgreSQL**
- More control and potentially lower cost
- Requires more operational expertise
- You manage backups, updates, monitoring
- Cost: Server costs only (~$20-100/month)

### Step 1.2: Provision PostgreSQL Instance

#### For AWS RDS:

```bash
# Using AWS CLI
aws rds create-db-instance \
  --db-instance-identifier company-directory-prod \
  --db-instance-class db.t3.medium \
  --engine postgres \
  --engine-version 15.4 \
  --master-username dbadmin \
  --master-user-password <STRONG_PASSWORD> \
  --allocated-storage 100 \
  --storage-type gp3 \
  --storage-encrypted \
  --backup-retention-period 30 \
  --preferred-backup-window "02:00-03:00" \
  --preferred-maintenance-window "sun:03:00-sun:04:00" \
  --vpc-security-group-ids sg-xxxxx \
  --db-subnet-group-name my-db-subnet-group \
  --publicly-accessible false \
  --enable-cloudwatch-logs-exports '["postgresql"]' \
  --tags Key=Environment,Value=Production Key=Application,Value=CompanyDirectory
```

#### For Self-Hosted (Docker):

```yaml
# infrastructure/docker-compose.production.yml
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    container_name: company-directory-postgres
    restart: always
    environment:
      POSTGRES_DB: company_directory
      POSTGRES_USER: dbadmin
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_INITDB_ARGS: "--encoding=UTF8 --locale=en_US.UTF-8"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./database/postgresql.conf:/etc/postgresql/postgresql.conf
      - ./backups:/backups
    ports:
      - "5432:5432"
    command: postgres -c config_file=/etc/postgresql/postgresql.conf
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U dbadmin -d company_directory"]
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  postgres_data:
    driver: local
```

### Step 1.3: Configure Database Security

#### Create Production Database User

```sql
-- Connect as admin user
psql -h <DB_HOST> -U dbadmin -d company_directory

-- Create application user with limited privileges
CREATE USER app_user WITH PASSWORD '<STRONG_PASSWORD>';

-- Grant necessary privileges
GRANT CONNECT ON DATABASE company_directory TO app_user;
GRANT USAGE ON SCHEMA public TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;

-- Set default privileges for future tables
ALTER DEFAULT PRIVILEGES IN SCHEMA public 
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public 
  GRANT USAGE, SELECT ON SEQUENCES TO app_user;
```

#### Configure Network Access

**For AWS RDS:**
1. Create security group allowing access only from backend servers
2. Configure VPC to isolate database in private subnet
3. Enable SSL/TLS connections

```bash
# Security group rule (allow from backend security group only)
aws ec2 authorize-security-group-ingress \
  --group-id sg-database \
  --protocol tcp \
  --port 5432 \
  --source-group sg-backend
```

**For Self-Hosted:**
1. Configure firewall to allow connections only from backend servers
2. Update `pg_hba.conf` to require SSL

```conf
# pg_hba.conf
# TYPE  DATABASE        USER            ADDRESS                 METHOD
hostssl all             app_user        10.0.1.0/24             md5
hostssl all             dbadmin         10.0.0.0/8              md5
```

### Step 1.4: Enable SSL/TLS Connections

#### Generate SSL Certificates (Self-Hosted)

```bash
# Generate server certificate
openssl req -new -x509 -days 365 -nodes -text \
  -out server.crt \
  -keyout server.key \
  -subj "/CN=company-directory-db"

# Set permissions
chmod 600 server.key
chown postgres:postgres server.key server.crt

# Update postgresql.conf
ssl = on
ssl_cert_file = '/path/to/server.crt'
ssl_key_file = '/path/to/server.key'
```

#### Configure Application to Use SSL

```env
# backend/.env.production
DATABASE_URL="postgresql://app_user:password@db-host:5432/company_directory?sslmode=require"
```

### Step 1.5: Configure Automated Backups

#### For AWS RDS:
Backups are automatic, but verify settings:
- Backup retention: 30 days
- Backup window: 02:00-03:00 UTC
- Point-in-time recovery: Enabled

#### For Self-Hosted:

```bash
# Create backup script
cat > /opt/scripts/backup-database.sh << 'EOF'
#!/bin/bash
set -e

# Configuration
BACKUP_DIR="/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DATE=$(date +%Y-%m-%d)
DB_HOST="localhost"
DB_NAME="company_directory"
DB_USER="dbadmin"
RETENTION_DAYS=30

# Create backup directory
mkdir -p "$BACKUP_DIR/$DATE"

# Perform backup
PGPASSWORD=$DB_PASSWORD pg_dump \
  -h $DB_HOST \
  -U $DB_USER \
  -d $DB_NAME \
  --format=custom \
  --compress=9 \
  --file="$BACKUP_DIR/$DATE/backup_$TIMESTAMP.dump"

# Verify backup
if [ $? -eq 0 ]; then
  echo "✓ Backup successful: $BACKUP_DIR/$DATE/backup_$TIMESTAMP.dump"
  
  # Optional: Upload to S3
  if [ -n "$AWS_S3_BUCKET" ]; then
    aws s3 cp "$BACKUP_DIR/$DATE/backup_$TIMESTAMP.dump" \
      "s3://$AWS_S3_BUCKET/backups/$DATE/"
    echo "✓ Backup uploaded to S3"
  fi
  
  # Clean up old backups
  find $BACKUP_DIR -type f -mtime +$RETENTION_DAYS -delete
  find $BACKUP_DIR -type d -empty -delete
  echo "✓ Old backups cleaned up"
else
  echo "✗ Backup failed!"
  exit 1
fi
EOF

chmod +x /opt/scripts/backup-database.sh

# Add to crontab (daily at 2 AM)
(crontab -l 2>/dev/null; echo "0 2 * * * /opt/scripts/backup-database.sh >> /var/log/db-backup.log 2>&1") | crontab -
```

### Step 1.6: Configure Connection Pooling

Update `postgresql.conf`:

```conf
# Connection Settings
max_connections = 100
shared_buffers = 2GB
effective_cache_size = 6GB
maintenance_work_mem = 512MB
checkpoint_completion_target = 0.9
wal_buffers = 16MB
default_statistics_target = 100
random_page_cost = 1.1
effective_io_concurrency = 200
work_mem = 10MB
min_wal_size = 1GB
max_wal_size = 4GB
max_worker_processes = 4
max_parallel_workers_per_gather = 2
max_parallel_workers = 4
max_parallel_maintenance_workers = 2
```

### Step 1.7: Test Database Connection

```bash
# Test connection from backend server
psql "postgresql://app_user:password@db-host:5432/company_directory?sslmode=require"

# Verify SSL is being used
psql -c "SELECT ssl_is_used();"

# Check connection limit
psql -c "SHOW max_connections;"

# Verify backup configuration
psql -c "SHOW archive_mode;"
```

### Step 1.8: Run Database Migrations

```bash
# From backend directory
cd backend

# Set production database URL
export DATABASE_URL="postgresql://app_user:password@db-host:5432/company_directory?sslmode=require"

# Run migrations
npm run prisma:migrate deploy

# Verify schema
npm run prisma:db pull
```

### Step 1.9: Create Initial Tenant and Admin User

```bash
# Create seed script for production
cat > backend/prisma/seed-production.ts << 'EOF'
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  // Create default tenant
  const tenant = await prisma.tenant.create({
    data: {
      name: 'Default Organization',
      subdomain: 'app',
      settings: {
        branding: {
          primaryColor: '#3B82F6',
          secondaryColor: '#1E40AF'
        }
      },
      is_active: true
    }
  });

  console.log('✓ Created tenant:', tenant.name);

  // Create admin user
  const hashedPassword = await bcrypt.hash(process.env.ADMIN_PASSWORD || 'ChangeMe123!', 10);
  
  const admin = await prisma.user.create({
    data: {
      email: process.env.ADMIN_EMAIL || 'admin@company.com',
      password_hash: hashedPassword,
      role: 'super_admin',
      tenant_id: tenant.id,
      is_active: true
    }
  });

  console.log('✓ Created admin user:', admin.email);

  // Create admin employee profile
  await prisma.employee.create({
    data: {
      user_id: admin.id,
      tenant_id: tenant.id,
      first_name: 'System',
      last_name: 'Administrator',
      email: admin.email,
      title: 'System Administrator',
      is_active: true
    }
  });

  console.log('✓ Created admin employee profile');
}

main()
  .catch((e) => {
    console.error('Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
EOF

# Run seed script
ADMIN_EMAIL="admin@yourcompany.com" ADMIN_PASSWORD="<STRONG_PASSWORD>" \
  npx ts-node prisma/seed-production.ts
```

## Verification Checklist

- [ ] PostgreSQL 13+ instance provisioned
- [ ] Database accessible only from backend servers
- [ ] SSL/TLS connections enabled and verified
- [ ] Application user created with limited privileges
- [ ] Automated backups configured (daily, 30-day retention)
- [ ] Connection pooling configured (max 100 connections)
- [ ] Database migrations run successfully
- [ ] Initial tenant and admin user created
- [ ] Database performance monitoring enabled
- [ ] Backup restoration tested

## Connection String Format

```env
# Production database URL format
DATABASE_URL="postgresql://app_user:PASSWORD@HOST:5432/company_directory?sslmode=require&connection_limit=20&pool_timeout=20"

# For AWS RDS
DATABASE_URL="postgresql://app_user:PASSWORD@company-directory-prod.xxxxx.us-east-1.rds.amazonaws.com:5432/company_directory?sslmode=require"

# For self-hosted
DATABASE_URL="postgresql://app_user:PASSWORD@10.0.1.50:5432/company_directory?sslmode=require"
```

## Troubleshooting

### Cannot Connect to Database

```bash
# Check if database is running
pg_isready -h <DB_HOST> -p 5432

# Check network connectivity
telnet <DB_HOST> 5432

# Check security group/firewall rules
# Ensure backend server IP is allowed

# Check SSL configuration
psql "postgresql://app_user:password@host:5432/dbname?sslmode=require" -c "SELECT version();"
```

### Slow Query Performance

```sql
-- Enable slow query logging
ALTER SYSTEM SET log_min_duration_statement = 1000; -- Log queries > 1 second
SELECT pg_reload_conf();

-- Check for missing indexes
SELECT schemaname, tablename, attname, n_distinct, correlation
FROM pg_stats
WHERE schemaname = 'public'
ORDER BY abs(correlation) DESC;

-- Analyze query performance
EXPLAIN ANALYZE SELECT * FROM employees WHERE tenant_id = 'xxx';
```

### Backup Failures

```bash
# Check backup logs
tail -f /var/log/db-backup.log

# Test backup manually
/opt/scripts/backup-database.sh

# Verify backup file
pg_restore --list /backups/2024-02-06/backup_20240206_020000.dump

# Test restoration
pg_restore -h localhost -U dbadmin -d test_restore /backups/latest.dump
```

## Next Steps

Once database infrastructure is complete, proceed to:
1. Set up Redis infrastructure (Task 2)
2. Configure object storage (Task 3)
3. Set up application hosting (Task 4)

## Security Reminders

- ⚠️ Never commit database passwords to version control
- ⚠️ Use strong passwords (16+ characters, mixed case, numbers, symbols)
- ⚠️ Rotate database passwords every 90 days
- ⚠️ Restrict database access to application servers only
- ⚠️ Enable SSL/TLS for all connections
- ⚠️ Monitor failed login attempts
- ⚠️ Test backup restoration monthly
