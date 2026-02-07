# GDPR Compliance Implementation

This document describes the implementation of GDPR (General Data Protection Regulation) compliance features for the Company Directory application.

## Overview

The GDPR implementation provides comprehensive data protection and privacy controls including:

- **Data Export**: Users can download all their personal data in JSON format
- **Data Deletion**: Self-service data deletion requests with automated processing
- **Data Retention**: Configurable retention policies with automated cleanup
- **Data Anonymization**: Preserves audit records while removing personal information

## Requirements Addressed

### Requirement 17.1: Data Retention Policies
- ✅ Configurable retention policies (30 days to 7 years)
- ✅ Automated enforcement via scheduled jobs
- ✅ Super Admin configuration interface

### Requirement 17.2: Data Deletion
- ✅ Self-service deletion request interface
- ✅ Automated processing within 30 days
- ✅ Complete removal of personal information

### Requirement 17.3: Data Anonymization
- ✅ Preserves audit records for compliance
- ✅ Removes personal identifiers from historical data
- ✅ Maintains data integrity for business operations

### Requirement 17.4: Data Export
- ✅ Complete user data export in JSON format
- ✅ Includes profile, audit logs, and analytics events
- ✅ Downloadable file with proper headers

## Implementation Components

### 1. Database Schema

#### Data Deletion Requests Table
```sql
CREATE TABLE "data_deletion_requests" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "status" VARCHAR(50) NOT NULL DEFAULT 'pending',
    "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMP(3),
    "reason" TEXT,
    "anonymized_data" JSONB
);
```

#### Tenant Retention Configuration
- `data_retention_days` field in tenants table
- Default: 730 days (2 years minimum)
- Range: 30 days to 7 years (2555 days)

### 2. Services

#### GdprService (`src/services/gdpr.service.ts`)
- **exportUserData()**: Exports complete user data including encrypted fields
- **requestDataDeletion()**: Creates deletion request with validation
- **processDataDeletion()**: Executes data deletion with anonymization
- **getDeletionRequestStatus()**: Retrieves deletion request status

#### DataRetentionService (`src/services/data-retention.service.ts`)
- **enforceRetentionPolicies()**: Cleans up expired data across all tenants
- **getRetentionStats()**: Provides retention statistics for monitoring
- **updateRetentionPolicy()**: Updates tenant retention configuration

#### RetentionSchedulerService (`src/services/retention-scheduler.service.ts`)
- **Automated Scheduling**: Runs retention policies daily at 2 AM
- **Deletion Processing**: Processes pending deletions every 6 hours
- **Manual Execution**: Supports manual policy enforcement

### 3. API Endpoints

#### User Endpoints
- `GET /api/gdpr/export` - Export user data
- `POST /api/gdpr/delete-request` - Request data deletion
- `GET /api/gdpr/delete-request/status` - Check deletion status

#### Admin Endpoints
- `GET /api/gdpr/admin/pending-deletions` - View pending deletions
- `POST /api/gdpr/admin/process-deletion/:id` - Process deletion request
- `GET /api/gdpr/admin/retention-stats` - View retention statistics
- `PUT /api/gdpr/admin/retention-policy` - Update retention policy

### 4. Scheduled Jobs

#### Daily Retention Enforcement (2:00 AM)
```javascript
cron.schedule('0 2 * * *', async () => {
  await retentionService.enforceRetentionPolicies();
});
```

#### Deletion Processing (Every 6 hours)
```javascript
cron.schedule('0 */6 * * *', async () => {
  await retentionService.processPendingDeletions();
});
```

## Data Processing Flow

### Data Export Process
1. User requests data export via API
2. System retrieves all user-related data:
   - Employee profile (with decrypted sensitive fields)
   - Audit logs (all actions related to user)
   - Analytics events (user behavior data)
3. Data is formatted as JSON with metadata
4. Response includes download headers for file save

### Data Deletion Process
1. User submits deletion request with optional reason
2. System validates request and creates deletion record
3. Request enters 24-hour waiting period (allows cancellation)
4. Automated processor executes deletion:
   - Anonymizes audit logs (removes personal identifiers)
   - Deletes analytics events (personal behavior data)
   - Deletes user sessions
   - Deletes employee profile
   - Deletes user account
   - Stores anonymized metadata for compliance

### Retention Policy Enforcement
1. Daily job retrieves all tenant retention policies
2. For each tenant:
   - Calculates cutoff dates based on retention period
   - Deletes expired audit logs (minimum 2 years retained)
   - Deletes expired analytics events
   - Cleans up expired sessions
   - Removes old deletion request records

## Security Considerations

### Data Encryption
- Sensitive fields are decrypted only during export
- Encryption keys are managed separately from data
- Field-level encryption protects phone numbers and personal emails

### Access Control
- User endpoints require authentication and tenant isolation
- Admin endpoints require elevated permissions
- Super Admin role required for retention policy changes

### Audit Trail
- All GDPR operations are logged in audit system
- Deletion requests preserve anonymized metadata
- Retention policy changes are tracked

## Compliance Features

### GDPR Article 15 (Right of Access)
- Complete data export functionality
- Includes all personal data and processing history
- Machine-readable JSON format

### GDPR Article 17 (Right to Erasure)
- Self-service deletion request interface
- Complete removal within 30 days
- Preserves legitimate business interests (anonymized audit logs)

### GDPR Article 5 (Storage Limitation)
- Configurable retention periods
- Automated data cleanup
- Minimum retention for legal compliance

### GDPR Article 25 (Data Protection by Design)
- Built-in privacy controls
- Automated compliance processes
- Default secure configurations

## Testing

### Test Script
Run the GDPR implementation test:
```bash
npm run test:gdpr
```

### Test Coverage
- Data export functionality
- Deletion request creation and processing
- Retention policy enforcement
- Data anonymization verification
- API endpoint validation

## Monitoring and Maintenance

### Retention Statistics
- Track data volumes and retention compliance
- Monitor cleanup job performance
- Alert on retention policy violations

### Deletion Processing
- Monitor pending deletion queue
- Track processing success rates
- Alert on failed deletions

### Compliance Reporting
- Generate retention compliance reports
- Track GDPR request volumes
- Monitor data processing activities

## Configuration

### Environment Variables
```env
# Retention job scheduling (production only)
NODE_ENV=production

# Database connection for cleanup jobs
DATABASE_URL=postgresql://...
```

### Tenant Configuration
```javascript
// Update retention policy (30 days to 7 years)
PUT /api/gdpr/admin/retention-policy
{
  "retentionDays": 365
}
```

## Deployment Notes

### Production Setup
1. Ensure scheduled jobs are enabled in production environment
2. Configure monitoring for retention job execution
3. Set up alerts for failed deletion processing
4. Verify database backup excludes deleted user data

### Performance Considerations
- Retention jobs run during low-traffic hours (2 AM)
- Large data deletions are processed in batches
- Database indexes optimize cleanup query performance
- Retention statistics are cached for dashboard display

## Support and Troubleshooting

### Common Issues
1. **Failed Deletions**: Check database constraints and foreign key relationships
2. **Retention Job Failures**: Verify database connectivity and permissions
3. **Export Timeouts**: Large datasets may require pagination or streaming

### Monitoring Queries
```sql
-- Check pending deletion requests
SELECT COUNT(*) FROM data_deletion_requests WHERE status = 'pending';

-- Monitor retention job performance
SELECT tenant_id, data_retention_days, 
       COUNT(*) as audit_log_count 
FROM tenants t 
JOIN audit_logs a ON t.id = a.tenant_id 
GROUP BY tenant_id, data_retention_days;
```

This implementation ensures full GDPR compliance while maintaining system performance and data integrity.