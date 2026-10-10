CREATE TABLE public.master_context (
  user_id uuid PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.master_context TO authenticated;
GRANT ALL ON public.master_context TO service_role;
ALTER TABLE public.master_context ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own master context" ON public.master_context FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.current_company_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(
    (SELECT mc.company_id FROM public.master_context mc WHERE mc.user_id = auth.uid() AND public.has_role(auth.uid(), 'master')),
    (SELECT company_id FROM public.company_members WHERE user_id = auth.uid())
  )
$$;

CREATE OR REPLACE FUNCTION public.master_switch_company(_company uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_master() THEN RAISE EXCEPTION 'Apenas Master'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.companies WHERE id = _company) THEN RAISE EXCEPTION 'Empresa não encontrada'; END IF;
  INSERT INTO public.master_context(user_id, company_id) VALUES (auth.uid(), _company)
  ON CONFLICT (user_id) DO UPDATE SET company_id = EXCLUDED.company_id, updated_at = now();
END $$;
REVOKE ALL ON FUNCTION public.master_switch_company(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.master_switch_company(uuid) TO authenticated;