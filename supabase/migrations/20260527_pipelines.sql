-- ============ CRM: Pipelines (funis) ============
CREATE TABLE IF NOT EXISTS public.pipelines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  position SMALLINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed dos funis baseados no RD
INSERT INTO public.pipelines (name, position) VALUES
  ('SDR INTERNO - DEBORA', 0),
  ('SDR INTERNO - FRANÇA', 1),
  ('Venda Interna Henrique-SBS', 2),
  ('Venda Interna Francisco-ES', 3),
  ('Pré-Vendas (SDR)', 4)
ON CONFLICT DO NOTHING;

-- Vincular deal_stages a um pipeline
ALTER TABLE public.deal_stages
  ADD COLUMN IF NOT EXISTS pipeline_id UUID REFERENCES public.pipelines(id) ON DELETE CASCADE;

-- Vincular deals a um pipeline
ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS pipeline_id UUID REFERENCES public.pipelines(id) ON DELETE SET NULL;

-- RLS para pipelines
ALTER TABLE public.pipelines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pipelines_read" ON public.pipelines
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "pipelines_admin_write" ON public.pipelines
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Agora vamos criar os estágios para cada funil.
-- Primeiro, pegar os IDs dos pipelines recém-criados e criar estágios.
-- Como não temos variáveis em SQL puro, vamos usar um DO block:

DO $$
DECLARE
  p_sdr_debora UUID;
  p_sdr_franca UUID;
  p_henrique UUID;
  p_francisco UUID;
  p_pre_vendas UUID;
BEGIN
  SELECT id INTO p_sdr_debora FROM public.pipelines WHERE name = 'SDR INTERNO - DEBORA';
  SELECT id INTO p_sdr_franca FROM public.pipelines WHERE name = 'SDR INTERNO - FRANÇA';
  SELECT id INTO p_henrique FROM public.pipelines WHERE name = 'Venda Interna Henrique-SBS';
  SELECT id INTO p_francisco FROM public.pipelines WHERE name = 'Venda Interna Francisco-ES';
  SELECT id INTO p_pre_vendas FROM public.pipelines WHERE name = 'Pré-Vendas (SDR)';

  -- Estágios SDR (Debora e França usam os mesmos)
  INSERT INTO public.deal_stages (name, position, color, pipeline_id) VALUES
    ('Qualificados', 0, '#6366f1', p_sdr_debora),
    ('Em Contato', 1, '#8b5cf6', p_sdr_debora),
    ('Reunião Agendada', 2, '#0ea5e9', p_sdr_debora),
    ('Reunião Realizada', 3, '#f59e0b', p_sdr_debora),
    ('Negociação', 4, '#f97316', p_sdr_debora),
    ('Venda Fechada', 5, '#22c55e', p_sdr_debora),
    ('Perdido', 6, '#ef4444', p_sdr_debora);

  INSERT INTO public.deal_stages (name, position, color, pipeline_id) VALUES
    ('Qualificados', 0, '#6366f1', p_sdr_franca),
    ('Em Contato', 1, '#8b5cf6', p_sdr_franca),
    ('Reunião Agendada', 2, '#0ea5e9', p_sdr_franca),
    ('Reunião Realizada', 3, '#f59e0b', p_sdr_franca),
    ('Negociação', 4, '#f97316', p_sdr_franca),
    ('Venda Fechada', 5, '#22c55e', p_sdr_franca),
    ('Perdido', 6, '#ef4444', p_sdr_franca);

  -- Estágios Venda Interna (Henrique e Francisco usam os mesmos)
  INSERT INTO public.deal_stages (name, position, color, pipeline_id) VALUES
    ('Prospects', 0, '#6366f1', p_henrique),
    ('Tentativa de contato', 1, '#8b5cf6', p_henrique),
    ('Contato feito', 2, '#a855f7', p_henrique),
    ('Reunião Agendada', 3, '#0ea5e9', p_henrique),
    ('Proposta Enviada', 4, '#f59e0b', p_henrique),
    ('Retorno', 5, '#f97316', p_henrique),
    ('Fechada', 6, '#22c55e', p_henrique),
    ('Não Aprovada', 7, '#ef4444', p_henrique);

  INSERT INTO public.deal_stages (name, position, color, pipeline_id) VALUES
    ('Prospects', 0, '#6366f1', p_francisco),
    ('Tentativa de contato', 1, '#8b5cf6', p_francisco),
    ('Contato feito', 2, '#a855f7', p_francisco),
    ('Reunião Agendada', 3, '#0ea5e9', p_francisco),
    ('Proposta Enviada', 4, '#f59e0b', p_francisco),
    ('Retorno', 5, '#f97316', p_francisco),
    ('Fechada', 6, '#22c55e', p_francisco),
    ('Não Aprovada', 7, '#ef4444', p_francisco);

  -- Pré-Vendas
  INSERT INTO public.deal_stages (name, position, color, pipeline_id) VALUES
    ('Lead novo', 0, '#6366f1', p_pre_vendas),
    ('Qualificação', 1, '#8b5cf6', p_pre_vendas),
    ('Contato feito', 2, '#0ea5e9', p_pre_vendas),
    ('Reunião Agendada', 3, '#f59e0b', p_pre_vendas),
    ('Passado para vendas', 4, '#22c55e', p_pre_vendas),
    ('Descartado', 5, '#ef4444', p_pre_vendas);

  -- Vincular os estágios antigos (sem pipeline) ao primeiro pipeline como fallback
  UPDATE public.deal_stages SET pipeline_id = p_sdr_debora WHERE pipeline_id IS NULL;

  -- Vincular deals antigos ao primeiro pipeline
  UPDATE public.deals SET pipeline_id = p_sdr_debora WHERE pipeline_id IS NULL;
END $$;
