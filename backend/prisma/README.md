# Database Configuration

This document describes the Prisma ORM configuration for the Company Directory application.

## Overview

The application uses PostgreSQL as the primary database with Prisma ORM for type-safe database access. The configuration includes:

- **Multi-tenant architecture** with Row-Level Security (RLS)
- **Connection pooling** for optimal performance
- **Full-text search** capabilities
- **Audit logging** for compliance
- **Comprehensive indexing** for performance

## Quick Setup

### Prerequisites
- Node.js 18+ installed
- PostgreSQL 13+ running
- Database created (e.g., `company_directory`)

### Setup Commands

**Linux/macOS:**
```bash
chmod +x setup-database.sh
./setup-database.sh
```

**Windows:**
```cmd
setup-database.bat
```

**Manual Setup:**
```bash
# 1. Install dependencies
npm install

# 2. Copy environment file
cp .env.example .env
# Edit .env with your database credentials

# 3. Generate Prisma client
npm run prisma:generate

# 4. Run migrations
npm run prisma:migrate

# 5. Verify setup
npm run test:db
npm run verify:schema
npm run test:audit
```

## Configuration

### Database Connection

The database connection is configured via the `DATABASE_URL` environment variable:

```bash
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/company_directory?schema=public&connection_limit=20&pool_timeout=20
```

**Connection Pool Parameters:**
- `connection_limit=20`: Maximum number of database connections
- `pool_timeout=20`: Connection timeout in seconds

### Schema Features

#### Multi-Tenant Isolation
- All tables include `tenant_id` for data isolation
- Row-Level Security policies enforce tenant boundaries
- Tenant context is set via `app.current_tenant` session variable

#### Full-Text Search
- `search_vector` column with tsvector type for efficient text search
- GIN indexes for fast search performance
- Automatic search vector updates via triggers

#### Audit Logging
- Immutable audit logs for all data modifications
- Field-level change tracking
- Compliance-ready retention policies

## Usage

### Generate Prisma Client
```bash
npm run prisma:generate
```

### Run Migrations
```bash
npm run prisma:migrate
```

### Test Database Connection
```bash
npm run test:db
```

### Test Audit System
```bash
npm run test:audit
```

### Verify Schema
```bash
npm run verify:schema
```

### Open Prisma Studio
```bash
npm run prisma:studio
```

## Database Schema

### Core Tables
- `tenants`: Organization configuration and branding
- `users`: Authentication and user management
- `employees`: Employee profiles and contact information
- `custom_fields`: Tenant-specific field definitions

### Supporting Tables
- `sessions`: JWT token management
- `audit_logs`: Change tracking and compliance (immutable)
- `analytics_events`: Usage analytics and reporting

### Indexes
- **Performance indexes**: On frequently queried columns
- **Search indexes**: GIN indexes for full-text search
- **Tenant indexes**: For efficient multi-tenant queries

## Services

### AuditService
Handles immutable audit logging:
```typescript
import { AuditService } from '../services/audit.service';

// Log a single change
await AuditService.logChange({
  tenantId: 'tenant-123',
  userId: 'user-456',
  action: 'UPDATE',
  entityType: 'employee',
  entityId: 'emp-789',
  fieldName: 'title',
  oldValue: 'Developer',
  newValue: 'Senior Developer'
});

// Log multiple field changes
await AuditService.logFieldChanges(baseEntry, [
  { fieldName: 'firstName', oldValue: 'John', newValue: 'Jane' },
  { fieldName: 'title', oldValue: 'Dev', newValue: 'Senior Dev' }
]);

// Track analytics events
await AuditService.trackEvent({
  tenantId: 'tenant-123',
  eventType: 'profile_view',
  metadata: { profileId: 'emp-789' }
});
```

### SessionService
Manages JWT sessions:
```typescript
import { SessionService } from '../services/session.service';

// Create session
await SessionService.createSession(userId, tokenHash, expiresAt);

// Validate session
const sessionData = await SessionService.validateSession(tokenHash);

// Clean up expired sessions
const cleanedCount = await SessionService.cleanupExpiredSessions();
```

## Security Features

### Row-Level Security (RLS)
All tables have RLS policies that enforce tenant isolation:
```sql
-- Example policy
CREATE POLICY "tenant_isolation" ON "employees"
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant', true)::uuid);
```

### Audit Log Immutability
Audit logs cannot be modified or deleted:
```sql
-- Triggers prevent modifications
CREATE TRIGGER prevent_audit_log_update
    BEFORE UPDATE ON "audit_logs"
    FOR EACH ROW
    EXECUTE FUNCTION prevent_audit_log_modification();
```

### Connection Security
- TLS encryption enforced
- Connection pooling prevents exhaustion
- Prepared statements prevent SQL injection

## Maintenance

### Cleanup Operations
```bash
# Clean up expired sessions
npm run cleanup:sessions

# Clean up old analytics (90 days)
npm run cleanup:analytics

# Clean up audit logs (respects tenant retention policy)
npm run cleanup:audit
```

### Monitoring
```bash
# Check database performance
npm run monitor:db

# View connection pool status
npm run monitor:connections

# Check RLS policy effectiveness
npm run verify:rls
```

## Requirements Satisfied

This configuration satisfies the following requirements:

- **11.1**: Complete data isolation between tenants
- **11.3**: Optimized database performance with connection pooling
- **19.1-19.2**: Fast search capabilities with indexed queries
- **20.1**: Comprehensive audit logging
- **7.1**: Data encryption at rest (configured at PostgreSQL level)
- **8.1-8.5**: Immutable audit trail with retention policies
- **16.1**: Analytics event tracking

## Troubleshooting

### Common Issues

**Connection Errors:**
```bash
# Check if PostgreSQL is running
pg_isready -h localhost -p 5432

# Test connection manually
psql $DATABASE_URL
```

**Migration Errors:**
```bash
# Reset migrations (development only)
npm run prisma:migrate reset

# Check migration status
npm run prisma:migrate status
```

**Performance Issues:**
```bash
# Analyze query performance
npm run analyze:queries

# Check index usage
npm run analyze:indexes
```

### Environment Variables
Required environment variables:
- `DATABASE_URL`: PostgreSQL connection string
- `NODE_ENV`: Environment (development/production)
- `JWT_SECRET`: Secret for JWT signing
- `ENCRYPTION_KEY`: Key for field-level encryption

## Connection Pooling

Connection pooling is handled at multiple levels:

1. **Database URL Parameters**: `connection_limit` and `pool_timeout`
2. **Prisma Client**: Single instance with global caching in development
3. **PostgreSQL**: Built-in connection pooling and management

This ensures optimal performance under load while preventing connection exhaustion.