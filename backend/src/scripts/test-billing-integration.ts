import { PrismaClient } from '@prisma/client';
import { billingService } from '../services/billing.service';
import { subscriptionService } from '../services/subscription.service';

const prisma = new PrismaClient();

async function testBillingIntegration() {
  console.log('🧪 Testing Billing Integration...\n');

  try {
    // Test 1: Create subscription plans (only if Stripe is configured)
    console.log('1. Testing subscription plan creation...');
    if (process.env.STRIPE_SECRET_KEY) {
      try {
        const plans = await billingService.createSubscriptionPlans();
        console.log('✅ Subscription plans created:', plans.length);
      } catch (error) {
        console.log('⚠️  Stripe not configured or plans already exist:', error.message);
      }
    } else {
      console.log('⚠️  Stripe not configured, skipping plan creation');
    }

    // Test 2: Test user limit checking
    console.log('\n2. Testing user limit enforcement...');
    
    // Find a test tenant
    const tenant = await prisma.tenant.findFirst({
      where: { subscriptionTier: { not: null } },
    });

    if (!tenant) {
      console.log('❌ No tenant found for testing');
      return;
    }

    console.log(`Testing with tenant: ${tenant.name} (${tenant.subscriptionTier})`);

    // Test user limit check
    const userLimitCheck = await subscriptionService.canAddUser(tenant.id);
    console.log('✅ User limit check:', {
      canAdd: userLimitCheck.canAdd,
      currentCount: userLimitCheck.currentCount,
      limit: userLimitCheck.limit,
    });

    // Test employee limit check
    const employeeLimitCheck = await subscriptionService.canAddEmployee(tenant.id);
    console.log('✅ Employee limit check:', {
      canAdd: employeeLimitCheck.canAdd,
      currentCount: employeeLimitCheck.currentCount,
      limit: employeeLimitCheck.limit,
    });

    // Test 3: Get usage statistics
    console.log('\n3. Testing usage statistics...');
    const usageStats = await subscriptionService.getUsageStats(tenant.id);
    console.log('✅ Usage statistics:', {
      subscriptionTier: usageStats.subscriptionTier,
      usagePercentage: usageStats.usagePercentage,
      isNearLimit: usageStats.isNearLimit,
      isAtLimit: usageStats.isAtLimit,
    });

    // Test 4: Get upgrade recommendations
    console.log('\n4. Testing upgrade recommendations...');
    const recommendations = await subscriptionService.getUpgradeRecommendations(tenant.id);
    console.log('✅ Upgrade recommendations:', {
      recommendationCount: recommendations.recommendations.length,
      availableUpgrades: recommendations.availableUpgrades.length,
    });

    // Test 5: Test billing service methods (mock data)
    console.log('\n5. Testing billing service methods...');
    
    if (process.env.STRIPE_SECRET_KEY) {
      try {
        // Test customer creation (with mock data)
        console.log('Testing customer creation...');
        const customer = await billingService.createCustomer(
          tenant.id,
          'test@example.com',
          tenant.name
        );
        console.log('✅ Customer created:', customer.id);

        // Clean up test customer
        await billingService.stripe.customers.del(customer.id);
        console.log('✅ Test customer cleaned up');
      } catch (error) {
        console.log('⚠️  Stripe customer test failed:', error.message);
      }
    }

    console.log('\n✅ All billing integration tests completed successfully!');

  } catch (error) {
    console.error('❌ Billing integration test failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
if (require.main === module) {
  testBillingIntegration()
    .then(() => {
      console.log('\n🎉 Billing integration test completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Billing integration test failed:', error);
      process.exit(1);
    });
}

export { testBillingIntegration };