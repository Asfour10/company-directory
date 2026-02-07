# Company Directory API Documentation

## Overview

The Company Directory API is a RESTful service that provides secure, multi-tenant employee directory functionality. All endpoints require authentication unless otherwise specified, and data is automatically isolated by tenant.

## Base URL

```
https://api.company-directory.com/api
```

## Authentication

All API requests require a valid JWT token in the Authorization header:

```
Authorization: Bearer <jwt_token>
```

### Authentication Endpoints

#### Get Current User
```http
GET /api/auth/me
```

**Response:**
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "role": "user|manager|admin|super_admin",
    "tenantId": "uuid"
  }
}
```

#### Refresh Token
```http
POST /api/auth/token/refresh
```

**Request Body:**
```json
{
  "refreshToken": "string"
}
```

**Response:**
```json
{
  "accessToken": "string",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "role": "user"
  }
}
```

#### Logout
```http
POST /api/auth/logout
```

**Response:**
```json
{
  "message": "Logged out successfully"
}
```

#### SSO Login
```http
GET /api/auth/sso/:provider/login?tenant=company-subdomain
```

**Parameters:**
- `provider`: SSO provider (azure-ad, google, okta)
- `tenant`: Company subdomain

#### SSO Callback
```http
POST /api/auth/sso/:provider/callback
GET /api/auth/sso/:provider/callback
```

## Employee Management

### List Employees
```http
GET /api/employees
```

**Query Parameters:**
- `page` (integer): Page number (default: 1)
- `pageSize` (integer): Items per page (max: 100, default: 20)
- `search` (string): Search term for names, titles, departments
- `department` (string): Filter by department
- `title` (string): Filter by job title
- `managerId` (string): Filter by manager ID
- `isActive` (boolean): Include/exclude inactive employees (default: true)
- `skills` (string): Comma-separated list of skills to filter by
- `sortBy` (string): Sort field (default: lastName)
- `sortOrder` (string): asc|desc (default: asc)

**Response:**
```json
{
  "employees": [
    {
      "id": "uuid",
      "firstName": "John",
      "lastName": "Doe",
      "email": "john.doe@company.com",
      "title": "Software Engineer",
      "department": "Engineering",
      "phone": "+1-555-0123",
      "officeLocation": "New York",
      "photoUrl": "https://...",
      "skills": ["JavaScript", "React"],
      "managerId": "uuid",
      "isActive": true,
      "createdAt": "2024-01-01T00:00:00Z",
      "updatedAt": "2024-01-01T00:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "total": 150,
    "totalPages": 8,
    "hasNext": true,
    "hasPrev": false
  },
  "meta": {
    "responseTime": "45ms",
    "count": 20
  }
}
```

### Get Employee by ID
```http
GET /api/employees/:id
```

**Response:**
```json
{
  "employee": {
    "id": "uuid",
    "firstName": "John",
    "lastName": "Doe",
    "email": "john.doe@company.com",
    "title": "Software Engineer",
    "department": "Engineering",
    "phone": "+1-555-0123",
    "officeLocation": "New York",
    "photoUrl": "https://...",
    "bio": "Experienced software engineer...",
    "skills": ["JavaScript", "React", "Node.js"],
    "managerId": "uuid",
    "manager": {
      "id": "uuid",
      "firstName": "Jane",
      "lastName": "Smith",
      "title": "Engineering Manager"
    },
    "customFields": {
      "employeeId": "EMP001",
      "startDate": "2023-01-15"
    },
    "profileCompleteness": 85,
    "isActive": true,
    "createdAt": "2024-01-01T00:00:00Z",
    "updatedAt": "2024-01-01T00:00:00Z"
  },
  "customFields": [
    {
      "id": "uuid",
      "fieldName": "employeeId",
      "displayName": "Employee ID",
      "fieldType": "text",
      "isRequired": true
    }
  ]
}
```

### Create Employee (Admin Only)
```http
POST /api/employees
```

**Request Body:**
```json
{
  "firstName": "John",
  "lastName": "Doe",
  "email": "john.doe@company.com",
  "title": "Software Engineer",
  "department": "Engineering",
  "phone": "+1-555-0123",
  "officeLocation": "New York",
  "bio": "Experienced software engineer...",
  "skills": ["JavaScript", "React"],
  "managerId": "uuid",
  "customFields": {
    "employeeId": "EMP001",
    "startDate": "2023-01-15"
  }
}
```

**Response:**
```json
{
  "employee": {
    "id": "uuid",
    "firstName": "John",
    "lastName": "Doe",
    // ... other fields
  },
  "message": "Employee created successfully"
}
```

### Update Employee
```http
PUT /api/employees/:id
```

**Authorization:** Profile owner, manager of employee, or admin
**Request Body:** Same as create employee (all fields optional)

**Response:**
```json
{
  "employee": {
    "id": "uuid",
    // ... updated employee data
  },
  "message": "Employee updated successfully"
}
```

### Deactivate Employee (Admin Only)
```http
DELETE /api/employees/:id
```

**Response:**
```json
{
  "message": "Employee deactivated successfully"
}
```

### Upload Profile Photo
```http
POST /api/employees/:id/photo
```

**Authorization:** Profile owner or admin
**Content-Type:** multipart/form-data
**Body:** Form field `photo` with image file (max 2MB)

**Response:**
```json
{
  "employee": {
    "id": "uuid",
    "photoUrl": "https://..."
  },
  "upload": {
    "filename": "profile.jpg",
    "size": 1024000,
    "url": "https://..."
  },
  "message": "Profile photo uploaded successfully"
}
```

### Delete Profile Photo
```http
DELETE /api/employees/:id/photo
```

**Authorization:** Profile owner or admin

**Response:**
```json
{
  "message": "Profile photo removed successfully"
}
```

### Get Direct Reports
```http
GET /api/employees/:id/direct-reports
```

**Response:**
```json
{
  "directReports": [
    {
      "id": "uuid",
      "firstName": "Jane",
      "lastName": "Smith",
      "title": "Senior Developer",
      "department": "Engineering"
    }
  ],
  "managerId": "uuid",
  "count": 5
}
```

### Get Employee Hierarchy
```http
GET /api/employees/:id/hierarchy
```

**Response:**
```json
{
  "hierarchy": {
    "employee": {
      "id": "uuid",
      "firstName": "John",
      "lastName": "Doe"
    },
    "manager": {
      "id": "uuid",
      "firstName": "Jane",
      "lastName": "Smith"
    },
    "directReports": [
      {
        "id": "uuid",
        "firstName": "Bob",
        "lastName": "Johnson"
      }
    ]
  },
  "employeeId": "uuid"
}
```

## Search

### Search Employees
```http
GET /api/search?q=search_term
```

**Query Parameters:**
- `q` or `query` (string): Search term (required)
- `department` (string): Filter by department
- `title` (string): Filter by job title
- `skills` (string): Comma-separated skills filter
- `includeInactive` (boolean): Include inactive employees (default: false)
- `page` (integer): Page number (default: 1)
- `pageSize` (integer): Results per page (max: 100, default: 20)
- `fuzzyThreshold` (float): Fuzzy matching threshold (0.0-1.0, default: 0.3)

**Response:**
```json
{
  "results": [
    {
      "id": "uuid",
      "firstName": "John",
      "lastName": "Doe",
      "title": "Software Engineer",
      "department": "Engineering",
      "photoUrl": "https://...",
      "matchType": "exact|fuzzy|partial",
      "relevanceScore": 0.95
    }
  ],
  "total": 25,
  "page": 1,
  "pageSize": 20,
  "hasMore": true,
  "query": "john engineer",
  "executionTime": 45,
  "suggestions": ["john smith", "jane engineer"],
  "filters": {
    "department": null,
    "title": null,
    "skills": null,
    "includeInactive": false
  },
  "meta": {
    "responseTime": "50ms",
    "cached": false,
    "resultCount": 20,
    "searchTypes": ["exact", "fuzzy"]
  }
}
```

### Search Suggestions
```http
GET /api/search/suggestions?q=jo
```

**Response:**
```json
{
  "suggestions": ["john", "johnson", "jones"],
  "query": "jo",
  "count": 3
}
```

### Autocomplete
```http
GET /api/search/autocomplete?q=eng&type=titles
```

**Query Parameters:**
- `q` (string): Query term
- `type` (string): names|titles|departments|skills|all
- `limit` (integer): Max suggestions (default: 5, max: 10)

**Response:**
```json
{
  "suggestions": ["Engineer", "Engineering Manager", "Engineering Director"],
  "query": "eng",
  "type": "titles",
  "count": 3
}
```

## Analytics (Admin Only)

### Dashboard Analytics
```http
GET /api/analytics/dashboard?days=90
```

**Query Parameters:**
- `days` (integer): Time period in days (1-365, default: 90)

**Response:**
```json
{
  "success": true,
  "data": {
    "period": {
      "days": 90,
      "startDate": "2024-01-01T00:00:00Z",
      "endDate": "2024-03-31T23:59:59Z"
    },
    "overview": {
      "totalUsers": 150,
      "activeUsers": 120,
      "profileCompleteness": 85.5,
      "totalSearches": 2500,
      "totalProfileViews": 8500,
      "totalProfileUpdates": 450
    },
    "topSearchQueries": [
      {
        "query": "john smith",
        "count": 45,
        "percentage": 1.8
      }
    ],
    "mostViewedProfiles": [
      {
        "employeeId": "uuid",
        "employeeName": "John Doe",
        "viewCount": 125
      }
    ],
    "departmentDistribution": [
      {
        "department": "Engineering",
        "count": 45,
        "percentage": 30.0
      }
    ],
    "roleDistribution": [
      {
        "title": "Software Engineer",
        "count": 25,
        "percentage": 16.7
      }
    ]
  }
}
```

### Search Analytics
```http
GET /api/analytics/search?days=30
```

**Response:**
```json
{
  "success": true,
  "data": {
    "period": {
      "days": 30,
      "startDate": "2024-03-01T00:00:00Z",
      "endDate": "2024-03-31T23:59:59Z"
    },
    "statistics": {
      "totalSearches": 850,
      "uniqueSearchers": 75,
      "averageResults": 12.5,
      "averageExecutionTime": 125,
      "zeroResultQueries": 45
    },
    "topQueries": [
      {
        "query": "engineering",
        "count": 125,
        "averageResults": 15
      }
    ],
    "trends": [
      {
        "date": "2024-03-01",
        "searches": 28,
        "uniqueUsers": 15
      }
    ]
  }
}
```

## Admin Endpoints

### Audit Logs
```http
GET /api/admin/audit-logs
```

**Query Parameters:**
- `startDate` (ISO date): Filter from date
- `endDate` (ISO date): Filter to date
- `userId` (string): Filter by user ID
- `entityType` (string): Filter by entity type
- `entityId` (string): Filter by entity ID
- `fieldName` (string): Filter by field name
- `page` (integer): Page number (default: 1)
- `pageSize` (integer): Items per page (max: 100, default: 50)

**Response:**
```json
{
  "success": true,
  "data": {
    "logs": [
      {
        "id": "uuid",
        "tenantId": "uuid",
        "userId": "uuid",
        "userName": "John Doe",
        "action": "UPDATE",
        "entityType": "employee",
        "entityId": "uuid",
        "fieldName": "title",
        "oldValue": "Developer",
        "newValue": "Senior Developer",
        "timestamp": "2024-01-01T12:00:00Z",
        "ipAddress": "192.168.1.1",
        "userAgent": "Mozilla/5.0..."
      }
    ],
    "pagination": {
      "page": 1,
      "pageSize": 50,
      "total": 1250,
      "totalPages": 25
    }
  }
}
```

### Export Audit Logs
```http
GET /api/admin/audit-logs/export
```

**Query Parameters:** Same as audit logs list
**Response:** CSV file download

### Bulk Import Validation
```http
POST /api/admin/employees/bulk-import/validate
```

**Content-Type:** multipart/form-data
**Body:** Form field `csvFile` with CSV file

**Response:**
```json
{
  "success": true,
  "data": {
    "validation": {
      "isValid": true,
      "errors": [],
      "warnings": ["Row 5: Phone number format unusual"],
      "summary": {
        "totalRows": 100,
        "validRows": 99,
        "invalidRows": 1,
        "duplicateEmails": 0
      }
    },
    "fileInfo": {
      "name": "employees.csv",
      "size": 25600,
      "type": "text/csv"
    }
  }
}
```

### Bulk Import
```http
POST /api/admin/employees/bulk-import
```

**Content-Type:** multipart/form-data
**Body:**
- `csvFile`: CSV file
- `batchSize` (integer): Processing batch size (default: 50)
- `updateExisting` (boolean): Update existing employees (default: false)
- `skipInvalidRows` (boolean): Skip invalid rows (default: true)

**Response:**
```json
{
  "success": true,
  "data": {
    "summary": {
      "processed": 100,
      "created": 85,
      "updated": 10,
      "failed": 5
    },
    "results": [
      {
        "row": 1,
        "status": "created",
        "employeeId": "uuid",
        "email": "john.doe@company.com"
      }
    ],
    "errors": [
      {
        "row": 15,
        "error": "Invalid email format",
        "data": {"email": "invalid-email"}
      }
    ]
  },
  "message": "Import completed: 85 created, 10 updated, 5 failed"
}
```

### Custom Fields Management
```http
GET /api/admin/custom-fields
POST /api/admin/custom-fields
PUT /api/admin/custom-fields/:id
DELETE /api/admin/custom-fields/:id
```

**Create Custom Field Request:**
```json
{
  "fieldName": "employeeId",
  "displayName": "Employee ID",
  "fieldType": "text|number|date|dropdown|multiselect",
  "isRequired": true,
  "options": ["Option 1", "Option 2"],
  "displayOrder": 1
}
```

## Tenant Management

### Get Tenant Settings
```http
GET /api/tenant/settings
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Acme Corp",
    "subdomain": "acme",
    "logoUrl": "https://...",
    "primaryColor": "#007bff",
    "accentColor": "#6c757d",
    "subscriptionTier": "professional",
    "userLimit": 200,
    "dataRetentionDays": 2555,
    "createdAt": "2024-01-01T00:00:00Z",
    "updatedAt": "2024-01-01T00:00:00Z"
  }
}
```

### Update Branding (Super Admin Only)
```http
PUT /api/tenant/branding
```

**Request Body:**
```json
{
  "primaryColor": "#007bff",
  "accentColor": "#6c757d"
}
```

### Upload Logo (Super Admin Only)
```http
POST /api/tenant/logo
```

**Content-Type:** multipart/form-data
**Body:** Form field `logo` with image file (max 2MB)

### Update SSO Configuration (Super Admin Only)
```http
PUT /api/tenant/sso-config
```

**Request Body:**
```json
{
  "provider": "azure-ad",
  "config": {
    "clientId": "client-id",
    "clientSecret": "client-secret",
    "tenantId": "azure-tenant-id"
  }
}
```

## Billing (Super Admin Only)

### Get Billing Information
```http
GET /api/billing/tenant/billing
```

**Response:**
```json
{
  "subscriptionTier": "professional",
  "userLimit": 200,
  "subscriptionStatus": "active",
  "currentPeriodEnd": "2024-04-01T00:00:00Z",
  "cancelAtPeriodEnd": false,
  "nextInvoiceAmount": 2999
}
```

### Upgrade Subscription
```http
POST /api/billing/tenant/billing/upgrade
```

**Request Body:**
```json
{
  "priceId": "price_professional_monthly"
}
```

### Get Available Plans
```http
GET /api/billing/plans
```

**Response:**
```json
[
  {
    "tier": "starter",
    "name": "Starter",
    "userLimit": 50,
    "monthlyPrice": 9.99,
    "yearlyPrice": 99.99,
    "features": [
      "Up to 50 employees",
      "Basic search functionality",
      "Profile management",
      "Email support"
    ]
  }
]
```

## Error Responses

All endpoints return consistent error responses:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable error message",
    "details": "Additional error details (optional)",
    "requestId": "uuid"
  }
}
```

### Common Error Codes

- `UNAUTHORIZED` (401): Invalid or missing authentication token
- `FORBIDDEN` (403): Insufficient permissions for the requested action
- `NOT_FOUND` (404): Requested resource not found
- `VALIDATION_ERROR` (400): Invalid request data
- `TENANT_NOT_FOUND` (404): Invalid tenant or tenant not found
- `EMPLOYEE_NOT_FOUND` (404): Employee not found
- `FILE_UPLOAD_ERROR` (400): File upload failed
- `SEARCH_ERROR` (500): Search service temporarily unavailable
- `ANALYTICS_ERROR` (500): Analytics service error
- `BILLING_ERROR` (500): Billing service error

## Rate Limiting

API requests are rate limited per tenant:
- 1000 requests per hour for regular endpoints
- 100 requests per hour for bulk operations
- 10 requests per minute for file uploads

Rate limit headers are included in responses:
```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1640995200
```

## Pagination

List endpoints support pagination with consistent parameters:
- `page`: Page number (1-based)
- `pageSize`: Items per page (max varies by endpoint)

Pagination response format:
```json
{
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "total": 150,
    "totalPages": 8,
    "hasNext": true,
    "hasPrev": false
  }
}
```

## Performance Requirements

- Employee list: < 2 seconds response time
- Search results: < 500ms for up to 10,000 employees
- Profile views: < 1 second response time
- Analytics dashboard: < 5 seconds with caching

## Security

- All data transmission uses HTTPS with TLS 1.2+
- JWT tokens expire after 8 hours
- Sensitive fields are encrypted at rest
- Tenant data isolation enforced at database level
- All API requests are logged for audit purposes