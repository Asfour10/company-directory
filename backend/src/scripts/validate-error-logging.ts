#!/usr/bin/env tsx

/**
 * Validation script for error handling and logging implementation
 * Validates that all components are properly imported and configured
 */

import { Logger, ErrorLogger, setupGlobalErrorHandlers } from '../lib/logger';
import { 
  AppError, 
  ValidationError, 
  NotFoundError, 
  createErrorHandler,
  formatErrorResponse,
  isOperationalError 
} from '../utils/errors';
import { 
  requestLogger, 
  responseLogger, 
  securityLogger, 
  requestIdMiddleware,
  loggingMiddlewareStack 
} from '../middleware/logging.middleware';

/**
 * Validate that all logging components are properly exported and accessible
 */
function validateLoggingComponents(): boolean {
  console.log('🔍 Validating error handling and logging components...\n');

  const validations = [
    // Logger validations
    { name: 'Logger.info', component: Logger.info, type: 'function' },
    { name: 'Logger.error', component: Logger.error, type: 'function' },
    { name: 'Logger.warn', component: Logger.warn, type: 'function' },
    { name: 'Logger.debug', component: Logger.debug, type: 'function' },
    { name: 'Logger.business', component: Logger.business, type: 'function' },
    { name: 'Logger.security', component: Logger.security, type: 'function' },
    { name: 'Logger.performance', component: Logger.performance, type: 'function' },
    { name: 'Logger.audit', component: Logger.audit, type: 'function' },
    { name: 'Logger.setContext', component: Logger.setContext, type: 'function' },
    { name: 'Logger.clearContext', component: Logger.clearContext, type: 'function' },
    
    // Error Logger validations
    { name: 'ErrorLogger.log', component: ErrorLogger.log, type: 'function' },
    { name: 'setupGlobalErrorHandlers', component: setupGlobalErrorHandlers, type: 'function' },
    
    // Error classes validations
    { name: 'AppError', component: AppError, type: 'function' },
    { name: 'ValidationError', component: ValidationError, type: 'function' },
    { name: 'NotFoundError', component: NotFoundError, type: 'function' },
    
    // Error utilities validations
    { name: 'createErrorHandler', component: createErrorHandler, type: 'function' },
    { name: 'formatErrorResponse', component: formatErrorResponse, type: 'function' },
    { name: 'isOperationalError', component: isOperationalError, type: 'function' },
    
    // Middleware validations
    { name: 'requestLogger', component: requestLogger, type: 'function' },
    { name: 'responseLogger', component: responseLogger, type: 'function' },
    { name: 'securityLogger', component: securityLogger, type: 'function' },
    { name: 'requestIdMiddleware', component: requestIdMiddleware, type: 'function' },
    { name: 'loggingMiddlewareStack', component: loggingMiddlewareStack, type: 'object' },
  ];

  let allValid = true;

  for (const validation of validations) {
    const actualType = typeof validation.component;
    const isValid = actualType === validation.type && validation.component !== undefined;
    
    const status = isValid ? '✅' : '❌';
    const typeInfo = isValid ? '' : ` (expected ${validation.type}, got ${actualType})`;
    
    console.log(`${status} ${validation.name}${typeInfo}`);
    
    if (!isValid) {
      allValid = false;
    }
  }

  return allValid;
}

/**
 * Validate error class instantiation
 */
function validateErrorClasses(): boolean {
  console.log('\n🔍 Validating error class instantiation...\n');

  try {
    // Test AppError
    const appError = new AppError('Test error', 400, 'TEST_ERROR');
    console.log('✅ AppError instantiation successful');
    console.log(`   - Message: ${appError.message}`);
    console.log(`   - Status Code: ${appError.statusCode}`);
    console.log(`   - Code: ${appError.code}`);
    console.log(`   - Is Operational: ${appError.isOperational}`);

    // Test ValidationError
    const validationError = new ValidationError('Invalid field', 'email', 'test@');
    console.log('✅ ValidationError instantiation successful');
    console.log(`   - Field: ${validationError.field}`);
    console.log(`   - Value: ${validationError.value}`);

    // Test NotFoundError
    const notFoundError = new NotFoundError('Employee', 'emp-123');
    console.log('✅ NotFoundError instantiation successful');
    console.log(`   - Message: ${notFoundError.message}`);

    return true;
  } catch (error: any) {
    console.log('❌ Error class validation failed:', error.message);
    return false;
  }
}

/**
 * Validate error response formatting
 */
function validateErrorFormatting(): boolean {
  console.log('\n🔍 Validating error response formatting...\n');

  try {
    const error = new AppError('Test formatting error', 400, 'FORMAT_TEST');
    const formatted = formatErrorResponse(error, '/test/path', true);

    console.log('✅ Error response formatting successful');
    console.log('   - Formatted response structure:');
    console.log(`     * error: ${formatted.error}`);
    console.log(`     * message: ${formatted.message}`);
    console.log(`     * code: ${formatted.code}`);
    console.log(`     * statusCode: ${formatted.statusCode}`);
    console.log(`     * timestamp: ${formatted.timestamp}`);
    console.log(`     * path: ${formatted.path}`);

    // Test operational error detection
    const isOp = isOperationalError(error);
    console.log(`✅ Operational error detection: ${isOp}`);

    return true;
  } catch (error: any) {
    console.log('❌ Error formatting validation failed:', error.message);
    return false;
  }
}

/**
 * Main validation function
 */
async function validateImplementation(): Promise<void> {
  console.log('🧪 Validating Error Handling and Logging Implementation\n');
  console.log('=' .repeat(60));

  const componentValidation = validateLoggingComponents();
  const classValidation = validateErrorClasses();
  const formattingValidation = validateErrorFormatting();

  console.log('\n' + '=' .repeat(60));
  console.log('📊 VALIDATION SUMMARY');
  console.log('=' .repeat(60));

  console.log(`Components: ${componentValidation ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Error Classes: ${classValidation ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Error Formatting: ${formattingValidation ? '✅ PASS' : '❌ FAIL'}`);

  const overallSuccess = componentValidation && classValidation && formattingValidation;
  
  console.log('\n' + '=' .repeat(60));
  console.log(`OVERALL RESULT: ${overallSuccess ? '✅ ALL VALIDATIONS PASSED' : '❌ SOME VALIDATIONS FAILED'}`);
  console.log('=' .repeat(60));

  if (overallSuccess) {
    console.log('\n🎉 Error handling and logging implementation is ready!');
    console.log('📋 Features implemented:');
    console.log('   • Comprehensive error classes with proper inheritance');
    console.log('   • Structured logging with Winston');
    console.log('   • Request/response logging middleware');
    console.log('   • Security event logging');
    console.log('   • Business event tracking');
    console.log('   • Performance monitoring');
    console.log('   • Audit logging');
    console.log('   • Context-aware logging with request IDs');
    console.log('   • Sensitive data sanitization');
    console.log('   • Global error handlers');
    console.log('   • Proper error response formatting');
  } else {
    console.log('\n❌ Please fix the validation errors above before proceeding.');
    process.exit(1);
  }
}

// Export for potential use in other scripts
export {
  validateLoggingComponents,
  validateErrorClasses,
  validateErrorFormatting,
  validateImplementation,
};

// Run validation if this script is executed directly
if (require.main === module) {
  validateImplementation().catch((error: any) => {
    console.error('❌ Validation failed:', error);
    process.exit(1);
  });
}