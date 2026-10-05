CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  name text NOT NULL CHECK (length(trim(name)) > 0),
  price numeric(12,2) NOT NULL DEFAULT 0 CHECK (price >= 0),
  cost_price numeric(12,2) NOT NULL DEFAULT 0 CHECK (cost_price >= 0),
  stock_quantity integer NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
  min_stock_alert integer NOT NULL DEFAULT 5 CHECK (min_stock_alert >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own products select" ON public.products FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own products insert" ON public.products FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own products update" ON public.products FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own products delete" ON public.products FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  name text NOT NULL CHECK (length(trim(name)) > 0),
  phone text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customers TO authenticated;
GRANT ALL ON public.customers TO service_role;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own customers select" ON public.customers FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own customers insert" ON public.customers FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own customers update" ON public.customers FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own customers delete" ON public.customers FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  total_amount numeric(12,2) NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
  payment_status text NOT NULL DEFAULT 'paid' CHECK (payment_status IN ('paid','pending_debt')),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sales TO authenticated;
GRANT ALL ON public.sales TO service_role;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own sales select" ON public.sales FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own sales insert" ON public.sales FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own sales update" ON public.sales FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own sales delete" ON public.sales FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.sale_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id uuid NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  quantity integer NOT NULL CHECK (quantity > 0),
  unit_price numeric(12,2) NOT NULL CHECK (unit_price >= 0)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sale_items TO authenticated;
GRANT ALL ON public.sale_items TO service_role;
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own sale_items select" ON public.sale_items FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.sales s WHERE s.id = sale_id AND s.user_id = auth.uid()));
CREATE POLICY "own sale_items insert" ON public.sale_items FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.sales s WHERE s.id = sale_id AND s.user_id = auth.uid()));
CREATE POLICY "own sale_items delete" ON public.sale_items FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.sales s WHERE s.id = sale_id AND s.user_id = auth.uid()));

CREATE INDEX ON public.products(user_id);
CREATE INDEX ON public.customers(user_id);
CREATE INDEX ON public.sales(user_id);
CREATE INDEX ON public.sale_items(sale_id);

-- Atomic sale: creates sale + items and decrements stock (runs as caller, RLS applies)
CREATE OR REPLACE FUNCTION public.create_sale(_customer_id uuid, _payment_status text, _items jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  _sale_id uuid;
  _item jsonb;
  _p public.products%ROWTYPE;
  _qty integer;
  _total numeric := 0;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  IF _payment_status NOT IN ('paid','pending_debt') THEN RAISE EXCEPTION 'Forma de pagamento inválida'; END IF;
  IF _payment_status = 'pending_debt' AND _customer_id IS NULL THEN RAISE EXCEPTION 'Selecione um cliente para venda fiado'; END IF;
  IF _items IS NULL OR jsonb_array_length(_items) = 0 THEN RAISE EXCEPTION 'Adicione ao menos um produto'; END IF;

  INSERT INTO public.sales(user_id, customer_id, payment_status, total_amount)
  VALUES (auth.uid(), _customer_id, _payment_status, 0) RETURNING id INTO _sale_id;

  FOR _item IN SELECT * FROM jsonb_array_elements(_items) LOOP
    _qty := (_item->>'quantity')::integer;
    IF _qty IS NULL OR _qty <= 0 THEN RAISE EXCEPTION 'Quantidade inválida'; END IF;
    SELECT * INTO _p FROM public.products WHERE id = (_item->>'product_id')::uuid FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Produto não encontrado'; END IF;
    IF _p.stock_quantity < _qty THEN RAISE EXCEPTION 'Estoque insuficiente para %', _p.name; END IF;
    UPDATE public.products SET stock_quantity = stock_quantity - _qty WHERE id = _p.id;
    INSERT INTO public.sale_items(sale_id, product_id, quantity, unit_price) VALUES (_sale_id, _p.id, _qty, _p.price);
    _total := _total + _p.price * _qty;
  END LOOP;

  UPDATE public.sales SET total_amount = _total WHERE id = _sale_id;
  RETURN _sale_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.create_sale(uuid, text, jsonb) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.create_sale(uuid, text, jsonb) TO authenticated;