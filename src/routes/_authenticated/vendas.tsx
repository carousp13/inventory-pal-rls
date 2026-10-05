import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Loader2, Minus, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { customersQuery, productsQuery, salesQuery } from "@/lib/data";
import { brl, dateBR, errMsg } from "@/lib/format";
import { Empty, PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/vendas")({
  head: () => ({ meta: [{ title: "Vender — Caderninho" }, { name: "description", content: "Registre vendas à vista ou fiado." }] }),
  loader: ({ context }) => Promise.all([
    context.queryClient.ensureQueryData(productsQuery),
    context.queryClient.ensureQueryData(customersQuery),
    context.queryClient.ensureQueryData(salesQuery),
  ]),
  component: Vendas,
});

function Vendas() {
  const { data: products } = useSuspenseQuery(productsQuery);
  const { data: customers } = useSuspenseQuery(customersQuery);
  const { data: sales } = useSuspenseQuery(salesQuery);
  const qc = useQueryClient();
  const [cart, setCart] = useState<Record<string, number>>({});
  const [pay, setPay] = useState<"paid" | "pending_debt">("paid");
  const [customer, setCustomer] = useState<string>("");
  const [saving, setSaving] = useState(false);

  const lines = Object.entries(cart).map(([id, qty]) => ({ p: products.find((x) => x.id === id)!, qty })).filter((l) => l.p);
  const total = lines.reduce((a, l) => a + Number(l.p.price) * l.qty, 0);
  const available = products.filter((p) => p.stock_quantity > 0 && !cart[p.id]);

  function setQty(id: string, qty: number) {
    const p = products.find((x) => x.id === id); if (!p) return;
    if (qty > p.stock_quantity) return toast.error(`Só há ${p.stock_quantity} un. de ${p.name}.`);
    setCart((c) => { const n = { ...c }; if (qty <= 0) delete n[id]; else n[id] = qty; return n; });
  }

  async function finalizar() {
    if (lines.length === 0) return toast.error("Adicione ao menos um produto.");
    if (pay === "pending_debt" && !customer) return toast.error("Escolha o cliente para vender fiado.");
    setSaving(true);
    try {
      const { error } = await supabase.rpc("create_sale", {
        _customer_id: customer || null as unknown as string,
        _payment_status: pay,
        _items: lines.map((l) => ({ product_id: l.p.id, quantity: l.qty })),
      });
      if (error) throw error;
      toast.success(pay === "paid" ? "Venda registrada!" : "Venda fiado anotada!");
      setCart({}); setCustomer(""); setPay("paid");
      qc.invalidateQueries();
    } catch (e) { toast.error(errMsg(e)); } finally { setSaving(false); }
  }

  return (
    <>
      <PageHeader title="Nova venda" />
      <section className="space-y-4 rounded-2xl border bg-card p-4 shadow-soft">
        <div className="space-y-1.5">
          <Label>Adicionar produto</Label>
          <Select value="" onValueChange={(id) => setQty(id, 1)}>
            <SelectTrigger className="h-11"><SelectValue placeholder={available.length ? "Escolha um produto" : "Sem produtos disponíveis"} /></SelectTrigger>
            <SelectContent>
              {available.map((p) => <SelectItem key={p.id} value={p.id}>{p.name} — {brl(p.price)} ({p.stock_quantity} un.)</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        {lines.length > 0 && (
          <ul className="divide-y">
            {lines.map(({ p, qty }) => (
              <li key={p.id} className="flex items-center gap-2 py-2">
                <div className="min-w-0 flex-1"><div className="truncate font-medium">{p.name}</div><div className="text-xs text-muted-foreground">{brl(p.price)} cada</div></div>
                <Button variant="outline" size="icon" onClick={() => setQty(p.id, qty - 1)} aria-label="Menos">{qty === 1 ? <Trash2 /> : <Minus />}</Button>
                <span className="tabular w-6 text-center font-bold">{qty}</span>
                <Button variant="outline" size="icon" onClick={() => setQty(p.id, qty + 1)} aria-label="Mais"><Plus /></Button>
              </li>
            ))}
          </ul>
        )}
        <div className="grid grid-cols-2 gap-2">
          {(["paid", "pending_debt"] as const).map((v) => (
            <button key={v} type="button" onClick={() => setPay(v)} className={`rounded-xl border-2 p-3 text-sm font-semibold ${pay === v ? "border-primary bg-secondary text-secondary-foreground" : "border-border text-muted-foreground"}`}>
              {v === "paid" ? "À vista (pago)" : "Fiado (pagar depois)"}
            </button>
          ))}
        </div>
        <div className="space-y-1.5">
          <Label>Cliente {pay === "paid" && <span className="text-muted-foreground">(opcional)</span>}</Label>
          <Select value={customer} onValueChange={setCustomer}>
            <SelectTrigger className="h-11"><SelectValue placeholder={customers.length ? "Escolha o cliente" : "Cadastre clientes na aba Clientes"} /></SelectTrigger>
            <SelectContent>{customers.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="flex items-center justify-between border-t pt-3">
          <span className="text-muted-foreground">Total</span>
          <span className="tabular font-display text-2xl font-extrabold">{brl(total)}</span>
        </div>
        <Button size="lg" variant="accent" className="w-full" onClick={finalizar} disabled={saving}>
          {saving && <Loader2 className="animate-spin" />} Finalizar venda
        </Button>
      </section>

      <h2 className="mb-3 mt-8 text-lg font-bold">Últimas vendas</h2>
      {sales.length === 0 ? <Empty>Nenhuma venda ainda.</Empty> : (
        <ul className="space-y-2">
          {sales.slice(0, 20).map((s) => (
            <li key={s.id} className="flex items-center justify-between rounded-xl border bg-card p-3 text-sm">
              <div>
                <div className="font-medium">{s.sale_items.map((i) => `${i.quantity}× ${i.products?.name ?? "?"}`).join(", ")}</div>
                <div className="text-xs text-muted-foreground">{dateBR(s.created_at)}{s.customers ? ` · ${s.customers.name}` : ""}</div>
              </div>
              <div className="text-right">
                <div className="tabular font-bold">{brl(s.total_amount)}</div>
                <div className={`text-xs font-semibold ${s.payment_status === "paid" ? "text-success" : "text-warning-foreground"}`}>{s.payment_status === "paid" ? "Pago" : "Fiado"}</div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
