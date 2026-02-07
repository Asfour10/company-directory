-- Add encryption fields to tenants table
ALTER TABLE "tenants" ADD COLUMN "encryption_key_id" VARCHAR(255);
ALTER TABLE "tenants" ADD COLUMN "encrypted_data_key" TEXT;

-- Modify employees table to support encrypted fields
-- Change phone from VARCHAR to JSONB for encrypted storage
ALTER TABLE "employees" ALTER COLUMN "phone" TYPE JSONB USING 
  CASE 
    WHEN "phone" IS NULL THEN NULL
    WHEN "phone" = '' THEN NULL
    ELSE json_build_object('value', "phone", 'iv', '')
  END;

-- Add personal_email as encrypted field
ALTER TABLE "employees" ADD COLUMN "personal_email" JSONB;

-- Add comments to document encrypted fields
COMMENT ON COLUMN "employees"."phone" IS 'Encrypted field: { value: string, iv: string }';
COMMENT ON COLUMN "employees"."personal_email" IS 'Encrypted field: { value: string, iv: string }';
COMMENT ON COLUMN "tenants"."encryption_key_id" IS 'Identifier for tenant-specific encryption key';
COMMENT ON COLUMN "tenants"."encrypted_data_key" IS 'Encrypted data encryption key for tenant';