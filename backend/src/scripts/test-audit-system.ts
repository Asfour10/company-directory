#!/usr/bin/env tsx

/**
 * Test script to verify audit logging system functionality
 */

import { AuditService } from '../services/audit.service';
import { prisma } from '../lib/database';

async function testAuditSystem() {
  console.log('🔍 Testing Audit Logging System...\n');

  try {
    // Test data
    const testTenantId = '123e4567-e89b-12d3-a456-426614174000';
    const testUserId = '123e4567-e89b-12d3-a456-426614174001';
    const testEntityId = '123e4567-e89b-12d3-a456-426614174002';

    console.log('1. Testing logChange method...');
    
    // Test logging a change
    await AuditService.logChange({
      tenantId: testTenantId,
      userId: testUserId,
      action: 'UPDATE',
      entityType: 'employee',
      entityId: testEntityId,
      fieldName: 'firstName',
      oldValue: 'John',
      newValue: 'Jonathan',
      ipAddress: '192.168.1.1',
      userAgent: 'Test User Agent',
    });

    console.log('✅ Successfully logged audit entry');

    console.log('\n2. Testing logFieldChanges method...');
    
    // Test logging multiple field changes
    await AuditService.logFieldChanges(
      {
        tenantId: testTenantId,
        userId: testUserId,
        action: 'UPDATE',
        entityType: 'employee',
        entityId: testEntityId,
        ipAddress: '192.168.1.1',
        userAgent: 'Test User Agent',
      },
      [
        { fieldName: 'lastName', oldValue: 'Doe', newValue: 'Smith' },
        { fieldName: 'email', oldValue: 'john.doe@example.com', newValue: 'jonathan.smith@example.com' },
      ]
    );

    console.log('✅ Successfully logged multiple field changes');

    console.log('\n3. Testing trackEvent method...');
    
    // Test tracking an analytics event
    await AuditService.trackEvent({
      tenantId: testTenantId,
      userId: testUserId,
      eventType: 'profile_view',
      metadata: {
        profileId: testEntityId,
        viewerRole: 'user',
      },
    });

    console.log('✅ Successfully tracked analytics event');

    console.log('\n4. Testing getAuditLogs method...');
    
    // Test retrieving audit logs
    const auditLogs = await AuditService.getAuditLogs({
      tenantId: testTenantId,
      page: 1,
      pageSize: 10,
    });

    console.log(`✅ Retrieved ${auditLogs.logs.length} audit logs`);
    console.log(`   Total logs: ${auditLogs.pagination.total}`);

    if (auditLogs.logs.length > 0) {
      const firstLog = auditLogs.logs[0];
      console.log(`   Latest log: ${firstLog.action} on ${firstLog.entityType} at ${firstLog.createdAt}`);
    }

    console.log('\n5. Testing exportAuditLogs method...');
    
    // Test CSV export
    const csvContent = await AuditService.exportAuditLogs({
      tenantId: testTenantId,
    });

    const lines = csvContent.split('\n');
    console.log(`✅ Generated CSV with ${lines.length} lines (including header)`);
    console.log(`   Header: ${lines[0]}`);

    console.log('\n6. Testing getAuditStatistics method...');
    
    // Test audit statistics
    const stats = await AuditService.getAuditStatistics(testTenantId, 30);
    console.log(`✅ Retrieved audit statistics: ${stats.length} stat groups`);
    
    stats.forEach(stat => {
      console.log(`   ${stat.action} ${stat.entityType}: ${stat.count} times`);
    });

    console.log('\n7. Testing getAnalyticsEvents method...');
    
    // Test analytics events retrieval
    const analyticsEvents = await AuditService.getAnalyticsEvents({
      tenantId: testTenantId,
      page: 1,
      pageSize: 10,
    });

    console.log(`✅ Retrieved ${analyticsEvents.events.length} analytics events`);
    console.log(`   Total events: ${analyticsEvents.pagination.total}`);

    console.log('\n8. Testing getAnalyticsStatistics method...');
    
    // Test analytics statistics
    const analyticsStats = await AuditService.getAnalyticsStatistics(testTenantId, 30);
    console.log(`✅ Retrieved analytics statistics: ${analyticsStats.length} event types`);
    
    analyticsStats.forEach(stat => {
      console.log(`   ${stat.eventType}: ${stat.count} times`);
    });

    console.log('\n🎉 All audit system tests passed!');

  } catch (error) {
    console.error('❌ Test failed:', error);
    throw error;
  }
}

// Run the test
testAuditSystem()
  .then(() => {
    console.log('\n✅ Audit system test completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Audit system test failed:', error);
    process.exit(1);
  });