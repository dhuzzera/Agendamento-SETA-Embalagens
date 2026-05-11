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
