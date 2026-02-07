#!/usr/bin/env tsx

/**
 * Test script for manager relationship functionality
 */

import { prisma } from '../lib/database';
import { EmployeeRepository } from '../repositories/employee.repository';
import { EmployeeService } from '../services/employee.service';
import { setTenantContext } from '../lib/database';

async function testManagerRelationships() {
  try {
    console.log('🔍 Testing manager relationship functionality...');
    
    // Create a test tenant
    const testTenant = await prisma.tenant.create({
      data: {
        name: 'Test Company',
        subdomain: 'testcompany-mgr',
        subscriptionTier: 'professional',
        userLimit: 100,
      },
    });
    
    console.log('✅ Test tenant created:', testTenant.subdomain);
    
    // Set tenant context for RLS
    await setTenantContext(testTenant.id);
    
    const context = {
      tenantId: testTenant.id,
      userId: 'test-user-123',
      userRole: 'admin',
      ipAddress: '127.0.0.1',
      userAgent: 'Test Agent',
    };
    
    // Test 1: Create organizational hierarchy
    console.log('\n🧪 Test 1: Create organizational hierarchy');
    
    // Create CEO (no manager)
    const ceo = await EmployeeService.createEmployee({
      firstName: 'John',
      lastName: 'CEO',
      email: 'ceo@testcompany.com',
      title: 'Chief Executive Officer',
      department: 'Executive',
    }, context);
    console.log('✅ CEO created:', `${ceo.firstName} ${ceo.lastName}`);
    
    // Create VP (reports to CEO)
    const vp = await EmployeeService.createEmployee({
      firstName: 'Jane',
      lastName: 'VP',
      email: 'vp@testcompany.com',
      title: 'Vice President of Engineering',
      department: 'Engineering',
      managerId: ceo.id,
    }, context);
    console.log('✅ VP created:', `${vp.firstName} ${vp.lastName}`);
    
    // Create Director (reports to VP)
    const director = await EmployeeService.createEmployee({
      firstName: 'Bob',
      lastName: 'Director',
      email: 'director@testcompany.com',
      title: 'Engineering Director',
      department: 'Engineering',
      managerId: vp.id,
    }, context);
    console.log('✅ Director created:', `${director.firstName} ${director.lastName}`);
    
    // Create Manager (reports to Director)
    const manager = await EmployeeService.createEmployee({
      firstName: 'Alice',
      lastName: 'Manager',
      email: 'manager@testcompany.com',
      title: 'Engineering Manager',
      department: 'Engineering',
      managerId: director.id,
    }, context);
    console.log('✅ Manager created:', `${manager.firstName} ${manager.lastName}`);
    
    // Create Engineers (report to Manager)
    const engineer1 = await EmployeeService.createEmployee({
      firstName: 'Charlie',
      lastName: 'Engineer',
      email: 'charlie@testcompany.com',
      title: 'Senior Software Engineer',
      department: 'Engineering',
      managerId: manager.id,
    }, context);
    
    const engineer2 = await EmployeeService.createEmployee({
      firstName: 'Diana',
      lastName: 'Engineer',
      email: 'diana@testcompany.com',
      title: 'Software Engineer',
      department: 'Engineering',
      managerId: manager.id,
    }, context);
    
    console.log('✅ Engineers created:', `${engineer1.firstName} & ${engineer2.firstName}`);
    
    // Test 2: Validate manager relationships
    console.log('\n🧪 Test 2: Validate manager relationships');
    
    const vpWithManager = await EmployeeService.getEmployeeById(vp.id, context);
    console.log('✅ VP manager validation:', {
      vpName: `${vpWithManager.firstName} ${vpWithManager.lastName}`,
      managerName: vpWithManager.manager ? 
        `${vpWithManager.manager.firstName} ${vpWithManager.manager.lastName}` : 
        'None',
      directReportsCount: vpWithManager.directReports.length,
    });
    
    // Test 3: Get direct reports
    console.log('\n🧪 Test 3: Get direct reports');
    
    const managerReports = await EmployeeService.getDirectReports(manager.id, context);
    console.log('✅ Manager direct reports:', {
      managerName: `${manager.firstName} ${manager.lastName}`,
      reportsCount: managerReports.length,
      reports: managerReports.map(r => `${r.firstName} ${r.lastName}`),
    });
    
    // Test 4: Get organizational hierarchy
    console.log('\n🧪 Test 4: Get organizational hierarchy');
    
    const engineerHierarchy = await EmployeeService.getEmployeeHierarchy(engineer1.id, context);
    console.log('✅ Engineer hierarchy:', {
      employee: `${engineerHierarchy.employee.firstName} ${engineerHierarchy.employee.lastName}`,
      managementChain: engineerHierarchy.managementChain.map(m => `${m.firstName} ${m.lastName}`),
      directReports: engineerHierarchy.directReports.map(r => `${r.firstName} ${r.lastName}`),
    });
    
    // Test 5: Prevent circular relationships
    console.log('\n🧪 Test 5: Prevent circular relationships');
    
    try {
      // Try to make CEO report to VP (should fail)
      await EmployeeService.updateEmployee(ceo.id, { managerId: vp.id }, context);
      console.log('❌ Circular relationship prevention failed');
    } catch (error) {
      console.log('✅ Circular relationship prevented:', (error as Error).message);
    }
    
    try {
      // Try to make manager report to engineer (should fail)
      await EmployeeService.updateEmployee(manager.id, { managerId: engineer1.id }, context);
      console.log('❌ Circular relationship prevention failed');
    } catch (error) {
      console.log('✅ Circular relationship prevented:', (error as Error).message);
    }
    
    // Test 6: Self-management prevention
    console.log('\n🧪 Test 6: Self-management prevention');
    
    try {
      // Try to make employee their own manager (should fail)
      await EmployeeService.updateEmployee(engineer1.id, { managerId: engineer1.id }, context);
      console.log('❌ Self-management prevention failed');
    } catch (error) {
      console.log('✅ Self-management prevented:', (error as Error).message);
    }
    
    // Test 7: Manager validation (non-existent manager)
    console.log('\n🧪 Test 7: Manager validation');
    
    try {
      // Try to assign non-existent manager
      await EmployeeService.updateEmployee(engineer1.id, { 
        managerId: '123e4567-e89b-12d3-a456-426614174000' 
      }, context);
      console.log('❌ Invalid manager validation failed');
    } catch (error) {
      console.log('✅ Invalid manager rejected:', (error as Error).message);
    }
    
    // Test 8: Manager change and hierarchy update
    console.log('\n🧪 Test 8: Manager change and hierarchy update');
    
    // Move engineer2 to report directly to director
    const updatedEngineer2 = await EmployeeService.updateEmployee(
      engineer2.id, 
      { managerId: director.id }, 
      context
    );
    
    console.log('✅ Engineer2 manager changed:', {
      employee: `${updatedEngineer2.firstName} ${updatedEngineer2.lastName}`,
      newManager: updatedEngineer2.manager ? 
        `${updatedEngineer2.manager.firstName} ${updatedEngineer2.manager.lastName}` : 
        'None',
    });
    
    // Verify manager's direct reports updated
    const updatedManagerReports = await EmployeeService.getDirectReports(manager.id, context);
    console.log('✅ Manager reports after change:', {
      reportsCount: updatedManagerReports.length,
      reports: updatedManagerReports.map(r => `${r.firstName} ${r.lastName}`),
    });
    
    // Test 9: Management chain traversal
    console.log('\n🧪 Test 9: Management chain traversal');
    
    const managementChain = await EmployeeRepository.getManagementChain(testTenant.id, engineer1.id);
    console.log('✅ Management chain:', {
      employee: `${engineer1.firstName} ${engineer1.lastName}`,
      chain: managementChain.map(m => `${m.firstName} ${m.lastName} (${m.title})`),
      chainLength: managementChain.length,
    });
    
    // Test 10: Organizational statistics
    console.log('\n🧪 Test 10: Organizational statistics');
    
    const stats = await EmployeeService.getEmployeeStatistics(context);
    console.log('✅ Organizational statistics:', {
      totalEmployees: stats.totalEmployees,
      activeEmployees: stats.activeEmployees,
      departmentDistribution: stats.departmentDistribution,
    });
    
    // Test 11: Manager deactivation impact
    console.log('\n🧪 Test 11: Manager deactivation impact');
    
    // Check what happens when a manager is deactivated
    const managerBeforeDeactivation = await EmployeeService.getDirectReports(manager.id, context);
    console.log('Manager reports before deactivation:', managerBeforeDeactivation.length);
    
    // Deactivate the manager
    await EmployeeService.deactivateEmployee(manager.id, context);
    console.log('✅ Manager deactivated');
    
    // Check if direct reports still exist but manager relationship is maintained
    const engineer1AfterManagerDeactivation = await EmployeeService.getEmployeeById(engineer1.id, context);
    console.log('✅ Engineer after manager deactivation:', {
      employee: `${engineer1AfterManagerDeactivation.firstName} ${engineer1AfterManagerDeactivation.lastName}`,
      managerId: engineer1AfterManagerDeactivation.managerId,
      managerActive: engineer1AfterManagerDeactivation.manager ? 'Active' : 'Inactive/None',
    });
    
    // Test 12: Complex hierarchy validation
    console.log('\n🧪 Test 12: Complex hierarchy validation');
    
    // Test would-create-circular-relationship function directly
    const wouldCreateCircle1 = await EmployeeRepository.wouldCreateCircularRelationship(
      testTenant.id,
      ceo.id,
      director.id
    );
    console.log('✅ Circular check (CEO -> Director):', wouldCreateCircle1);
    
    const wouldCreateCircle2 = await EmployeeRepository.wouldCreateCircularRelationship(
      testTenant.id,
      director.id,
      ceo.id
    );
    console.log('✅ Circular check (Director -> CEO):', wouldCreateCircle2);
    
    // Clean up test data
    console.log('\n🧹 Cleaning up test data...');
    
    await prisma.employee.deleteMany({
      where: { tenantId: testTenant.id },
    });
    
    await prisma.tenant.delete({
      where: { id: testTenant.id },
    });
    
    console.log('✅ Test data cleaned up');
    console.log('🎉 All manager relationship tests completed successfully!');
    
  } catch (error) {
    console.error('❌ Manager relationship test failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
testManagerRelationships();