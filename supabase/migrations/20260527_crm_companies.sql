-- ============ CRM: Empresas ============
CREATE TABLE IF NOT EXISTS public.companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  segment TEXT,
  cnpj TEXT,
  url TEXT,
  description TEXT,
  city TEXT,
  state TEXT,
  phone TEXT,
  email TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_companies_name ON public.companies (name);
CREATE INDEX IF NOT EXISTS idx_companies_created_by ON public.companies (created_by);

CREATE TRIGGER trg_companies_updated BEFORE UPDATE ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "companies_read" ON public.companies
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "companies_insert" ON public.companies
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "companies_update" ON public.companies
  FOR UPDATE TO authenticated USING (true);
CREATE POLICY "companies_delete" ON public.companies
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Vincular clients a companies (opcional)
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL;

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS cargo TEXT;

-- Vincular deals a companies
ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL;

-- Melhorar deal_activities para tarefas com data/hora e tipo expandido
ALTER TABLE public.deal_activities
  DROP CONSTRAINT IF EXISTS deal_activities_type_check;

ALTER TABLE public.deal_activities
  ADD CONSTRAINT deal_activities_type_check
  CHECK (type IN ('note', 'call', 'email', 'meeting', 'stage_change', 'task', 'visit', 'lunch', 'whatsapp'));

-- Adicionar campos extras para tarefas
ALTER TABLE public.deal_activities
  ADD COLUMN IF NOT EXISTS subject TEXT,
  ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES auth.users(id);

CREATE INDEX IF NOT EXISTS idx_deal_activities_assigned
  ON public.deal_activities (assigned_to, due_date)
  WHERE completed = false;
