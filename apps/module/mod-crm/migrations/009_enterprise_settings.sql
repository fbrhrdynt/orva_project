BEGIN;

CREATE TABLE IF NOT EXISTS core.organization_settings (
  organization_id uuid NOT NULL REFERENCES core.organizations(id) ON DELETE CASCADE,
  setting_key varchar(120) NOT NULL,
  setting_value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_by uuid REFERENCES core.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, setting_key)
);

CREATE TABLE IF NOT EXISTS core.currencies (
  code char(3) PRIMARY KEY,
  name varchar(100) NOT NULL,
  symbol varchar(12) NOT NULL,
  symbol_position varchar(8) NOT NULL DEFAULT 'before' CHECK (symbol_position IN ('before','after')),
  decimal_places smallint NOT NULL DEFAULT 2 CHECK (decimal_places BETWEEN 0 AND 6),
  rounding_factor numeric(18,8) NOT NULL DEFAULT 0.01 CHECK (rounding_factor > 0),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS core.exchange_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES core.organizations(id) ON DELETE CASCADE,
  from_currency char(3) NOT NULL REFERENCES core.currencies(code),
  to_currency char(3) NOT NULL REFERENCES core.currencies(code),
  rate numeric(24,10) NOT NULL CHECK (rate > 0),
  effective_at date NOT NULL DEFAULT CURRENT_DATE,
  created_by uuid REFERENCES core.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, from_currency, to_currency, effective_at),
  CHECK (from_currency <> to_currency)
);

CREATE TABLE IF NOT EXISTS core.security_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES core.organizations(id) ON DELETE CASCADE,
  name varchar(120) NOT NULL,
  code varchar(80) NOT NULL,
  description text NOT NULL DEFAULT '',
  is_system boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES core.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, code)
);

CREATE TABLE IF NOT EXISTS core.role_permissions (
  role_id uuid NOT NULL REFERENCES core.security_roles(id) ON DELETE CASCADE,
  permission_key varchar(180) NOT NULL,
  effect varchar(8) NOT NULL DEFAULT 'allow' CHECK (effect IN ('allow','deny')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (role_id, permission_key)
);

CREATE TABLE IF NOT EXISTS core.smtp_servers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES core.organizations(id) ON DELETE CASCADE,
  description varchar(160) NOT NULL,
  priority integer NOT NULL DEFAULT 10 CHECK (priority BETWEEN 1 AND 999),
  host varchar(255) NOT NULL,
  port integer NOT NULL CHECK (port BETWEEN 1 AND 65535),
  encryption varchar(12) NOT NULL CHECK (encryption IN ('starttls','ssl','none')),
  username varchar(254) NOT NULL DEFAULT '',
  password_ciphertext text NOT NULL DEFAULT '',
  from_email varchar(254) NOT NULL DEFAULT '',
  active boolean NOT NULL DEFAULT true,
  last_test_at timestamptz,
  last_test_status varchar(20),
  created_by uuid REFERENCES core.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS core.server_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES core.organizations(id) ON DELETE CASCADE,
  name varchar(160) NOT NULL,
  action_key varchar(120) NOT NULL,
  target_model varchar(160) NOT NULL,
  action_type varchar(40) NOT NULL DEFAULT 'registered_handler',
  handler_key varchar(120) NOT NULL,
  description text NOT NULL DEFAULT '',
  active boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES core.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, action_key)
);

CREATE TABLE IF NOT EXISTS core.automation_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES core.organizations(id) ON DELETE CASCADE,
  name varchar(160) NOT NULL,
  target_model varchar(160) NOT NULL,
  trigger_event varchar(40) NOT NULL CHECK (trigger_event IN ('created','updated','deleted','manual')),
  server_action_id uuid NOT NULL REFERENCES core.server_actions(id) ON DELETE RESTRICT,
  condition_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  description text NOT NULL DEFAULT '',
  active boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES core.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS core.ui_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES core.organizations(id) ON DELETE CASCADE,
  name varchar(160) NOT NULL,
  view_key varchar(160) NOT NULL,
  module_key varchar(80) NOT NULL,
  target_model varchar(160) NOT NULL,
  view_type varchar(20) NOT NULL CHECK (view_type IN ('form','list','kanban','dashboard','calendar','report')),
  resource_path varchar(255) NOT NULL,
  schema_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES core.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, view_key)
);

CREATE TABLE IF NOT EXISTS core.admin_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES core.organizations(id) ON DELETE SET NULL,
  actor_id uuid REFERENCES core.users(id) ON DELETE SET NULL,
  action varchar(100) NOT NULL,
  resource_type varchar(80) NOT NULL,
  resource_id varchar(80),
  summary text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS organization_settings_updated_idx ON core.organization_settings(organization_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS exchange_rates_lookup_idx ON core.exchange_rates(organization_id, from_currency, to_currency, effective_at DESC);
CREATE INDEX IF NOT EXISTS smtp_servers_priority_idx ON core.smtp_servers(organization_id, active, priority);
CREATE INDEX IF NOT EXISTS automation_rules_lookup_idx ON core.automation_rules(organization_id, active, target_model, trigger_event);
CREATE INDEX IF NOT EXISTS ui_views_lookup_idx ON core.ui_views(organization_id, module_key, active);
CREATE INDEX IF NOT EXISTS admin_audit_org_created_idx ON core.admin_audit_events(organization_id, created_at DESC);

INSERT INTO core.currencies(code,name,symbol,symbol_position,decimal_places,rounding_factor) VALUES
('IDR','Indonesian Rupiah','Rp','before',0,1),
('USD','US Dollar','$','before',2,0.01),
('EUR','Euro','€','after',2,0.01),
('GBP','British Pound','£','before',2,0.01),
('SGD','Singapore Dollar','S$','before',2,0.01),
('JPY','Japanese Yen','¥','before',0,1),
('AUD','Australian Dollar','A$','before',2,0.01),
('MYR','Malaysian Ringgit','RM','before',2,0.01),
('CNY','Chinese Yuan','¥','before',2,0.01),
('SAR','Saudi Riyal','ر.س','after',2,0.01)
ON CONFLICT(code) DO NOTHING;

COMMIT;
