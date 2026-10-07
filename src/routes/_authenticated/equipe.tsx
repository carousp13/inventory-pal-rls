import { createFileRoute, redirect } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { meQuery, membersQuery } from "@/lib/data";
import { PageHeader } from "@/components/PageHeader";
import { TeamManager } from "@/components/TeamManager";

export const Route = createFileRoute("/_authenticated/equipe")({
  head: () => ({ meta: [{ title: "Equipe — Caderninho" }, { name: "description", content: "Usuários da sua empresa." }] }),
  loader: async ({ context }) => {
    const me = await context.queryClient.ensureQueryData(meQuery);
    if (!me.canManageTeam || !me.companyId) throw redirect({ to: "/painel" });
    await context.queryClient.ensureQueryData(membersQuery(me.companyId));
  },
  component: Equipe,
});

function Equipe() {
  const { data: me } = useSuspenseQuery(meQuery);
  return (
    <>
      <PageHeader title="Equipe" subtitle={me.companyName ?? "Usuários da empresa"} />
      <TeamManager companyId={me.companyId!} myUserId={me.userId} />
    </>
  );
}
