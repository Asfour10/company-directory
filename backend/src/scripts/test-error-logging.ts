#!/usr/bin/env tsx

/**
 * Test script for error handling and logging implementation
 * Tests the Winston logger, error handlers, and logging middleware
 */

import { Logger, ErrorLogger, setupGlobalErrorHandlers } from '../lib/logger';
import { AppError, ValidationError, NotFoundError } from '../utils/errors';

async function testLogging() {
  console.log('🧪 Testing Error Handling and Logging Implementation\n');

  // Setup global error handlers
  setupGlobalErrorHandlers();

  // Test basic logging levels
  console.log('📝 Testing basic logging levels...');
  Logger.debug('This is a debug message');
  Logger.info('This is an info message');
  Logger.warn('This is a warning message');
  Logger.error('This is an error message');
  Logger.http('This is an HTTP message');

  // Test structured logging with context
  console.log('\n📝 Testing structured logging with context...');
  Logger.setContext('req-123', 'tenant-456', 'user-789');
  Logger.info('User action performed', {
    action: 'profile_update',
    resource: 'employee',
    resourceId: 'emp-123',
  });

  // Test business event logging
  console.log('\n📝 Testing business event logging...');
  Logger.business('User Login', {
    userId: 'user-123',
    tenantId: 'tenant-456',
    method: 'SSO',
  });

  Logger.business('Employee Created', {
    employeeId: 'emp-456',
    createdBy: 'user-123',
  });

  // Test security event logging
  console.log('\n📝 Testing security event logging...');
  Logger.security('Failed Authentication', {
    ip: '192.168.1.100',
    userAgent: 'Mozilla/5.0...',
    attempts: 3,
  });

  Logger.security('Admin Access', {
    userId: 'admin-123',
    endpoint: '/admin/users',
    ip: '192.168.1.100',
  });

  // Test performance logging
  console.log('\n📝 Testing performance logging...');
  Logger.performance('Database Query', 1250, {
    query: 'SELECT * FROM employees',
    table: 'employees',
  });

  // Test audit logging
  console.log('\n📝 Testing audit logging...');
  Logger.audit('UPDATE', 'employee', 'emp-123', {
    field: 'email',
    oldValue: 'old@example.com',
    newValue: 'new@example.com',
  });

  // Test external service logging
  console.log('\n📝 Testing external service logging...');
  Logger.external('AWS S3', 'upload_file', 500, true);
  Logger.external('Stripe', 'create_subscription', 2000, false);

  // Test database logging
  console.log('\n📝 Testing database logging...');
  Logger.database('INSERT', 'employees', 150);
  Logger.database('UPDATE', 'tenants', 75);

  // Test authentication logging
  console.log('\n📝 Testing authentication logging...');
  Logger.auth('login_success', 'user-123', 'tenant-456', {
    method: 'SSO',
    provider: 'Azure AD',
  });

  Logger.auth('logout', 'user-123', 'tenant-456');

  // Test error logging with different error types
  console.log('\n🚨 Testing error logging...');

  // Test AppError
  const appError = new AppError('Test application error', 400, 'TEST_ERROR');
  ErrorLogger.log(appError, {
    context: 'test_script',
    operation: 'error_testing',
  });

  // Test ValidationError
  const validationError = new ValidationError('Invalid email format', 'email', 'invalid-email');
  ErrorLogger.log(validationError, {
    context: 'validation_test',
    input: 'user_registration',
  });

  // Test NotFoundError
  const notFoundError = new NotFoundError('Employee', 'emp-999');
  ErrorLogger.log(notFoundError, {
    context: 'resource_lookup',
    operation: 'get_employee',
  });

  // Test generic Error
  const genericError = new Error('Generic error for testing');
  ErrorLogger.log(genericError, {
    context: 'generic_test',
    source: 'test_script',
  });

  // Clear context
  Logger.clearContext();

  console.log('\n✅ Error handling and logging tests completed!');
  console.log('📋 Check the console output above for structured logs');
  console.log('📁 In production, logs would be written to files in the logs/ directory');
}

// Run the test
testLogging().catch((error) => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});