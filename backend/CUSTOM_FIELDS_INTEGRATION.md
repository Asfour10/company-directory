# Custom Fields Integration with Employee Profiles

This document describes how custom fields are integrated into employee profiles in the Company Directory application.

## Overview

Custom fields allow tenants to extend employee profiles with additional data fields specific to their organization. The integration ensures that:

1. Custom field values are stored in the employee's JSONB column
2. Custom fields are included in all profile responses
3. Custom field values are validated against field definitions when creating/updating employees

## Database Schema

### Employee Table
```sql
-- Employee table includes a JSONB column for custom fields
customFields Json @default("{}") @map("custom_fields")
```

### Custom Fields Table
```sql
-- Custom field definitions are stored per tenant
model CustomField {
  id           String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  tenantId     String   @map("tenant_id") @db.Uuid
  fieldName    String   @map("field_name") @db.VarChar(100)
  fieldType    String   @map("field_type") @db.VarChar(50)
  isRequired   Boolean  @default(false) @map("is_required")
  options      Json?
  displayOrder Int?     @map("display_order")
  createdAt    DateTime @default(now()) @map("created_at")
}
```

## Supported Field Types

1. **text** - String values up to 500 characters
2. **number** - Numeric values (integers and decimals)
3. **date** - Date values
4. **dropdown** - Single selection from predefined options
5. **multiselect** - Multiple selections from predefined options

## API Integration

### Employee Creation (POST /api/employees)

```json
{
  "firstName": "John",
  "lastName": "Doe",
  "email": "john@company.com",
  "customFields": {
    "employeeId": "EMP001",
    "workLocation": "Remote",
    "yearsExperience": 5,
    "certifications": ["AWS", "Docker"]
  }
}
```

### Employee Update (PUT /api/employees/:id)

```json
{
  "customFields": {
    "employeeId": "EMP001-UPDATED",
    "workLocation": "Hybrid",
    "yearsExperience": 6
  }
}
```

### Employee Profile Response (GET /api/employees/:id)

```json
{
  "employee": {
    "id": "uuid",
    "firstName": "John",
    "lastName": "Doe",
    "email": "john@company.com",
    "customFields": {
      "employeeId": "EMP001",
      "workLocation": "Remote",
      "yearsExperience": 5,
      "certifications": ["AWS", "Docker"]
    },
    "profileCompleteness": 85
  },
  "customFields": [
    {
      "id": "cf1",
      "fieldName": "employeeId",
      "fieldType": "text",
      "isRequired": true
    },
    {
      "id": "cf2",
      "fieldName": "workLocation",
      "fieldType": "dropdown",
      "isRequired": false,
      "options": ["Remote", "Office", "Hybrid"]
    }
  ]
}
```

### Get Custom Field Definitions (GET /api/employees/custom-fields)

```json
{
  "customFields": [
    {
      "id": "cf1",
      "fieldName": "employeeId",
      "fieldType": "text",
      "isRequired": true,
      "displayOrder": 1
    },
    {
      "id": "cf2",
      "fieldName": "workLocation",
      "fieldType": "dropdown",
      "isRequired": false,
      "options": ["Remote", "Office", "Hybrid"],
      "displayOrder": 2
    }
  ],
  "count": 2
}
```

## Validation

### Field Value Validation

Custom field values are validated against their field definitions:

```typescript
// Text field validation
{ fieldName: "employeeId", fieldType: "text", isRequired: true }
// Valid: "EMP001"
// Invalid: null (required field missing)

// Dropdown field validation
{ fieldName: "workLocation", fieldType: "dropdown", options: ["Remote", "Office", "Hybrid"] }
// Valid: "Remote"
// Invalid: "InvalidLocation"

// Number field validation
{ fieldName: "yearsExperience", fieldType: "number" }
// Valid: 5
// Invalid: "not-a-number"

// Multiselect field validation
{ fieldName: "certifications", fieldType: "multiselect", options: ["AWS", "Azure", "GCP"] }
// Valid: ["AWS", "Azure"]
// Invalid: ["InvalidCert"]
```

### Validation Process

1. **Employee Creation/Update**: Custom field values are validated before saving
2. **Required Fields**: Missing required custom fields cause validation errors
3. **Field Types**: Values must match the expected data type
4. **Dropdown/Multiselect**: Values must be from the predefined options
5. **Unknown Fields**: Custom fields not defined for the tenant are rejected

## Service Layer Integration

### EmployeeService Methods

```typescript
// Create employee with custom field validation
static async createEmployee(data: CreateEmployeeData, context: EmployeeServiceContext)

// Update employee with custom field validation
static async updateEmployee(employeeId: string, data: UpdateEmployeeData, context: EmployeeServiceContext)

// Get employee with custom field definitions
static async getEmployeeByIdWithCustomFields(employeeId: string, context: EmployeeServiceContext)
```

### CustomFieldRepository Methods

```typescript
// Validate custom field values against definitions
static async validateCustomFieldValues(tenantId: string, customFieldValues: Record<string, any>)

// Validate individual field value
static validateFieldValue(field: any, value: any): { isValid: boolean; error?: string }
```

## Profile Completeness Calculation

The profile completeness calculation includes custom fields:

```typescript
// Standard fields (70% weight)
const requiredFields = ['firstName', 'lastName', 'email', 'title', 'department'];
const optionalFields = ['phone', 'officeLocation', 'bio', 'skills', 'photoUrl'];

// Custom fields (included in calculation)
const requiredCustomFields = customFields.filter(cf => cf.isRequired);
const optionalCustomFields = customFields.filter(cf => !cf.isRequired);

// Final completeness score
const completeness = Math.round(
  ((completedRequiredTotal / Math.max(totalRequired, 1)) * 70) + 
  ((completedOptionalTotal / Math.max(totalOptional, 1)) * 30)
);
```

## Error Handling

### Validation Errors

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Custom field validation failed: employeeId is required, workLocation must be one of: Remote, Office, Hybrid",
    "requestId": "req-123"
  }
}
```

### Common Error Scenarios

1. **Missing Required Field**: Required custom field not provided
2. **Invalid Field Type**: Value doesn't match expected data type
3. **Invalid Dropdown Option**: Value not in predefined options list
4. **Unknown Field**: Custom field not defined for tenant
5. **Field Constraints**: Value exceeds length limits or other constraints

## Testing

### Unit Tests

- `employee-custom-fields.service.test.ts` - Service layer integration tests
- Custom field validation tests in `CustomFieldRepository`

### Integration Tests

- `test-custom-field-integration.ts` - End-to-end custom field integration
- `test-custom-fields-simple.ts` - Basic validation testing

### Test Scenarios

1. Create employee with valid custom fields
2. Reject employee creation with invalid custom fields
3. Update employee custom fields
4. Validate required field enforcement
5. Test field type validation
6. Test dropdown/multiselect options validation

## Frontend Integration

### Form Rendering

The frontend can use the custom field definitions to dynamically render form fields:

```typescript
// Get custom fields for form rendering
const response = await fetch('/api/employees/custom-fields');
const { customFields } = await response.json();

// Render form fields based on field type
customFields.forEach(field => {
  switch (field.fieldType) {
    case 'text':
      renderTextInput(field);
      break;
    case 'dropdown':
      renderDropdown(field);
      break;
    case 'multiselect':
      renderMultiselect(field);
      break;
    // ... other field types
  }
});
```

### Profile Display

Custom fields are included in employee profile responses and can be displayed alongside standard fields.

## Security Considerations

1. **Tenant Isolation**: Custom fields are scoped to tenants
2. **Validation**: All custom field values are validated server-side
3. **Authorization**: Custom field editing follows the same authorization rules as other employee fields
4. **Audit Logging**: Custom field changes are logged in the audit system

## Performance Considerations

1. **JSONB Storage**: Custom fields are stored efficiently in PostgreSQL JSONB columns
2. **Indexing**: JSONB fields can be indexed for search performance if needed
3. **Validation Caching**: Custom field definitions are cached to avoid repeated database queries
4. **Bulk Operations**: Custom field validation is optimized for bulk employee operations

## Migration and Backwards Compatibility

1. **Default Values**: Existing employees have empty custom fields object `{}`
2. **Schema Evolution**: New custom fields can be added without affecting existing data
3. **Field Deletion**: Deleting custom field definitions doesn't remove stored values (soft delete)
4. **Data Migration**: Tools available for migrating existing data to custom fields