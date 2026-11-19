BEGIN;
ALTER TABLE crm.records DROP CONSTRAINT IF EXISTS records_record_type_check;
ALTER TABLE crm.records ADD CONSTRAINT records_record_type_check CHECK (
 record_type IN (
  'leads','customers','contacts','opportunities','activities',
  'lead_sources','pipeline_stages','activity_types','lost_reasons','sales_teams',
  'activity_plans','opportunity_tags','lead_mining_requests'
 )
);
CREATE INDEX IF NOT EXISTS crm_records_org_type_updated_idx
 ON crm.records(organization_id,record_type,updated_at DESC,id);
COMMIT;
