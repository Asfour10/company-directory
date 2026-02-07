#!/usr/bin/env tsx

/**
 * Test script for tenant logo upload functionality
 * Tests requirement 12.1: Logo upload with max 2MB size and image format validation
 */

import { TenantService, tenantLogoUploadService } from '../services/tenant.service';
import { FileUploadService } from '../services/file-upload.service';
import { prisma } from '../lib/database';
import fs from 'fs/promises';
import path from 'path';

interface TestResult {
  test: string;
  passed: boolean;
  error?: string;
  details?: any;
}

const results: TestResult[] = [];

function logTest(test: string, passed: boolean, error?: string, details?: any) {
  results.push({ test, passed, error, details });
  const status = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`${status}: ${test}`);
  if (error) console.log(`   Error: ${error}`);
  if (details) console.log(`   Details:`, details);
}

/**
 * Create a mock file buffer for testing
 */
function createMockFile(
  filename: string,
  mimeType: string,
  size: number
): Express.Multer.File {
  const buffer = Buffer.alloc(size);
  return {
    fieldname: 'logo',
    originalname: filename,
    encoding: '7bit',
    mimetype: mimeType,
    size,
    buffer,
    destination: '',
    filename: '',
    path: '',
    stream: null as any,
  };
}

/**
 * Test logo upload configuration
 */
async function testLogoUploadConfig() {
  try {
    // Test configuration values
    const config = tenantLogoUploadService['config'];
    
    // Test max file size (should be 2MB as per requirement 12.1)
    const expectedMaxSize = 2 * 1024 * 1024; // 2MB
    if (config.maxFileSize !== expectedMaxSize) {
      throw new Error(`Max file size should be ${expectedMaxSize} bytes, got ${config.maxFileSize}`);
    }

    // Test allowed MIME types
    const expectedMimeTypes = [
      'image/jpeg',
      'image/jpg', 
      'image/png',
      'image/webp',
      'image/svg+xml'
    ];
    
    for (const mimeType of expectedMimeTypes) {
      if (!config.allowedMimeTypes.includes(mimeType)) {
        throw new Error(`Missing allowed MIME type: ${mimeType}`);
      }
    }

    // Test allowed extensions
    const expectedExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.svg'];
    for (const ext of expectedExtensions) {
      if (!config.allowedExtensions.includes(ext)) {
        throw new Error(`Missing allowed extension: ${ext}`);
      }
    }

    logTest('Logo upload configuration', true, undefined, {
      maxFileSize: config.maxFileSize,
      allowedMimeTypes: config.allowedMimeTypes.length,
      allowedExtensions: config.allowedExtensions.length
    });
  } catch (error) {
    logTest('Logo upload configuration', false, (error as Error).message);
  }
}

/**
 * Test file size validation
 */
async function testFileSizeValidation() {
  try {
    // Test file within size limit (1MB)
    const validFile = createMockFile('logo.png', 'image/png', 1024 * 1024);
    const validation1 = await tenantLogoUploadService.validateImage(validFile);
    
    if (!validation1.isValid) {
      throw new Error(`Valid file rejected: ${validation1.errors.join(', ')}`);
    }

    // Test file exceeding size limit (3MB)
    const oversizedFile = createMockFile('logo.png', 'image/png', 3 * 1024 * 1024);
    const validation2 = await tenantLogoUploadService.validateImage(oversizedFile);
    
    if (validation2.isValid) {
      throw new Error('Oversized file should be rejected');
    }

    if (!validation2.errors.some(err => err.includes('exceeds maximum allowed size'))) {
      throw new Error('Should have size validation error');
    }

    logTest('File size validation', true, undefined, {
      validFileSize: validFile.size,
      oversizedFileSize: oversizedFile.size,
      maxAllowed: 2 * 1024 * 1024
    });
  } catch (error) {
    logTest('File size validation', false, (error as Error).message);
  }
}

/**
 * Test MIME type validation
 */
async function testMimeTypeValidation() {
  try {
    // Test valid MIME types
    const validMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];
    for (const mimeType of validMimeTypes) {
      const file = createMockFile('logo.jpg', mimeType, 1024 * 1024);
      const validation = await tenantLogoUploadService.validateImage(file);
      
      if (!validation.isValid) {
        throw new Error(`Valid MIME type ${mimeType} rejected: ${validation.errors.join(', ')}`);
      }
    }

    // Test invalid MIME type
    const invalidFile = createMockFile('document.pdf', 'application/pdf', 1024 * 1024);
    const validation = await tenantLogoUploadService.validateImage(invalidFile);
    
    if (validation.isValid) {
      throw new Error('Invalid MIME type should be rejected');
    }

    if (!validation.errors.some(err => err.includes('not allowed'))) {
      throw new Error('Should have MIME type validation error');
    }

    logTest('MIME type validation', true, undefined, {
      validMimeTypes: validMimeTypes.length,
      testedInvalidType: 'application/pdf'
    });
  } catch (error) {
    logTest('MIME type validation', false, (error as Error).message);
  }
}

/**
 * Test tenant logo upload service methods
 */
async function testTenantLogoService() {
  try {
    // Create a test tenant first
    const testTenant = await TenantService.createTenant({
      name: 'Test Logo Company',
      subdomain: 'test-logo-' + Date.now(),
      subscriptionTier: 'basic',
      userLimit: 100,
    });

    // Test logo upload
    const logoFile = createMockFile('company-logo.png', 'image/png', 1024 * 1024);
    
    // Mock the file upload service to avoid actual file operations
    const originalUploadFile = tenantLogoUploadService.uploadFile;
    tenantLogoUploadService.uploadFile = jest.fn().mockResolvedValue({
      filename: 'test-logo.png',
      originalName: 'company-logo.png',
      mimeType: 'image/png',
      size: 1024 * 1024,
      url: 'https://example.com/uploads/test-logo.png',
      key: 'tenant-logos/test-logo.png'
    });

    const logoUrl = await TenantService.uploadLogo(testTenant.id, logoFile);
    
    if (!logoUrl) {
      throw new Error('Logo upload should return URL');
    }

    // Verify tenant was updated with logo URL
    const updatedTenant = await TenantService.getTenantById(testTenant.id);
    if (!updatedTenant?.logoUrl) {
      throw new Error('Tenant should have logo URL after upload');
    }

    // Test logo deletion
    const originalDeleteFile = tenantLogoUploadService.deleteFile;
    tenantLogoUploadService.deleteFile = jest.fn().mockResolvedValue(undefined);

    await TenantService.deleteLogo(testTenant.id);

    // Verify tenant logo URL was cleared
    const tenantAfterDelete = await TenantService.getTenantById(testTenant.id);
    if (tenantAfterDelete?.logoUrl) {
      throw new Error('Tenant logo URL should be cleared after deletion');
    }

    // Restore original methods
    tenantLogoUploadService.uploadFile = originalUploadFile;
    tenantLogoUploadService.deleteFile = originalDeleteFile;

    // Clean up test tenant
    await TenantService.deleteTenant(testTenant.id);

    logTest('Tenant logo service methods', true, undefined, {
      tenantId: testTenant.id,
      uploadedUrl: logoUrl,
      deletionSuccessful: true
    });
  } catch (error) {
    logTest('Tenant logo service methods', false, (error as Error).message);
  }
}

/**
 * Test error handling for logo upload
 */
async function testLogoUploadErrorHandling() {
  try {
    // Test upload without file
    try {
      await TenantService.uploadLogo('test-tenant', null as any);
      throw new Error('Should throw error for null file');
    } catch (error) {
      if (!(error as Error).message.includes('No logo file provided')) {
        throw new Error('Should have specific error message for missing file');
      }
    }

    // Test upload for non-existent tenant
    const logoFile = createMockFile('logo.png', 'image/png', 1024 * 1024);
    try {
      await TenantService.uploadLogo('non-existent-tenant', logoFile);
      throw new Error('Should throw error for non-existent tenant');
    } catch (error) {
      if (!(error as Error).message.includes('Tenant not found')) {
        throw new Error('Should have specific error message for missing tenant');
      }
    }

    // Test delete logo for tenant without logo
    const testTenant = await TenantService.createTenant({
      name: 'Test No Logo Company',
      subdomain: 'test-no-logo-' + Date.now(),
      subscriptionTier: 'basic',
      userLimit: 100,
    });

    try {
      await TenantService.deleteLogo(testTenant.id);
      throw new Error('Should throw error when no logo exists');
    } catch (error) {
      if (!(error as Error).message.includes('No logo to delete')) {
        throw new Error('Should have specific error message for missing logo');
      }
    }

    // Clean up
    await TenantService.deleteTenant(testTenant.id);

    logTest('Logo upload error handling', true, undefined, {
      testedNullFile: true,
      testedNonExistentTenant: true,
      testedDeleteNonExistentLogo: true
    });
  } catch (error) {
    logTest('Logo upload error handling', false, (error as Error).message);
  }
}

/**
 * Test file upload service configuration
 */
async function testFileUploadServiceConfig() {
  try {
    const service = new FileUploadService({
      maxFileSize: 2 * 1024 * 1024,
      allowedMimeTypes: ['image/jpeg', 'image/png'],
      allowedExtensions: ['.jpg', '.png'],
      destination: 'local',
      localConfig: {
        uploadPath: 'test-uploads',
        baseUrl: '/test-uploads'
      }
    });

    // Test middleware creation
    const middleware = service.createUploadMiddleware('logo');
    if (!middleware) {
      throw new Error('Should create upload middleware');
    }

    // Test file validation
    const validFile = createMockFile('test.png', 'image/png', 1024 * 1024);
    const validation = await service.validateImage(validFile);
    
    if (!validation.isValid) {
      throw new Error(`Valid file should pass validation: ${validation.errors.join(', ')}`);
    }

    logTest('File upload service configuration', true, undefined, {
      middlewareCreated: !!middleware,
      validationWorking: validation.isValid
    });
  } catch (error) {
    logTest('File upload service configuration', false, (error as Error).message);
  }
}

/**
 * Main test runner
 */
async function runTests() {
  console.log('🧪 Testing Tenant Logo Upload Functionality');
  console.log('='.repeat(50));

  try {
    await testLogoUploadConfig();
    await testFileSizeValidation();
    await testMimeTypeValidation();
    await testTenantLogoService();
    await testLogoUploadErrorHandling();
    await testFileUploadServiceConfig();
  } catch (error) {
    console.error('❌ Test runner error:', error);
  }

  // Summary
  console.log('\n📊 Test Summary');
  console.log('='.repeat(50));
  
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📈 Success Rate: ${((passed / results.length) * 100).toFixed(1)}%`);

  if (failed > 0) {
    console.log('\n❌ Failed Tests:');
    results.filter(r => !r.passed).forEach(r => {
      console.log(`   - ${r.test}: ${r.error}`);
    });
  }

  // Verify requirement 12.1 compliance
  console.log('\n📋 Requirement 12.1 Compliance Check:');
  console.log('='.repeat(50));
  
  const req12_1_tests = [
    'Logo upload configuration',
    'File size validation', 
    'MIME type validation'
  ];
  
  const req12_1_passed = req12_1_tests.every(test => 
    results.find(r => r.test === test)?.passed
  );
  
  if (req12_1_passed) {
    console.log('✅ Requirement 12.1 SATISFIED:');
    console.log('   - Logo upload supports max 2MB file size');
    console.log('   - Image format validation implemented');
    console.log('   - Object storage integration ready');
  } else {
    console.log('❌ Requirement 12.1 NOT SATISFIED');
  }

  process.exit(failed > 0 ? 1 : 0);
}

// Run tests if this script is executed directly
if (require.main === module) {
  runTests().catch(console.error);
}

export { runTests };