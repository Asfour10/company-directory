import Stripe from 'stripe';
import { PrismaClient } from '@prisma/client';
import { notificationService } from './notification.service';

const prisma = new PrismaClient();

export class BillingService {
  private stripe: Stripe | null;

  constructor() {
    if (!process.env.STRIPE_SECRET_KEY) {
      console.warn('STRIPE_SECRET_KEY not configured - billing features will be disabled');
      this.stripe = null;
      return;
    }
    
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2023-10-16',
    });
  }

  private ensureStripeConfigured(): Stripe {
    if (!this.stripe) {
      throw new Error('Stripe is not configured. Please set STRIPE_SECRET_KEY environment variable.');
    }
    return this.stripe;
  }

  /**
   * Create subscription plans in Stripe
   */
  async createSubscriptionPlans() {
    try {
      // Create products and prices for different subscription tiers
      const plans = [
        {
          name: 'Starter',
          userLimit: 50,
          monthlyPrice: 999, // $9.99 in cents
          yearlyPrice: 9999, // $99.99 in cents
        },
        {
          name: 'Professional',
          userLimit: 200,
          monthlyPrice: 2999, // $29.99 in cents
          yearlyPrice: 29999, // $299.99 in cents
        },
        {
          name: 'Enterprise',
          userLimit: 1000,
          monthlyPrice: 9999, // $99.99 in cents
          yearlyPrice: 99999, // $999.99 in cents
        },
      ];

      const createdPlans = [];

      for (const plan of plans) {
        // Create product
        const product = await this.ensureStripeConfigured().products.create({
          name: `Company Directory ${plan.name}`,
          description: `${plan.name} plan with up to ${plan.userLimit} users`,
          metadata: {
            userLimit: plan.userLimit.toString(),
            tier: plan.name.toLowerCase(),
          },
        });

        // Create monthly price
        const monthlyPrice = await this.ensureStripeConfigured().prices.create({
          product: product.id,
          unit_amount: plan.monthlyPrice,
          currency: 'usd',
          recurring: {
            interval: 'month',
          },
          metadata: {
            tier: plan.name.toLowerCase(),
            billing_period: 'monthly',
          },
        });

        // Create yearly price
        const yearlyPrice = await this.ensureStripeConfigured().prices.create({
          product: product.id,
          unit_amount: plan.yearlyPrice,
          currency: 'usd',
          recurring: {
            interval: 'year',
          },
          metadata: {
            tier: plan.name.toLowerCase(),
            billing_period: 'yearly',
          },
        });

        createdPlans.push({
          tier: plan.name.toLowerCase(),
          product: product,
          monthlyPrice: monthlyPrice,
          yearlyPrice: yearlyPrice,
          userLimit: plan.userLimit,
        });
      }

      return createdPlans;
    } catch (error) {
      console.error('Error creating subscription plans:', error);
      throw error;
    }
  }

  /**
   * Create a Stripe customer for a tenant
   */
  async createCustomer(tenantId: string, email: string, name: string) {
    try {
      const customer = await this.ensureStripeConfigured().customers.create({
        email,
        name,
        metadata: {
          tenantId,
        },
      });

      return customer;
    } catch (error) {
      console.error('Error creating Stripe customer:', error);
      throw error;
    }
  }

  /**
   * Create a subscription for a tenant
   */
  async createSubscription(customerId: string, priceId: string, tenantId: string) {
    try {
      const subscription = await this.ensureStripeConfigured().subscriptions.create({
        customer: customerId,
        items: [{ price: priceId }],
        metadata: {
          tenantId,
        },
        payment_behavior: 'default_incomplete',
        payment_settings: { save_default_payment_method: 'on_subscription' },
        expand: ['latest_invoice.payment_intent'],
      });

      return subscription;
    } catch (error) {
      console.error('Error creating subscription:', error);
      throw error;
    }
  }

  /**
   * Update subscription to a different plan
   */
  async updateSubscription(subscriptionId: string, newPriceId: string) {
    try {
      const subscription = await this.ensureStripeConfigured().subscriptions.retrieve(subscriptionId);
      
      const updatedSubscription = await this.ensureStripeConfigured().subscriptions.update(subscriptionId, {
        items: [{
          id: subscription.items.data[0].id,
          price: newPriceId,
        }],
        proration_behavior: 'create_prorations',
      });

      return updatedSubscription;
    } catch (error) {
      console.error('Error updating subscription:', error);
      throw error;
    }
  }

  /**
   * Cancel a subscription
   */
  async cancelSubscription(subscriptionId: string) {
    try {
      const subscription = await this.ensureStripeConfigured().subscriptions.cancel(subscriptionId);
      return subscription;
    } catch (error) {
      console.error('Error canceling subscription:', error);
      throw error;
    }
  }

  /**
   * Get subscription details
   */
  async getSubscription(subscriptionId: string) {
    try {
      const subscription = await this.ensureStripeConfigured().subscriptions.retrieve(subscriptionId, {
        expand: ['latest_invoice', 'customer'],
      });
      return subscription;
    } catch (error) {
      console.error('Error retrieving subscription:', error);
      throw error;
    }
  }

  /**
   * Create a billing portal session
   */
  async createBillingPortalSession(customerId: string, returnUrl: string) {
    try {
      const session = await this.ensureStripeConfigured().billingPortal.sessions.create({
        customer: customerId,
        return_url: returnUrl,
      });
      return session;
    } catch (error) {
      console.error('Error creating billing portal session:', error);
      throw error;
    }
  }

  /**
   * Handle Stripe webhook events
   */
  async handleWebhook(event: Stripe.Event) {
    try {
      switch (event.type) {
        case 'customer.subscription.created':
          await this.handleSubscriptionCreated(event.data.object as Stripe.Subscription);
          break;
        case 'customer.subscription.updated':
          await this.handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
          break;
        case 'customer.subscription.deleted':
          await this.handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
          break;
        case 'invoice.payment_succeeded':
          await this.handlePaymentSucceeded(event.data.object as Stripe.Invoice);
          break;
        case 'invoice.payment_failed':
          await this.handlePaymentFailed(event.data.object as Stripe.Invoice);
          break;
        default:
          console.log(`Unhandled event type: ${event.type}`);
      }
    } catch (error) {
      console.error('Error handling webhook:', error);
      throw error;
    }
  }

  private async handleSubscriptionCreated(subscription: Stripe.Subscription) {
    const tenantId = subscription.metadata.tenantId;
    if (!tenantId) return;

    // Update tenant with subscription info
    await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        subscriptionTier: this.getSubscriptionTier(subscription),
        userLimit: this.getUserLimit(subscription),
      },
    });
  }

  private async handleSubscriptionUpdated(subscription: Stripe.Subscription) {
    const tenantId = subscription.metadata.tenantId;
    if (!tenantId) return;

    // Update tenant with new subscription info
    await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        subscriptionTier: this.getSubscriptionTier(subscription),
        userLimit: this.getUserLimit(subscription),
      },
    });
  }

  private async handleSubscriptionDeleted(subscription: Stripe.Subscription) {
    const tenantId = subscription.metadata.tenantId;
    if (!tenantId) return;

    // Downgrade tenant to free tier
    await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        subscriptionTier: 'free',
        userLimit: 10, // Free tier limit
      },
    });
  }

  private async handlePaymentSucceeded(invoice: Stripe.Invoice) {
    // Log successful payment
    console.log(`Payment succeeded for invoice: ${invoice.id}`);
  }

  private async handlePaymentFailed(invoice: Stripe.Invoice) {
    // Log failed payment and potentially notify tenant
    console.log(`Payment failed for invoice: ${invoice.id}`);
    
    // Get tenant ID from customer metadata
    if (invoice.customer && typeof invoice.customer === 'string') {
      const customer = await this.ensureStripeConfigured().customers.retrieve(invoice.customer);
      if (customer && !customer.deleted) {
        const metadata = (customer as Stripe.Customer).metadata;
        const tenantId = metadata?.tenantId;
        if (tenantId) {
          await notificationService.handlePaymentFailure(
            tenantId,
            invoice.id,
            invoice.amount_due
          );
        }
      }
    }
  }

  private getSubscriptionTier(subscription: Stripe.Subscription): string {
    const price = subscription.items.data[0]?.price;
    return price?.metadata?.tier || 'starter';
  }

  private getUserLimit(subscription: Stripe.Subscription): number {
    const price = subscription.items.data[0]?.price;
    const userLimit = price?.metadata?.userLimit;
    return userLimit ? parseInt(userLimit) : 50;
  }
}

export const billingService = new BillingService();