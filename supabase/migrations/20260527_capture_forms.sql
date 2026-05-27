-- ============ MARKETING: Formulários de captura ============
CREATE TABLE IF NOT EXISTS public.capture_forms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  fields JSONB NOT NULL DEFAULT '[{"name":"name","label":"Nome","type":"text","required":true},{"name":"email","label":"E-mail","type":"email","required":true}]',
  redirect_url TEXT,
  list_id UUID REFERENCES public.contact_lists(id) ON DELETE SET NULL,
  pipeline_id UUID REFERENCES public.pipelines(id) ON DELETE SET NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  submissions INT NOT NULL DEFAULT 0,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.capture_forms ENABLE ROW LEVEL SECURITY;

-- Admin pode gerenciar
CREATE POLICY "capture_forms_admin" ON public.capture_forms FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Público pode ler formulários ativos (para renderizar)
CREATE POLICY "capture_forms_public_read" ON public.capture_forms
  FOR SELECT TO anon, authenticated USING (active = true);
