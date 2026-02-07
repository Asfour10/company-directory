import { AuthorizationService, Role, Permission } from '../middleware/authorization.middleware';

/**
 * Test script to verify authorization functionality
 */
async function testAuthorization() {
  console.log('🔐 Testing Authorization System...\n');

  // Test 1: Role permissions
  console.log('1. Testing role permissions:');
  
  const testCases = [
    { role: Role.USER, permission: Permission.VIEW_EMPLOYEES, expected: true },
    { role: Role.USER, permission: Permission.CREATE_EMPLOYEES, expected: false },
    { role: Role.MANAGER, permission: Permission.EDIT_DIRECT_REPORTS, expected: true },
    { role: Role.ADMIN, permission: Permission.CREATE_EMPLOYEES, expected: true },
    { role: Role.SUPER_ADMIN, permission: Permission.ASSIGN_ROLES, expected: true },
  ];

  for (const testCase of testCases) {
    const result = AuthorizationService.hasPermission(testCase.role, testCase.permission);
    const status = result === testCase.expected ? '✅' : '❌';
    console.log(`   ${status} ${testCase.role} -> ${testCase.permission}: ${result}`);
  }

  // Test 2: Multiple permissions
  console.log('\n2. Testing multiple permissions:');
  
  const hasAnyResult = AuthorizationService.hasAnyPermission(
    Role.USER, 
    [Permission.VIEW_EMPLOYEES, Permission.CREATE_EMPLOYEES]
  );
  console.log(`   ✅ User has any of [VIEW_EMPLOYEES, CREATE_EMPLOYEES]: ${hasAnyResult}`);

  const hasAllResult = AuthorizationService.hasAllPermissions(
    Role.USER, 
    [Permission.VIEW_EMPLOYEES, Permission.CREATE_EMPLOYEES]
  );
  console.log(`   ✅ User has all of [VIEW_EMPLOYEES, CREATE_EMPLOYEES]: ${hasAllResult}`);

  // Test 3: Role hierarchy
  console.log('\n3. Testing role hierarchy:');
  
  const roles = [Role.USER, Role.MANAGER, Role.ADMIN, Role.SUPER_ADMIN];
  const permissions = [
    Permission.VIEW_EMPLOYEES,
    Permission.EDIT_DIRECT_REPORTS,
    Permission.CREATE_EMPLOYEES,
    Permission.ASSIGN_ROLES
  ];

  console.log('   Role permissions matrix:');
  console.log('   Role\\Permission | VIEW_EMP | EDIT_REPORTS | CREATE_EMP | ASSIGN_ROLES');
  console.log('   ----------------|----------|--------------|------------|-------------');

  for (const role of roles) {
    const results = permissions.map(permission => 
      AuthorizationService.hasPermission(role, permission) ? '✅' : '❌'
    );
    console.log(`   ${role.padEnd(15)} | ${results[0].padEnd(8)} | ${results[1].padEnd(12)} | ${results[2].padEnd(10)} | ${results[3]}`);
  }

  console.log('\n✅ Authorization system test completed!');
}

// Run the test
testAuthorization().catch(console.error);