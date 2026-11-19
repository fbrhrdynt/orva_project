BEGIN;

-- Supports tenant-scoped duplicate-customer checks during Lead Conversion.
CREATE INDEX IF NOT EXISTS crm_customers_org_email_norm_idx
 ON crm.records (organization_id, lower(btrim(data->>'email')))
 WHERE record_type='customers' AND COALESCE(data->>'email','') <> '';

-- Speeds up common CRM board and status filters without indexing unrelated entities.
CREATE INDEX IF NOT EXISTS crm_opportunities_org_stage_idx
 ON crm.records (organization_id, (data->>'stage'), updated_at DESC)
 WHERE record_type='opportunities';

CREATE INDEX IF NOT EXISTS crm_leads_org_status_idx
 ON crm.records (organization_id, (data->>'status'), updated_at DESC)
 WHERE record_type='leads';

COMMIT;
