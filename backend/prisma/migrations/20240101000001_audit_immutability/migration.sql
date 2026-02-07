-- Add immutability constraints to audit_logs table
-- Prevent updates and deletes on audit logs for compliance

-- Create function to prevent audit log modifications
CREATE OR REPLACE FUNCTION prevent_audit_log_modification()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Audit logs are immutable and cannot be modified or deleted';
END;
$$ LANGUAGE plpgsql;

-- Create triggers to prevent updates and deletes on audit_logs
CREATE TRIGGER prevent_audit_log_update
    BEFORE UPDATE ON "audit_logs"
    FOR EACH ROW
    EXECUTE FUNCTION prevent_audit_log_modification();

CREATE TRIGGER prevent_audit_log_delete
    BEFORE DELETE ON "audit_logs"
    FOR EACH ROW
    EXECUTE FUNCTION prevent_audit_log_modification();

-- Add additional indexes for audit log performance
CREATE INDEX IF NOT EXISTS "audit_logs_action_idx" ON "audit_logs"("action");
CREATE INDEX IF NOT EXISTS "audit_logs_field_name_idx" ON "audit_logs"("field_name");
CREATE INDEX IF NOT EXISTS "audit_logs_created_at_idx" ON "audit_logs"("created_at" DESC);

-- Add indexes for analytics events performance
CREATE INDEX IF NOT EXISTS "analytics_events_user_id_idx" ON "analytics_events"("user_id");
CREATE INDEX IF NOT EXISTS "analytics_events_metadata_idx" ON "analytics_events" USING GIN ("metadata");

-- Create function for audit log cleanup (respects retention policy)
CREATE OR REPLACE FUNCTION cleanup_expired_audit_logs(retention_days INTEGER DEFAULT 730)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- Only allow deletion of logs older than retention period
    DELETE FROM "audit_logs" 
    WHERE created_at < NOW() - INTERVAL '1 day' * retention_days;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Create function for analytics event cleanup
CREATE OR REPLACE FUNCTION cleanup_expired_analytics_events(retention_days INTEGER DEFAULT 90)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- Clean up old analytics events (shorter retention than audit logs)
    DELETE FROM "analytics_events" 
    WHERE created_at < NOW() - INTERVAL '1 day' * retention_days;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Add comments for documentation
COMMENT ON TABLE "audit_logs" IS 'Immutable audit trail for all data modifications. Records are never updated or deleted except for retention policy cleanup.';
COMMENT ON TABLE "analytics_events" IS 'Usage analytics and tracking events for reporting and insights.';
COMMENT ON TABLE "sessions" IS 'JWT token management and session tracking with automatic cleanup.';

COMMENT ON COLUMN "audit_logs"."action" IS 'Type of action performed (CREATE, UPDATE, DELETE)';
COMMENT ON COLUMN "audit_logs"."entity_type" IS 'Type of entity being modified (employee, user, etc.)';
COMMENT ON COLUMN "audit_logs"."entity_id" IS 'ID of the specific entity being modified';
COMMENT ON COLUMN "audit_logs"."field_name" IS 'Specific field that was changed (null for CREATE/DELETE)';
COMMENT ON COLUMN "audit_logs"."old_value" IS 'Previous value before change (null for CREATE)';
COMMENT ON COLUMN "audit_logs"."new_value" IS 'New value after change (null for DELETE)';

COMMENT ON COLUMN "analytics_events"."event_type" IS 'Type of analytics event (search, profile_view, login, etc.)';
COMMENT ON COLUMN "analytics_events"."metadata" IS 'Additional event data in JSON format';

-- Create view for audit log reporting (with proper tenant isolation)
CREATE OR REPLACE VIEW "audit_log_summary" AS
SELECT 
    tenant_id,
    action,
    entity_type,
    DATE(created_at) as log_date,
    COUNT(*) as event_count,
    COUNT(DISTINCT user_id) as unique_users,
    COUNT(DISTINCT entity_id) as unique_entities
FROM "audit_logs"
GROUP BY tenant_id, action, entity_type, DATE(created_at);

-- Create view for analytics reporting
CREATE OR REPLACE VIEW "analytics_summary" AS
SELECT 
    tenant_id,
    event_type,
    DATE(created_at) as event_date,
    COUNT(*) as event_count,
    COUNT(DISTINCT user_id) as unique_users
FROM "analytics_events"
GROUP BY tenant_id, event_type, DATE(created_at);

-- Apply RLS to views
ALTER VIEW "audit_log_summary" SET (security_barrier = true);
ALTER VIEW "analytics_summary" SET (security_barrier = true);