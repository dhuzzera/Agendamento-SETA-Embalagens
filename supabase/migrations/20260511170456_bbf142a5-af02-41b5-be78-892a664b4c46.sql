-- Audit log for availability changes
CREATE TABLE public.availability_changes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  representative_id UUID NOT NULL,
  availability_id UUID,
  action TEXT NOT NULL CHECK (action IN ('created','updated','deleted')),
  old_values JSONB,
  new_values JSONB,
  affected_appointment_ids UUID[] NOT NULL DEFAULT '{}',
  changed_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_avail_changes_rep_date
  ON public.availability_changes (representative_id, created_at DESC);

ALTER TABLE public.availability_changes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "avail_changes_owner_read"
  ON public.availability_changes
  FOR SELECT TO authenticated
  USING (representative_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- Trigger: log every change and snapshot the affected confirmed appointments
CREATE OR REPLACE FUNCTION public.log_availability_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rep_id UUID;
  av_id UUID;
  act TEXT;
  old_j JSONB;
  new_j JSONB;
  weekday SMALLINT;
  s_time TIME;
  e_time TIME;
  affected UUID[];
BEGIN
  IF TG_OP = 'INSERT' THEN
    act := 'created';
    rep_id := NEW.representative_id;
    av_id := NEW.id;
    new_j := to_jsonb(NEW);
    weekday := NEW.weekday;
    s_time := NEW.start_time;
    e_time := NEW.end_time;
  ELSIF TG_OP = 'UPDATE' THEN
    act := 'updated';
    rep_id := NEW.representative_id;
    av_id := NEW.id;
    old_j := to_jsonb(OLD);
    new_j := to_jsonb(NEW);
    weekday := OLD.weekday;
    s_time := LEAST(OLD.start_time, NEW.start_time);
    e_time := GREATEST(OLD.end_time, NEW.end_time);
  ELSE
    act := 'deleted';
    rep_id := OLD.representative_id;
    av_id := OLD.id;
    old_j := to_jsonb(OLD);
    weekday := OLD.weekday;
    s_time := OLD.start_time;
    e_time := OLD.end_time;
  END IF;

  -- Confirmed future appointments that fell inside the affected slot
  SELECT COALESCE(array_agg(ap.id), '{}')
  INTO affected
  FROM public.appointments ap
  WHERE ap.representative_id = rep_id
    AND ap.status IN ('scheduled', 'rescheduled')
    AND (ap.appointment_date + ap.start_time) >= now()
    AND EXTRACT(DOW FROM ap.appointment_date)::SMALLINT = weekday
    AND ap.start_time < e_time
    AND ap.end_time > s_time;

  INSERT INTO public.availability_changes (
    representative_id, availability_id, action,
    old_values, new_values, affected_appointment_ids, changed_by
  ) VALUES (
    rep_id, av_id, act, old_j, new_j, affected, auth.uid()
  );

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.log_availability_change() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_log_availability_change
AFTER INSERT OR UPDATE OR DELETE ON public.availabilities
FOR EACH ROW EXECUTE FUNCTION public.log_availability_change();
