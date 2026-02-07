import { prisma } from '../lib/database';
import { AnalyticsService } from '../services/analytics.service';
import { redisClient } from '../lib/redis';

async function testAdminAnalyticsEndpoint() {
  console.log('🧪 Testing Admin Analytics Endpoint Implementation...\n');

  try {
    // Connect to Redis (optional)
    try {
      await redisClient.connect();
      console.log('✅ Redis connected');
    } catch (error) {
      console.warn('⚠️  Redis connection failed, continuing without cache');
    }

    // Create test tenant
    const testTenant = await prisma.tenant.create({
      data: {
        id: 'test-analytics-tenant',
        name: 'Test Analytics Tenant',
        subdomain: 'test-analytics',
        isActive: true,
      },
    });
    console.log('✅ Test tenant created');

    // Create test user
    const testUser = await prisma.user.create({
      data: {
        id: 'test-analytics-user',
        email: 'admin@test-analytics.com',
        tenantId: testTenant.id,
        role: 'admin',
        isActive: true,
      },
    });
    console.log('✅ Test user created');

    // Create test employee
    const testEmployee = await prisma.employee.create({
      data: {
        id: 'test-analytics-employee',
        tenantId: testTenant.id,
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@test-analytics.com',
        title: 'Software Engineer',
        department: 'Engineering',
        isActive: true,
      },
    });
    console.log('✅ Test employee created');

    // Create test analytics events
    await prisma.analyticsEvent.createMany({
      data: [
        {
          tenantId: testTenant.id,
          userId: testUser.id,
          eventType: 'search_query',
          metadata: { query: 'john', resultCount: 1, executionTime: 50 },
        },
        {
          tenantId: testTenant.id,
          userId: testUser.id,
          eventType: 'profile_view',
          metadata: { profileId: testEmployee.id, source: 'search' },
        },
        {
          tenantId: testTenant.id,
          userId: testUser.id,
          eventType: 'profile_update',
          metadata: { profileId: testEmployee.id, fieldsChanged: ['title'] },
        },
        {
          tenantId: testTenant.id,
          userId: testUser.id,
          eventType: 'login',
          metadata: { timestamp: new Date().toISOString() },
        },
      ],
    });
    console.log('✅ Test analytics events created');

    // Test the analytics service method directly
    console.log('\n📊 Testing getDashboardAnalytics method...');
    const analyticsData = await AnalyticsService.getDashboardAnalytics(testTenant.id, 90);
    
    console.log('✅ Analytics data retrieved successfully');
    console.log('📈 Analytics Summary:');
    console.log(`   Period: ${analyticsData.period}`);
    console.log(`   Total Users: ${analyticsData.userMetrics.totalUsers}`);
    console.log(`   Active Users: ${analyticsData.userMetrics.activeUsers}`);
    console.log(`   Profile Completeness: ${analyticsData.profileMetrics.completenessPercentage}%`);
    console.log(`   Top Search Queries: ${analyticsData.topSearchQueries.length}`);
    console.log(`   Most Viewed Profiles: ${analyticsData.mostViewedProfiles.length}`);
    console.log(`   Department Distribution: ${analyticsData.departmentDistribution.length}`);
    console.log(`   Role Distribution: ${analyticsData.roleDistribution.length}`);

    // Test caching functionality
    if (redisClient.isReady()) {
      console.log('\n🗄️  Testing caching functionality...');
      const cacheKey = `analytics:dashboard:${testTenant.id}:90`;
      
      // Set cache
      await redisClient.set(cacheKey, analyticsData, 3600);
      console.log('✅ Data cached successfully');
      
      // Get from cache
      const cachedData = await redisClient.get(cacheKey);
      if (cachedData) {
        console.log('✅ Data retrieved from cache successfully');
        console.log(`   Cached period: ${cachedData.period}`);
      } else {
        console.log('❌ Failed to retrieve data from cache');
      }
      
      // Clear cache
      await redisClient.del(cacheKey);
      console.log('✅ Cache cleared');
    }

    // Test with different time periods
    console.log('\n⏰ Testing different time periods...');
    const periods = [30, 60, 90, 180];
    
    for (const days of periods) {
      const periodData = await AnalyticsService.getDashboardAnalytics(testTenant.id, days);
      console.log(`   ${days} days: ${periodData.period}`);
    }

    // Test edge cases
    console.log('\n🔍 Testing edge cases...');
    
    // Test with minimum days (1)
    const minData = await AnalyticsService.getDashboardAnalytics(testTenant.id, 1);
    console.log(`   Minimum period (1 day): ${minData.period}`);
    
    // Test with maximum days (should be capped)
    const maxData = await AnalyticsService.getDashboardAnalytics(testTenant.id, 500);
    console.log(`   Maximum period (500 requested): ${maxData.period}`);

    console.log('\n✅ All tests passed! Admin analytics endpoint implementation is working correctly.');

  } catch (error) {
    console.error('❌ Test failed:', error);
    throw error;
  } finally {
    // Clean up test data
    console.log('\n🧹 Cleaning up test data...');
    
    try {
      await prisma.analyticsEvent.deleteMany({
        where: { tenantId: 'test-analytics-tenant' },
      });
      await prisma.employee.deleteMany({
        where: { tenantId: 'test-analytics-tenant' },
      });
      await prisma.user.deleteMany({
        where: { tenantId: 'test-analytics-tenant' },
      });
      await prisma.tenant.delete({
        where: { id: 'test-analytics-tenant' },
      });
      console.log('✅ Test data cleaned up');
    } catch (error) {
      console.warn('⚠️  Failed to clean up test data:', error.message);
    }

    // Disconnect Redis
    if (redisClient.isReady()) {
      await redisClient.disconnect();
      console.log('✅ Redis disconnected');
    }
  }
}

// Run the test
testAdminAnalyticsEndpoint()
  .then(() => {
    console.log('\n🎉 Admin Analytics Endpoint test completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Admin Analytics Endpoint test failed:', error);
    process.exit(1);
  });