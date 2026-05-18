-- Tabela de auditoria geral para ações administrativas
CREATE TABLE IF NOT EXISTS public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_log_user ON public.audit_log (user_id, created_at DESC);
CREATE INDEX idx_audit_log_entity ON public.audit_log (entity_type, entity_id);
CREATE INDEX idx_audit_log_created ON public.audit_log (created_at DESC);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Apenas admins podem ler os logs
CREATE POLICY "audit_log_admin_read" ON public.audit_log
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Qualquer autenticado pode inserir (o sistema registra ações)
CREATE POLICY "audit_log_insert" ON public.audit_log
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- Trigger automático: registra alterações em appointments
CREATE OR REPLACE FUNCTION public.log_appointment_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    INSERT INTO public.audit_log (user_id, action, entity_type, entity_id, details)
    VALUES (
      auth.uid(),
      'appointment_updated',
      'appointment',
      NEW.id::text,
      jsonb_build_object(
        'old_status', OLD.status,
        'new_status', NEW.status,
        'old_date', OLD.appointment_date,
        'new_date', NEW.appointment_date
      )
    );
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_audit_appointment ON public.appointments;
CREATE TRIGGER trg_audit_appointment
  AFTER UPDATE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.log_appointment_change();
