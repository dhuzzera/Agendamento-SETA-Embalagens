-- =====================================================================
-- Combined Supabase Migrations
-- Generated from 19 migration files in chronological order
-- =====================================================================

-- =============================================================================
-- Migration: 20260511160958_27dd8ea5-987e-4406-937d-8f30235881bb.sql
-- =============================================================================

-- ============ ENUMS ============
CREATE TYPE public.app_role AS ENUM ('admin', 'representative');
CREATE TYPE public.appointment_status AS ENUM ('scheduled', 'completed', 'cancelled', 'rescheduled');

-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  avatar_url TEXT,
  slug TEXT UNIQUE,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============ USER ROLES ============
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

-- Security definer function para checar role sem recursão
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- ============ AVAILABILITIES (recorrência semanal) ============
CREATE TABLE public.availabilities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  representative_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  weekday SMALLINT NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  meeting_duration_min INTEGER NOT NULL DEFAULT 30,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============ BLOCKS (bloqueios pontuais) ============
CREATE TABLE public.blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  representative_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  block_date DATE NOT NULL,
  start_time TIME,
  end_time TIME,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============ CLIENTS (sem login) ============
CREATE TABLE public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  company TEXT,
  phone TEXT,
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============ APPOINTMENTS ============
CREATE TABLE public.appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  representative_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  appointment_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  status public.appointment_status NOT NULL DEFAULT 'scheduled',
  notes TEXT,
  internal_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índice único: impede dupla marcação no mesmo horário do mesmo representante
CREATE UNIQUE INDEX uniq_appointment_slot
  ON public.appointments(representative_id, appointment_date, start_time)
  WHERE status = 'scheduled';

CREATE INDEX idx_appointments_rep_date ON public.appointments(representative_id, appointment_date);
CREATE INDEX idx_blocks_rep_date ON public.blocks(representative_id, block_date);

-- ============ TRIGGERS ============
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_appointments_updated BEFORE UPDATE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Trigger para auto-criar profile no signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, phone)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.email,
    NEW.raw_user_meta_data->>'phone'
  );
  -- Default role: representative
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'representative');
  RETURN NEW;
END $$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ RLS ============
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.availabilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

-- profiles
CREATE POLICY "profiles_self_select" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "profiles_public_by_slug" ON public.profiles FOR SELECT TO anon, authenticated
  USING (slug IS NOT NULL AND active = true);
CREATE POLICY "profiles_self_update" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "profiles_admin_insert" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR id = auth.uid());
CREATE POLICY "profiles_admin_delete" ON public.profiles FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- user_roles
CREATE POLICY "roles_self_select" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "roles_admin_all" ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- availabilities
CREATE POLICY "avail_public_read" ON public.availabilities FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "avail_owner_write" ON public.availabilities FOR ALL TO authenticated
  USING (representative_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (representative_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- blocks
CREATE POLICY "blocks_public_read" ON public.blocks FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "blocks_owner_write" ON public.blocks FOR ALL TO authenticated
  USING (representative_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (representative_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- clients - público pode inserir (booking), representantes/admins leem
CREATE POLICY "clients_insert_public" ON public.clients FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "clients_read_auth" ON public.clients FOR SELECT TO authenticated USING (true);

-- appointments
CREATE POLICY "appt_public_insert" ON public.appointments FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "appt_owner_select" ON public.appointments FOR SELECT TO authenticated
  USING (representative_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "appt_owner_update" ON public.appointments FOR UPDATE TO authenticated
  USING (representative_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "appt_owner_delete" ON public.appointments FOR DELETE TO authenticated
  USING (representative_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));


-- =============================================================================
-- Migration: 20260511161031_6fe3b0a9-f875-455a-808c-34c3d1c9733f.sql
-- =============================================================================

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


-- =============================================================================
-- Migration: 20260511161054_c3996d27-8b2a-4d88-ad1e-b0cb7e5ecf73.sql
-- =============================================================================

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- =============================================================================
-- Migration: 20260511164653_ed37a70c-a07a-4f2b-8089-d16b5b7135da.sql
-- =============================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS calendar_token uuid NOT NULL DEFAULT gen_random_uuid();

CREATE UNIQUE INDEX IF NOT EXISTS profiles_calendar_token_key
  ON public.profiles (calendar_token);


-- =============================================================================
-- Migration: 20260511170233_3b520036-45b1-41d8-b305-aaee529fc1b3.sql
-- =============================================================================

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


-- =============================================================================
-- Migration: 20260511170253_3311e6d6-f67b-41a8-985b-d5371ed894ad.sql
-- =============================================================================

REVOKE ALL ON FUNCTION public.validate_availability_change() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.validate_block_change() FROM PUBLIC, anon, authenticated;


-- =============================================================================
-- Migration: 20260511170456_bbf142a5-af02-41b5-be78-892a664b4c46.sql
-- =============================================================================

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


-- =============================================================================
-- Migration: 20260511171019_d7ade431-7fbc-4207-a5d2-27077aa5b2c3.sql
-- =============================================================================

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT false;

-- =============================================================================
-- Migration: 20260511172954_d8801df6-3e02-454b-8cb0-87e2037e06ee.sql
-- =============================================================================

-- Performance indexes. All IF NOT EXISTS so it is safe to re-run.

-- appointments: filtrado por representante + data, e por data + status em counts
CREATE INDEX IF NOT EXISTS idx_appointments_rep_date
  ON public.appointments (representative_id, appointment_date);

CREATE INDEX IF NOT EXISTS idx_appointments_date_status
  ON public.appointments (appointment_date, status);

CREATE INDEX IF NOT EXISTS idx_appointments_client
  ON public.appointments (client_id);

-- availabilities: lookups públicos por representante + slot ativo
CREATE INDEX IF NOT EXISTS idx_availabilities_rep_active
  ON public.availabilities (representative_id, active);

-- blocks: filtrados por representante + data
CREATE INDEX IF NOT EXISTS idx_blocks_rep_date
  ON public.blocks (representative_id, block_date);

-- user_roles: lookups por user_id (toda checagem has_role passa por aqui)
CREATE INDEX IF NOT EXISTS idx_user_roles_user
  ON public.user_roles (user_id);

-- profiles: tela pública carrega por slug (ativos apenas)
CREATE INDEX IF NOT EXISTS idx_profiles_slug_active
  ON public.profiles (slug)
  WHERE slug IS NOT NULL AND active = true;

-- availability_changes: log lido por representante + ordem cronológica
CREATE INDEX IF NOT EXISTS idx_availability_changes_rep_created
  ON public.availability_changes (representative_id, created_at DESC);


-- =============================================================================
-- Migration: 20260511173256_c217297d-8081-46a2-8137-9b39668adaee.sql
-- =============================================================================

CREATE TABLE public.performance_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  route text NOT NULL,
  metric_name text NOT NULL,
  value double precision NOT NULL,
  rating text,
  navigation_type text,
  user_id uuid,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_perf_route_metric_created ON public.performance_metrics (route, metric_name, created_at DESC);
CREATE INDEX idx_perf_created ON public.performance_metrics (created_at DESC);

ALTER TABLE public.performance_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone can insert performance metrics"
  ON public.performance_metrics FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "admins can read performance metrics"
  ON public.performance_metrics FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));


-- =============================================================================
-- Migration: 20260511184216_61884ede-3af3-425a-808f-4fb9abfb7a3f.sql
-- =============================================================================

-- 1) Add bio column to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS bio text;

-- 2) Create public avatars bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- 3) Storage policies for avatars bucket
DROP POLICY IF EXISTS "Avatars are publicly readable" ON storage.objects;
CREATE POLICY "Avatars are publicly readable"
ON storage.objects
FOR SELECT
USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Users can upload their own avatar" ON storage.objects;
CREATE POLICY "Users can upload their own avatar"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "Users can update their own avatar" ON storage.objects;
CREATE POLICY "Users can update their own avatar"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'avatars'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "Users can delete their own avatar" ON storage.objects;
CREATE POLICY "Users can delete their own avatar"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'avatars'
  AND auth.uid()::text = (storage.foldername(name))[1]
);


-- =============================================================================
-- Migration: 20260511195230_0b0db1a8-4d69-4692-97c9-e845424ccc29.sql
-- =============================================================================

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS meeting_type text NOT NULL DEFAULT 'online',
  ADD COLUMN IF NOT EXISTS location text;

ALTER TABLE public.appointments
  DROP CONSTRAINT IF EXISTS appointments_meeting_type_check;

ALTER TABLE public.appointments
  ADD CONSTRAINT appointments_meeting_type_check
  CHECK (meeting_type IN ('online','presencial'));


-- =============================================================================
-- Migration: 20260511203121_7d47fd63-4c79-487c-ae57-40c505ad4921.sql
-- =============================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS allow_online boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS allow_presencial boolean NOT NULL DEFAULT true;

CREATE OR REPLACE FUNCTION public.validate_profile_meeting_modes()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.allow_online = false AND NEW.allow_presencial = false THEN
    RAISE EXCEPTION 'Pelo menos uma modalidade (online ou presencial) deve estar ativa.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_validate_meeting_modes ON public.profiles;
CREATE TRIGGER profiles_validate_meeting_modes
BEFORE INSERT OR UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.validate_profile_meeting_modes();


-- =============================================================================
-- Migration: 20260512103438_d828b334-b009-4bec-8009-6aa4e576e0e0.sql
-- =============================================================================

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


-- =============================================================================
-- Migration: 20260512104132_45966476-9267-4187-9d42-dffbaf686d94.sql
-- =============================================================================

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS latitude double precision,
  ADD COLUMN IF NOT EXISTS longitude double precision;


-- =============================================================================
-- Migration: 20260512114126_aa1f9a0a-72c7-4b8f-b5fe-f9d4303bff7f.sql
-- =============================================================================

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


-- =============================================================================
-- Migration: 20260512122739_be155efc-1026-48a7-afa2-594009b076f1.sql
-- =============================================================================

DROP POLICY IF EXISTS app_settings_admin_update ON public.app_settings;
CREATE POLICY app_settings_auth_update ON public.app_settings
  FOR UPDATE TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- =============================================================================
-- Migration: 20260512123338_9c6cd30a-3dc2-44a4-b417-b6b03173ab3d.sql
-- =============================================================================

ALTER TABLE public.appointments REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.appointments;

-- =============================================================================
-- Migration: 20260512131609_7f1014bb-dce9-4f25-8b53-e017410db734.sql
-- =============================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS cep TEXT,
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS address_number TEXT,
  ADD COLUMN IF NOT EXISTS address_complement TEXT,
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS state TEXT;
