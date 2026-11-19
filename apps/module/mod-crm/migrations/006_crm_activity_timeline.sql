BEGIN;
CREATE TABLE IF NOT EXISTS crm.activity_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 organization_id uuid NOT NULL REFERENCES core.organizations(id) ON DELETE CASCADE,
 record_id uuid NOT NULL,
 record_type varchar(40) NOT NULL,
 event_type varchar(40) NOT NULL,
 summary varchar(500) NOT NULL,
 payload jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(payload)='object'),
 actor_id uuid REFERENCES core.users(id) ON DELETE SET NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS crm_activity_events_record_idx
 ON crm.activity_events(organization_id,record_id,created_at DESC);
CREATE INDEX IF NOT EXISTS crm_activity_events_org_created_idx
 ON crm.activity_events(organization_id,created_at DESC);
COMMIT;
