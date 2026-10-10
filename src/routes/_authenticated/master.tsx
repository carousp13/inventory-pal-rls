import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Suspense, useState } from "react";
import { Building2, ChevronDown, Loader2, LogIn } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { companiesQuery, meQuery } from "@/lib/data";
import { dateBR, errMsg } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Empty, PageHeader } from "@/components/PageHeader";
import { TeamManager } from "@/components/TeamManager";

export const Route = createFileRoute("/_authenticated/master")({
  head: () => ({ meta: [{ title: "Master — Caderninho" }, { name: "description", content: "Todas as empresas do sistema." }] }),
  loader: async ({ context }) => {
    const me = await context.queryClient.ensureQueryData(meQuery);
    if (!me.isMaster) throw redirect({ to: "/painel" });
    await context.queryClient.ensureQueryData(companiesQuery);
  },
  component: Master,
});

function Master() {
  const { data: me } = useSuspenseQuery(meQuery);
  const { data: companies } = useSuspenseQuery(companiesQuery);
  const [open, setOpen] = useState<string | null>(null);
  const qc = useQueryClient();
  const navigate = useNavigate();
  async function enter(id: string) {
    const { error } = await supabase.rpc("master_switch_company", { _company: id });
    if (error) { toast.error(errMsg(error)); return; }
    qc.clear();
    toast.success("Empresa ativa trocada.");
    navigate({ to: "/painel" });
  }
  return (
    <>
      <PageHeader title="Painel Master" subtitle={`${companies.length} empresa(s) no sistema`} />
      {companies.length === 0 ? <Empty>Nenhuma empresa cadastrada.</Empty> : (
        <ul className="space-y-2">
          {companies.map((c) => (
            <li key={c.id} className="rounded-xl border bg-card shadow-soft">
              <button className="flex w-full items-center gap-3 p-3 text-left" onClick={() => setOpen(open === c.id ? null : c.id)}>
                <Building2 className="size-5 text-primary" />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold">{c.name}</div>
                  <div className="text-xs text-muted-foreground">{c.company_members[0]?.count ?? 0} usuário(s) · desde {dateBR(c.created_at)}</div>
                </div>
                <ChevronDown className={`size-4 transition-transform ${open === c.id ? "rotate-180" : ""}`} />
              </button>
              {open === c.id && (
                <div className="space-y-3 border-t p-3">
                  {me.companyId === c.id ? (
                    <p className="text-sm font-medium text-primary">Você está operando nesta empresa.</p>
                  ) : (
                    <Button variant="outline" className="w-full" onClick={() => enter(c.id)}><LogIn /> Operar estoque e vendas desta empresa</Button>
                  )}
                  <Suspense fallback={<Loader2 className="mx-auto animate-spin" />}>
                    <TeamManager companyId={c.id} myUserId={me.userId} />
                  </Suspense>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
