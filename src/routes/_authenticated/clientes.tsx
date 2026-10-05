import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { Check, Loader2, Phone, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { customersQuery, salesQuery, type Customer } from "@/lib/data";
import { brl, dateBR, errMsg } from "@/lib/format";
import { Empty, PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/clientes")({
  head: () => ({ meta: [{ title: "Clientes — Caderninho" }, { name: "description", content: "Clientes e contas de fiado." }] }),
  loader: ({ context }) => Promise.all([context.queryClient.ensureQueryData(customersQuery), context.queryClient.ensureQueryData(salesQuery)]),
  component: Clientes,
});

function Clientes() {
  const { data: customers } = useSuspenseQuery(customersQuery);
  const { data: sales } = useSuspenseQuery(salesQuery);
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<Customer | null>(null);

  const debtOf = (id: string) => sales.filter((s) => s.customer_id === id && s.payment_status === "pending_debt");
  const sorted = [...customers].sort((a, b) => debtOf(b.id).reduce((x, s) => x + Number(s.total_amount), 0) - debtOf(a.id).reduce((x, s) => x + Number(s.total_amount), 0));

  async function remove(c: Customer) {
    if (!confirm(`Remover ${c.name}?`)) return;
    try {
      const { error } = await supabase.from("customers").delete().eq("id", c.id);
      if (error) throw error;
      toast.success("Cliente removido.");
      qc.invalidateQueries();
    } catch (e) { toast.error(errMsg(e)); }
  }

  return (
    <>
      <PageHeader title="Clientes" subtitle="Quem compra e quem deve" action={<Button onClick={() => setOpen(true)}><Plus /> Cliente</Button>} />
      {customers.length === 0 ? <Empty>Nenhum cliente cadastrado.</Empty> : (
        <ul className="space-y-2">
          {sorted.map((c) => {
            const owed = debtOf(c.id).reduce((a, s) => a + Number(s.total_amount), 0);
            return (
              <li key={c.id} className="flex items-center gap-3 rounded-xl border bg-card p-3 shadow-soft">
                <button className="min-w-0 flex-1 text-left" onClick={() => setDetail(c)}>
                  <div className="truncate font-semibold">{c.name}</div>
                  {c.phone && <div className="flex items-center gap-1 text-xs text-muted-foreground"><Phone className="size-3" /> {c.phone}</div>}
                </button>
                <span className={`tabular rounded-full px-2.5 py-1 text-xs font-bold ${owed > 0 ? "bg-warning/25 text-warning-foreground" : "bg-secondary text-secondary-foreground"}`}>
                  {owed > 0 ? `Deve ${brl(owed)}` : "Em dia"}
                </span>
                <Button variant="ghost" size="icon" onClick={() => remove(c)} aria-label="Remover"><Trash2 /></Button>
              </li>
            );
          })}
        </ul>
      )}
      <NewCustomer open={open} onClose={() => setOpen(false)} />
      <DebtDialog customer={detail} onClose={() => setDetail(null)} debts={detail ? debtOf(detail.id) : []} />
    </>
  );
}

function NewCustomer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const name = String(f.get("name") ?? "").trim();
    const phone = String(f.get("phone") ?? "").trim();
    if (!name) { toast.error("Informe o nome do cliente."); return; }
    if (phone && !/^[\d\s()+-]{8,20}$/.test(phone)) { toast.error("Telefone inválido."); return; }
    setSaving(true);
    try {
      const { error } = await supabase.from("customers").insert({ name, phone: phone || null });
      if (error) throw error;
      toast.success("Cliente cadastrado.");
      qc.invalidateQueries({ queryKey: ["customers"] });
      onClose();
    } catch (err) { toast.error(errMsg(err)); } finally { setSaving(false); }
  }
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Novo cliente</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1.5"><Label htmlFor="name">Nome</Label><Input id="name" name="name" className="h-11" /></div>
          <div className="space-y-1.5"><Label htmlFor="phone">Telefone</Label><Input id="phone" name="phone" inputMode="tel" className="h-11" placeholder="(11) 99999-9999" /></div>
          <Button type="submit" size="lg" className="w-full" disabled={saving}>{saving && <Loader2 className="animate-spin" />} Salvar</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DebtDialog({ customer, debts, onClose }: { customer: Customer | null; debts: { id: string; total_amount: number; created_at: string }[]; onClose: () => void }) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);
  async function markPaid(ids: string[]) {
    setBusy(ids.length > 1 ? "all" : (ids[0] ?? null));
    try {
      const { error } = await supabase.from("sales").update({ payment_status: "paid" }).in("id", ids);
      if (error) throw error;
      toast.success("Pagamento registrado.");
      qc.invalidateQueries({ queryKey: ["sales"] });
    } catch (e) { toast.error(errMsg(e)); } finally { setBusy(null); }
  }
  const total = debts.reduce((a, s) => a + Number(s.total_amount), 0);
  return (
    <Dialog open={!!customer} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Fiado de {customer?.name}</DialogTitle></DialogHeader>
        {debts.length === 0 ? <Empty>Nenhuma conta pendente.</Empty> : (
          <>
            <ul className="divide-y">
              {debts.map((s) => (
                <li key={s.id} className="flex items-center justify-between py-2 text-sm">
                  <span className="text-muted-foreground">{dateBR(s.created_at)}</span>
                  <span className="tabular font-semibold">{brl(s.total_amount)}</span>
                  <Button size="sm" variant="outline" onClick={() => markPaid([s.id])} disabled={!!busy}>
                    {busy === s.id ? <Loader2 className="animate-spin" /> : <Check />} Pago
                  </Button>
                </li>
              ))}
            </ul>
            <Button size="lg" onClick={() => markPaid(debts.map((d) => d.id))} disabled={!!busy}>
              {busy === "all" && <Loader2 className="animate-spin" />} Quitar tudo ({brl(total)})
            </Button>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
