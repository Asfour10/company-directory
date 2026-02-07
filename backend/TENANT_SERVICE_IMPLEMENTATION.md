# Tenant Service Implementation

## Overview

The Tenant Service provides comprehensive tenant management functionality for the Company Directory application, including CRUD operations, branding customization, subdomain management, and usage analytics. This implementation satisfies requirements 12.1, 12.2, and 12.4.

## Features Implemented

### ✅ Core Tenant Management
- **Tenant CRUD Operations**: Create, read, update, and delete tenant configurations
- **Tenant Isolation**: Ensures complete data separation between tenants
- **Subdomain Management**: Validates and manages custom subdomains
- **Subscription Management**: Handles user limits and subscription tiers

### ✅ Branding Customization (Requirement 12.1, 12.2)
- **Logo Upload**: Support for company logo uploads up to 2MB
- **Color Customization**: Primary and accent color configuration with hex validation
- **Brand Consistency**: Applies branding across all tenant pages and components
- **File Management**: Handles logo storage and cleanup

### ✅ Subdomain Configuration (Requirement 12.4)
- **Custom Subdomains**: Format `company-name.directory-platform.com`
- **Validation Rules**: Enforces subdomain format and reserved name restrictions
- **Suggestion Engine**: Generates available subdomain alternatives
- **Uniqueness Checks**: Prevents duplicate subdomain registration

### ✅ Analytics and Usage Tracking
- **Tenant Statistics**: User count, employee count, active users
- **Usage Analytics**: Search events, profile views, login tracking
- **Utilization Metrics**: User limit utilization percentage
- **Historical Data**: Configurable time period analytics

## API Endpoints

### Tenant Settings
- `GET /api/tenant/settings` - Get tenant configuration
- `PUT /api/tenant/branding` - Update branding settings
- `PUT /api/tenant/sso-config` - Update SSO configuration

### Logo Management
- `POST /api/tenant/logo` - Upload tenant logo
- `DELETE /api/tenant/logo` - Delete tenant logo

### Analytics
- `GET /api/tenant/stats` - Get tenant statistics
- `GET /api/tenant/usage` - Get usage analytics

### Utilities
- `GET /api/tenant/subdomain-suggestions` - Generate subdomain suggestions

## Service Methods

### Core Operations
```typescript
// Create new tenant
TenantService.createTenant(data: CreateTenantData)

// Retrieve tenant information
TenantService.getTenantById(tenantId: string)
TenantService.getTenantBySubdomain(subdomain: string)

// Update tenant configuration
TenantService.updateTenant(tenantId: string, data: UpdateTenantData)
TenantService.updateBranding(tenantId: string, branding: BrandingData)
TenantService.updateSSOConfig(tenantId: string, ssoConfig: SSOConfig)
```

### Logo Management
```typescript
// Upload and manage logos
TenantService.uploadLogo(tenantId: string, file: Express.Multer.File)
TenantService.deleteLogo(tenantId: string)
```

### Analytics
```typescript
// Get tenant metrics
TenantService.getTenantStats(tenantId: string)
TenantService.getTenantUsage(tenantId: string, days?: number)
TenantService.isAtUserLimit(tenantId: string)
```

### Utilities
```typescript
// Subdomain management
TenantService.generateSubdomainSuggestions(baseName: string)
TenantService.listTenants(params: ListParams)
```

## Validation Rules

### Subdomain Validation
- **Length**: 3-63 characters
- **Format**: Lowercase letters, numbers, and hyphens only
- **Restrictions**: Cannot start/end with hyphen, no consecutive hyphens
- **Reserved Names**: www, api, admin, app, mail, ftp, localhost, staging, dev, test, demo, support, help, blog, docs, status, cdn, assets, static

### Color Validation
- **Format**: Hexadecimal color codes (#RRGGBB or #RGB)
- **Examples**: #FF0000, #00FF00, #123, #ABC
- **Case Insensitive**: Both uppercase and lowercase accepted

### Logo Upload Validation
- **File Size**: Maximum 2MB (requirement 12.1)
- **Formats**: JPEG, PNG, WebP, SVG
- **Storage**: Configurable (local, S3, Azure Blob Storage)

## Database Schema

The tenant service works with the following database structure:

```sql
CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  subdomain VARCHAR(100) UNIQUE NOT NULL,
  logo_url TEXT,
  primary_color VARCHAR(7), -- Hex color
  accent_color VARCHAR(7),   -- Hex color
  subscription_tier VARCHAR(50) NOT NULL,
  user_limit INTEGER NOT NULL,
  sso_provider VARCHAR(50),
  sso_config JSONB,
  data_retention_days INTEGER DEFAULT 730,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

## Security Features

### Access Control
- **Authentication Required**: All endpoints require valid JWT tokens
- **Role-Based Access**: Super Admin role required for branding/SSO changes
- **Tenant Isolation**: Automatic tenant context enforcement

### Data Protection
- **Input Validation**: Comprehensive validation for all inputs
- **File Upload Security**: File type and size validation
- **SQL Injection Prevention**: Parameterized queries via Prisma ORM

### Audit Logging
- **Change Tracking**: All tenant modifications logged
- **User Attribution**: Changes linked to performing user
- **Immutable Records**: Audit logs cannot be modified

## File Upload Configuration

### Logo Upload Service
```typescript
export const tenantLogoConfig: UploadConfig = {
  maxFileSize: 2 * 1024 * 1024, // 2MB
  allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'],
  allowedExtensions: ['.jpg', '.jpeg', '.png', '.webp', '.svg'],
  destination: 'local' | 's3' | 'azure',
  // Storage-specific configuration...
};
```

### Storage Backends
- **Local Storage**: Development and testing
- **AWS S3**: Production cloud storage
- **Azure Blob Storage**: Enterprise cloud storage

## Error Handling

### Validation Errors
- **Invalid Subdomain**: Format validation with specific error messages
- **Invalid Colors**: Hex format validation
- **File Upload Errors**: Size and type validation
- **Duplicate Subdomain**: Uniqueness constraint violations

### Service Errors
- **Tenant Not Found**: 404 errors for non-existent tenants
- **Upload Failures**: Storage service error handling
- **Database Errors**: Connection and constraint error handling

## Testing

### Unit Tests
- **Service Methods**: Complete coverage of all public methods
- **Validation Logic**: Subdomain and color validation testing
- **Error Scenarios**: Invalid input and edge case handling

### Property-Based Tests
- **Subdomain Properties**: Format validation across input ranges
- **Color Properties**: Hex validation consistency
- **Data Integrity**: Tenant data validation properties

### Integration Tests
- **API Endpoints**: Full request/response cycle testing
- **File Upload**: Multipart form data handling
- **Authentication**: Role-based access control testing

## Performance Considerations

### Caching
- **Tenant Configuration**: Redis caching with TTL
- **Cache Invalidation**: Automatic cache clearing on updates
- **Subdomain Lookup**: Optimized subdomain resolution

### Database Optimization
- **Indexes**: Subdomain and tenant ID indexes
- **Query Optimization**: Efficient tenant statistics queries
- **Connection Pooling**: Prisma connection management

## Usage Examples

### Creating a Tenant
```typescript
const tenant = await TenantService.createTenant({
  name: 'Acme Corporation',
  subdomain: 'acme-corp',
  subscriptionTier: 'premium',
  userLimit: 500,
  primaryColor: '#FF6B35',
  accentColor: '#004E89',
});
```

### Uploading a Logo
```typescript
const logoUrl = await TenantService.uploadLogo(tenantId, logoFile);
```

### Getting Analytics
```typescript
const stats = await TenantService.getTenantStats(tenantId);
const usage = await TenantService.getTenantUsage(tenantId, 30);
```

## Configuration

### Environment Variables
```bash
# File upload configuration
UPLOAD_DESTINATION=s3|local|azure
UPLOAD_PATH=uploads/tenant-logos
UPLOAD_BASE_URL=/uploads/tenant-logos

# AWS S3 configuration
AWS_S3_BUCKET=company-directory-assets
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key

# Database configuration
DATABASE_URL=postgresql://user:pass@localhost:5432/company_directory
```

## Compliance

### GDPR Compliance
- **Data Retention**: Configurable retention policies
- **Data Export**: Tenant data export functionality
- **Data Deletion**: Secure tenant data removal

### SOC 2 Compliance
- **Audit Logging**: Comprehensive change tracking
- **Access Controls**: Role-based permissions
- **Data Encryption**: At-rest and in-transit encryption

## Future Enhancements

### Planned Features
- **Multi-region Support**: Geographic tenant distribution
- **Advanced Analytics**: Custom reporting and dashboards
- **Webhook Integration**: Real-time tenant event notifications
- **API Rate Limiting**: Per-tenant API usage controls

### Scalability Improvements
- **Horizontal Scaling**: Multi-instance tenant service
- **Database Sharding**: Tenant-based data partitioning
- **CDN Integration**: Global logo and asset distribution

## Troubleshooting

### Common Issues
1. **Subdomain Validation Failures**: Check format and reserved names
2. **Logo Upload Errors**: Verify file size and format
3. **Color Validation Issues**: Ensure proper hex format
4. **Cache Inconsistencies**: Clear tenant cache after updates

### Debugging
- **Logging**: Comprehensive error and operation logging
- **Health Checks**: Service availability monitoring
- **Metrics**: Performance and usage metrics collection

## Conclusion

The Tenant Service implementation provides a robust, secure, and scalable foundation for multi-tenant operations in the Company Directory application. It fully satisfies the specified requirements while providing extensibility for future enhancements.