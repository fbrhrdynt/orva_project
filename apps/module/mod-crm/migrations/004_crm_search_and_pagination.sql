BEGIN;
ALTER TABLE crm.records
  ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (to_tsvector('simple', coalesce(data::text,''))) STORED;
CREATE INDEX IF NOT EXISTS crm_records_search_vector_idx ON crm.records USING GIN(search_vector);
CREATE INDEX IF NOT EXISTS crm_records_org_type_updated_idx ON crm.records(organization_id,record_type,updated_at DESC,id);
COMMIT;
