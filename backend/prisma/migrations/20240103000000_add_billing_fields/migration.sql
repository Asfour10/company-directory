-- Add billing-related fields to tenants table
ALTER TABLE "tenants" ADD COLUMN "stripe_customer_id" VARCHAR(255);
ALTER TABLE "tenants" ADD COLUMN "stripe_subscription_id" VARCHAR(255);
ALTER TABLE "tenants" ADD COLUMN "subscription_status" VARCHAR(50);
ALTER TABLE "tenants" ADD COLUMN "current_period_end" TIMESTAMP(3);

-- Add indexes for billing fields
CREATE INDEX "tenants_stripe_customer_id_idx" ON "tenants"("stripe_customer_id");
CREATE INDEX "tenants_stripe_subscription_id_idx" ON "tenants"("stripe_subscription_id");