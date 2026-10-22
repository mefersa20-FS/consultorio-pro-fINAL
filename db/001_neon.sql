-- Application data is isolated from the managed neon_auth schema.
CREATE TABLE IF NOT EXISTS public.clinical_documents (
  owner_id text NOT NULL,
  resource text NOT NULL CHECK (resource IN ('patients','clinical_records','appointments','therapy_sessions','profiles')),
  id text NOT NULL,
  data jsonb NOT NULL CHECK (jsonb_typeof(data) = 'object'),
  parent_resource text GENERATED ALWAYS AS (CASE WHEN resource IN ('clinical_records','appointments','therapy_sessions') THEN 'patients' END) STORED,
  patient_id text GENERATED ALWAYS AS (CASE WHEN resource IN ('clinical_records','appointments','therapy_sessions') THEN data->>'patient_id' END) STORED,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (owner_id, resource, id),
  FOREIGN KEY (owner_id, parent_resource, patient_id) REFERENCES public.clinical_documents(owner_id, resource, id) ON DELETE CASCADE,
  CHECK (parent_resource IS NULL OR patient_id IS NOT NULL),
  CHECK (resource <> 'clinical_records' OR length(data->>'form_type') > 0)
);
CREATE UNIQUE INDEX IF NOT EXISTS clinical_documents_form ON public.clinical_documents(owner_id, patient_id, (data->>'form_type')) WHERE resource = 'clinical_records';
CREATE INDEX IF NOT EXISTS clinical_documents_patient ON public.clinical_documents(owner_id, resource, patient_id);
ALTER TABLE public.clinical_documents ENABLE ROW LEVEL SECURITY;
-- No browser/Data API grants. Only server handlers use the privileged connection;
-- each statement must additionally constrain owner_id from a verified JWT.
REVOKE ALL ON public.clinical_documents FROM PUBLIC;
