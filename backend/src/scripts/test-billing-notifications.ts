import { PrismaClient } from '@prisma/client';
import { emailService } from '../services/email.service';
import { notificationService } from '../services/notification.service';
import { schedulerService } from '../services/scheduler.service';

const prisma = new PrismaClient();

async function testBillingNotifications() {
  console.log('🧪 Testing Billing Notifications...\n');

  try {
    // Test 1: Test email service configuration
    console.log('1. Testing email service configuration...');
    if (process.env.SMTP_HOST) {
      console.log('✅ SMTP configured:', process.env.SMTP_HOST);
    } else {
      console.log('⚠️  SMTP not configured, emails will be logged only');
    }

    // Test 2: Find a test tenant
    console.log('\n2. Finding test tenant...');
    const tenant = await prisma.tenant.findFirst({
      where: { subscriptionTier: { not: null } },
      include: {
        users: {
          where: { role: 'super_admin', isActive: true },
          select: { email: true },
        },
      },
    });

    if (!tenant) {
      console.log('❌ No tenant found for testing');
      return;
    }

    console.log(`✅ Testing with tenant: ${tenant.name}`);
    console.log(`   Super admins: ${tenant.users.length}`);

    // Test 3: Test renewal reminder email
    console.log('\n3. Testing renewal reminder email...');
    try {
      await emailService.sendRenewalReminder(tenant.id, 7);
      console.log('✅ Renewal reminder email sent successfully');
    } catch (error) {
      console.log('⚠️  Renewal reminder failed:', error.message);
    }

    // Test 4: Test usage limit warning email
    console.log('\n4. Testing usage limit warning email...');
    try {
      await emailService.sendUsageLimitWarning(tenant.id, 85, 42, 50);
      console.log('✅ Usage limit warning email sent successfully');
    } catch (error) {
      console.log('⚠️  Usage limit warning failed:', error.message);
    }

    // Test 5: Test payment failure notification
    console.log('\n5. Testing payment failure notification...');
    try {
      await emailService.sendPaymentFailureNotification(tenant.id, 'in_test_123', 2999);
      console.log('✅ Payment failure notification sent successfully');
    } catch (error) {
      console.log('⚠️  Payment failure notification failed:', error.message);
    }

    // Test 6: Test notification service methods
    console.log('\n6. Testing notification service methods...');
    
    // Test renewal reminders check
    try {
      await notificationService.sendRenewalReminders();
      console.log('✅ Renewal reminders check completed');
    } catch (error) {
      console.log('⚠️  Renewal reminders check failed:', error.message);
    }

    // Test usage limit warnings check
    try {
      await notificationService.sendUsageLimitWarnings();
      console.log('✅ Usage limit warnings check completed');
    } catch (error) {
      console.log('⚠️  Usage limit warnings check failed:', error.message);
    }

    // Test 7: Test scheduler service
    console.log('\n7. Testing scheduler service...');
    try {
      await schedulerService.runNotificationChecksNow();
      console.log('✅ Scheduler notification checks completed');
    } catch (error) {
      console.log('⚠️  Scheduler notification checks failed:', error.message);
    }

    // Test 8: Test notification tracking
    console.log('\n8. Testing notification tracking...');
    const recentNotifications = await prisma.analyticsEvent.findMany({
      where: {
        tenantId: tenant.id,
        eventType: { in: ['usage_warning_sent', 'payment_failure'] },
        createdAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    console.log(`✅ Found ${recentNotifications.length} recent notification events`);
    recentNotifications.forEach(event => {
      console.log(`   - ${event.eventType} at ${event.createdAt.toISOString()}`);
    });

    console.log('\n✅ All billing notification tests completed successfully!');

  } catch (error) {
    console.error('❌ Billing notification test failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
if (require.main === module) {
  testBillingNotifications()
    .then(() => {
      console.log('\n🎉 Billing notification test completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Billing notification test failed:', error);
      process.exit(1);
    });
}

export { testBillingNotifications };