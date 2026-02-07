#!/usr/bin/env tsx

/**
 * Test script for analytics aggregation service
 * Tests the new dashboard analytics functionality
 */

import { AnalyticsService } from '../services/analytics.service';
import { prisma } from '../lib/database';

async function testAnalyticsAggregation() {
  console.log('🧪 Testing Analytics Aggregation Service...\n');

  try {
    // Test tenant ID (you may need to adjust this)
    const testTenantId = 'test-tenant-id';

    console.log('1. Testing getDashboardAnalytics...');
    try {
      const dashboardData = await AnalyticsService.getDashboardAnalytics(testTenantId, 30);
      console.log('✅ Dashboard analytics retrieved successfully');
      console.log(`   - Total Users: ${dashboardData.userMetrics.totalUsers}`);
      console.log(`   - Active Users: ${dashboardData.userMetrics.activeUsers}`);
      console.log(`   - Profile Completeness: ${dashboardData.profileMetrics.completenessPercentage}%`);
      console.log(`   - Top Search Queries: ${dashboardData.topSearchQueries.length}`);
      console.log(`   - Most Viewed Profiles: ${dashboardData.mostViewedProfiles.length}`);
      console.log(`   - Department Distribution: ${dashboardData.departmentDistribution.length} departments`);
      console.log(`   - Role Distribution: ${dashboardData.roleDistribution.length} roles`);
    } catch (error) {
      console.log('❌ Dashboard analytics failed:', error.message);
    }

    console.log('\n2. Testing getDetailedAnalytics...');
    try {
      const detailedData = await AnalyticsService.getDetailedAnalytics(testTenantId, 90);
      console.log('✅ Detailed analytics retrieved successfully');
      console.log(`   - Generated at: ${detailedData.generatedAt}`);
      console.log(`   - Dashboard data included: ${!!detailedData.dashboard}`);
      console.log(`   - Search data included: ${!!detailedData.search}`);
      console.log(`   - Profile data included: ${!!detailedData.profiles}`);
      console.log(`   - User data included: ${!!detailedData.users}`);
    } catch (error) {
      console.log('❌ Detailed analytics failed:', error.message);
    }

    console.log('\n3. Testing profile completeness calculation...');
    try {
      // Access private method for testing
      const completeness = await (AnalyticsService as any).calculateProfileCompleteness(testTenantId);
      console.log('✅ Profile completeness calculated successfully');
      console.log(`   - Total Profiles: ${completeness.totalProfiles}`);
      console.log(`   - Complete Profiles: ${completeness.completeProfiles}`);
      console.log(`   - Average Completeness: ${completeness.averageCompleteness}%`);
      console.log(`   - Completeness Percentage: ${completeness.completenessPercentage}%`);
    } catch (error) {
      console.log('❌ Profile completeness calculation failed:', error.message);
    }

    console.log('\n4. Testing analytics event tracking...');
    try {
      // Test search query tracking
      await AnalyticsService.trackSearchQuery(testTenantId, 'test-user-id', {
        query: 'test analytics search',
        resultCount: 5,
        executionTime: 120,
        filters: { department: 'Engineering' },
      });
      console.log('✅ Search query tracking successful');

      // Test profile view tracking
      await AnalyticsService.trackProfileView(testTenantId, 'test-user-id', {
        profileId: 'test-profile-id',
        action: 'view',
        source: 'search',
      });
      console.log('✅ Profile view tracking successful');

      // Test login tracking
      await AnalyticsService.trackLogin(testTenantId, 'test-user-id', {
        loginMethod: 'sso',
        ipAddress: '192.168.1.100',
      });
      console.log('✅ Login tracking successful');
    } catch (error) {
      console.log('❌ Analytics event tracking failed:', error.message);
    }

    console.log('\n5. Testing analytics summary...');
    try {
      const summary = await AnalyticsService.getAnalyticsSummary(testTenantId, 30);
      console.log('✅ Analytics summary retrieved successfully');
      console.log(`   - Period: ${summary.period}`);
      console.log(`   - Total Searches: ${summary.summary.totalSearches}`);
      console.log(`   - Total Profile Views: ${summary.summary.totalProfileViews}`);
      console.log(`   - Total Logins: ${summary.summary.totalLogins}`);
    } catch (error) {
      console.log('❌ Analytics summary failed:', error.message);
    }

    console.log('\n✅ Analytics aggregation service testing completed!');

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
testAnalyticsAggregation().catch(console.error);