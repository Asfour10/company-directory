/**
 * Integration test for authorization system
 * This script tests the authorization middleware and service integration
 */

import { AuthorizationService, Role, Permission } from '../middleware/authorization.middleware';

console.log('🔐 Testing Authorization System Integration...\n');

// Test role-based permissions
console.log('1. Testing Role-Based Permissions:');
console.log('=====================================');

const testPermissions = [
  { role: Role.USER, permission: Permission.VIEW_EMPLOYEES, expected: true },
  { role: Role.USER, permission: Permission.CREATE_EMPLOYEES, expected: false },
  { role: Role.USER, permission: Permission.EDIT_OWN_PROFILE, expected: true },
  { role: Role.MANAGER, permission: Permission.EDIT_DIRECT_REPORTS, expected: true },
  { role: Role.MANAGER, permission: Permission.CREATE_EMPLOYEES, expected: false },
  { role: Role.ADMIN, permission: Permission.CREATE_EMPLOYEES, expected: true },
  { role: Role.ADMIN, permission: Permission.DEACTIVATE_EMPLOYEES, expected: true },
  { role: Role.ADMIN, permission: Permission.ASSIGN_ROLES, expected: false },
  { role: Role.SUPER_ADMIN, permission: Permission.ASSIGN_ROLES, expected: true },
  { role: Role.SUPER_ADMIN, permission: Permission.MANAGE_BILLING, expected: true },
];

let passedTests = 0;
let totalTests = testPermissions.length;

for (const test of testPermissions) {
  const result = AuthorizationService.hasPermission(test.role, test.permission);
  const status = result === test.expected ? '✅ PASS' : '❌ FAIL';
  
  if (result === test.expected) {
    passedTests++;
  }
  
  console.log(`${status} ${test.role.padEnd(12)} -> ${test.permission.padEnd(25)} = ${result}`);
}

console.log(`\nResults: ${passedTests}/${totalTests} tests passed\n`);

// Test permission combinations
console.log('2. Testing Permission Combinations:');
console.log('===================================');

const combinationTests = [
  {
    role: Role.USER,
    permissions: [Permission.VIEW_EMPLOYEES, Permission.EDIT_OWN_PROFILE],
    testType: 'hasAnyPermission',
    expected: true
  },
  {
    role: Role.USER,
    permissions: [Permission.CREATE_EMPLOYEES, Permission.DEACTIVATE_EMPLOYEES],
    testType: 'hasAnyPermission',
    expected: false
  },
  {
    role: Role.ADMIN,
    permissions: [Permission.VIEW_EMPLOYEES, Permission.CREATE_EMPLOYEES],
    testType: 'hasAllPermissions',
    expected: true
  },
  {
    role: Role.USER,
    permissions: [Permission.VIEW_EMPLOYEES, Permission.CREATE_EMPLOYEES],
    testType: 'hasAllPermissions',
    expected: false
  }
];

let combinationPassed = 0;
let combinationTotal = combinationTests.length;

for (const test of combinationTests) {
  let result: boolean;
  
  if (test.testType === 'hasAnyPermission') {
    result = AuthorizationService.hasAnyPermission(test.role, test.permissions);
  } else {
    result = AuthorizationService.hasAllPermissions(test.role, test.permissions);
  }
  
  const status = result === test.expected ? '✅ PASS' : '❌ FAIL';
  
  if (result === test.expected) {
    combinationPassed++;
  }
  
  console.log(`${status} ${test.role} ${test.testType}([${test.permissions.join(', ')}]) = ${result}`);
}

console.log(`\nResults: ${combinationPassed}/${combinationTotal} combination tests passed\n`);

// Test role hierarchy
console.log('3. Testing Role Hierarchy:');
console.log('==========================');

const roles = [Role.USER, Role.MANAGER, Role.ADMIN, Role.SUPER_ADMIN];
const keyPermissions = [
  Permission.VIEW_EMPLOYEES,
  Permission.EDIT_DIRECT_REPORTS,
  Permission.CREATE_EMPLOYEES,
  Permission.MANAGE_TENANT_SETTINGS,
  Permission.ASSIGN_ROLES
];

console.log('Role\\Permission'.padEnd(15) + ' | ' + keyPermissions.map(p => p.split('_').pop()?.padEnd(8)).join(' | '));
console.log('-'.repeat(15) + ' | ' + keyPermissions.map(() => '-'.repeat(8)).join(' | '));

for (const role of roles) {
  const results = keyPermissions.map(permission => 
    AuthorizationService.hasPermission(role, permission) ? '✅'.padEnd(8) : '❌'.padEnd(8)
  );
  console.log(role.padEnd(15) + ' | ' + results.join(' | '));
}

// Summary
const totalAllTests = totalTests + combinationTotal;
const totalAllPassed = passedTests + combinationPassed;

console.log('\n' + '='.repeat(50));
console.log('📊 AUTHORIZATION SYSTEM TEST SUMMARY');
console.log('='.repeat(50));
console.log(`✅ Passed: ${totalAllPassed}/${totalAllTests} tests`);
console.log(`❌ Failed: ${totalAllTests - totalAllPassed}/${totalAllTests} tests`);
console.log(`📈 Success Rate: ${Math.round((totalAllPassed / totalAllTests) * 100)}%`);

if (totalAllPassed === totalAllTests) {
  console.log('\n🎉 All authorization tests passed! The system is working correctly.');
} else {
  console.log('\n⚠️  Some tests failed. Please review the authorization configuration.');
}

console.log('\n🔐 Authorization system test completed!');