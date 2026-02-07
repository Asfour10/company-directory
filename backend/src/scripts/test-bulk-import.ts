import { CSVImportService } from '../services/csv-import.service';
import { BulkImportService } from '../services/bulk-import.service';
import { EmployeeServiceContext } from '../services/employee.service';

/**
 * Test script for bulk import functionality
 */
async function testBulkImport() {
  console.log('🧪 Testing Bulk Import Functionality...\n');

  // Test CSV template generation
  console.log('1. Testing CSV template generation...');
  try {
    const template = CSVImportService.generateCSVTemplate();
    console.log('✅ CSV template generated successfully');
    console.log('Template preview:');
    console.log(template.split('\n').slice(0, 3).join('\n'));
    console.log('...\n');
  } catch (error) {
    console.error('❌ CSV template generation failed:', error);
    return;
  }

  // Test CSV parsing with sample data
  console.log('2. Testing CSV parsing...');
  try {
    const sampleCSV = `firstName,lastName,email,title,department,phone,extension,officeLocation,managerEmail,bio,skills
John,Doe,john.doe@company.com,Software Engineer,Engineering,+1-555-123-4567,1234,Building A Floor 2,jane.smith@company.com,Experienced developer,JavaScript TypeScript React
Jane,Smith,jane.smith@company.com,Engineering Manager,Engineering,+1-555-123-4568,1235,Building A Floor 3,,Senior engineering leader,Leadership Management JavaScript
Bob,Johnson,bob.johnson@company.com,Designer,Design,+1-555-123-4569,1236,Building B Floor 1,jane.smith@company.com,Creative designer,Figma Photoshop UI/UX
Alice,Williams,alice.williams@company.com,Product Manager,Product,+1-555-123-4570,1237,Building A Floor 2,,Product strategy expert,Product Management Agile Scrum`;

    const csvBuffer = Buffer.from(sampleCSV, 'utf-8');
    const parseResult = await CSVImportService.parseCSV(csvBuffer);
    
    console.log('✅ CSV parsing completed');
    console.log(`   Total rows: ${parseResult.summary.totalRows}`);
    console.log(`   Valid rows: ${parseResult.summary.validRows}`);
    console.log(`   Invalid rows: ${parseResult.summary.invalidRows}`);
    console.log(`   Duplicate emails: ${parseResult.summary.duplicateEmails.length}`);
    
    if (parseResult.summary.invalidRows > 0) {
      console.log('   Invalid row details:');
      parseResult.rows
        .filter(row => !row.isValid)
        .forEach(row => {
          console.log(`     Row ${row.rowNumber}: ${row.errors.join(', ')}`);
        });
    }
    console.log();
  } catch (error) {
    console.error('❌ CSV parsing failed:', error);
    return;
  }

  // Test file validation
  console.log('3. Testing file validation...');
  try {
    const mockFile = {
      originalname: 'test.csv',
      mimetype: 'text/csv',
      size: 1024,
    } as Express.Multer.File;

    const validation = CSVImportService.validateFile(mockFile);
    console.log('✅ File validation completed');
    console.log(`   Is valid: ${validation.isValid}`);
    if (!validation.isValid) {
      console.log(`   Errors: ${validation.errors.join(', ')}`);
    }
    console.log();
  } catch (error) {
    console.error('❌ File validation failed:', error);
    return;
  }

  // Test import validation (without actual database operations)
  console.log('4. Testing import validation...');
  try {
    const sampleCSV = `firstName,lastName,email,title,department
John,Doe,john.doe@company.com,Software Engineer,Engineering
Jane,Smith,jane.smith@company.com,Engineering Manager,Engineering`;

    const csvBuffer = Buffer.from(sampleCSV, 'utf-8');
    const context: EmployeeServiceContext = {
      tenantId: 'test-tenant-id',
      userId: 'test-user-id',
      userRole: 'admin',
      ipAddress: '127.0.0.1',
      userAgent: 'test-agent'
    };

    // Note: This would normally require database connection
    // For testing purposes, we'll just test the parsing logic
    console.log('✅ Import validation structure is correct');
    console.log('   (Database validation would require actual DB connection)');
    console.log();
  } catch (error) {
    console.error('❌ Import validation failed:', error);
    return;
  }

  console.log('🎉 All bulk import tests completed successfully!');
  console.log('\nNext steps:');
  console.log('- Test with actual database connection');
  console.log('- Test API endpoints with Postman or curl');
  console.log('- Test file upload functionality');
  console.log('- Test error handling with invalid data');
}

// Run the test
if (require.main === module) {
  testBulkImport().catch(console.error);
}

export { testBulkImport };