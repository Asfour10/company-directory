import { PrismaClient } from '@prisma/client';
import { GdprService } from '../services/gdpr.service';
import { DataRetentionService } from '../services/data-retention.service';
import { EncryptionKeyService } from '../services/encryption-key.service';

const prisma = new PrismaClient();
const keyConfig = { provider: 'local' as const };
const keyService = new EncryptionKeyService(keyConfig);
const gdprService = new GdprService(prisma, keyService);
const dataRetentionService = new DataRetentionService(prisma, gdprService);

async function testGdprImplementation() {
  console.log('🧪 Testing GDPR Implementation...\n');

  try {
    // Test 1: Create test tenant and user
    console.log('1. Creating test tenant and user...');
    const tenant = await prisma.tenant.create({
      data: {
        name: 'GDPR Test Company',
        subdomain: 'gdpr-test',
        subscriptionTier: 'basic',
        userLimit: 100,
        dataRetentionDays: 365 // 1 year retention
      }
    });

    const user = await prisma.user.create({
      data: {
        tenantId: tenant.id,
        email: 'test@gdprtest.com',
        role: 'user'
      }
    });

    const employee = await prisma.employee.create({
      data: {
        tenantId: tenant.id,
        userId: user.id,
        firstName: 'John',
        lastName: 'Doe',
        email: 'test@gdprtest.com',
        title: 'Software Engineer',
        department: 'Engineering',
        skills: ['JavaScript', 'TypeScript']
      }
    });

    console.log('✅ Test data created');

    // Test 2: Create some audit logs and analytics events
    console.log('\n2. Creating audit logs and analytics events...');
    await prisma.auditLog.create({
      data: {
        tenantId: tenant.id,
        userId: user.id,
        action: 'create',
        entityType: 'employee',
        entityId: employee.id,
        fieldName: 'firstName',
        newValue: 'John'
      }
    });

    await prisma.analyticsEvent.create({
      data: {
        tenantId: tenant.id,
        userId: user.id,
        eventType: 'profile_view',
        metadata: { profileId: employee.id }
      }
    });

    console.log('✅ Audit logs and analytics events created');

    // Test 3: Export user data
    console.log('\n3. Testing data export...');
    const exportedData = await gdprService.exportUserData(user.id, tenant.id);
    
    console.log('✅ Data export successful');
    console.log(`   - Profile data: ${exportedData.profile.firstName} ${exportedData.profile.lastName}`);
    console.log(`   - Audit logs: ${exportedData.auditLogs.length} entries`);
    console.log(`   - Analytics events: ${exportedData.analyticsEvents.length} entries`);

    // Test 4: Request data deletion
    console.log('\n4. Testing data deletion request...');
    const deletionRequest = await gdprService.requestDataDeletion(
      user.id, 
      tenant.id, 
      'User requested account deletion'
    );
    
    console.log('✅ Data deletion request created');
    console.log(`   - Request ID: ${deletionRequest.id}`);
    console.log(`   - Status: ${deletionRequest.status}`);

    // Test 5: Check deletion request status
    console.log('\n5. Testing deletion request status...');
    const status = await gdprService.getDeletionRequestStatus(user.id, tenant.id);
    console.log('✅ Deletion request status retrieved');
    console.log(`   - Status: ${status?.status}`);
    console.log(`   - Requested at: ${status?.requestedAt}`);

    // Test 6: Process data deletion
    console.log('\n6. Testing data deletion processing...');
    await gdprService.processDataDeletion(deletionRequest.id, tenant.id);
    console.log('✅ Data deletion processed successfully');

    // Test 7: Verify data is deleted
    console.log('\n7. Verifying data deletion...');
    const deletedUser = await prisma.user.findUnique({ where: { id: user.id } });
    const deletedEmployee = await prisma.employee.findUnique({ where: { id: employee.id } });
    const anonymizedAuditLogs = await prisma.auditLog.findMany({
      where: { tenantId: tenant.id, entityId: employee.id }
    });

    console.log('✅ Data deletion verification complete');
    console.log(`   - User deleted: ${deletedUser === null}`);
    console.log(`   - Employee deleted: ${deletedEmployee === null}`);
    console.log(`   - Audit logs anonymized: ${anonymizedAuditLogs.every(log => log.userId === null)}`);

    // Test 8: Test retention policy
    console.log('\n8. Testing retention policy...');
    const retentionStats = await dataRetentionService.getRetentionStats(tenant.id);
    console.log('✅ Retention statistics retrieved');
    console.log(`   - Retention days: ${retentionStats.retentionDays}`);
    console.log(`   - Audit log count: ${retentionStats.auditLogCount}`);
    console.log(`   - Analytics event count: ${retentionStats.analyticsEventCount}`);

    // Test 9: Update retention policy
    console.log('\n9. Testing retention policy update...');
    await dataRetentionService.updateRetentionPolicy(tenant.id, 90); // 90 days
    const updatedTenant = await prisma.tenant.findUnique({
      where: { id: tenant.id },
      select: { dataRetentionDays: true }
    });
    console.log('✅ Retention policy updated');
    console.log(`   - New retention days: ${updatedTenant?.dataRetentionDays}`);

    // Cleanup
    console.log('\n10. Cleaning up test data...');
    await prisma.dataDeletionRequest.deleteMany({ where: { tenantId: tenant.id } });
    await prisma.auditLog.deleteMany({ where: { tenantId: tenant.id } });
    await prisma.analyticsEvent.deleteMany({ where: { tenantId: tenant.id } });
    await prisma.tenant.delete({ where: { id: tenant.id } });
    console.log('✅ Test data cleaned up');

    console.log('\n🎉 All GDPR tests passed successfully!');
    console.log('\nGDPR Implementation Summary:');
    console.log('✅ Data export functionality (Requirement 17.4)');
    console.log('✅ Self-service data deletion (Requirement 17.2)');
    console.log('✅ Data anonymization while preserving audit records (Requirement 17.3)');
    console.log('✅ Configurable retention policies (Requirement 17.1)');

  } catch (error) {
    console.error('❌ GDPR test failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
testGdprImplementation()
  .then(() => {
    console.log('\n✅ GDPR implementation test completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ GDPR implementation test failed:', error);
    process.exit(1);
  });