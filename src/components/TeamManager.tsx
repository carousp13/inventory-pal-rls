import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, type FormEvent } from "react";
import { Loader2, Plus, Trash2, UserRound } from "lucide-react";
import { toast } from "sonner";
import { membersQuery, roleLabel, type Member, type Role } from "@/lib/data";
import { changeMemberRole, createMember, removeMember } from "@/lib/team.functions";
import { errMsg } from "@/lib/format";
import { Empty } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const selectCls = "h-10 rounded-md border border-input bg-background px-3 text-sm";

export function TeamManager({ companyId, myUserId }: { companyId: string; myUserId: string }) {
  const { data: members } = useSuspenseQuery(membersQuery(companyId));
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const remove = useServerFn(removeMember);
  const setRole = useServerFn(changeMemberRole);

  async function onRemove(m: Member) {
    if (!confirm(`Excluir ${m.full_name || m.email}? A pessoa perde o acesso ao sistema.`)) return;
    try {
      await remove({ data: { memberId: m.id } });
      toast.success("Usuário excluído.");
      qc.invalidateQueries({ queryKey: ["members"] });
      qc.invalidateQueries({ queryKey: ["companies"] });
    } catch (e) { toast.error(errMsg(e)); }
  }
  async function onRole(m: Member, role: "admin" | "operator") {
    try {
      await setRole({ data: { memberId: m.id, role } });
      toast.success("Nível atualizado.");
      qc.invalidateQueries({ queryKey: ["members"] });
    } catch (e) { toast.error(errMsg(e)); }
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end"><Button onClick={() => setOpen(true)}><Plus /> Usuário</Button></div>
      {members.length === 0 ? <Empty>Nenhum usuário nesta empresa.</Empty> : (
        <ul className="space-y-2">
          {members.map((m) => {
            const me = m.user_id === myUserId;
            return (
              <li key={m.id} className="flex items-center gap-3 rounded-xl border bg-card p-3 shadow-soft">
                <span className="grid size-9 place-items-center rounded-full bg-secondary text-secondary-foreground"><UserRound className="size-4" /></span>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold">{m.full_name || m.email}{me && <span className="ml-1 text-xs font-normal text-muted-foreground">(você)</span>}</div>
                  <div className="truncate text-xs text-muted-foreground">{m.email}</div>
                </div>
                {me ? (
                  <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-bold text-secondary-foreground">{roleLabel[m.role as Role]}</span>
                ) : (
                  <select aria-label="Nível" className={selectCls} value={m.role} onChange={(e) => onRole(m, e.target.value as "admin" | "operator")}>
                    <option value="admin">Administrador</option>
                    <option value="operator">Operador</option>
                  </select>
                )}
                {!me && <Button variant="ghost" size="icon" onClick={() => onRemove(m)} aria-label="Excluir usuário"><Trash2 /></Button>}
              </li>
            );
          })}
        </ul>
      )}
      <NewMember companyId={companyId} open={open} onClose={() => setOpen(false)} />
    </div>
  );
}

function NewMember({ companyId, open, onClose }: { companyId: string; open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const create = useServerFn(createMember);
  const [saving, setSaving] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const fullName = String(f.get("name") ?? "").trim();
    const email = String(f.get("email") ?? "").trim();
    const password = String(f.get("password") ?? "");
    const role = String(f.get("role")) as "admin" | "operator";
    if (!fullName || !email) { toast.error("Preencha nome e e-mail."); return; }
    if (password.length < 6) { toast.error("A senha inicial precisa ter pelo menos 6 caracteres."); return; }
    setSaving(true);
    try {
      await create({ data: { companyId, fullName, email, password, role } });
      toast.success("Usuário criado! Repasse o e-mail e a senha inicial para a pessoa.");
      qc.invalidateQueries({ queryKey: ["members"] });
      qc.invalidateQueries({ queryKey: ["companies"] });
      onClose();
    } catch (err) { toast.error(errMsg(err)); } finally { setSaving(false); }
  }
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Novo usuário</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1.5"><Label htmlFor="m-name">Nome</Label><Input id="m-name" name="name" maxLength={100} /></div>
          <div className="space-y-1.5"><Label htmlFor="m-email">E-mail</Label><Input id="m-email" name="email" type="email" maxLength={255} /></div>
          <div className="space-y-1.5"><Label htmlFor="m-pw">Senha inicial</Label><Input id="m-pw" name="password" type="text" autoComplete="off" /></div>
          <div className="space-y-1.5">
            <Label htmlFor="m-role">Nível</Label>
            <select id="m-role" name="role" defaultValue="operator" className={`${selectCls} w-full`}>
              <option value="operator">Operador — estoque, vendas e clientes</option>
              <option value="admin">Administrador — tudo, inclusive usuários</option>
            </select>
          </div>
          <Button type="submit" className="w-full" disabled={saving}>{saving && <Loader2 className="animate-spin" />} Criar usuário</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
