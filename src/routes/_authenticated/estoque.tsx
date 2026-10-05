import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { FileText, Pencil, Plus, Trash2, Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { productsQuery, type Product } from "@/lib/data";
import { brl, errMsg, parseNonNeg } from "@/lib/format";
import { Empty, PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/estoque")({
  head: () => ({ meta: [{ title: "Estoque — Caderninho" }, { name: "description", content: "Seus produtos e quantidades." }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(productsQuery),
  component: Estoque,
});

function Estoque() {
  const { data: products } = useSuspenseQuery(productsQuery);
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Product | "new" | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [q, setQ] = useState("");
  const list = products.filter((p) => p.name.toLowerCase().includes(q.toLowerCase()));

  async function remove(p: Product) {
    if (!confirm(`Remover "${p.name}"?`)) return;
    try {
      const { error } = await supabase.from("products").delete().eq("id", p.id);
      if (error) throw error;
      toast.success("Produto removido.");
      qc.invalidateQueries({ queryKey: ["products"] });
    } catch (e) { toast.error(errMsg(e)); }
  }

  return (
    <>
      <PageHeader title="Estoque" subtitle={`${products.length} produtos`} action={
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={() => setImportOpen(true)} aria-label="Importar nota fiscal"><FileText /></Button>
          <Button onClick={() => setEditing("new")}><Plus /> Produto</Button>
        </div>
      } />
      <div className="relative mb-4">
        <Search className="absolute left-3 top-3 size-4 text-muted-foreground" />
        <Input placeholder="Buscar produto" value={q} onChange={(e) => setQ(e.target.value)} className="h-10 pl-9" />
      </div>
      {list.length === 0 ? <Empty>Nenhum produto. Cadastre o primeiro ou importe uma nota fiscal.</Empty> : (
        <ul className="space-y-2">
          {list.map((p) => {
            const status = p.stock_quantity === 0 ? "out" : p.stock_quantity <= p.min_stock_alert ? "low" : "ok";
            return (
              <li key={p.id} className="flex items-center gap-3 rounded-xl border bg-card p-3 shadow-soft">
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold">{p.name}</div>
                  <div className="text-sm text-muted-foreground">{brl(p.price)} · custo {brl(p.cost_price)}</div>
                </div>
                <span className={`tabular rounded-full px-2.5 py-1 text-xs font-bold ${status === "out" ? "bg-destructive/15 text-destructive" : status === "low" ? "bg-warning/25 text-warning-foreground" : "bg-secondary text-secondary-foreground"}`}>
                  {status === "out" ? "Esgotado" : `${p.stock_quantity} un.`}
                </span>
                <Button variant="ghost" size="icon" onClick={() => setEditing(p)} aria-label="Editar"><Pencil /></Button>
                <Button variant="ghost" size="icon" onClick={() => remove(p)} aria-label="Remover"><Trash2 /></Button>
              </li>
            );
          })}
        </ul>
      )}
      <ProductDialog product={editing} onClose={() => setEditing(null)} />
      <ImportDialog open={importOpen} onClose={() => setImportOpen(false)} products={products} />
    </>
  );
}

function ProductDialog({ product, onClose }: { product: Product | "new" | null; onClose: () => void }) {
  const qc = useQueryClient();
  const p = product && product !== "new" ? product : null;
  const [saving, setSaving] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const name = String(f.get("name") ?? "").trim();
    const price = parseNonNeg(String(f.get("price")));
    const cost = parseNonNeg(String(f.get("cost") || "0"));
    const stock = parseNonNeg(String(f.get("stock")), true);
    const min = parseNonNeg(String(f.get("min") || "0"), true);
    if (!name) { toast.error("Informe o nome do produto."); return; }
    if (price === null || cost === null) { toast.error("Preços devem ser números iguais ou maiores que zero."); return; }
    if (stock === null || min === null) { toast.error("Quantidades devem ser números inteiros, sem valores negativos."); return; }
    setSaving(true);
    try {
      const row = { name, price, cost_price: cost, stock_quantity: stock, min_stock_alert: min };
      const { error } = p ? await supabase.from("products").update(row).eq("id", p.id) : await supabase.from("products").insert(row);
      if (error) throw error;
      toast.success(p ? "Produto atualizado." : "Produto cadastrado.");
      qc.invalidateQueries({ queryKey: ["products"] });
      onClose();
    } catch (err) { toast.error(errMsg(err)); } finally { setSaving(false); }
  }

  return (
    <Dialog open={!!product} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{p ? "Editar produto" : "Novo produto"}</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-3" key={p?.id ?? "new"}>
          <Field label="Nome" name="name" defaultValue={p?.name} />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Preço de venda (R$)" name="price" inputMode="decimal" defaultValue={p?.price?.toString()} />
            <Field label="Preço de custo (R$)" name="cost" inputMode="decimal" defaultValue={p?.cost_price?.toString() ?? "0"} />
            <Field label="Quantidade" name="stock" inputMode="numeric" defaultValue={p?.stock_quantity?.toString() ?? "0"} />
            <Field label="Avisar quando tiver" name="min" inputMode="numeric" defaultValue={p?.min_stock_alert?.toString() ?? "5"} />
          </div>
          <Button type="submit" size="lg" className="w-full" disabled={saving}>{saving && <Loader2 className="animate-spin" />} Salvar</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, name, ...rest }: { label: string; name: string } & React.ComponentProps<typeof Input>) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} className="h-11" {...rest} />
    </div>
  );
}

type Parsed = { name: string; qty: number; cost: number; price: number };
const SAMPLE = `Arroz Tipo 1 5kg;10;22,50;29,90
Feijão Carioca 1kg;20;6,80;9,49
Óleo de Soja 900ml;15;5,20;7,99`;

function parseNota(text: string): { items: Parsed[]; bad: number } {
  const items: Parsed[] = []; let bad = 0;
  for (const raw of text.split("\n")) {
    const line = raw.trim(); if (!line) continue;
    const [name, q, c, pr] = line.split(/[;\t]/).map((s) => s?.trim() ?? "");
    const qty = parseNonNeg(q ?? "", true), cost = parseNonNeg(c ?? ""), price = parseNonNeg(pr ?? c ?? "");
    if (!name || qty === null || qty === 0 || cost === null || price === null) { bad++; continue; }
    items.push({ name, qty, cost, price });
  }
  return { items, bad };
}

function ImportDialog({ open, onClose, products }: { open: boolean; onClose: () => void; products: Product[] }) {
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const { items, bad } = parseNota(text);

  async function importar() {
    if (items.length === 0) { toast.error("Nenhum item válido encontrado na nota."); return; }
    setSaving(true);
    try {
      for (const it of items) {
        const existing = products.find((p) => p.name.toLowerCase() === it.name.toLowerCase());
        const { error } = existing
          ? await supabase.from("products").update({ stock_quantity: existing.stock_quantity + it.qty, cost_price: it.cost, price: it.price }).eq("id", existing.id)
          : await supabase.from("products").insert({ name: it.name, stock_quantity: it.qty, cost_price: it.cost, price: it.price });
        if (error) throw error;
      }
      toast.success(`${items.length} itens adicionados ao estoque.`);
      qc.invalidateQueries({ queryKey: ["products"] });
      setText(""); onClose();
    } catch (e) { toast.error(errMsg(e)); } finally { setSaving(false); }
  }

  async function loadFile(file: File) {
    try { setText(await file.text()); } catch { toast.error("Não foi possível ler o arquivo."); }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Entrada pela nota fiscal</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">Cole os itens da nota, um por linha: <b>nome; quantidade; custo; preço de venda</b>. Produtos com o mesmo nome têm o estoque somado.</p>
        <Textarea rows={6} value={text} onChange={(e) => setText(e.target.value)} placeholder={SAMPLE} />
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => setText(SAMPLE)}>Usar nota de exemplo</Button>
          <label className="inline-flex h-8 cursor-pointer items-center rounded-md border px-3 text-xs font-medium">
            Abrir arquivo (.txt/.csv)
            <input type="file" accept=".txt,.csv" className="hidden" onChange={(e) => e.target.files?.[0] && loadFile(e.target.files[0])} />
          </label>
        </div>
        {items.length > 0 && (
          <ul className="max-h-40 space-y-1 overflow-auto rounded-lg bg-muted p-3 text-sm">
            {items.map((i, k) => <li key={k} className="flex justify-between"><span>{i.qty}× {i.name}</span><span className="tabular">{brl(i.price)}</span></li>)}
          </ul>
        )}
        {bad > 0 && <p className="text-sm text-destructive">{bad} linha(s) ignoradas por dados inválidos.</p>}
        <Button size="lg" onClick={importar} disabled={saving || items.length === 0}>{saving && <Loader2 className="animate-spin" />} Adicionar {items.length} itens</Button>
      </DialogContent>
    </Dialog>
  );
}
