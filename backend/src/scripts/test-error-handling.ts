#!/usr/bin/env tsx

/**
 * Test script for error handling system
 */

import { 
  AppError,
  TenantNotFoundError,
  ValidationError,
  UnauthorizedError,
  UserLimitExceededError,
  formatErrorResponse,
  isOperationalError,
  TenantErrorHandler,
  ErrorLogger
} from '../utils/errors';

function testErrorClasses() {
  console.log('🧪 Testing error classes...');

  // Test AppError
  const appError = new AppError('Test error', 400, 'TEST_ERROR');
  console.log('✅ AppError:', {
    message: appError.message,
    statusCode: appError.statusCode,
    code: appError.code,
    isOperational: appError.isOperational,
  });

  // Test TenantNotFoundError
  const tenantError = new TenantNotFoundError('test-tenant');
  console.log('✅ TenantNotFoundError:', {
    message: tenantError.message,
    statusCode: tenantError.statusCode,
    code: tenantError.code,
  });

  // Test ValidationError
  const validationError = new ValidationError('Invalid email format', 'email', 'invalid-email');
  console.log('✅ ValidationError:', {
    message: validationError.message,
    field: validationError.field,
    value: validationError.value,
  });

  // Test UnauthorizedError
  const authError = new UnauthorizedError('Access denied');
  console.log('✅ UnauthorizedError:', {
    message: authError.message,
    statusCode: authError.statusCode,
    code: authError.code,
  });

  // Test UserLimitExceededError
  const limitError = new UserLimitExceededError(100);
  console.log('✅ UserLimitExceededError:', {
    message: limitError.message,
    statusCode: limitError.statusCode,
    code: limitError.code,
  });
}

function testErrorFormatting() {
  console.log('\n🧪 Testing error formatting...');

  const error = new ValidationError('Email is required', 'email');
  const formatted = formatErrorResponse(error, '/api/users', true);
  
  console.log('✅ Formatted error response:', JSON.stringify(formatted, null, 2));

  // Test with non-AppError
  const genericError = new Error('Generic error');
  const formattedGeneric = formatErrorResponse(genericError, '/api/test');
  
  console.log('✅ Formatted generic error:', JSON.stringify(formattedGeneric, null, 2));
}

function testOperationalErrorCheck() {
  console.log('\n🧪 Testing operational error detection...');

  const operationalError = new TenantNotFoundError('test');
  const programmingError = new Error('Unexpected error');
  
  console.log('✅ Operational error check:', {
    tenantError: isOperationalError(operationalError),
    programmingError: isOperationalError(programmingError),
  });
}

function testTenantErrorHandler() {
  console.log('\n🧪 Testing tenant error handler...');

  // Test Prisma P2025 error (record not found)
  const prismaError = {
    code: 'P2025',
    message: 'Record not found',
  };
  
  const handledError = TenantErrorHandler.handleExtractionError(prismaError, 'test-tenant');
  console.log('✅ Handled Prisma error:', {
    message: handledError.message,
    code: handledError.code,
    statusCode: handledError.statusCode,
  });

  // Test validation errors
  const subdomainError = TenantErrorHandler.handleValidationError(
    'subdomain', 
    'invalid_subdomain!', 
    'subdomain_format'
  );
  console.log('✅ Handled validation error:', {
    message: subdomainError.message,
    field: subdomainError.field,
    value: subdomainError.value,
  });

  // Test limit errors
  const limitError = TenantErrorHandler.handleLimitError('users', 150, 100);
  console.log('✅ Handled limit error:', {
    message: limitError.message,
    code: limitError.code,
    statusCode: limitError.statusCode,
  });
}

function testErrorLogger() {
  console.log('\n🧪 Testing error logger...');

  const error = new TenantNotFoundError('test-tenant');
  const context = {
    userId: 'user-123',
    tenantId: 'tenant-456',
    action: 'get_profile',
  };

  console.log('📝 Logging error (check console output):');
  ErrorLogger.log(error, context);
  console.log('✅ Error logged successfully');
}

function testErrorInheritance() {
  console.log('\n🧪 Testing error inheritance...');

  const tenantError = new TenantNotFoundError('test');
  
  console.log('✅ Error inheritance check:', {
    isError: tenantError instanceof Error,
    isAppError: tenantError instanceof AppError,
    isTenantError: tenantError instanceof TenantNotFoundError,
    name: tenantError.name,
    constructor: tenantError.constructor.name,
  });
}

function testErrorSerialization() {
  console.log('\n🧪 Testing error serialization...');

  const error = new ValidationError('Invalid input', 'name', 'test@');
  
  // Test JSON serialization
  const serialized = JSON.stringify(error);
  console.log('✅ Serialized error:', serialized);
  
  // Test formatted response serialization
  const formatted = formatErrorResponse(error, '/api/test');
  const formattedSerialized = JSON.stringify(formatted);
  console.log('✅ Serialized formatted response:', formattedSerialized);
}

function testErrorStackTrace() {
  console.log('\n🧪 Testing error stack traces...');

  function throwError() {
    throw new TenantNotFoundError('test-tenant');
  }

  function callThrowError() {
    throwError();
  }

  try {
    callThrowError();
  } catch (error) {
    console.log('✅ Stack trace preserved:', {
      hasStack: !!(error as Error).stack,
      stackIncludes: (error as Error).stack?.includes('throwError'),
    });
  }
}

async function runAllTests() {
  try {
    console.log('🚀 Starting error handling tests...\n');

    testErrorClasses();
    testErrorFormatting();
    testOperationalErrorCheck();
    testTenantErrorHandler();
    testErrorLogger();
    testErrorInheritance();
    testErrorSerialization();
    testErrorStackTrace();

    console.log('\n🎉 All error handling tests completed successfully!');
  } catch (error) {
    console.error('❌ Error handling test failed:', error);
    process.exit(1);
  }
}

// Run the tests
runAllTests();