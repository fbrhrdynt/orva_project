BEGIN;
CREATE TABLE IF NOT EXISTS crm.records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES core.organizations(id) ON DELETE CASCADE,
  record_type varchar(40) NOT NULL CHECK (record_type IN ('leads','customers','contacts','opportunities','activities','lead_sources','pipeline_stages','activity_types','lost_reasons','sales_teams')),
  data jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(data)='object'),
  created_by uuid REFERENCES core.users(id),
  updated_by uuid REFERENCES core.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS crm_records_org_type_created_idx ON crm.records(organization_id,record_type,created_at DESC);
CREATE INDEX IF NOT EXISTS crm_records_data_gin_idx ON crm.records USING gin(data);
-- Idempotent sample workspace data for the first organization only.
WITH org AS (SELECT id FROM core.organizations ORDER BY created_at LIMIT 1),
owner_user AS (SELECT id FROM core.users WHERE is_platform_owner=true ORDER BY created_at LIMIT 1),
samples(record_type,data) AS (VALUES
 ('leads','{"name":"Andi Pratama","company":"PT Samudra Energi","email":"andi@samudra.co.id","phone":"081211112222","source":"Website","status":"Qualified","owner":"Febro"}'::jsonb),
 ('leads','{"name":"Maya Putri","company":"Energi Nusantara","email":"maya@energi.co.id","phone":"081233334444","source":"Referral","status":"New","owner":"Unassigned"}'::jsonb),
 ('leads','{"name":"Budi Santoso","company":"PT Maju Teknik","email":"budi@maju.co.id","phone":"081255556666","source":"LinkedIn","status":"New","owner":"Febro"}'::jsonb),
 ('customers','{"name":"PT Samudra Energi","type":"Company","category":"Oil & Gas","group":"Enterprise","email":"procurement@samudra.co.id","phone":"0215550101","website":"samudra.co.id"}'::jsonb),
 ('customers','{"name":"Energi Nusantara","type":"Company","category":"Oil & Gas","group":"Corporate","email":"hello@energi.co.id","phone":"0215550102","website":"energi.co.id"}'::jsonb),
 ('contacts','{"name":"Andi Pratama","company":"PT Samudra Energi","job_title":"Procurement Manager","email":"andi@samudra.co.id","phone":"081211112222","owner":"Febro"}'::jsonb),
 ('opportunities','{"name":"Offshore Equipment Supply","customer":"PT Samudra Energi","value":85000,"stage":"Proposal","probability":70,"expected_close":"2026-12-20","owner":"Febro"}'::jsonb),
 ('opportunities','{"name":"Maintenance Contract 2027","customer":"Energi Nusantara","value":64500,"stage":"Negotiation","probability":80,"expected_close":"2027-01-15","owner":"Febro"}'::jsonb),
 ('opportunities','{"name":"Industrial Pump Package","customer":"PT Maju Teknik","value":42000,"stage":"Qualified","probability":40,"expected_close":"2027-02-01","owner":"Febro"}'::jsonb),
 ('activities','{"subject":"Client discovery call","type":"Call","related_to":"PT Samudra Energi","due_date":"2026-11-20","time":"09:30","owner":"Febro","status":"Scheduled"}'::jsonb),
 ('activities','{"subject":"Proposal review","type":"Meeting","related_to":"Energi Nusantara","due_date":"2026-11-20","time":"11:00","owner":"Febro","status":"Scheduled"}'::jsonb),
 ('lead_sources','{"name":"Website","description":"Company website","active":"Yes"}'::jsonb),
 ('lead_sources','{"name":"Referral","description":"Customer referral","active":"Yes"}'::jsonb),
 ('lead_sources','{"name":"LinkedIn","description":"Social network","active":"Yes"}'::jsonb),
 ('pipeline_stages','{"name":"New","probability":10,"sequence":1,"active":"Yes"}'::jsonb),
 ('pipeline_stages','{"name":"Qualified","probability":30,"sequence":2,"active":"Yes"}'::jsonb),
 ('pipeline_stages','{"name":"Proposal","probability":50,"sequence":3,"active":"Yes"}'::jsonb),
 ('pipeline_stages','{"name":"Negotiation","probability":75,"sequence":4,"active":"Yes"}'::jsonb),
 ('pipeline_stages','{"name":"Closing","probability":90,"sequence":5,"active":"Yes"}'::jsonb),
 ('activity_types','{"name":"Call","description":"Phone call","active":"Yes"}'::jsonb),
 ('activity_types','{"name":"Meeting","description":"Client meeting","active":"Yes"}'::jsonb),
 ('activity_types','{"name":"Email","description":"Email communication","active":"Yes"}'::jsonb),
 ('lost_reasons','{"name":"Price","description":"Price not competitive","active":"Yes"}'::jsonb),
 ('lost_reasons','{"name":"Competitor","description":"Selected competitor","active":"Yes"}'::jsonb),
 ('sales_teams','{"name":"Enterprise Sales","manager":"Febro","members":"Febro, Maya","target":500000,"active":"Yes"}'::jsonb)
)
INSERT INTO crm.records(organization_id,record_type,data,created_by,updated_by)
SELECT org.id,s.record_type,s.data,owner_user.id,owner_user.id
FROM org CROSS JOIN samples AS s CROSS JOIN owner_user
WHERE NOT EXISTS (SELECT 1 FROM crm.records r WHERE r.organization_id=org.id);
COMMIT;
