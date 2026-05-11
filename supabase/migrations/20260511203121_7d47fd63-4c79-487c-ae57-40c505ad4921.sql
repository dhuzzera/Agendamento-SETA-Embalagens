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