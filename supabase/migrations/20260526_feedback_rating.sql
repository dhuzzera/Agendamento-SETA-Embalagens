-- Adiciona coluna de avaliação do cliente ao agendamento
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS feedback_rating smallint CHECK (feedback_rating BETWEEN 1 AND 5);

-- Índice para consultas de métricas
CREATE INDEX IF NOT EXISTS idx_appointments_feedback
  ON public.appointments (feedback_rating)
  WHERE feedback_rating IS NOT NULL;
