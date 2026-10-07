CREATE TYPE public.app_role AS ENUM ('master');
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.companies TO authenticated;
GRANT ALL ON public.companies TO service_role;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.company_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('admin','operator')),
  email text,
  full_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.company_members TO authenticated;
GRANT ALL ON public.company_members TO service_role;
ALTER TABLE public.company_members ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;
CREATE OR REPLACE FUNCTION public.is_master()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(auth.uid(), 'master')
$$;
CREATE OR REPLACE FUNCTION public.current_company_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT company_id FROM public.company_members WHERE user_id = auth.uid()
$$;
CREATE OR REPLACE FUNCTION public.can_access_company(_company uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_master() OR EXISTS (SELECT 1 FROM public.company_members WHERE user_id = auth.uid() AND company_id = _company)
$$;
CREATE OR REPLACE FUNCTION public.is_company_admin(_company uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_master() OR EXISTS (SELECT 1 FROM public.company_members WHERE user_id = auth.uid() AND company_id = _company AND role = 'admin')
$$;

CREATE POLICY "read own roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_master());
CREATE POLICY "companies select" ON public.companies FOR SELECT TO authenticated USING (public.can_access_company(id));
CREATE POLICY "companies update" ON public.companies FOR UPDATE TO authenticated USING (public.is_company_admin(id)) WITH CHECK (public.is_company_admin(id));
CREATE POLICY "members select" ON public.company_members FOR SELECT TO authenticated USING (public.can_access_company(company_id));

-- self-service company creation for new signups
CREATE OR REPLACE FUNCTION public.create_my_company(_name text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _id uuid; _email text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  IF EXISTS (SELECT 1 FROM public.company_members WHERE user_id = auth.uid()) THEN RAISE EXCEPTION 'Você já pertence a uma empresa'; END IF;
  IF coalesce(trim(_name),'') = '' THEN RAISE EXCEPTION 'Informe o nome da empresa'; END IF;
  SELECT email INTO _email FROM auth.users WHERE id = auth.uid();
  INSERT INTO public.companies(name, created_by) VALUES (trim(_name), auth.uid()) RETURNING id INTO _id;
  INSERT INTO public.company_members(company_id, user_id, role, email) VALUES (_id, auth.uid(), 'admin', _email);
  RETURN _id;
END $$;
REVOKE ALL ON FUNCTION public.create_my_company(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.create_my_company(text) TO authenticated;

-- company columns
ALTER TABLE public.products ADD COLUMN company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE DEFAULT public.current_company_id();
ALTER TABLE public.customers ADD COLUMN company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE DEFAULT public.current_company_id();
ALTER TABLE public.sales ADD COLUMN company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE DEFAULT public.current_company_id();

-- backfill: every existing account becomes its own company (as admin)
INSERT INTO public.companies(name, created_by)
SELECT coalesce(nullif(u.raw_user_meta_data->>'full_name',''), split_part(u.email,'@',1)) || ' — Empresa', u.id FROM auth.users u;
INSERT INTO public.company_members(company_id, user_id, role, email, full_name)
SELECT c.id, u.id, 'admin', u.email, u.raw_user_meta_data->>'full_name' FROM public.companies c JOIN auth.users u ON u.id = c.created_by;
UPDATE public.products t SET company_id = c.id FROM public.companies c WHERE c.created_by = t.user_id;
UPDATE public.customers t SET company_id = c.id FROM public.companies c WHERE c.created_by = t.user_id;
UPDATE public.sales t SET company_id = c.id FROM public.companies c WHERE c.created_by = t.user_id;

CREATE INDEX ON public.products(company_id);
CREATE INDEX ON public.customers(company_id);
CREATE INDEX ON public.sales(company_id);

-- replace per-user policies with per-company policies
DROP POLICY "own products select" ON public.products;
DROP POLICY "own products insert" ON public.products;
DROP POLICY "own products update" ON public.products;
DROP POLICY "own products delete" ON public.products;
DROP POLICY "own customers select" ON public.customers;
DROP POLICY "own customers insert" ON public.customers;
DROP POLICY "own customers update" ON public.customers;
DROP POLICY "own customers delete" ON public.customers;
DROP POLICY "own sales select" ON public.sales;
DROP POLICY "own sales insert" ON public.sales;
DROP POLICY "own sales update" ON public.sales;
DROP POLICY "own sales delete" ON public.sales;
DROP POLICY "own sale_items select" ON public.sale_items;
DROP POLICY "own sale_items insert" ON public.sale_items;
DROP POLICY "own sale_items delete" ON public.sale_items;

CREATE POLICY "company products all" ON public.products FOR ALL TO authenticated USING (public.can_access_company(company_id)) WITH CHECK (public.can_access_company(company_id));
CREATE POLICY "company customers all" ON public.customers FOR ALL TO authenticated USING (public.can_access_company(company_id)) WITH CHECK (public.can_access_company(company_id));
CREATE POLICY "company sales all" ON public.sales FOR ALL TO authenticated USING (public.can_access_company(company_id)) WITH CHECK (public.can_access_company(company_id));
CREATE POLICY "company sale_items select" ON public.sale_items FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.sales s WHERE s.id = sale_id AND public.can_access_company(s.company_id)));
CREATE POLICY "company sale_items insert" ON public.sale_items FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.sales s WHERE s.id = sale_id AND public.can_access_company(s.company_id)));
CREATE POLICY "company sale_items delete" ON public.sale_items FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.sales s WHERE s.id = sale_id AND public.can_access_company(s.company_id)));

CREATE OR REPLACE FUNCTION public.create_sale(_customer_id uuid, _payment_status text, _items jsonb)
 RETURNS uuid LANGUAGE plpgsql SET search_path TO 'public'
AS $function$
DECLARE
  _sale_id uuid; _item jsonb; _p public.products%ROWTYPE; _qty integer; _total numeric := 0;
  _company uuid := public.current_company_id();
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  IF _company IS NULL THEN RAISE EXCEPTION 'Sua conta não está ligada a uma empresa'; END IF;
  IF _payment_status NOT IN ('paid','pending_debt') THEN RAISE EXCEPTION 'Forma de pagamento inválida'; END IF;
  IF _payment_status = 'pending_debt' AND _customer_id IS NULL THEN RAISE EXCEPTION 'Selecione um cliente para venda fiado'; END IF;
  IF _customer_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.customers WHERE id = _customer_id AND company_id = _company) THEN RAISE EXCEPTION 'Cliente não encontrado'; END IF;
  IF _items IS NULL OR jsonb_array_length(_items) = 0 THEN RAISE EXCEPTION 'Adicione ao menos um produto'; END IF;

  INSERT INTO public.sales(user_id, company_id, customer_id, payment_status, total_amount)
  VALUES (auth.uid(), _company, _customer_id, _payment_status, 0) RETURNING id INTO _sale_id;

  FOR _item IN SELECT * FROM jsonb_array_elements(_items) LOOP
    _qty := (_item->>'quantity')::integer;
    IF _qty IS NULL OR _qty <= 0 THEN RAISE EXCEPTION 'Quantidade inválida'; END IF;
    SELECT * INTO _p FROM public.products WHERE id = (_item->>'product_id')::uuid AND company_id = _company FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Produto não encontrado'; END IF;
    IF _p.stock_quantity < _qty THEN RAISE EXCEPTION 'Estoque insuficiente para %', _p.name; END IF;
    UPDATE public.products SET stock_quantity = stock_quantity - _qty WHERE id = _p.id;
    INSERT INTO public.sale_items(sale_id, product_id, quantity, unit_price) VALUES (_sale_id, _p.id, _qty, _p.price);
    _total := _total + _p.price * _qty;
  END LOOP;

  UPDATE public.sales SET total_amount = _total WHERE id = _sale_id;
  RETURN _sale_id;
END;
$function$;