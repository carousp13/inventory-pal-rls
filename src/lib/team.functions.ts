import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Ctx = { supabase: any; userId: string };

/** Verifies (as the caller, through RLS-safe helpers) that they may manage this company's team. */
async function assertCanManage(ctx: Ctx, companyId: string) {
  const { data, error } = await ctx.supabase.rpc("is_company_admin", { _company: companyId });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Você não tem permissão para gerenciar usuários desta empresa.");
}

export const createMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      companyId: z.string().uuid(),
      email: z.string().trim().email().max(255),
      fullName: z.string().trim().min(1).max(100),
      password: z.string().min(6).max(72),
      role: z.enum(["admin", "operator"]),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertCanManage(context as Ctx, data.companyId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.fullName },
    });
    if (error || !created.user) {
      const m = error?.message ?? "Erro ao criar usuário";
      throw new Error(/already|registered|exists/i.test(m) ? "Já existe uma conta com esse e-mail." : m);
    }
    const { error: mErr } = await supabaseAdmin.from("company_members").insert({
      company_id: data.companyId,
      user_id: created.user.id,
      role: data.role,
      email: data.email,
      full_name: data.fullName,
    });
    if (mErr) {
      await supabaseAdmin.auth.admin.deleteUser(created.user.id);
      throw new Error(mErr.message);
    }
    return { ok: true };
  });

export const removeMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ memberId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    const { data: m, error } = await ctx.supabase.from("company_members").select("id, user_id, company_id").eq("id", data.memberId).maybeSingle();
    if (error) throw new Error(error.message);
    if (!m) throw new Error("Usuário não encontrado.");
    if (m.user_id === ctx.userId) throw new Error("Você não pode excluir a própria conta.");
    await assertCanManage(ctx, m.company_id);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: isMaster } = await supabaseAdmin.from("user_roles").select("id").eq("user_id", m.user_id).eq("role", "master").maybeSingle();
    if (isMaster) throw new Error("Contas Master não podem ser excluídas por aqui.");
    const { error: dErr } = await supabaseAdmin.auth.admin.deleteUser(m.user_id);
    if (dErr) throw new Error(dErr.message);
    return { ok: true };
  });

export const changeMemberRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ memberId: z.string().uuid(), role: z.enum(["admin", "operator"]) }).parse(d))
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    const { data: m, error } = await ctx.supabase.from("company_members").select("id, user_id, company_id").eq("id", data.memberId).maybeSingle();
    if (error) throw new Error(error.message);
    if (!m) throw new Error("Usuário não encontrado.");
    if (m.user_id === ctx.userId) throw new Error("Você não pode mudar o próprio nível.");
    await assertCanManage(ctx, m.company_id);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: uErr } = await supabaseAdmin.from("company_members").update({ role: data.role }).eq("id", m.id);
    if (uErr) throw new Error(uErr.message);
    return { ok: true };
  });
