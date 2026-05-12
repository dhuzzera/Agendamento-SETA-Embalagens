
-- 1) Add city/state to appointments
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS state text;

-- 2) App settings (singleton row id=1)
CREATE TABLE IF NOT EXISTS public.app_settings (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  travel_buffer_minutes integer NOT NULL DEFAULT 180,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.app_settings (id, travel_buffer_minutes)
VALUES (1, 180)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS app_settings_read ON public.app_settings;
CREATE POLICY app_settings_read ON public.app_settings
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS app_settings_admin_update ON public.app_settings;
CREATE POLICY app_settings_admin_update ON public.app_settings
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE OR REPLACE FUNCTION public.touch_app_settings()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS trg_touch_app_settings ON public.app_settings;
CREATE TRIGGER trg_touch_app_settings
  BEFORE UPDATE ON public.app_settings
  FOR EACH ROW EXECUTE FUNCTION public.touch_app_settings();

-- 3) Update validate_appointment to enforce region + travel buffer
CREATE OR REPLACE FUNCTION public.validate_appointment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  rep_active BOOLEAN;
  has_avail BOOLEAN;
  is_blocked BOOLEAN;
  has_conflict BOOLEAN;
  buffer_min INT;
  region_row RECORD;
  travel_conflict RECORD;
  buffer_interval INTERVAL;
BEGIN
  SELECT active INTO rep_active FROM public.profiles WHERE id = NEW.representative_id;
  IF rep_active IS NOT TRUE THEN
    RAISE EXCEPTION 'Representante indisponível';
  END IF;

  IF (NEW.appointment_date + NEW.start_time) < now() THEN
    RAISE EXCEPTION 'Não é possível agendar horários passados';
  END IF;

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

  SELECT EXISTS (
    SELECT 1 FROM public.appointments ap
    WHERE ap.representative_id = NEW.representative_id
      AND ap.appointment_date = NEW.appointment_date
      AND ap.status IN ('scheduled', 'rescheduled')
      AND (NEW.id IS NULL OR ap.id <> NEW.id)
      AND NEW.start_time < ap.end_time
      AND NEW.end_time > ap.start_time
  ) INTO has_conflict;
  IF has_conflict THEN
    RAISE EXCEPTION 'Horário já reservado';
  END IF;

  -- Presencial-only rules: required fields, region lock, travel buffer
  IF NEW.meeting_type = 'presencial' THEN
    IF NEW.city IS NULL OR btrim(NEW.city) = ''
       OR NEW.state IS NULL OR btrim(NEW.state) = ''
       OR NEW.location IS NULL OR btrim(NEW.location) = '' THEN
      RAISE EXCEPTION 'Reuniões presenciais exigem cidade, estado (UF) e endereço.';
    END IF;

    -- Region lock: same city/UF as the first presencial of the day
    SELECT ap.city, ap.state INTO region_row
    FROM public.appointments ap
    WHERE ap.representative_id = NEW.representative_id
      AND ap.appointment_date = NEW.appointment_date
      AND ap.meeting_type = 'presencial'
      AND ap.status IN ('scheduled', 'rescheduled')
      AND (NEW.id IS NULL OR ap.id <> NEW.id)
    ORDER BY ap.start_time ASC
    LIMIT 1;

    IF region_row.city IS NOT NULL THEN
      IF lower(btrim(region_row.city)) <> lower(btrim(NEW.city))
         OR lower(btrim(region_row.state)) <> lower(btrim(NEW.state)) THEN
        RAISE EXCEPTION 'Agenda de % bloqueada para % - %.',
          to_char(NEW.appointment_date, 'DD/MM/YYYY'),
          region_row.city,
          upper(region_row.state);
      END IF;
    END IF;

    -- Travel buffer: enforce N minutes between presenciais
    SELECT travel_buffer_minutes INTO buffer_min FROM public.app_settings WHERE id = 1;
    IF buffer_min IS NULL THEN buffer_min := 180; END IF;
    buffer_interval := make_interval(mins => buffer_min);

    SELECT ap.start_time, ap.end_time INTO travel_conflict
    FROM public.appointments ap
    WHERE ap.representative_id = NEW.representative_id
      AND ap.appointment_date = NEW.appointment_date
      AND ap.meeting_type = 'presencial'
      AND ap.status IN ('scheduled', 'rescheduled')
      AND (NEW.id IS NULL OR ap.id <> NEW.id)
      AND (NEW.appointment_date + NEW.start_time) < (NEW.appointment_date + ap.end_time + buffer_interval)
      AND (NEW.appointment_date + NEW.end_time + buffer_interval) > (NEW.appointment_date + ap.start_time)
    LIMIT 1;

    IF travel_conflict.start_time IS NOT NULL THEN
      RAISE EXCEPTION 'Conflito de deslocamento: existe outra visita presencial às % e é necessário um intervalo de % minutos entre visitas.',
        to_char(travel_conflict.start_time, 'HH24:MI'),
        buffer_min;
    END IF;
  END IF;

  RETURN NEW;
END $function$;
