ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS meeting_type text NOT NULL DEFAULT 'online',
  ADD COLUMN IF NOT EXISTS location text;

ALTER TABLE public.appointments
  DROP CONSTRAINT IF EXISTS appointments_meeting_type_check;

ALTER TABLE public.appointments
  ADD CONSTRAINT appointments_meeting_type_check
  CHECK (meeting_type IN ('online','presencial'));