# Bulk Import Implementation

## Overview

The bulk import functionality has been successfully implemented for the Company Directory application. This feature allows administrators to import multiple employee records from CSV files efficiently.

## Components Implemented

### 1. CSV Import Service (`src/services/csv-import.service.ts`)

**Features:**
- CSV file parsing and validation
- Header normalization and mapping
- Data type validation
- Duplicate email detection
- File format validation
- CSV template generation

**Key Methods:**
- `parseCSV(csvBuffer)` - Parse and validate CSV data
- `validateCSVFormat()` - Validate CSV structure
- `validateAndNormalizeHeaders()` - Map CSV headers to expected fields
- `generateCSVTemplate()` - Generate downloadable CSV template
- `validateFile()` - Validate uploaded file

**Validation Features:**
- Required columns: firstName, lastName, email
- Optional columns: title, department, phone, extension, officeLocation, managerEmail, bio, skills
- Email format validation
- Phone number format validation
- Skills parsing (comma-separated to array)
- File size limits (10MB max)
- Row limits (10,000 max)

### 2. Bulk Import Service (`src/services/bulk-import.service.ts`)

**Features:**
- Batch processing of employee records
- Create/update existing employees
- Manager relationship validation
- Tenant user limit checking
- Comprehensive error handling
- Audit logging integration

**Key Methods:**
- `importFromCSV()` - Main import function
- `processBatch()` - Process employees in batches
- `processEmployeeRow()` - Handle individual employee records
- `validateImportData()` - Pre-import validation
- `prepareEmployeeData()` - Convert import data to employee format

**Import Options:**
- `batchSize` - Number of records to process at once (default: 50, max: 100)
- `updateExisting` - Whether to update existing employees (default: true)
- `skipInvalidRows` - Continue processing if invalid rows found (default: true)
- `validateManagerEmails` - Validate manager relationships (default: true)

### 3. Admin API Endpoints (`src/routes/admin.routes.ts`)

**Endpoints Added:**

#### POST `/api/admin/employees/bulk-import/validate`
- Validates CSV file before import
- Returns validation results and warnings
- File upload via multipart/form-data

#### POST `/api/admin/employees/bulk-import`
- Performs the actual bulk import
- Accepts CSV file and import options
- Returns detailed import results

#### GET `/api/admin/employees/bulk-import/template`
- Downloads CSV template file
- Includes example data and proper headers

#### GET `/api/admin/employees/bulk-import/progress/:importId`
- Gets import progress (placeholder for future async imports)

## CSV Template Format

```csv
firstName,lastName,email,title,department,phone,extension,officeLocation,managerEmail,bio,skills
John,Doe,john.doe@company.com,Software Engineer,Engineering,+1-555-123-4567,1234,Building A Floor 2,jane.smith@company.com,Experienced software engineer,JavaScript TypeScript React Node.js
```

## Import Process Flow

1. **File Upload** - Admin uploads CSV file
2. **File Validation** - Check file type, size, format
3. **CSV Parsing** - Parse headers and data rows
4. **Data Validation** - Validate each row against business rules
5. **Duplicate Detection** - Check for duplicate emails within file
6. **Tenant Validation** - Check user limits and existing employees
7. **Batch Processing** - Process employees in configurable batches
8. **Manager Resolution** - Map manager emails to employee IDs
9. **Create/Update** - Create new or update existing employees
10. **Audit Logging** - Log all changes for compliance
11. **Result Summary** - Return detailed results to admin

## Error Handling

**File-level Errors:**
- Invalid file type (must be CSV)
- File too large (>10MB)
- Empty file
- Invalid CSV structure

**Row-level Errors:**
- Missing required fields
- Invalid email format
- Invalid phone number format
- Manager email not found
- Duplicate emails

**System-level Errors:**
- Tenant user limit exceeded
- Database connection issues
- Permission denied

## Security Features

- Admin-only access (requires admin role)
- Tenant isolation (users can only import to their tenant)
- File type validation
- Size limits to prevent DoS
- Input sanitization and validation
- Audit logging for compliance

## Performance Considerations

- Batch processing to handle large files
- Configurable batch sizes
- Memory-efficient streaming CSV parser
- Database transaction management
- Progress tracking for long imports

## Testing

A test script has been created at `src/scripts/test-bulk-import.ts` to verify:
- CSV template generation
- CSV parsing functionality
- File validation
- Error handling

## Requirements Satisfied

✅ **Requirement 5.1** - Accept CSV file uploads containing employee information
✅ **Requirement 5.2** - Validate file format and data structure before processing
✅ **Requirement 5.3** - Display specific error messages for invalid data
✅ **Requirement 5.4** - Create or update Employee Profiles based on imported data
✅ **Requirement 5.5** - Provide summary report showing results and errors

## Usage Examples

### Validate CSV before import:
```bash
curl -X POST \
  -H "Authorization: Bearer <token>" \
  -F "csvFile=@employees.csv" \
  http://localhost:3000/api/admin/employees/bulk-import/validate
```

### Import employees:
```bash
curl -X POST \
  -H "Authorization: Bearer <token>" \
  -F "csvFile=@employees.csv" \
  -F "updateExisting=true" \
  -F "skipInvalidRows=true" \
  http://localhost:3000/api/admin/employees/bulk-import
```

### Download template:
```bash
curl -X GET \
  -H "Authorization: Bearer <token>" \
  http://localhost:3000/api/admin/employees/bulk-import/template \
  -o employee-template.csv
```

## Future Enhancements

- Async processing for very large files
- Progress tracking with WebSocket updates
- Custom field mapping interface
- Import history and rollback
- Scheduled imports
- Integration with HR systems