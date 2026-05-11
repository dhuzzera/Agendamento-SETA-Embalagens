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
