-- ============================================================
-- Integração Agendamento ↔ CRM
-- Quando um appointment é criado/concluído, sincroniza com deals
-- ============================================================

-- Função: ao criar um appointment, cria ou atualiza deal no CRM
CREATE OR REPLACE FUNCTION public.sync_appointment_to_crm()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  existing_deal_id UUID;
  target_stage_id UUID;
  rep_pipeline_id UUID;
  client_company TEXT;
  deal_title TEXT;
BEGIN
  -- Busca o pipeline do representante (owner_id = representative_id)
  SELECT id INTO rep_pipeline_id
  FROM public.pipelines
  WHERE owner_id = NEW.representative_id
  LIMIT 1;

  -- Se não tem pipeline próprio, usa o primeiro disponível
  IF rep_pipeline_id IS NULL THEN
    SELECT id INTO rep_pipeline_id
    FROM public.pipelines
    ORDER BY position
    LIMIT 1;
  END IF;

  IF rep_pipeline_id IS NULL THEN
    RETURN NEW; -- Sem pipeline, não sincroniza
  END IF;

  -- Busca nome da empresa do cliente
  SELECT company INTO client_company
  FROM public.clients
  WHERE id = NEW.client_id;

  -- INSERT: novo agendamento → cria deal se não existe
  IF TG_OP = 'INSERT' THEN
    -- Verifica se já existe deal para este cliente neste pipeline
    SELECT d.id INTO existing_deal_id
    FROM public.deals d
    WHERE d.client_id = NEW.client_id
      AND d.pipeline_id = rep_pipeline_id
      AND d.stage_id NOT IN (
        SELECT ds.id FROM public.deal_stages ds
        WHERE ds.pipeline_id = rep_pipeline_id
          AND (ds.name IN ('Fechados', 'Fechada', 'Venda Fechada', 'Perdidos', 'Perdido', 'Não Aprovada'))
      )
    ORDER BY d.updated_at DESC
    LIMIT 1;

    -- Busca estágio "Reunião Agendada" do pipeline
    SELECT id INTO target_stage_id
    FROM public.deal_stages
    WHERE pipeline_id = rep_pipeline_id
      AND name = 'Reunião Agendada'
    LIMIT 1;

    -- Fallback: primeiro estágio
    IF target_stage_id IS NULL THEN
      SELECT id INTO target_stage_id
      FROM public.deal_stages
      WHERE pipeline_id = rep_pipeline_id
      ORDER BY position
      LIMIT 1;
    END IF;

    IF target_stage_id IS NULL THEN
      RETURN NEW;
    END IF;

    deal_title := COALESCE(client_company, (SELECT name FROM public.clients WHERE id = NEW.client_id));

    IF existing_deal_id IS NOT NULL THEN
      -- Atualiza deal existente para "Reunião Agendada"
      UPDATE public.deals
      SET stage_id = target_stage_id, updated_at = now()
      WHERE id = existing_deal_id;

      -- Registra na timeline
      INSERT INTO public.deal_activities (deal_id, type, description)
      VALUES (existing_deal_id, 'meeting', 'Reunião agendada para ' || to_char(NEW.appointment_date, 'DD/MM/YYYY') || ' às ' || to_char(NEW.start_time, 'HH24:MI'));
    ELSE
      -- Cria novo deal
      INSERT INTO public.deals (title, client_id, representative_id, stage_id, pipeline_id, appointment_id)
      VALUES (
        deal_title || ' — Reunião ' || to_char(NEW.appointment_date, 'DD/MM'),
        NEW.client_id,
        NEW.representative_id,
        target_stage_id,
        rep_pipeline_id,
        NEW.id
      );
    END IF;
  END IF;

  -- UPDATE: reunião concluída → atualiza estágio do deal
  IF TG_OP = 'UPDATE' AND OLD.status <> NEW.status THEN
    -- Busca deal vinculado
    SELECT d.id INTO existing_deal_id
    FROM public.deals d
    WHERE (d.appointment_id = NEW.id OR d.client_id = NEW.client_id)
      AND d.pipeline_id = rep_pipeline_id
    ORDER BY d.updated_at DESC
    LIMIT 1;

    IF existing_deal_id IS NOT NULL THEN
      IF NEW.status = 'completed' AND NEW.meeting_result IS NOT NULL THEN
        -- Venda fechada → estágio Fechados
        IF NEW.meeting_result = 'venda_fechada' THEN
          SELECT id INTO target_stage_id
          FROM public.deal_stages
          WHERE pipeline_id = rep_pipeline_id AND name IN ('Fechados', 'Fechada', 'Venda Fechada')
          LIMIT 1;

          IF target_stage_id IS NOT NULL THEN
            UPDATE public.deals
            SET stage_id = target_stage_id,
                value = COALESCE(NEW.sale_value::numeric, value),
                updated_at = now()
            WHERE id = existing_deal_id;
          END IF;

          INSERT INTO public.deal_activities (deal_id, type, description)
          VALUES (existing_deal_id, 'stage_change', 'Venda fechada! Valor: R$ ' || COALESCE(NEW.sale_value, '0'));

        -- Em negociação → estágio Negociação
        ELSIF NEW.meeting_result = 'em_negociacao' THEN
          SELECT id INTO target_stage_id
          FROM public.deal_stages
          WHERE pipeline_id = rep_pipeline_id AND name = 'Negociação'
          LIMIT 1;

          IF target_stage_id IS NOT NULL THEN
            UPDATE public.deals SET stage_id = target_stage_id, updated_at = now() WHERE id = existing_deal_id;
          END IF;

          INSERT INTO public.deal_activities (deal_id, type, description)
          VALUES (existing_deal_id, 'stage_change', 'Reunião concluída — em negociação');

        -- Proposta reprovada → Perdidos
        ELSIF NEW.meeting_result = 'proposta_reprovada' THEN
          SELECT id INTO target_stage_id
          FROM public.deal_stages
          WHERE pipeline_id = rep_pipeline_id AND name IN ('Perdidos', 'Perdido', 'Não Aprovada')
          LIMIT 1;

          IF target_stage_id IS NOT NULL THEN
            UPDATE public.deals
            SET stage_id = target_stage_id,
                lost_reason = NEW.result_notes,
                updated_at = now()
            WHERE id = existing_deal_id;
          END IF;

          INSERT INTO public.deal_activities (deal_id, type, description)
          VALUES (existing_deal_id, 'stage_change', 'Proposta reprovada: ' || COALESCE(NEW.result_notes, ''));
        END IF;

      ELSIF NEW.status = 'cancelled' THEN
        INSERT INTO public.deal_activities (deal_id, type, description)
        VALUES (existing_deal_id, 'note', 'Reunião cancelada');
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END $$;

-- Trigger: dispara após INSERT ou UPDATE em appointments
DROP TRIGGER IF EXISTS trg_sync_appointment_to_crm ON public.appointments;
CREATE TRIGGER trg_sync_appointment_to_crm
  AFTER INSERT OR UPDATE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.sync_appointment_to_crm();
