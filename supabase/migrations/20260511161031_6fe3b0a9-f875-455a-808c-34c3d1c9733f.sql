
-- Restrict has_role execution
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;

-- Validation trigger for appointments: ensures slot is free, within availability, not blocked, not in past
CREATE OR REPLACE FUNCTION public.validate_appointment()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  rep_active BOOLEAN;
  has_avail BOOLEAN;
  is_blocked BOOLEAN;
  has_conflict BOOLEAN;
BEGIN
  -- Rep must exist and be active
  SELECT active INTO rep_active FROM public.profiles WHERE id = NEW.representative_id;
  IF rep_active IS NOT TRUE THEN
    RAISE EXCEPTION 'Representante indisponível';
  END IF;

  -- Past dates rejected
  IF (NEW.appointment_date + NEW.start_time) < now() THEN
    RAISE EXCEPTION 'Não é possível agendar horários passados';
  END IF;

  -- Within availability
  SELECT EXISTS (
    SELECT 1 FROM public.availabilities a
    WHERE a.representative_id = NEW.representative_id
      AND a.active = true
      AND a.weekday = EXTRACT(DOW FROM NEW.appointment_date)::SMALLINT
      AND a.start_time <= NEW.start_time
      AND a.end_time >= NEW.end_time
  ) INTO has_avail;
  IF NOT has_avail THEN
    RAISE EXCEPTION 'Horário fora da disponibilidade do representante';
  END IF;

  -- Not blocked
  SELECT EXISTS (
    SELECT 1 FROM public.blocks b
    WHERE b.representative_id = NEW.representative_id
      AND b.block_date = NEW.appointment_date
      AND (
        (b.start_time IS NULL AND b.end_time IS NULL)
        OR (NEW.start_time < b.end_time AND NEW.end_time > b.start_time)
      )
  ) INTO is_blocked;
  IF is_blocked THEN
    RAISE EXCEPTION 'Horário bloqueado pelo representante';
  END IF;

  -- Conflict with existing scheduled appointment
  SELECT EXISTS (
    SELECT 1 FROM public.appointments ap
    WHERE ap.representative_id = NEW.representative_id
      AND ap.appointment_date = NEW.appointment_date
      AND ap.status = 'scheduled'
      AND (NEW.id IS NULL OR ap.id <> NEW.id)
      AND NEW.start_time < ap.end_time
      AND NEW.end_time > ap.start_time
  ) INTO has_conflict;
  IF has_conflict THEN
    RAISE EXCEPTION 'Horário já reservado';
  END IF;

  RETURN NEW;
END $$;

REVOKE EXECUTE ON FUNCTION public.validate_appointment() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_validate_appointment
  BEFORE INSERT OR UPDATE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.validate_appointment();

-- handle_new_user search_path already set; ensure set_updated_at also has search_path
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;
