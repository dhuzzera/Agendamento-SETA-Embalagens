-- Validate availability changes: no future scheduled appointment may be left
-- without coverage by an active availability after UPDATE/DELETE/INSERT.
CREATE OR REPLACE FUNCTION public.validate_availability_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rep_id UUID;
  conflict_count INT;
BEGIN
  IF TG_OP = 'DELETE' THEN
    rep_id := OLD.representative_id;
  ELSE
    rep_id := NEW.representative_id;
  END IF;

  -- Find any future scheduled/rescheduled appointment for this rep that is
  -- NOT covered by any currently-active availability (post-change state).
  SELECT COUNT(*) INTO conflict_count
  FROM public.appointments ap
  WHERE ap.representative_id = rep_id
    AND ap.status IN ('scheduled', 'rescheduled')
    AND (ap.appointment_date + ap.start_time) >= now()
    AND NOT EXISTS (
      SELECT 1 FROM public.availabilities a
      WHERE a.representative_id = rep_id
        AND a.active = true
        AND a.weekday = EXTRACT(DOW FROM ap.appointment_date)::SMALLINT
        AND a.start_time <= ap.start_time
        AND a.end_time >= ap.end_time
        -- Exclude the row being deleted/updated from the post-change state
        AND (TG_OP = 'INSERT' OR a.id <> COALESCE(OLD.id, NEW.id) OR TG_OP = 'UPDATE' AND a.id = NEW.id)
    );

  IF conflict_count > 0 THEN
    RAISE EXCEPTION 'Não é possível alterar: % agendamento(s) confirmado(s) ficariam sem horário disponível. Cancele ou remarque antes.', conflict_count;
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_availability_change ON public.availabilities;
CREATE TRIGGER trg_validate_availability_change
AFTER INSERT OR UPDATE OR DELETE ON public.availabilities
FOR EACH ROW EXECUTE FUNCTION public.validate_availability_change();

-- Validate blocks: a new/updated block cannot overlap an existing confirmed appointment.
CREATE OR REPLACE FUNCTION public.validate_block_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  conflict_count INT;
BEGIN
  SELECT COUNT(*) INTO conflict_count
  FROM public.appointments ap
  WHERE ap.representative_id = NEW.representative_id
    AND ap.status IN ('scheduled', 'rescheduled')
    AND ap.appointment_date = NEW.block_date
    AND (
      (NEW.start_time IS NULL AND NEW.end_time IS NULL)
      OR (ap.start_time < NEW.end_time AND ap.end_time > NEW.start_time)
    );

  IF conflict_count > 0 THEN
    RAISE EXCEPTION 'Não é possível bloquear: % agendamento(s) confirmado(s) neste período. Cancele ou remarque antes.', conflict_count;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_block_change ON public.blocks;
CREATE TRIGGER trg_validate_block_change
BEFORE INSERT OR UPDATE ON public.blocks
FOR EACH ROW EXECUTE FUNCTION public.validate_block_change();
