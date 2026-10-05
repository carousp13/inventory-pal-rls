import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { AlertTriangle, PackageX, Trophy, Wallet, HandCoins } from "lucide-react";
import { productsQuery, salesQuery } from "@/lib/data";
import { brl } from "@/lib/format";
import { Empty, PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/painel")({
  head: () => ({ meta: [{ title: "Painel — Caderninho" }, { name: "description", content: "Resumo da sua loja." }] }),
  loader: ({ context }) => Promise.all([context.queryClient.ensureQueryData(productsQuery), context.queryClient.ensureQueryData(salesQuery)]),
  component: Painel,
});

function Painel() {
  const { data: products } = useSuspenseQuery(productsQuery);
  const { data: sales } = useSuspenseQuery(salesQuery);

  const today = new Date().toDateString();
  const todayTotal = sales.filter((s) => new Date(s.created_at).toDateString() === today).reduce((a, s) => a + Number(s.total_amount), 0);
  const pending = sales.filter((s) => s.payment_status === "pending_debt").reduce((a, s) => a + Number(s.total_amount), 0);

  const out = products.filter((p) => p.stock_quantity === 0);
  const low = products.filter((p) => p.stock_quantity > 0 && p.stock_quantity <= p.min_stock_alert);

  const ranking = new Map<string, { name: string; qty: number }>();
  for (const s of sales) for (const i of s.sale_items) {
    const key = i.product_id ?? i.products?.name ?? "?";
    const cur = ranking.get(key) ?? { name: i.products?.name ?? "Produto removido", qty: 0 };
    cur.qty += i.quantity;
    ranking.set(key, cur);
  }
  const top = [...ranking.values()].sort((a, b) => b.qty - a.qty).slice(0, 5);
  const maxQty = top[0]?.qty ?? 1;

  return (
    <>
      <PageHeader title="Painel" subtitle="Como está sua loja hoje" action={<Button asChild variant="accent"><Link to="/vendas">Nova venda</Link></Button>} />
      <div className="grid grid-cols-2 gap-3">
        <Stat icon={Wallet} label="Vendido hoje" value={brl(todayTotal)} />
        <Stat icon={HandCoins} label="Fiado a receber" value={brl(pending)} />
      </div>

      {(out.length > 0 || low.length > 0) && (
        <section className="mt-5 space-y-2">
          {out.map((p) => (
            <Link to="/estoque" key={p.id} className="flex items-center gap-3 rounded-xl bg-destructive/10 p-3 text-sm">
              <PackageX className="size-5 text-destructive" />
              <span className="flex-1 font-medium">{p.name}</span>
              <span className="font-semibold text-destructive">Esgotado</span>
            </Link>
          ))}
          {low.map((p) => (
            <Link to="/estoque" key={p.id} className="flex items-center gap-3 rounded-xl bg-warning/20 p-3 text-sm">
              <AlertTriangle className="size-5 text-warning-foreground" />
              <span className="flex-1 font-medium">{p.name}</span>
              <span className="font-semibold text-warning-foreground">Restam {p.stock_quantity}</span>
            </Link>
          ))}
        </section>
      )}

      <section className="mt-6 rounded-2xl border bg-card p-5 shadow-soft">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-bold"><Trophy className="size-5 text-accent-foreground" /> Mais vendidos</h2>
        {top.length === 0 ? <Empty>Nenhuma venda registrada ainda.</Empty> : (
          <ol className="space-y-3">
            {top.map((t, i) => (
              <li key={t.name + i}>
                <div className="mb-1 flex justify-between text-sm">
                  <span className="font-medium">{i + 1}. {t.name}</span>
                  <span className="tabular text-muted-foreground">{t.qty} un.</span>
                </div>
                <div className="h-2 rounded-full bg-muted">
                  <div className="h-2 rounded-full bg-primary" style={{ width: `${(t.qty / maxQty) * 100}%` }} />
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>
    </>
  );
}

function Stat({ icon: Icon, label, value }: { icon: typeof Wallet; label: string; value: string }) {
  return (
    <div className="rounded-2xl border bg-card p-4 shadow-soft">
      <Icon className="size-5 text-primary" />
      <div className="mt-2 text-xs text-muted-foreground">{label}</div>
      <div className="tabular font-display text-xl font-extrabold">{value}</div>
    </div>
  );
}
