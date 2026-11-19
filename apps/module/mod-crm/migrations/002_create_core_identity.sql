BEGIN;
CREATE SCHEMA IF NOT EXISTS core AUTHORIZATION orva_app;
CREATE TABLE IF NOT EXISTS core.organizations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 name varchar(160) NOT NULL,
 slug varchar(100) NOT NULL UNIQUE,
 status varchar(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended')),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS core.users (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 email varchar(254) NOT NULL UNIQUE,
 full_name varchar(160) NOT NULL,
 password_hash text NOT NULL,
 status varchar(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active','disabled')),
 is_platform_owner boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS core.memberships (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL REFERENCES core.users(id) ON DELETE CASCADE,
 organization_id uuid NOT NULL REFERENCES core.organizations(id) ON DELETE CASCADE,
 role varchar(40) NOT NULL DEFAULT 'member',
 status varchar(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active','disabled')),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(user_id, organization_id)
);
CREATE TABLE IF NOT EXISTS core.modules (
 module_key varchar(80) PRIMARY KEY,
 name varchar(120) NOT NULL,
 description varchar(255) NOT NULL DEFAULT '',
 route varchar(160) NOT NULL,
 status varchar(20) NOT NULL DEFAULT 'available' CHECK (status IN ('available','coming_soon','disabled')),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS core.organization_modules (
 organization_id uuid NOT NULL REFERENCES core.organizations(id) ON DELETE CASCADE,
 module_key varchar(80) NOT NULL REFERENCES core.modules(module_key),
 enabled boolean NOT NULL DEFAULT true,
 granted_by uuid REFERENCES core.users(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(organization_id,module_key)
);
CREATE TABLE IF NOT EXISTS core.user_module_access (
 user_id uuid NOT NULL REFERENCES core.users(id) ON DELETE CASCADE,
 organization_id uuid NOT NULL REFERENCES core.organizations(id) ON DELETE CASCADE,
 module_key varchar(80) NOT NULL REFERENCES core.modules(module_key),
 can_access boolean NOT NULL DEFAULT true,
 granted_by uuid REFERENCES core.users(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(user_id,organization_id,module_key)
);
INSERT INTO core.modules(module_key,name,description,route,status) VALUES
 ('crm','CRM','Customers, leads & opportunities','/crm','available'),
 ('sales','Sales','Quotations, orders & invoicing','/sales','coming_soon'),
 ('service','Service','Customer support & field service','/service','coming_soon'),
 ('subscriptions','Subscriptions & Rental','Recurring services & rental','/subscriptions','coming_soon'),
 ('finance','Finance','Accounting, payments & budgets','/finance','coming_soon'),
 ('procurement','Procurement','Purchasing & supplier management','/procurement','coming_soon'),
 ('inventory','Inventory','Products, stock & warehouse','/inventory','coming_soon'),
 ('fleet','Fleet Management','Vehicles & fleet operations','/fleet','coming_soon'),
 ('manufacturing','Manufacturing','Production, BOM & MRP','/manufacturing','coming_soon'),
 ('quality','Quality Management','Inspections & quality control','/quality','coming_soon'),
 ('assets','Asset Management','Assets, equipment & maintenance','/assets','coming_soon'),
 ('projects','Projects','Projects, tasks & timesheets','/projects','coming_soon'),
 ('hr','Human Resources','Employees, attendance & payroll','/hr','coming_soon'),
 ('marketing','Marketing','Campaigns, website & commerce','/marketing','coming_soon'),
 ('documents','Documents & Collaboration','Documents, approvals & teamwork','/documents','coming_soon'),
 ('analytics','Analytics','Dashboards, reports & forecasting','/analytics','coming_soon'),
 ('administration','Administration','Platform settings & access control','/administration','coming_soon')
ON CONFLICT(module_key) DO UPDATE SET name=EXCLUDED.name,description=EXCLUDED.description,route=EXCLUDED.route;
COMMIT;
