#!/usr/bin/env tsx

/**
 * Test script for file upload service functionality
 */

import { FileUploadService, UploadConfig } from '../services/file-upload.service';
import fs from 'fs/promises';
import path from 'path';

// Mock file object for testing
function createMockFile(options: {
  originalname: string;
  mimetype: string;
  size: number;
  buffer?: Buffer;
}): Express.Multer.File {
  return {
    fieldname: 'photo',
    originalname: options.originalname,
    encoding: '7bit',
    mimetype: options.mimetype,
    size: options.size,
    buffer: options.buffer || Buffer.from('fake-image-data'),
    destination: '',
    filename: '',
    path: '',
    stream: {} as any,
  };
}

async function testLocalUploadService() {
  console.log('🧪 Testing local file upload service...');

  const config: UploadConfig = {
    maxFileSize: 2 * 1024 * 1024, // 2MB
    allowedMimeTypes: ['image/jpeg', 'image/png'],
    allowedExtensions: ['.jpg', '.jpeg', '.png'],
    destination: 'local',
    localConfig: {
      uploadPath: 'test-uploads',
      baseUrl: '/test-uploads',
    },
  };

  const uploadService = new FileUploadService(config);

  // Test 1: Valid file upload
  console.log('\n📤 Test 1: Valid file upload');
  
  const validFile = createMockFile({
    originalname: 'profile.jpg',
    mimetype: 'image/jpeg',
    size: 1024 * 500, // 500KB
  });

  try {
    const result = await uploadService.uploadFile(validFile, 'tenant-123', 'user-456');
    console.log('✅ Valid file upload successful:', {
      filename: result.filename,
      originalName: result.originalName,
      size: result.size,
      url: result.url,
    });

    // Test file exists
    if (result.path) {
      try {
        await fs.access(result.path);
        console.log('✅ File exists on disk');
      } catch (error) {
        console.log('❌ File not found on disk');
      }
    }
  } catch (error) {
    console.log('❌ Valid file upload failed:', (error as Error).message);
  }

  // Test 2: File too large
  console.log('\n📤 Test 2: File too large');
  
  const largeFile = createMockFile({
    originalname: 'large.jpg',
    mimetype: 'image/jpeg',
    size: 3 * 1024 * 1024, // 3MB (exceeds 2MB limit)
  });

  try {
    await uploadService.uploadFile(largeFile, 'tenant-123');
    console.log('❌ Large file validation failed');
  } catch (error) {
    console.log('✅ Large file rejected:', (error as Error).message);
  }

  // Test 3: Invalid MIME type
  console.log('\n📤 Test 3: Invalid MIME type');
  
  const invalidMimeFile = createMockFile({
    originalname: 'document.pdf',
    mimetype: 'application/pdf',
    size: 1024,
  });

  try {
    await uploadService.uploadFile(invalidMimeFile, 'tenant-123');
    console.log('❌ Invalid MIME type validation failed');
  } catch (error) {
    console.log('✅ Invalid MIME type rejected:', (error as Error).message);
  }

  // Test 4: Image validation
  console.log('\n🖼️ Test 4: Image validation');
  
  try {
    const validation = await uploadService.validateImage(validFile);
    console.log('✅ Image validation result:', {
      isValid: validation.isValid,
      width: validation.width,
      height: validation.height,
      errors: validation.errors,
    });
  } catch (error) {
    console.log('❌ Image validation failed:', (error as Error).message);
  }

  // Test 5: File info retrieval
  console.log('\n📋 Test 5: File info retrieval');
  
  try {
    const fileInfo = await uploadService.getFileInfo('test-file.jpg');
    console.log('✅ File info retrieved:', fileInfo);
  } catch (error) {
    console.log('❌ File info retrieval failed:', (error as Error).message);
  }

  // Clean up test files
  console.log('\n🧹 Cleaning up test files...');
  try {
    await fs.rmdir('test-uploads', { recursive: true });
    console.log('✅ Test files cleaned up');
  } catch (error) {
    console.log('⚠️ Cleanup warning:', (error as Error).message);
  }
}

async function testS3UploadService() {
  console.log('\n🧪 Testing S3 file upload service...');

  // Only test if S3 credentials are available
  if (!process.env.AWS_S3_BUCKET || !process.env.AWS_ACCESS_KEY_ID) {
    console.log('⚠️ S3 credentials not available, skipping S3 tests');
    return;
  }

  const config: UploadConfig = {
    maxFileSize: 2 * 1024 * 1024,
    allowedMimeTypes: ['image/jpeg', 'image/png'],
    allowedExtensions: ['.jpg', '.jpeg', '.png'],
    destination: 's3',
    s3Config: {
      bucket: process.env.AWS_S3_BUCKET,
      region: process.env.AWS_REGION || 'us-east-1',
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
    },
  };

  const uploadService = new FileUploadService(config);

  // Test S3 upload
  const testFile = createMockFile({
    originalname: 'test-s3.jpg',
    mimetype: 'image/jpeg',
    size: 1024,
  });

  try {
    const result = await uploadService.uploadFile(testFile, 'tenant-test');
    console.log('✅ S3 upload successful:', {
      filename: result.filename,
      url: result.url,
      key: result.key,
    });

    // Test signed URL generation
    if (result.key) {
      try {
        const signedUrl = await uploadService.generateSignedUrl(result.key, 300);
        console.log('✅ Signed URL generated:', signedUrl.substring(0, 50) + '...');
      } catch (error) {
        console.log('❌ Signed URL generation failed:', (error as Error).message);
      }

      // Test file deletion
      try {
        await uploadService.deleteFile(result.url, result.key);
        console.log('✅ S3 file deleted successfully');
      } catch (error) {
        console.log('❌ S3 file deletion failed:', (error as Error).message);
      }
    }
  } catch (error) {
    console.log('❌ S3 upload failed:', (error as Error).message);
  }
}

async function testMulterMiddleware() {
  console.log('\n🧪 Testing Multer middleware creation...');

  const config: UploadConfig = {
    maxFileSize: 1024 * 1024, // 1MB
    allowedMimeTypes: ['image/jpeg'],
    allowedExtensions: ['.jpg'],
    destination: 'local',
    localConfig: {
      uploadPath: 'test-middleware',
      baseUrl: '/test-middleware',
    },
  };

  const uploadService = new FileUploadService(config);

  try {
    const middleware = uploadService.createUploadMiddleware('profilePhoto');
    console.log('✅ Multer middleware created successfully');
    console.log('   Middleware type:', typeof middleware);
  } catch (error) {
    console.log('❌ Multer middleware creation failed:', (error as Error).message);
  }
}

async function testFilenameGeneration() {
  console.log('\n🧪 Testing filename generation...');

  const config: UploadConfig = {
    maxFileSize: 1024,
    allowedMimeTypes: ['image/jpeg'],
    allowedExtensions: ['.jpg'],
    destination: 'local',
  };

  const uploadService = new FileUploadService(config);

  // Test multiple uploads to ensure unique filenames
  const files = [
    createMockFile({
      originalname: 'profile.jpg',
      mimetype: 'image/jpeg',
      size: 100,
    }),
    createMockFile({
      originalname: 'profile.jpg',
      mimetype: 'image/jpeg',
      size: 100,
    }),
  ];

  const filenames: string[] = [];

  for (let i = 0; i < files.length; i++) {
    try {
      const result = await uploadService.uploadFile(files[i], 'tenant-123', 'user-456');
      filenames.push(result.filename);
      console.log(`✅ File ${i + 1} uploaded with filename:`, result.filename);
    } catch (error) {
      console.log(`❌ File ${i + 1} upload failed:`, (error as Error).message);
    }
  }

  // Check uniqueness
  const uniqueFilenames = new Set(filenames);
  if (uniqueFilenames.size === filenames.length) {
    console.log('✅ All filenames are unique');
  } else {
    console.log('❌ Duplicate filenames detected');
  }

  // Clean up
  try {
    await fs.rmdir('test-middleware', { recursive: true });
  } catch (error) {
    // Ignore cleanup errors
  }
}

async function testErrorHandling() {
  console.log('\n🧪 Testing error handling...');

  const config: UploadConfig = {
    maxFileSize: 1024,
    allowedMimeTypes: ['image/jpeg'],
    allowedExtensions: ['.jpg'],
    destination: 'local',
    localConfig: {
      uploadPath: '/invalid/path/that/does/not/exist',
      baseUrl: '/test',
    },
  };

  const uploadService = new FileUploadService(config);

  // Test upload to invalid path
  const testFile = createMockFile({
    originalname: 'test.jpg',
    mimetype: 'image/jpeg',
    size: 100,
  });

  try {
    await uploadService.uploadFile(testFile, 'tenant-123');
    console.log('❌ Invalid path error handling failed');
  } catch (error) {
    console.log('✅ Invalid path error caught:', (error as Error).message);
  }

  // Test delete non-existent file
  try {
    await uploadService.deleteFile('/non-existent/file.jpg');
    console.log('✅ Delete non-existent file handled gracefully');
  } catch (error) {
    console.log('⚠️ Delete non-existent file error:', (error as Error).message);
  }
}

async function testConfigValidation() {
  console.log('\n🧪 Testing configuration validation...');

  // Test S3 config without credentials
  try {
    const invalidS3Config: UploadConfig = {
      maxFileSize: 1024,
      allowedMimeTypes: ['image/jpeg'],
      allowedExtensions: ['.jpg'],
      destination: 's3',
      // Missing s3Config
    };

    const uploadService = new FileUploadService(invalidS3Config);
    const testFile = createMockFile({
      originalname: 'test.jpg',
      mimetype: 'image/jpeg',
      size: 100,
    });

    await uploadService.uploadFile(testFile, 'tenant-123');
    console.log('❌ S3 config validation failed');
  } catch (error) {
    console.log('✅ S3 config validation error caught:', (error as Error).message);
  }

  // Test Azure config (not implemented)
  try {
    const azureConfig: UploadConfig = {
      maxFileSize: 1024,
      allowedMimeTypes: ['image/jpeg'],
      allowedExtensions: ['.jpg'],
      destination: 'azure',
    };

    const uploadService = new FileUploadService(azureConfig);
    const testFile = createMockFile({
      originalname: 'test.jpg',
      mimetype: 'image/jpeg',
      size: 100,
    });

    await uploadService.uploadFile(testFile, 'tenant-123');
    console.log('❌ Azure not implemented error not thrown');
  } catch (error) {
    console.log('✅ Azure not implemented error caught:', (error as Error).message);
  }
}

async function runAllTests() {
  try {
    console.log('🚀 Starting file upload service tests...\n');

    await testLocalUploadService();
    await testS3UploadService();
    await testMulterMiddleware();
    await testFilenameGeneration();
    await testErrorHandling();
    await testConfigValidation();

    console.log('\n🎉 All file upload service tests completed!');
  } catch (error) {
    console.error('❌ File upload service test failed:', error);
    process.exit(1);
  }
}

// Run the tests
runAllTests();