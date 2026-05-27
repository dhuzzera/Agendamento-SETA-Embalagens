-- ============ CRM: Estágios do funil ============
CREATE TABLE IF NOT EXISTS public.deal_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  position SMALLINT NOT NULL DEFAULT 0,
  color TEXT NOT NULL DEFAULT '#6b7280',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed dos estágios padrão
INSERT INTO public.deal_stages (name, position, color) VALUES
  ('Lead novo', 0, '#6366f1'),
  ('Contato feito', 1, '#8b5cf6'),
  ('Reunião agendada', 2, '#0ea5e9'),
  ('Proposta enviada', 3, '#f59e0b'),
  ('Negociação', 4, '#f97316'),
  ('Venda fechada', 5, '#22c55e'),
  ('Perdido', 6, '#ef4444')
ON CONFLICT DO NOTHING;

-- ============ CRM: Deals (oportunidades) ============
CREATE TABLE IF NOT EXISTS public.deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  representative_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  stage_id UUID NOT NULL REFERENCES public.deal_stages(id),
  value NUMERIC(12,2),
  expected_close_date DATE,
  notes TEXT,
  lost_reason TEXT,
  appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_deals_rep ON public.deals (representative_id);
CREATE INDEX IF NOT EXISTS idx_deals_stage ON public.deals (stage_id);
CREATE INDEX IF NOT EXISTS idx_deals_client ON public.deals (client_id);

CREATE TRIGGER trg_deals_updated BEFORE UPDATE ON public.deals
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ CRM: Atividades/Timeline ============
CREATE TABLE IF NOT EXISTS public.deal_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  type TEXT NOT NULL CHECK (type IN ('note', 'call', 'email', 'meeting', 'stage_change', 'task')),
  description TEXT NOT NULL,
  metadata JSONB,
  due_date TIMESTAMPTZ,
  completed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_deal_activities_deal ON public.deal_activities (deal_id, created_at DESC);

-- ============ RLS ============
ALTER TABLE public.deal_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deal_activities ENABLE ROW LEVEL SECURITY;

-- deal_stages: todos autenticados podem ler
CREATE POLICY "deal_stages_read" ON public.deal_stages
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "deal_stages_admin_write" ON public.deal_stages
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- deals: representante vê os seus, admin vê todos
CREATE POLICY "deals_select" ON public.deals
  FOR SELECT TO authenticated
  USING (representative_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "deals_insert" ON public.deals
  FOR INSERT TO authenticated
  WITH CHECK (representative_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "deals_update" ON public.deals
  FOR UPDATE TO authenticated
  USING (representative_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "deals_delete" ON public.deals
  FOR DELETE TO authenticated
  USING (representative_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- deal_activities: mesma lógica via deal
CREATE POLICY "deal_activities_select" ON public.deal_activities
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "deal_activities_insert" ON public.deal_activities
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "deal_activities_update" ON public.deal_activities
  FOR UPDATE TO authenticated USING (true);
