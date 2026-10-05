import { createFileRoute, Link, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { BookOpen, KeyRound, LayoutDashboard, LogOut, Package, ShoppingCart, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

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
  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }
  return (
    <div className="min-h-screen pb-24 md:pb-8">
      <header className="sticky top-0 z-20 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
          <span className="flex items-center gap-2 font-display font-bold text-primary">
            <BookOpen className="size-5" /> Caderninho
          </span>
          <nav className="hidden gap-1 md:flex">
            {nav.map((n) => (
              <Link key={n.to} to={n.to} className="rounded-lg px-3 py-1.5 text-sm font-medium text-muted-foreground" activeProps={{ className: "bg-secondary text-secondary-foreground" }}>
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-4">
            <Link to="/senha" className="flex items-center gap-1 text-sm text-muted-foreground" activeProps={{ className: "text-primary font-medium" }} aria-label="Trocar senha">
              <KeyRound className="size-4" /> <span className="hidden sm:inline">Senha</span>
            </Link>
            <button onClick={signOut} className="flex items-center gap-1 text-sm text-muted-foreground" aria-label="Sair">
              <LogOut className="size-4" /> Sair
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-5">
        <Outlet />
      </main>
      <nav className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-4 border-t bg-card md:hidden">
        {nav.map((n) => (
          <Link key={n.to} to={n.to} className="flex flex-col items-center gap-0.5 py-2.5 text-xs font-medium text-muted-foreground" activeProps={{ className: "text-primary" }}>
            <n.icon className="size-5" /> {n.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
