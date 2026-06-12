-- Firm-wide settings (single row)
CREATE TABLE public.firm_settings (
  id boolean NOT NULL DEFAULT true PRIMARY KEY,
  allowed_holidays integer NOT NULL DEFAULT 2,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT firm_settings_singleton CHECK (id)
);

GRANT SELECT, INSERT, UPDATE ON public.firm_settings TO authenticated;
GRANT ALL ON public.firm_settings TO service_role;
ALTER TABLE public.firm_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view settings" ON public.firm_settings
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins update settings" ON public.firm_settings
  FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins insert settings" ON public.firm_settings
  FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'));

INSERT INTO public.firm_settings (id, allowed_holidays) VALUES (true, 2)
  ON CONFLICT (id) DO NOTHING;

CREATE TRIGGER update_firm_settings_updated_at BEFORE UPDATE ON public.firm_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Per-staff monthly salary
CREATE TABLE public.salary_config (
  user_id uuid NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  monthly_salary numeric(12,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.salary_config TO authenticated;
GRANT ALL ON public.salary_config TO service_role;
ALTER TABLE public.salary_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins or self view salary" ON public.salary_config
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin') OR auth.uid() = user_id);
CREATE POLICY "Admins insert salary" ON public.salary_config
  FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update salary" ON public.salary_config
  FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete salary" ON public.salary_config
  FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_salary_config_updated_at BEFORE UPDATE ON public.salary_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();