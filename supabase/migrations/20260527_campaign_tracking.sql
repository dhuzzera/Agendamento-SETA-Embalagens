-- Função para incrementar contadores de campanha
CREATE OR REPLACE FUNCTION public.increment_campaign_counter(p_campaign_id UUID, p_field TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_field = 'total_sent' THEN
    UPDATE public.campaigns SET total_sent = total_sent + 1 WHERE id = p_campaign_id;
  ELSIF p_field = 'total_opened' THEN
    UPDATE public.campaigns SET total_opened = total_opened + 1 WHERE id = p_campaign_id;
  ELSIF p_field = 'total_clicked' THEN
    UPDATE public.campaigns SET total_clicked = total_clicked + 1 WHERE id = p_campaign_id;
  END IF;
END $$;

-- Função para incrementar lead score por email
CREATE OR REPLACE FUNCTION public.increment_lead_score(p_email TEXT, p_points INT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.clients SET lead_score = lead_score + p_points WHERE email = p_email;
END $$;
