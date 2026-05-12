
ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS max_distance_km integer NOT NULL DEFAULT 30;

UPDATE public.app_settings SET max_distance_km = 30 WHERE id = 1 AND max_distance_km IS NULL;

CREATE OR REPLACE FUNCTION public.validate_appointment()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  rep_active BOOLEAN;
  has_avail BOOLEAN;
  is_blocked BOOLEAN;
  has_conflict BOOLEAN;
  buffer_min INT;
  max_km INT;
  first_appt RECORD;
  travel_conflict RECORD;
  buffer_interval INTERVAL;
  dist_km DOUBLE PRECISION;
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

  IF NEW.meeting_type = 'presencial' THEN
    IF NEW.city IS NULL OR btrim(NEW.city) = ''
       OR NEW.state IS NULL OR btrim(NEW.state) = ''
       OR NEW.location IS NULL OR btrim(NEW.location) = '' THEN
      RAISE EXCEPTION 'Reuniões presenciais exigem cidade, estado (UF) e endereço.';
    END IF;

    SELECT travel_buffer_minutes, max_distance_km
      INTO buffer_min, max_km
      FROM public.app_settings WHERE id = 1;
    IF buffer_min IS NULL THEN buffer_min := 180; END IF;
    IF max_km IS NULL THEN max_km := 30; END IF;

    -- First presencial of the day defines region
    SELECT ap.city, ap.state, ap.latitude, ap.longitude, ap.start_time
      INTO first_appt
    FROM public.appointments ap
    WHERE ap.representative_id = NEW.representative_id
      AND ap.appointment_date = NEW.appointment_date
      AND ap.meeting_type = 'presencial'
      AND ap.status IN ('scheduled', 'rescheduled')
      AND (NEW.id IS NULL OR ap.id <> NEW.id)
    ORDER BY ap.start_time ASC
    LIMIT 1;

    IF first_appt.city IS NOT NULL THEN
      -- Prefer distance check when coords available on both sides
      IF first_appt.latitude IS NOT NULL AND first_appt.longitude IS NOT NULL
         AND NEW.latitude IS NOT NULL AND NEW.longitude IS NOT NULL THEN
        dist_km := 6371 * 2 * asin(
          sqrt(
            power(sin(radians((NEW.latitude - first_appt.latitude) / 2)), 2)
            + cos(radians(first_appt.latitude)) * cos(radians(NEW.latitude))
              * power(sin(radians((NEW.longitude - first_appt.longitude) / 2)), 2)
          )
        );
        IF dist_km > max_km THEN
          RAISE EXCEPTION 'Fora do raio de % km da primeira visita do dia (% - %). Distância: % km.',
            max_km,
            first_appt.city,
            upper(first_appt.state),
            round(dist_km::numeric, 1);
        END IF;
      ELSE
        -- Fallback: same city/state when coords missing
        IF lower(btrim(first_appt.city)) <> lower(btrim(NEW.city))
           OR lower(btrim(first_appt.state)) <> lower(btrim(NEW.state)) THEN
          RAISE EXCEPTION 'Agenda de % bloqueada para % - % (sem coordenadas para validar distância).',
            to_char(NEW.appointment_date, 'DD/MM/YYYY'),
            first_appt.city,
            upper(first_appt.state);
        END IF;
      END IF;
    END IF;

    -- Travel buffer
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
