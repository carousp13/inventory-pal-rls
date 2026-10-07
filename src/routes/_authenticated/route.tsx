import { createFileRoute, Link, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { BookOpen, Building2, Crown, LayoutDashboard, Loader2, LogOut, Package, ShoppingCart, UserRound, Users, UsersRound } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { meQuery, roleLabel } from "@/lib/data";
import { errMsg } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AppLayout,
});

const nav = [
  { to: "/painel", label: "Painel", icon: LayoutDashboard },
  { to: "/vendas", label: "Vender", icon: ShoppingCart },
  { to: "/estoque", label: "Estoque", icon: Package },
  { to: "/clientes", label: "Clientes", icon: Users },
] as const;

function AppLayout() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const me = useQuery(meQuery);
  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }
  if (me.isPending) return <div className="grid min-h-screen place-items-center"><Loader2 className="animate-spin text-primary" /></div>;
  const needsCompany = me.data && !me.data.companyId;

  return (
    <div className="min-h-screen pb-24 md:pb-8">
      <header className="sticky top-0 z-20 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between gap-2 px-4">
          <div className="min-w-0">
            <span className="flex items-center gap-2 font-display font-bold text-primary">
              <BookOpen className="size-5" /> Caderninho
            </span>
            {me.data?.companyName && (
              <span className="block truncate text-[11px] leading-tight text-muted-foreground">
                {me.data.companyName} · {me.data.role ? roleLabel[me.data.role] : ""}
              </span>
            )}
          </div>
          {!needsCompany && (
            <nav className="hidden gap-1 md:flex">
              {nav.map((n) => (
                <Link key={n.to} to={n.to} className="rounded-lg px-3 py-1.5 text-sm font-medium text-muted-foreground" activeProps={{ className: "bg-secondary text-secondary-foreground" }}>
                  {n.label}
                </Link>
              ))}
            </nav>
          )}
          <div className="flex items-center gap-3">
            {me.data?.isMaster && (
              <Link to="/master" className="flex items-center gap-1 text-sm text-muted-foreground" activeProps={{ className: "text-primary font-medium" }} aria-label="Painel Master">
                <Crown className="size-4" /> <span className="hidden sm:inline">Master</span>
              </Link>
            )}
            {me.data?.canManageTeam && me.data.companyId && (
              <Link to="/equipe" className="flex items-center gap-1 text-sm text-muted-foreground" activeProps={{ className: "text-primary font-medium" }} aria-label="Equipe">
                <UsersRound className="size-4" /> <span className="hidden sm:inline">Equipe</span>
              </Link>
            )}
            <Link to="/perfil" className="flex items-center gap-1 text-sm text-muted-foreground" activeProps={{ className: "text-primary font-medium" }} aria-label="Meu perfil">
              <UserRound className="size-4" /> <span className="hidden sm:inline">Perfil</span>
            </Link>
            <button onClick={signOut} className="flex items-center gap-1 text-sm text-muted-foreground" aria-label="Sair">
              <LogOut className="size-4" /> <span className="hidden sm:inline">Sair</span>
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-5">
        {me.isError ? <p className="text-center text-sm text-destructive">{errMsg(me.error)}</p> : needsCompany ? <CreateCompany /> : <Outlet />}
      </main>
      {!needsCompany && (
        <nav className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-4 border-t bg-card md:hidden">
          {nav.map((n) => (
            <Link key={n.to} to={n.to} className="flex flex-col items-center gap-0.5 py-2.5 text-xs font-medium text-muted-foreground" activeProps={{ className: "text-primary" }}>
              <n.icon className="size-5" /> {n.label}
            </Link>
          ))}
        </nav>
      )}
    </div>
  );
}

function CreateCompany() {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) { toast.error("Informe o nome da empresa."); return; }
    setSaving(true);
    try {
      const { error } = await supabase.rpc("create_my_company", { _name: name.trim().slice(0, 100) });
      if (error) throw error;
      toast.success("Empresa criada! Você é o administrador.");
      await qc.invalidateQueries();
    } catch (err) { toast.error(errMsg(err)); } finally { setSaving(false); }
  }
  return (
    <form onSubmit={submit} className="mx-auto mt-8 max-w-sm space-y-4 rounded-2xl border bg-card p-6 shadow-soft">
      <Building2 className="size-8 text-primary" />
      <h1 className="text-xl font-extrabold">Cadastre sua empresa</h1>
      <p className="text-sm text-muted-foreground">Você será o administrador e poderá incluir sua equipe depois.</p>
      <div className="space-y-1.5">
        <Label htmlFor="c-name">Nome da empresa</Label>
        <Input id="c-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} className="h-11" />
      </div>
      <Button type="submit" size="lg" className="w-full" disabled={saving}>{saving && <Loader2 className="animate-spin" />} Criar empresa</Button>
    </form>
  );
}
