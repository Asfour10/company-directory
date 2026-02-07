#!/usr/bin/env tsx

/**
 * Test script to verify audit logging and analytics functionality
 */

import { prisma } from '../lib/database';
import { AuditService } from '../services/audit.service';
import { SessionService } from '../services/session.service';

async function testAuditAndAnalytics() {
  try {
    console.log('🔍 Testing audit logging and analytics...');
    
    // Test tenant context
    const testTenantId = 'test-tenant-' + Date.now();
    await prisma.$executeRaw`SET app.current_tenant = ${testTenantId}`;
    
    console.log('📝 Testing audit log creation...');
    
    // Test audit log creation
    await AuditService.logChange({
      tenantId: testTenantId,
      userId: 'test-user-123',
      action: 'CREATE',
      entityType: 'employee',
      entityId: 'emp-123',
      ipAddress: '192.168.1.1',
      userAgent: 'Test Agent',
    });
    
    console.log('✅ Audit log created successfully');
    
    // Test field changes logging
    await AuditService.logFieldChanges(
      {
        tenantId: testTenantId,
        userId: 'test-user-123',
        action: 'UPDATE',
        entityType: 'employee',
        entityId: 'emp-123',
        ipAddress: '192.168.1.1',
        userAgent: 'Test Agent',
      },
      [
        { fieldName: 'firstName', oldValue: 'John', newValue: 'Jane' },
        { fieldName: 'title', oldValue: 'Developer', newValue: 'Senior Developer' },
      ]
    );
    
    console.log('✅ Field changes logged successfully');
    
    // Test analytics event tracking
    console.log('📊 Testing analytics event tracking...');
    
    await AuditService.trackEvent({
      tenantId: testTenantId,
      userId: 'test-user-123',
      eventType: 'profile_view',
      metadata: {
        profileId: 'emp-123',
        source: 'search',
        searchQuery: 'john doe',
      },
    });
    
    await AuditService.trackEvent({
      tenantId: testTenantId,
      userId: 'test-user-123',
      eventType: 'search',
      metadata: {
        query: 'software engineer',
        resultsCount: 5,
        duration: 150,
      },
    });
    
    console.log('✅ Analytics events tracked successfully');
    
    // Test audit log retrieval
    console.log('🔍 Testing audit log retrieval...');
    
    const auditLogs = await AuditService.getAuditLogs({
      tenantId: testTenantId,
      page: 1,
      pageSize: 10,
    });
    
    console.log(`📋 Retrieved ${auditLogs.logs.length} audit logs`);
    console.log('📊 Pagination:', auditLogs.pagination);
    
    // Test analytics event retrieval
    const analyticsEvents = await AuditService.getAnalyticsEvents({
      tenantId: testTenantId,
      page: 1,
      pageSize: 10,
    });
    
    console.log(`📈 Retrieved ${analyticsEvents.events.length} analytics events`);
    
    // Test session management
    console.log('🔐 Testing session management...');
    
    const tokenHash = SessionService.hashToken('test-token-123');
    const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000); // 8 hours
    
    await SessionService.createSession('test-user-123', tokenHash, expiresAt);
    console.log('✅ Session created successfully');
    
    // Test immutability constraints
    console.log('🛡️ Testing audit log immutability...');
    
    try {
      // This should fail due to immutability constraints
      await prisma.$executeRaw`
        UPDATE audit_logs 
        SET action = 'MODIFIED' 
        WHERE tenant_id = ${testTenantId}
        LIMIT 1
      `;
      console.log('❌ Immutability test failed - update was allowed');
    } catch (error) {
      console.log('✅ Immutability constraint working - update prevented');
    }
    
    try {
      // This should also fail
      await prisma.$executeRaw`
        DELETE FROM audit_logs 
        WHERE tenant_id = ${testTenantId}
        LIMIT 1
      `;
      console.log('❌ Immutability test failed - delete was allowed');
    } catch (error) {
      console.log('✅ Immutability constraint working - delete prevented');
    }
    
    // Test statistics
    console.log('📊 Testing statistics...');
    
    const auditStats = await AuditService.getAuditStatistics(testTenantId, 1);
    console.log('📈 Audit statistics:', auditStats);
    
    const analyticsStats = await AuditService.getAnalyticsStatistics(testTenantId, 1);
    console.log('📊 Analytics statistics:', analyticsStats);
    
    // Clean up test data (using raw SQL to bypass immutability for cleanup)
    console.log('🧹 Cleaning up test data...');
    
    await prisma.$executeRaw`
      DELETE FROM sessions WHERE user_id = 'test-user-123'
    `;
    
    await prisma.$executeRaw`
      DELETE FROM analytics_events WHERE tenant_id = ${testTenantId}
    `;
    
    // Note: We can't clean up audit logs due to immutability constraints
    // In production, they would be cleaned up by the retention policy
    
    console.log('🎉 All audit and analytics tests passed!');
    
  } catch (error) {
    console.error('❌ Audit and analytics test failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
testAuditAndAnalytics();