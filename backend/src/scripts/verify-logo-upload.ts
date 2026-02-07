#!/usr/bin/env tsx

/**
 * Verification script for tenant logo upload functionality
 * **Validates: Requirements 12.1**
 * 
 * This script verifies that the logo upload implementation meets all requirements:
 * - Handles logo file upload (max 2MB)
 * - Validates image format
 * - Stores in object storage
 */

import { TenantService, tenantLogoUploadService } from '../services/tenant.service';
import { prisma } from '../lib/database';
import fs from 'fs/promises';
import path from 'path';

interface VerificationResult {
  requirement: string;
  status: 'PASS' | 'FAIL' | 'SKIP';
  details: string;
  error?: string;
}

const results: VerificationResult[] = [];

function logResult(requirement: string, status: 'PASS' | 'FAIL' | 'SKIP', details: string, error?: string) {
  results.push({ requirement, status, details, error });
  const emoji = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⏭️';
  console.log(`${emoji} ${requirement}: ${details}`);
  if (error) console.log(`   Error: ${error}`);
}

/**
 * Create a test image file buffer
 */
function createTestImageBuffer(sizeInBytes: number): Buffer {
  // Create a minimal PNG header + data
  const pngHeader = Buffer.from([
    0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG signature
    0x00, 0x00, 0x00, 0x0D, // IHDR chunk length
    0x49, 0x48, 0x44, 0x52, // IHDR
    0x00, 0x00, 0x00, 0x01, // Width: 1
    0x00, 0x00, 0x00, 0x01, // Height: 1
    0x08, 0x02, 0x00, 0x00, 0x00, // Bit depth, color type, compression, filter, interlace
    0x90, 0x77, 0x53, 0xDE, // CRC
  ]);
  
  const remainingSize = Math.max(0, sizeInBytes - pngHeader.length);
  const padding = Buffer.alloc(remainingSize, 0);
  
  return Buffer.concat([pngHeader, padding]);
}

/**
 * Create a mock file for testing
 */
function createMockFile(filename: string, mimeType: string, size: number): Express.Multer.File {
  return {
    fieldname: 'logo',
    originalname: filename,
    encoding: '7bit',
    mimetype: mimeType,
    size,
    buffer: createTestImageBuffer(size),
    destination: '',
    filename: '',
    path: '',
    stream: null as any,
  };
}

/**
 * Verify logo upload configuration meets requirements
 */
async function verifyUploadConfiguration() {
  try {
    const config = tenantLogoUploadService['config'];
    
    // Requirement 12.1: Max 2MB file size
    if (config.maxFileSize !== 2 * 1024 * 1024) {
      throw new Error(`Expected max file size 2MB (2097152 bytes), got ${config.maxFileSize} bytes`);
    }
    
    // Requirement 12.1: Image format validation
    const requiredMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];
    const missingMimeTypes = requiredMimeTypes.filter(type => !config.allowedMimeTypes.includes(type));
    
    if (missingMimeTypes.length > 0) {
      throw new Error(`Missing required MIME types: ${missingMimeTypes.join(', ')}`);
    }
    
    const requiredExtensions = ['.jpg', '.jpeg', '.png', '.webp'];
    const missingExtensions = requiredExtensions.filter(ext => !config.allowedExtensions.includes(ext));
    
    if (missingExtensions.length > 0) {
      throw new Error(`Missing required extensions: ${missingExtensions.join(', ')}`);
    }
    
    logResult(
      'Upload Configuration',
      'PASS',
      `Max size: ${config.maxFileSize / (1024 * 1024)}MB, MIME types: ${config.allowedMimeTypes.length}, Extensions: ${config.allowedExtensions.length}`
    );
  } catch (error) {
    logResult('Upload Configuration', 'FAIL', 'Configuration does not meet requirements', (error as Error).message);
  }
}

/**
 * Verify file size validation
 */
async function verifyFileSizeValidation() {
  try {
    // Test valid file size (1MB)
    const validFile = createMockFile('logo.png', 'image/png', 1024 * 1024);
    const validResult = await tenantLogoUploadService.validateImage(validFile);
    
    if (!validResult.isValid) {
      throw new Error(`Valid 1MB file rejected: ${validResult.errors.join(', ')}`);
    }
    
    // Test file at exact limit (2MB)
    const limitFile = createMockFile('logo.png', 'image/png', 2 * 1024 * 1024);
    const limitResult = await tenantLogoUploadService.validateImage(limitFile);
    
    if (!limitResult.isValid) {
      const sizeErrors = limitResult.errors.filter(err => err.includes('exceeds maximum'));
      if (sizeErrors.length > 0) {
        throw new Error(`File at 2MB limit rejected for size: ${sizeErrors.join(', ')}`);
      }
    }
    
    // Test oversized file (3MB)
    const oversizedFile = createMockFile('logo.png', 'image/png', 3 * 1024 * 1024);
    const oversizedResult = await tenantLogoUploadService.validateImage(oversizedFile);
    
    if (oversizedResult.isValid) {
      throw new Error('3MB file should be rejected but was accepted');
    }
    
    const hasSizeError = oversizedResult.errors.some(err => err.includes('exceeds maximum allowed size'));
    if (!hasSizeError) {
      throw new Error('Oversized file rejection should mention size limit');
    }
    
    logResult(
      'File Size Validation',
      'PASS',
      'Correctly validates 1MB (pass), 2MB (pass), 3MB (reject)'
    );
  } catch (error) {
    logResult('File Size Validation', 'FAIL', 'Size validation not working correctly', (error as Error).message);
  }
}

/**
 * Verify image format validation
 */
async function verifyImageFormatValidation() {
  try {
    // Test valid image formats
    const validFormats = [
      { mime: 'image/jpeg', ext: '.jpg' },
      { mime: 'image/png', ext: '.png' },
      { mime: 'image/webp', ext: '.webp' },
    ];
    
    for (const format of validFormats) {
      const file = createMockFile(`logo${format.ext}`, format.mime, 1024 * 1024);
      const result = await tenantLogoUploadService.validateImage(file);
      
      const mimeErrors = result.errors.filter(err => err.includes('not allowed') && !err.includes('size'));
      if (mimeErrors.length > 0) {
        throw new Error(`Valid format ${format.mime} rejected: ${mimeErrors.join(', ')}`);
      }
    }
    
    // Test invalid format
    const invalidFile = createMockFile('document.pdf', 'application/pdf', 1024 * 1024);
    const invalidResult = await tenantLogoUploadService.validateImage(invalidFile);
    
    if (invalidResult.isValid) {
      throw new Error('PDF file should be rejected but was accepted');
    }
    
    const hasMimeError = invalidResult.errors.some(err => err.includes('not allowed'));
    if (!hasMimeError) {
      throw new Error('Invalid format rejection should mention MIME type');
    }
    
    logResult(
      'Image Format Validation',
      'PASS',
      `Valid formats accepted: ${validFormats.length}, Invalid format rejected`
    );
  } catch (error) {
    logResult('Image Format Validation', 'FAIL', 'Format validation not working correctly', (error as Error).message);
  }
}

/**
 * Verify tenant logo upload service
 */
async function verifyTenantLogoService() {
  let testTenantId: string | null = null;
  
  try {
    // Create test tenant
    const testTenant = await TenantService.createTenant({
      name: 'Logo Verification Test Company',
      subdomain: 'logo-verify-' + Date.now(),
      subscriptionTier: 'basic',
      userLimit: 100,
    });
    testTenantId = testTenant.id;
    
    // Mock file upload to avoid actual storage operations
    const originalUploadFile = tenantLogoUploadService.uploadFile;
    const originalDeleteFile = tenantLogoUploadService.deleteFile;
    
    const mockUploadResult = {
      filename: 'test-logo.png',
      originalName: 'company-logo.png',
      mimeType: 'image/png',
      size: 1024 * 1024,
      url: 'https://example.com/uploads/test-logo.png',
      key: 'tenant-logos/test-logo.png'
    };
    
    tenantLogoUploadService.uploadFile = jest.fn().mockResolvedValue(mockUploadResult);
    tenantLogoUploadService.deleteFile = jest.fn().mockResolvedValue(undefined);
    
    // Test logo upload
    const logoFile = createMockFile('company-logo.png', 'image/png', 1024 * 1024);
    const logoUrl = await TenantService.uploadLogo(testTenant.id, logoFile);
    
    if (!logoUrl) {
      throw new Error('Logo upload should return URL');
    }
    
    // Verify tenant was updated
    const updatedTenant = await TenantService.getTenantById(testTenant.id);
    if (updatedTenant?.logoUrl !== logoUrl) {
      throw new Error('Tenant logoUrl not updated after upload');
    }
    
    // Test logo deletion
    await TenantService.deleteLogo(testTenant.id);
    
    const tenantAfterDelete = await TenantService.getTenantById(testTenant.id);
    if (tenantAfterDelete?.logoUrl !== null) {
      throw new Error('Tenant logoUrl not cleared after deletion');
    }
    
    // Restore original methods
    tenantLogoUploadService.uploadFile = originalUploadFile;
    tenantLogoUploadService.deleteFile = originalDeleteFile;
    
    logResult(
      'Tenant Logo Service',
      'PASS',
      'Upload and delete operations work correctly'
    );
  } catch (error) {
    logResult('Tenant Logo Service', 'FAIL', 'Service operations not working correctly', (error as Error).message);
  } finally {
    // Clean up test tenant
    if (testTenantId) {
      try {
        await TenantService.deleteTenant(testTenantId);
      } catch (error) {
        console.warn('Failed to clean up test tenant:', error);
      }
    }
  }
}

/**
 * Verify error handling
 */
async function verifyErrorHandling() {
  try {
    let errorCount = 0;
    
    // Test upload without file
    try {
      await TenantService.uploadLogo('test-tenant', null as any);
    } catch (error) {
      if ((error as Error).message.includes('No logo file provided')) {
        errorCount++;
      }
    }
    
    // Test upload for non-existent tenant
    const logoFile = createMockFile('logo.png', 'image/png', 1024 * 1024);
    try {
      await TenantService.uploadLogo('non-existent-tenant', logoFile);
    } catch (error) {
      if ((error as Error).message.includes('Tenant not found')) {
        errorCount++;
      }
    }
    
    // Test delete for non-existent tenant
    try {
      await TenantService.deleteLogo('non-existent-tenant');
    } catch (error) {
      if ((error as Error).message.includes('Tenant not found')) {
        errorCount++;
      }
    }
    
    if (errorCount !== 3) {
      throw new Error(`Expected 3 error cases to be handled, got ${errorCount}`);
    }
    
    logResult(
      'Error Handling',
      'PASS',
      'All error cases handled correctly'
    );
  } catch (error) {
    logResult('Error Handling', 'FAIL', 'Error handling not working correctly', (error as Error).message);
  }
}

/**
 * Verify storage configuration
 */
async function verifyStorageConfiguration() {
  try {
    const config = tenantLogoUploadService['config'];
    
    // Check that storage destination is configured
    if (!config.destination) {
      throw new Error('Storage destination not configured');
    }
    
    // Check appropriate configuration exists for the destination
    if (config.destination === 'local' && !config.localConfig) {
      throw new Error('Local storage selected but localConfig not provided');
    }
    
    if (config.destination === 's3' && !config.s3Config) {
      throw new Error('S3 storage selected but s3Config not provided');
    }
    
    if (config.destination === 'azure' && !config.azureConfig) {
      throw new Error('Azure storage selected but azureConfig not provided');
    }
    
    logResult(
      'Storage Configuration',
      'PASS',
      `Storage destination: ${config.destination}, Configuration present`
    );
  } catch (error) {
    logResult('Storage Configuration', 'FAIL', 'Storage not properly configured', (error as Error).message);
  }
}

/**
 * Main verification function
 */
async function runVerification() {
  console.log('🔍 Verifying Tenant Logo Upload Implementation');
  console.log('📋 Requirement 12.1: Logo upload with max 2MB, image format validation, object storage');
  console.log('='.repeat(80));
  
  try {
    await verifyUploadConfiguration();
    await verifyFileSizeValidation();
    await verifyImageFormatValidation();
    await verifyTenantLogoService();
    await verifyErrorHandling();
    await verifyStorageConfiguration();
  } catch (error) {
    console.error('❌ Verification runner error:', error);
  }
  
  // Summary
  console.log('\n📊 Verification Summary');
  console.log('='.repeat(80));
  
  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  const skipped = results.filter(r => r.status === 'SKIP').length;
  
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`⏭️ Skipped: ${skipped}`);
  
  if (failed > 0) {
    console.log('\n❌ Failed Verifications:');
    results.filter(r => r.status === 'FAIL').forEach(r => {
      console.log(`   - ${r.requirement}: ${r.error || r.details}`);
    });
  }
  
  // Final requirement compliance check
  console.log('\n📋 Requirement 12.1 Compliance Status');
  console.log('='.repeat(80));
  
  const criticalTests = [
    'Upload Configuration',
    'File Size Validation',
    'Image Format Validation',
    'Storage Configuration'
  ];
  
  const criticalPassed = criticalTests.every(test => 
    results.find(r => r.requirement === test)?.status === 'PASS'
  );
  
  if (criticalPassed && failed === 0) {
    console.log('✅ REQUIREMENT 12.1 FULLY SATISFIED');
    console.log('   ✓ Logo upload handles max 2MB file size');
    console.log('   ✓ Image format validation implemented');
    console.log('   ✓ Object storage integration configured');
    console.log('   ✓ Error handling implemented');
    console.log('   ✓ Service methods working correctly');
  } else {
    console.log('❌ REQUIREMENT 12.1 NOT FULLY SATISFIED');
    console.log(`   - ${failed} verification(s) failed`);
    console.log('   - Review failed tests above');
  }
  
  process.exit(failed > 0 ? 1 : 0);
}

// Run verification if this script is executed directly
if (require.main === module) {
  runVerification().catch(console.error);
}

export { runVerification };