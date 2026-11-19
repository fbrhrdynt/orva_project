BEGIN;

ALTER TABLE core.organizations
  ADD COLUMN IF NOT EXISTS profile jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE core.memberships
  ADD COLUMN IF NOT EXISTS role_id uuid REFERENCES core.security_roles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS memberships_org_role_idx ON core.memberships(organization_id, role_id, status);
CREATE INDEX IF NOT EXISTS memberships_user_status_idx ON core.memberships(user_id, status);

CREATE TABLE IF NOT EXISTS core.permission_catalog (
  permission_key varchar(180) PRIMARY KEY,
  module_key varchar(80) NOT NULL,
  resource_key varchar(100) NOT NULL,
  action_key varchar(60) NOT NULL,
  description varchar(255) NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS core.role_record_scopes (
  role_id uuid NOT NULL REFERENCES core.security_roles(id) ON DELETE CASCADE,
  resource_key varchar(100) NOT NULL,
  scope_type varchar(20) NOT NULL CHECK (scope_type IN ('all','own','team','organization','custom')),
  scope_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(role_id, resource_key)
);

CREATE TABLE IF NOT EXISTS core.role_field_policies (
  role_id uuid NOT NULL REFERENCES core.security_roles(id) ON DELETE CASCADE,
  resource_key varchar(100) NOT NULL,
  field_key varchar(100) NOT NULL,
  policy varchar(20) NOT NULL CHECK (policy IN ('visible','readonly','masked','hidden')),
  mask_pattern varchar(80) NOT NULL DEFAULT '••••',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(role_id, resource_key, field_key)
);

CREATE TABLE IF NOT EXISTS core.role_action_policies (
  role_id uuid NOT NULL REFERENCES core.security_roles(id) ON DELETE CASCADE,
  resource_key varchar(100) NOT NULL,
  action_key varchar(100) NOT NULL,
  allowed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(role_id, resource_key, action_key)
);

CREATE TABLE IF NOT EXISTS core.smtp_test_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  smtp_server_id uuid NOT NULL REFERENCES core.smtp_servers(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES core.organizations(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES core.users(id) ON DELETE SET NULL,
  status varchar(20) NOT NULL CHECK (status IN ('success','failed','not_configured')),
  message text NOT NULL DEFAULT '',
  tested_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS smtp_test_events_lookup_idx ON core.smtp_test_events(organization_id, tested_at DESC);
CREATE INDEX IF NOT EXISTS role_record_scopes_resource_idx ON core.role_record_scopes(resource_key, scope_type);

COMMIT;
