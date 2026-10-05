import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { KeyRound, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/PageHeader";
import { errMsg } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/senha")({
  head: () => ({
    meta: [
      { title: "Trocar senha — Caderninho" },
      { name: "description", content: "Altere a senha de acesso à sua conta no Caderninho." },
    ],
  }),
  component: TrocarSenha,
});

function TrocarSenha() {
  const [email, setEmail] = useState("");
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user?.email) setEmail(data.user.email);
    });
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!current || !next || !confirm) { toast.error("Preencha todos os campos."); return; }
    if (next.length < 6) { toast.error("A nova senha precisa ter pelo menos 6 caracteres."); return; }
    if (next !== confirm) { toast.error("A confirmação não é igual à nova senha."); return; }
    if (next === current) { toast.error("A nova senha precisa ser diferente da atual."); return; }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: next, current_password: current });
      if (error) throw error;
      toast.success("Senha alterada com sucesso!");
      setCurrent(""); setNext(""); setConfirm("");
    } catch (err) {
      const m = errMsg(err);
      if (m.toLowerCase().includes("current password")) toast.error("Sua senha atual está incorreta.");
      else if (m.toLowerCase().includes("different from the old")) toast.error("Escolha uma senha diferente da atual.");
      else toast.error(m);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <PageHeader title="Trocar senha" subtitle={email ? `Conta: ${email}` : "Escolha uma nova senha de acesso"} />
      <form onSubmit={submit} className="space-y-4 rounded-2xl border bg-card p-5 shadow-soft">
        <div className="space-y-1.5">
          <Label htmlFor="cur">Senha atual</Label>
          <Input id="cur" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} className="h-11" required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="new">Nova senha</Label>
          <Input id="new" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} className="h-11" required />
          <p className="text-xs text-muted-foreground">Mínimo de 6 caracteres.</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="conf">Confirmar nova senha</Label>
          <Input id="conf" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className="h-11" required />
        </div>
        <Button type="submit" size="lg" className="w-full" disabled={loading}>
          {loading ? <Loader2 className="animate-spin" /> : <KeyRound />}
          {loading ? "Salvando..." : "Salvar nova senha"}
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          Não lembra a senha atual?{" "}
          <Link to="/auth" className="text-primary underline-offset-4 hover:underline">Recuperar por e-mail</Link>
        </p>
      </form>
    </>
  );
}
