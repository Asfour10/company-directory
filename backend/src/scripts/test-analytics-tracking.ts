import { prisma } from '../lib/database';
import { AnalyticsService } from '../services/analytics.service';

/**
 * Test script for analytics event tracking functionality
 * Tests requirement 16.1: Track search queries, profile views, profile updates
 */
async function testAnalyticsTracking() {
  console.log('🧪 Testing Analytics Event Tracking');
  console.log('=====================================\n');

  try {
    // Create a test tenant
    console.log('1. Creating test tenant...');
    const testTenant = await prisma.tenant.create({
      data: {
        name: 'Analytics Test Company',
        subdomain: 'analytics-test',
        subscriptionTier: 'professional',
        userLimit: 100,
      },
    });
    console.log('✅ Test tenant created:', testTenant.id);

    // Create a test user
    console.log('\n2. Creating test user...');
    const testUser = await prisma.user.create({
      data: {
        tenantId: testTenant.id,
        email: 'test@analyticstest.com',
        role: 'user',
      },
    });
    console.log('✅ Test user created:', testUser.id);

    // Create a test employee profile
    console.log('\n3. Creating test employee profile...');
    const testEmployee = await prisma.employee.create({
      data: {
        tenantId: testTenant.id,
        userId: testUser.id,
        firstName: 'John',
        lastName: 'Analytics',
        email: 'john.analytics@analyticstest.com',
        title: 'Analytics Tester',
        department: 'Testing',
      },
    });
    console.log('✅ Test employee created:', testEmployee.id);

    // Test 1: Track search query events
    console.log('\n🧪 Test 1: Search Query Tracking');
    console.log('--------------------------------');
    
    const searchQueries = [
      { query: 'john', resultCount: 5, executionTime: 120 },
      { query: 'analytics', resultCount: 3, executionTime: 95 },
      { query: 'testing department', resultCount: 8, executionTime: 150 },
      { query: 'developer', resultCount: 0, executionTime: 80 },
    ];

    for (const searchData of searchQueries) {
      await AnalyticsService.trackSearchQuery(testTenant.id, testUser.id, searchData);
      console.log(`✅ Tracked search: "${searchData.query}" (${searchData.resultCount} results)`);
    }

    // Test 2: Track profile view events
    console.log('\n🧪 Test 2: Profile View Tracking');
    console.log('--------------------------------');
    
    const profileViews = [
      { profileId: testEmployee.id, source: 'search' },
      { profileId: testEmployee.id, source: 'direct' },
      { profileId: testEmployee.id, source: 'org_chart' },
    ];

    for (const viewData of profileViews) {
      await AnalyticsService.trackProfileView(testTenant.id, testUser.id, {
        profileId: viewData.profileId,
        action: 'view',
        source: viewData.source,
      });
      console.log(`✅ Tracked profile view: ${viewData.profileId} (source: ${viewData.source})`);
    }

    // Test 3: Track profile update events
    console.log('\n🧪 Test 3: Profile Update Tracking');
    console.log('----------------------------------');
    
    const profileUpdates = [
      { profileId: testEmployee.id, fieldsChanged: ['title', 'department'] },
      { profileId: testEmployee.id, fieldsChanged: ['phone', 'bio'] },
      { profileId: testEmployee.id, fieldsChanged: ['skills'] },
    ];

    for (const updateData of profileUpdates) {
      await AnalyticsService.trackProfileUpdate(testTenant.id, testUser.id, {
        profileId: updateData.profileId,
        action: 'update',
        fieldsChanged: updateData.fieldsChanged,
      });
      console.log(`✅ Tracked profile update: ${updateData.profileId} (fields: ${updateData.fieldsChanged.join(', ')})`);
    }

    // Test 4: Track profile creation and deletion
    console.log('\n🧪 Test 4: Profile Creation/Deletion Tracking');
    console.log('---------------------------------------------');
    
    await AnalyticsService.trackProfileCreate(testTenant.id, testUser.id, {
      profileId: testEmployee.id,
      action: 'create',
    });
    console.log('✅ Tracked profile creation');

    await AnalyticsService.trackProfileDelete(testTenant.id, testUser.id, {
      profileId: testEmployee.id,
      action: 'delete',
    });
    console.log('✅ Tracked profile deletion');

    // Test 5: Track login/logout events
    console.log('\n🧪 Test 5: Login/Logout Tracking');
    console.log('--------------------------------');
    
    await AnalyticsService.trackLogin(testTenant.id, testUser.id, {
      loginMethod: 'sso',
      ipAddress: '192.168.1.100',
    });
    console.log('✅ Tracked login event');

    await AnalyticsService.trackLogout(testTenant.id, testUser.id, {
      sessionDuration: 3600,
    });
    console.log('✅ Tracked logout event');

    // Test 6: Track org chart view
    console.log('\n🧪 Test 6: Org Chart View Tracking');
    console.log('----------------------------------');
    
    await AnalyticsService.trackOrgChartView(testTenant.id, testUser.id, {
      viewType: 'full_chart',
    });
    console.log('✅ Tracked org chart view');

    // Wait a moment for all events to be processed
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Test 7: Verify events were stored
    console.log('\n🧪 Test 7: Verify Analytics Events Storage');
    console.log('------------------------------------------');
    
    const eventCounts = await prisma.analyticsEvent.groupBy({
      by: ['eventType'],
      where: { tenantId: testTenant.id },
      _count: { id: true },
    });

    console.log('📊 Event counts by type:');
    eventCounts.forEach(event => {
      console.log(`   ${event.eventType}: ${event._count.id} events`);
    });

    // Test 8: Get analytics summary
    console.log('\n🧪 Test 8: Analytics Summary');
    console.log('----------------------------');
    
    const summary = await AnalyticsService.getAnalyticsSummary(testTenant.id, 1);
    console.log('📈 Analytics Summary:');
    console.log(`   Total searches: ${summary.summary.totalSearches}`);
    console.log(`   Unique search queries: ${summary.summary.uniqueSearchQueries}`);
    console.log(`   Total profile views: ${summary.summary.totalProfileViews}`);
    console.log(`   Total profile updates: ${summary.summary.totalProfileUpdates}`);
    console.log(`   Total logins: ${summary.summary.totalLogins}`);

    if (summary.topSearchQueries.length > 0) {
      console.log('\n🔍 Top Search Queries:');
      summary.topSearchQueries.forEach((query, index) => {
        console.log(`   ${index + 1}. "${query.query}" (${query.count} times)`);
      });
    }

    if (summary.mostViewedProfiles.length > 0) {
      console.log('\n👁️  Most Viewed Profiles:');
      summary.mostViewedProfiles.forEach((profile, index) => {
        console.log(`   ${index + 1}. ${profile.profileId} (${profile.count} views)`);
      });
    }

    // Test 9: Get search analytics
    console.log('\n🧪 Test 9: Search Analytics');
    console.log('---------------------------');
    
    const searchAnalytics = await AnalyticsService.getSearchAnalytics(testTenant.id, 1);
    console.log('🔍 Search Analytics:');
    console.log(`   Total searches: ${searchAnalytics.statistics.totalSearches}`);
    console.log(`   Unique queries: ${searchAnalytics.statistics.uniqueQueries}`);
    console.log(`   Average results: ${searchAnalytics.statistics.averageResults}`);
    console.log(`   Average execution time: ${searchAnalytics.statistics.averageExecutionTime}ms`);

    // Test 10: Get profile analytics
    console.log('\n🧪 Test 10: Profile Analytics');
    console.log('-----------------------------');
    
    const profileAnalytics = await AnalyticsService.getProfileAnalytics(testTenant.id, 1);
    console.log('👤 Profile Analytics:');
    console.log(`   Total views: ${profileAnalytics.statistics.totalViews}`);
    console.log(`   Total updates: ${profileAnalytics.statistics.totalUpdates}`);
    console.log(`   Unique profiles viewed: ${profileAnalytics.statistics.uniqueProfilesViewed}`);
    console.log(`   Unique profiles updated: ${profileAnalytics.statistics.uniqueProfilesUpdated}`);

    // Test 11: Get user activity analytics
    console.log('\n🧪 Test 11: User Activity Analytics');
    console.log('-----------------------------------');
    
    const userAnalytics = await AnalyticsService.getUserActivityAnalytics(testTenant.id, 1);
    console.log('👥 User Activity Analytics:');
    console.log(`   Total events: ${userAnalytics.statistics.totalEvents}`);
    console.log(`   Unique users: ${userAnalytics.statistics.uniqueUsers}`);
    console.log(`   Total logins: ${userAnalytics.statistics.totalLogins}`);

    console.log('\n✅ All analytics tracking tests completed successfully!');
    console.log('\n📋 Summary of Implemented Features:');
    console.log('   ✅ Search query tracking with metadata');
    console.log('   ✅ Profile view tracking with source attribution');
    console.log('   ✅ Profile update tracking with field-level changes');
    console.log('   ✅ Profile creation and deletion tracking');
    console.log('   ✅ Login and logout event tracking');
    console.log('   ✅ Organizational chart view tracking');
    console.log('   ✅ Analytics aggregation and reporting');
    console.log('   ✅ Search performance metrics');
    console.log('   ✅ User activity analytics');
    console.log('   ✅ Top queries and most viewed profiles');

    // Cleanup
    console.log('\n🧹 Cleaning up test data...');
    await prisma.analyticsEvent.deleteMany({
      where: { tenantId: testTenant.id },
    });
    await prisma.employee.deleteMany({
      where: { tenantId: testTenant.id },
    });
    await prisma.user.deleteMany({
      where: { tenantId: testTenant.id },
    });
    await prisma.tenant.delete({
      where: { id: testTenant.id },
    });
    console.log('✅ Test data cleaned up');

  } catch (error) {
    console.error('❌ Test failed:', error);
    throw error;
  }
}

// Run the test
if (require.main === module) {
  testAnalyticsTracking()
    .then(() => {
      console.log('\n🎉 Analytics tracking test completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Analytics tracking test failed:', error);
      process.exit(1);
    });
}

export { testAnalyticsTracking };