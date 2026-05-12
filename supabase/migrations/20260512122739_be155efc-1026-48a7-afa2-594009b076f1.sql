DROP POLICY IF EXISTS app_settings_admin_update ON public.app_settings;
CREATE POLICY app_settings_auth_update ON public.app_settings
  FOR UPDATE TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);