-- Adiciona campo de link de reunião online ao perfil do representante
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS meeting_link TEXT;
