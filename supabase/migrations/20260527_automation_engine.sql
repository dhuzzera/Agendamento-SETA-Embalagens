-- ============ Automation Engine: Registros de execução ============
CREATE TABLE IF NOT EXISTS public.automation_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id UUID NOT NULL REFERENCES public.automations(id) ON DELETE CASCADE,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  deal_id UUID REFERENCES public.deals(id) ON DELETE SET NULL,
  node_id TEXT, -- ID do nó no fluxo que foi executado
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('completed', 'failed', 'waiting')),
  result TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_automation_runs_automation ON public.automation_runs (automation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_automation_runs_client ON public.automation_runs (client_id, automation_id);

ALTER TABLE public.automation_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "automation_runs_admin" ON public.automation_runs FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Coluna para rastrear último processamento de cada automação
ALTER TABLE public.automations
  ADD COLUMN IF NOT EXISTS last_run_at TIMESTAMPTZ;

-- Extensão pg_cron (se disponível no plano)
-- CREATE EXTENSION IF NOT EXISTS pg_cron;
-- SELECT cron.schedule('run-automations', '*/15 * * * *', $$SELECT net.http_post('https://hzostqsltvqmheqxahdk.supabase.co/functions/v1/run-automations', '{}', '{"Authorization": "Bearer SERVICE_ROLE_KEY"}')$$);
