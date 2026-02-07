# Data Encryption Implementation

This document describes the comprehensive data encryption implementation for the Company Directory application, covering all aspects of data security from field-level encryption to transport security.

## Overview

The encryption implementation provides multiple layers of security:

1. **Field-Level Encryption** - Sensitive employee data encrypted at the application level
2. **Database Encryption at Rest** - PostgreSQL encryption configuration and verification
3. **Transport Security** - HTTPS/TLS enforcement with security headers
4. **Key Management** - Secure encryption key generation and management

## Implementation Details

### 1. Encryption Key Management (`encryption-key.service.ts`)

**Features:**
- Support for AWS KMS, Azure Key Vault, and local development
- Per-tenant encryption keys for data isolation
- Key caching for performance
- Secure key generation and decryption

**Configuration:**
```env
ENCRYPTION_PROVIDER=local  # aws, azure, local
AWS_REGION=us-east-1
AWS_KMS_KEY_ID=your-kms-key-id
AZURE_KEY_VAULT_URL=https://your-vault.vault.azure.net/
AZURE_KEY_NAME=your-key-name
```

**Usage:**
```typescript
const keyService = createEncryptionKeyService();
const keyData = await keyService.generateTenantKey(tenantId);
```

### 2. Field-Level Encryption (`field-encryption.service.ts`)

**Features:**
- AES-256-GCM encryption for sensitive fields
- Random IV generation for each encryption
- Tenant-specific encryption keys
- Support for bulk field operations

**Encrypted Fields:**
- `phone` - Employee phone numbers
- `personalEmail` - Personal email addresses
- Custom sensitive fields as needed

**Data Format:**
```json
{
  "value": "encrypted_data:auth_tag",
  "iv": "base64_initialization_vector"
}
```

**Usage:**
```typescript
const fieldService = createFieldEncryptionService(keyService);
const encrypted = await fieldService.encryptField(phoneNumber, tenantId);
const decrypted = await fieldService.decryptField(encrypted, tenantId);
```

### 3. Database Schema Changes

**Tenant Table:**
- `encryption_key_id` - Key identifier for tenant
- `encrypted_data_key` - Encrypted data encryption key

**Employee Table:**
- `phone` - Changed from VARCHAR to JSONB for encrypted storage
- `personal_email` - New JSONB field for encrypted personal emails

### 4. Database Encryption at Rest (`database-encryption.service.ts`)

**Features:**
- PostgreSQL SSL/TLS connection verification
- Encryption at rest status checking
- Configuration recommendations
- Backup encryption support

**Configuration:**
```env
DB_ENCRYPTION_ENABLED=true
DB_SSL_CERT=path/to/client-cert.pem
DB_SSL_KEY=path/to/client-key.pem
DB_SSL_ROOT_CERT=path/to/ca-cert.pem
```

### 5. HTTPS/TLS Enforcement (`https-enforcement.middleware.ts`)

**Features:**
- TLS 1.3 support with strong cipher suites
- HSTS (HTTP Strict Transport Security) headers
- Automatic HTTP to HTTPS redirect in production
- Comprehensive security headers

**Security Headers:**
- `Strict-Transport-Security`
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Referrer-Policy: strict-origin-when-cross-origin`

**Configuration:**
```env
SSL_KEY_PATH=path/to/server-key.pem
SSL_CERT_PATH=path/to/server-cert.pem
SSL_CA_PATH=path/to/ca-cert.pem
HTTPS_PORT=3443
ENFORCE_HTTPS=true
```

## Usage Examples

### Employee Service Integration

```typescript
import { EmployeeEncryptionService } from './employee-encryption.service';

// Create employee with encryption
const employee = await EmployeeEncryptionService.createEmployeeWithEncryption(
  employeeData,
  context
);

// Get employee with decryption
const employee = await EmployeeEncryptionService.getEmployeeByIdWithDecryption(
  employeeId,
  context
);
```

### Middleware Integration

```typescript
import { encryptionMiddleware } from './middleware/encryption.middleware';
import { httpsEnforcementMiddleware } from './middleware/https-enforcement.middleware';

// Add to Express app
app.use(httpsEnforcementMiddleware(defaultHttpsConfig));
app.use('/api', encryptionMiddleware);
```

## Testing and Verification

### Available Scripts

```bash
# Test complete encryption implementation
npm run test:encryption

# Verify database encryption
npm run verify:encryption

# Verify HTTPS/TLS configuration
npm run verify:https

# Run HTTPS development server
npm run dev:https
```

### Test Coverage

The implementation includes comprehensive tests for:
- Key generation and management
- Field encryption/decryption
- Database connection security
- HTTPS/TLS configuration
- Error handling
- Performance validation
- Security validation (cross-tenant isolation)

## Security Considerations

### Key Management
- Keys are generated per-tenant for isolation
- Keys are cached in memory for performance
- Production should use AWS KMS or Azure Key Vault
- Regular key rotation should be implemented

### Field Encryption
- Uses AES-256-GCM for authenticated encryption
- Random IV for each encryption prevents pattern analysis
- Tenant isolation prevents cross-tenant data access
- Failed decryption returns null rather than throwing errors

### Database Security
- SSL/TLS required for database connections
- Encryption at rest should be enabled at the PostgreSQL level
- Connection strings should include SSL parameters
- Regular security audits recommended

### Transport Security
- TLS 1.3 preferred, minimum TLS 1.2
- Strong cipher suites configured
- HSTS prevents downgrade attacks
- Security headers protect against common attacks

## Production Deployment

### Prerequisites
1. Valid SSL certificates for HTTPS
2. KMS or Key Vault setup for key management
3. PostgreSQL with encryption at rest enabled
4. Load balancer with SSL termination (optional)

### Environment Configuration
```env
NODE_ENV=production
ENCRYPTION_PROVIDER=aws  # or azure
ENFORCE_HTTPS=true
SSL_CERT_PATH=/path/to/cert.pem
SSL_KEY_PATH=/path/to/key.pem
DATABASE_URL=postgresql://...?sslmode=require
```

### Monitoring
- Monitor encryption/decryption performance
- Track key usage and rotation
- Monitor SSL certificate expiration
- Log security events and failures

## Compliance

This implementation supports compliance with:
- **SOC 2 Type II** - Data encryption requirements
- **GDPR** - Data protection and privacy
- **HIPAA** - Healthcare data security (if applicable)
- **PCI DSS** - Payment card data security (if applicable)

## Migration Guide

### Existing Data Migration
1. Run database migration to add encryption fields
2. Initialize tenant encryption keys
3. Migrate existing sensitive data to encrypted format
4. Update application code to use encryption services
5. Verify encryption is working correctly

### Rollback Plan
1. Keep unencrypted backup of sensitive data
2. Test decryption before removing backups
3. Monitor for decryption errors after deployment
4. Have rollback scripts ready if needed

## Support and Troubleshooting

### Common Issues
1. **Key not found errors** - Ensure tenant encryption is initialized
2. **Decryption failures** - Check key management configuration
3. **SSL connection errors** - Verify certificate paths and permissions
4. **Performance issues** - Monitor key caching and encryption overhead

### Debug Commands
```bash
# Test encryption functionality
npm run test:encryption

# Verify all security configurations
npm run verify:encryption && npm run verify:https

# Check database connection security
npm run test:db
```

## Future Enhancements

1. **Key Rotation** - Automated key rotation policies
2. **Hardware Security Modules** - HSM integration for key storage
3. **Certificate Management** - Automated certificate renewal
4. **Audit Logging** - Enhanced security event logging
5. **Performance Optimization** - Encryption caching strategies