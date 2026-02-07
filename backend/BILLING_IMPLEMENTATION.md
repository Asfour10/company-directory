# Billing and Subscription Management Implementation

## Overview

This document describes the implementation of the billing and subscription management system for the Company Directory application. The system integrates with Stripe for payment processing and provides user limit enforcement, upgrade prompts, and billing notifications.

## Architecture

### Components

1. **BillingService** (`src/services/billing.service.ts`)
   - Handles Stripe integration
   - Manages subscription plans, customers, and payments
   - Processes webhooks from Stripe

2. **SubscriptionService** (`src/services/subscription.service.ts`)
   - Enforces user limits based on subscription tiers
   - Provides usage statistics and upgrade recommendations
   - Manages subscription-related business logic

3. **User Limit Middleware** (`src/middleware/user-limit.middleware.ts`)
   - Checks user limits before creating employees/users
   - Adds usage warnings to API responses
   - Returns upgrade prompts when limits are exceeded

4. **Billing Routes** (`src/routes/billing.routes.ts`)
   - API endpoints for billing operations
   - Webhook handling for Stripe events
   - Billing portal integration

## Database Schema Changes

### Tenant Table Updates

Added billing-related fields to the `tenants` table:

```sql
ALTER TABLE "tenants" ADD COLUMN "stripe_customer_id" VARCHAR(255);
ALTER TABLE "tenants" ADD COLUMN "stripe_subscription_id" VARCHAR(255);
ALTER TABLE "tenants" ADD COLUMN "subscription_status" VARCHAR(50);
ALTER TABLE "tenants" ADD COLUMN "current_period_end" TIMESTAMP(3);

CREATE INDEX "tenants_stripe_customer_id_idx" ON "tenants"("stripe_customer_id");
CREATE INDEX "tenants_stripe_subscription_id_idx" ON "tenants"("stripe_subscription_id");
```

## Subscription Tiers

### Available Plans

1. **Free Tier**
   - Up to 10 employees
   - Basic features only
   - No billing required

2. **Starter Plan** - $9.99/month or $99.99/year
   - Up to 50 employees
   - Basic search functionality
   - Profile management
   - Email support

3. **Professional Plan** - $29.99/month or $299.99/year
   - Up to 200 employees
   - Advanced search and filters
   - Custom fields
   - Organizational chart
   - Analytics dashboard
   - Priority support

4. **Enterprise Plan** - $99.99/month or $999.99/year
   - Up to 1000 employees
   - All Professional features
   - SSO integration
   - SCIM provisioning
   - Advanced analytics
   - Audit logs
   - Custom branding
   - Dedicated support

## API Endpoints

### Billing Management

#### GET /api/tenant/billing
Get current subscription status and billing information.

**Authorization:** Super Admin only

**Response:**
```json
{
  "subscriptionTier": "professional",
  "userLimit": 200,
  "subscriptionStatus": "active",
  "currentPeriodEnd": "2024-02-01T00:00:00.000Z",
  "cancelAtPeriodEnd": false,
  "nextInvoiceAmount": 2999
}
```

#### POST /api/tenant/billing/upgrade
Upgrade subscription to a different plan.

**Authorization:** Super Admin only

**Request:**
```json
{
  "priceId": "price_1234567890"
}
```

**Response:**
```json
{
  "subscriptionId": "sub_1234567890",
  "clientSecret": "pi_1234567890_secret_abc123",
  "status": "incomplete"
}
```

#### POST /api/tenant/billing/portal
Create a billing portal session for managing subscription.

**Authorization:** Super Admin only

**Request:**
```json
{
  "returnUrl": "https://company.directory-platform.com/admin/billing"
}
```

**Response:**
```json
{
  "url": "https://billing.stripe.com/session/abc123"
}
```

#### GET /api/billing/plans
Get available subscription plans (public endpoint).

**Response:**
```json
[
  {
    "tier": "starter",
    "name": "Starter",
    "userLimit": 50,
    "monthlyPrice": 9.99,
    "yearlyPrice": 99.99,
    "features": [
      "Up to 50 employees",
      "Basic search functionality",
      "Profile management",
      "Email support"
    ]
  }
]
```

### Usage Statistics

#### GET /api/employees/usage
Get usage statistics and upgrade recommendations.

**Authorization:** Admin or Super Admin

**Response:**
```json
{
  "currentStats": {
    "subscriptionTier": "starter",
    "userLimit": 50,
    "currentUsers": 45,
    "currentEmployees": 45,
    "usagePercentage": 90,
    "isNearLimit": true,
    "isAtLimit": false
  },
  "recommendations": [
    {
      "type": "warning",
      "title": "Approaching Limit",
      "message": "You are using 90% of your user limit. Consider upgrading soon.",
      "action": "consider_upgrade"
    }
  ],
  "availableUpgrades": [
    {
      "tier": "professional",
      "name": "Professional",
      "userLimit": 200,
      "monthlyPrice": 29.99
    }
  ]
}
```

## User Limit Enforcement

### Middleware Implementation

The system uses middleware to enforce user limits:

1. **checkEmployeeLimit** - Prevents employee creation when at limit
2. **checkUserLimit** - Prevents user creation when at limit
3. **addUsageWarnings** - Adds usage warnings to API responses

### Error Responses

When user limit is exceeded, the API returns a 402 Payment Required status:

```json
{
  "error": "Employee limit exceeded",
  "message": "Employee limit reached. Your starter plan allows up to 50 employees. Please upgrade your subscription to add more employees.",
  "currentCount": 50,
  "limit": 50,
  "upgradeRequired": true,
  "upgradeUrl": "/admin/billing/upgrade"
}
```

### Usage Warnings

When approaching the limit (80%+), responses include usage warnings:

```json
{
  "employee": { ... },
  "usageWarning": {
    "message": "You are using 90% of your user limit (45/50). Consider upgrading your subscription.",
    "usagePercentage": 90,
    "upgradeUrl": "/admin/billing/upgrade"
  }
}
```

## Stripe Integration

### Webhook Handling

The system handles the following Stripe webhook events:

- `customer.subscription.created` - Updates tenant subscription info
- `customer.subscription.updated` - Updates subscription changes
- `customer.subscription.deleted` - Downgrades to free tier
- `invoice.payment_succeeded` - Logs successful payments
- `invoice.payment_failed` - Logs failed payments

### Security

- Webhook signatures are verified using Stripe's signature verification
- All billing operations require Super Admin authorization
- Stripe keys are stored as environment variables

## Environment Configuration

Required environment variables:

```bash
# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

## Testing

### Test Script

Run the billing integration test:

```bash
npm run test:billing
```

The test script (`src/scripts/test-billing-integration.ts`) verifies:

1. Subscription plan creation
2. User limit enforcement
3. Usage statistics calculation
4. Upgrade recommendations
5. Stripe customer operations

### Manual Testing

1. **Test User Limit Enforcement:**
   - Create employees until reaching the limit
   - Verify 402 error is returned
   - Check upgrade prompt is displayed

2. **Test Billing Portal:**
   - Access `/api/tenant/billing/portal`
   - Verify Stripe billing portal opens
   - Test subscription management

3. **Test Webhooks:**
   - Use Stripe CLI to forward webhooks
   - Test subscription lifecycle events
   - Verify tenant data is updated correctly

## Error Handling

### Common Errors

1. **Stripe Not Configured**
   - Returns warning messages
   - Continues with basic functionality

2. **User Limit Exceeded**
   - Returns 402 Payment Required
   - Includes upgrade information

3. **Invalid Subscription**
   - Handles gracefully
   - Provides fallback behavior

### Logging

All billing operations are logged with appropriate levels:
- Info: Successful operations
- Warn: Configuration issues
- Error: Failed operations

## Security Considerations

1. **Authorization**
   - Only Super Admins can access billing endpoints
   - Webhook endpoints use signature verification

2. **Data Protection**
   - No sensitive payment data stored locally
   - All payment processing handled by Stripe

3. **Rate Limiting**
   - Consider implementing rate limiting for billing endpoints
   - Prevent abuse of webhook endpoints

## Future Enhancements

1. **Billing Notifications**
   - Email notifications for payment failures
   - Renewal reminders
   - Usage threshold alerts

2. **Advanced Analytics**
   - Revenue tracking
   - Churn analysis
   - Usage patterns

3. **Multi-Currency Support**
   - Support for different currencies
   - Regional pricing

4. **Enterprise Features**
   - Custom pricing
   - Volume discounts
   - Annual contracts

## Troubleshooting

### Common Issues

1. **Webhook Failures**
   - Check webhook secret configuration
   - Verify endpoint accessibility
   - Review Stripe dashboard for errors

2. **User Limit Not Enforced**
   - Verify middleware is applied to routes
   - Check tenant subscription data
   - Review user count calculations

3. **Billing Portal Issues**
   - Ensure Stripe customer exists
   - Check return URL configuration
   - Verify portal settings in Stripe

### Debug Commands

```bash
# Test billing integration
npm run test:billing

# Check tenant subscription status
npm run test:tenant-service

# Verify database schema
npm run verify:schema
```