import express from 'express';
import Stripe from 'stripe';
import { billingService } from '../services/billing.service';
import { schedulerService } from '../services/scheduler.service';
import { authenticateToken, requireAdmin } from '../middleware/auth.middleware';
import { tenantMiddleware, requireTenant } from '../middleware/tenant.middleware';
import { requireRole } from '../middleware/authorization.middleware';

const router = express.Router();

/**
 * Stripe webhook endpoint
 * This endpoint receives webhook events from Stripe
 */
router.post('/webhooks/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'] as string;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error('Stripe webhook secret not configured');
    return res.status(400).send('Webhook secret not configured');
  }

  let event: Stripe.Event;

  try {
    event = Stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return res.status(400).send(`Webhook Error: ${err}`);
  }

  try {
    await billingService.handleWebhook(event);
    res.json({ received: true });
  } catch (error) {
    console.error('Error processing webhook:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

/**
 * Get tenant billing information
 * GET /api/tenant/billing
 */
router.get('/tenant/billing', 
  authMiddleware, 
  tenantMiddleware, 
  authorizationMiddleware(['super_admin']),
  async (req, res) => {
    try {
      const tenant = req.tenant;
      
      if (!tenant.stripeSubscriptionId) {
        return res.json({
          subscriptionTier: tenant.subscriptionTier,
          userLimit: tenant.userLimit,
          subscriptionStatus: 'inactive',
          currentPeriodEnd: null,
        });
      }

      const subscription = await billingService.getSubscription(tenant.stripeSubscriptionId);
      
      res.json({
        subscriptionTier: tenant.subscriptionTier,
        userLimit: tenant.userLimit,
        subscriptionStatus: subscription.status,
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        nextInvoiceAmount: subscription.latest_invoice ? 
          (subscription.latest_invoice as Stripe.Invoice).amount_due : null,
      });
    } catch (error) {
      console.error('Error fetching billing info:', error);
      res.status(500).json({ error: 'Failed to fetch billing information' });
    }
  }
);

/**
 * Upgrade subscription
 * POST /api/tenant/billing/upgrade
 */
router.post('/tenant/billing/upgrade',
  authMiddleware,
  tenantMiddleware,
  authorizationMiddleware(['super_admin']),
  async (req, res) => {
    try {
      const tenant = req.tenant;
      const { priceId } = req.body;

      if (!priceId) {
        return res.status(400).json({ error: 'Price ID is required' });
      }

      let subscription;

      if (tenant.stripeSubscriptionId) {
        // Update existing subscription
        subscription = await billingService.updateSubscription(tenant.stripeSubscriptionId, priceId);
      } else {
        // Create new subscription
        if (!tenant.stripeCustomerId) {
          // Create customer first
          const customer = await billingService.createCustomer(
            tenant.id,
            req.user.email,
            tenant.name
          );
          
          // Update tenant with customer ID
          await req.prisma.tenant.update({
            where: { id: tenant.id },
            data: { stripeCustomerId: customer.id },
          });
        }

        subscription = await billingService.createSubscription(
          tenant.stripeCustomerId!,
          priceId,
          tenant.id
        );
      }

      res.json({
        subscriptionId: subscription.id,
        clientSecret: subscription.latest_invoice?.payment_intent?.client_secret,
        status: subscription.status,
      });
    } catch (error) {
      console.error('Error upgrading subscription:', error);
      res.status(500).json({ error: 'Failed to upgrade subscription' });
    }
  }
);

/**
 * Create billing portal session
 * POST /api/tenant/billing/portal
 */
router.post('/tenant/billing/portal',
  authMiddleware,
  tenantMiddleware,
  authorizationMiddleware(['super_admin']),
  async (req, res) => {
    try {
      const tenant = req.tenant;
      const { returnUrl } = req.body;

      if (!tenant.stripeCustomerId) {
        return res.status(400).json({ error: 'No billing account found' });
      }

      const session = await billingService.createBillingPortalSession(
        tenant.stripeCustomerId,
        returnUrl || `https://${tenant.subdomain}.directory-platform.com/admin/billing`
      );

      res.json({ url: session.url });
    } catch (error) {
      console.error('Error creating billing portal session:', error);
      res.status(500).json({ error: 'Failed to create billing portal session' });
    }
  }
);

/**
 * Get available subscription plans
 * GET /api/billing/plans
 */
router.get('/billing/plans', async (req, res) => {
  try {
    const plans = [
      {
        tier: 'starter',
        name: 'Starter',
        userLimit: 50,
        monthlyPrice: 9.99,
        yearlyPrice: 99.99,
        features: [
          'Up to 50 employees',
          'Basic search functionality',
          'Profile management',
          'Email support',
        ],
      },
      {
        tier: 'professional',
        name: 'Professional',
        userLimit: 200,
        monthlyPrice: 29.99,
        yearlyPrice: 299.99,
        features: [
          'Up to 200 employees',
          'Advanced search and filters',
          'Custom fields',
          'Organizational chart',
          'Analytics dashboard',
          'Priority support',
        ],
      },
      {
        tier: 'enterprise',
        name: 'Enterprise',
        userLimit: 1000,
        monthlyPrice: 99.99,
        yearlyPrice: 999.99,
        features: [
          'Up to 1000 employees',
          'All Professional features',
          'SSO integration',
          'SCIM provisioning',
          'Advanced analytics',
          'Audit logs',
          'Custom branding',
          'Dedicated support',
        ],
      },
    ];

    res.json(plans);
  } catch (error) {
    console.error('Error fetching plans:', error);
    res.status(500).json({ error: 'Failed to fetch subscription plans' });
  }
});

/**
 * Manually trigger notification checks (admin only)
 * POST /api/admin/notifications/check
 */
router.post('/notifications/check',
  authMiddleware,
  tenantMiddleware,
  authorizationMiddleware(['super_admin']),
  async (req, res) => {
    try {
      await schedulerService.runNotificationChecksNow();
      res.json({ message: 'Notification checks completed successfully' });
    } catch (error) {
      console.error('Error running notification checks:', error);
      res.status(500).json({ error: 'Failed to run notification checks' });
    }
  }
);

export default router;