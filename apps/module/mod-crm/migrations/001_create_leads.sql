BEGIN;

CREATE SCHEMA IF NOT EXISTS crm AUTHORIZATION orva_app;

CREATE TABLE IF NOT EXISTS crm.leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  name varchar(160) NOT NULL,
  company varchar(160),
  email varchar(254),
  phone varchar(40),
  source varchar(80),
  status varchar(32) NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'contacted', 'qualified', 'unqualified', 'converted')),
  assigned_to varchar(160),
  created_by varchar(160) NOT NULL,
  updated_by varchar(160) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS leads_org_created_idx
  ON crm.leads (organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS leads_org_status_idx
  ON crm.leads (organization_id, status);

COMMIT;
