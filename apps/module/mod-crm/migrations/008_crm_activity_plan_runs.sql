BEGIN;

CREATE TABLE IF NOT EXISTS crm.activity_plan_runs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 organization_id uuid NOT NULL REFERENCES core.organizations(id) ON DELETE CASCADE,
 plan_id uuid NOT NULL,
 source_record_id uuid NOT NULL,
 trigger_key varchar(40) NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE (organization_id,plan_id,source_record_id,trigger_key)
);
CREATE INDEX IF NOT EXISTS crm_activity_plan_runs_org_created_idx
 ON crm.activity_plan_runs(organization_id,created_at DESC);

COMMIT;
