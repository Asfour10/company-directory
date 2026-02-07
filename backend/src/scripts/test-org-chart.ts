import { prisma } from '../lib/database';
import { OrgChartService } from '../services/org-chart.service';

async function testOrgChart() {
  try {
    console.log('🧪 Testing Organizational Chart Service...\n');

    // Get a test tenant
    const tenant = await prisma.tenant.findFirst();
    if (!tenant) {
      console.log('❌ No tenant found. Please run database setup first.');
      return;
    }

    console.log(`📊 Testing with tenant: ${tenant.name} (${tenant.id})\n`);

    const context = {
      tenantId: tenant.id,
      userId: undefined, // Testing without user context
      userRole: 'user',
    };

    // Test 1: Get complete organizational chart
    console.log('1️⃣ Testing complete organizational chart...');
    const startTime1 = Date.now();
    const orgChart = await OrgChartService.getOrganizationalChart(context);
    const duration1 = Date.now() - startTime1;
    
    console.log(`   ✅ Retrieved organizational chart in ${duration1}ms`);
    console.log(`   📈 Root nodes: ${orgChart.length}`);
    console.log(`   👥 Total employees: ${countTotalNodes(orgChart)}`);
    
    if (orgChart.length > 0) {
      console.log(`   🏢 Sample root employee: ${orgChart[0].firstName} ${orgChart[0].lastName} (${orgChart[0].title || 'No title'})`);
      if (orgChart[0].children.length > 0) {
        console.log(`   👨‍💼 Has ${orgChart[0].children.length} direct reports`);
      }
    }
    console.log();

    // Test 2: Get organizational statistics
    console.log('2️⃣ Testing organizational statistics...');
    const startTime2 = Date.now();
    const stats = await OrgChartService.getOrganizationalStats(context);
    const duration2 = Date.now() - startTime2;
    
    console.log(`   ✅ Retrieved statistics in ${duration2}ms`);
    console.log(`   👥 Total employees: ${stats.totalEmployees}`);
    console.log(`   👨‍💼 Managers: ${stats.managersCount}`);
    console.log(`   🔝 Top-level employees: ${stats.topLevelEmployees}`);
    console.log(`   📊 Max hierarchy depth: ${stats.maxHierarchyDepth}`);
    console.log(`   📈 Average span of control: ${stats.averageSpanOfControl}`);
    console.log(`   🏢 Departments: ${stats.departmentDistribution.length}`);
    console.log();

    // Test 3: Test with specific employee if available
    if (orgChart.length > 0) {
      const testEmployee = findFirstEmployeeWithReports(orgChart);
      if (testEmployee) {
        console.log('3️⃣ Testing employee-specific queries...');
        console.log(`   🎯 Testing with: ${testEmployee.firstName} ${testEmployee.lastName}`);

        // Test management chain
        const startTime3a = Date.now();
        const managementChain = await OrgChartService.getManagementChain(testEmployee.id, context);
        const duration3a = Date.now() - startTime3a;
        console.log(`   ✅ Management chain retrieved in ${duration3a}ms (${managementChain.length} levels)`);

        // Test direct reports
        const startTime3b = Date.now();
        const directReports = await OrgChartService.getDirectReports(testEmployee.id, context);
        const duration3b = Date.now() - startTime3b;
        console.log(`   ✅ Direct reports retrieved in ${duration3b}ms (${directReports.length} reports)`);

        // Test employee-specific org chart
        const startTime3c = Date.now();
        const employeeChart = await OrgChartService.getOrganizationalChartFromEmployee(testEmployee.id, context);
        const duration3c = Date.now() - startTime3c;
        console.log(`   ✅ Employee org chart retrieved in ${duration3c}ms`);
        console.log(`   📊 Employee level: ${employeeChart.level}, Children: ${countTotalNodes([employeeChart]) - 1}`);
        console.log();
      }
    }

    // Test 4: Validate organizational structure
    console.log('4️⃣ Testing organizational structure validation...');
    const startTime4 = Date.now();
    const validation = await OrgChartService.validateOrganizationalStructure(context);
    const duration4 = Date.now() - startTime4;
    
    console.log(`   ✅ Validation completed in ${duration4}ms`);
    console.log(`   🔍 Structure is ${validation.isValid ? 'valid' : 'invalid'}`);
    if (!validation.isValid) {
      console.log(`   ⚠️  Issues found: ${validation.issues.length}`);
      validation.issues.forEach((issue, index) => {
        console.log(`      ${index + 1}. ${issue}`);
      });
    }
    console.log();

    // Performance summary
    console.log('📊 Performance Summary:');
    console.log(`   🏢 Complete org chart: ${duration1}ms`);
    console.log(`   📈 Statistics: ${duration2}ms`);
    console.log(`   🔍 Validation: ${duration4}ms`);
    
    const totalTime = duration1 + duration2 + duration4;
    console.log(`   ⏱️  Total time: ${totalTime}ms`);
    
    if (totalTime < 5000) {
      console.log('   ✅ Performance requirement met (< 5 seconds)');
    } else {
      console.log('   ⚠️  Performance requirement not met (>= 5 seconds)');
    }

    console.log('\n🎉 Organizational Chart Service test completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error);
    if (error instanceof Error) {
      console.error('Stack trace:', error.stack);
    }
  } finally {
    await prisma.$disconnect();
  }
}

// Helper functions
function countTotalNodes(nodes: any[]): number {
  let count = nodes.length;
  nodes.forEach(node => {
    if (node.children && node.children.length > 0) {
      count += countTotalNodes(node.children);
    }
  });
  return count;
}

function findFirstEmployeeWithReports(nodes: any[]): any | null {
  for (const node of nodes) {
    if (node.children && node.children.length > 0) {
      return node;
    }
    const found = findFirstEmployeeWithReports(node.children || []);
    if (found) return found;
  }
  return null;
}

// Run the test
if (require.main === module) {
  testOrgChart();
}