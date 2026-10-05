import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { BookOpen, KeyRound, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { errMsg } from "@/lib/format";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Nova senha — Caderninho" },
      { name: "description", content: "Defina uma nova senha para sua conta do Caderninho." },
      { property: "og:title", content: "Nova senha — Caderninho" },
      { property: "og:description", content: "Defina uma nova senha para sua conta do Caderninho." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ResetPassword,
});

type Phase = "checking" | "form" | "expired";

function ResetPassword() {
  const navigate = useNavigate();
  const [phase, setPhase] = useState<Phase>("checking");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  // The link in the e-mail carries a one-time recovery session in the URL.
  // The client picks it up a moment after load, so we wait briefly for it.
  useEffect(() => {
    let alive = true;
    (async () => {
      for (let i = 0; i < 20; i++) {
        const { data } = await supabase.auth.getSession();
        if (!alive) return;
        if (data.session) { setPhase("form"); return; }
        await new Promise((r) => setTimeout(r, 200));
      }
      if (alive) setPhase("expired");
    })();
    return () => { alive = false; };
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!password) { toast.error("Digite a nova senha."); return; }
    if (password.length < 6) { toast.error("A senha precisa ter pelo menos 6 caracteres."); return; }
    if (password !== confirm) { toast.error("A confirmação não é igual à nova senha."); return; }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Senha alterada! Você já está dentro do painel.");
      navigate({ to: "/painel", replace: true });
    } catch (err) {
      const m = errMsg(err);
      if (m.toLowerCase().includes("current password")) {
        toast.error("Este link não vale mais para trocar a senha. Peça um novo em \"Esqueci minha senha\".");
      } else {
        toast.error(m);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen flex-col">
      <div className="bg-hero px-6 pb-14 pt-10 text-primary-foreground">
        <div className="mx-auto flex max-w-sm items-center gap-2 font-display text-lg font-bold">
          <BookOpen className="size-6" /> Caderninho
        </div>
        <h1 className="mx-auto mt-6 max-w-sm text-3xl font-extrabold">Definir nova senha</h1>
      </div>

      {phase === "checking" && (
        <div className="mx-auto -mt-8 w-full max-w-sm rounded-2xl border bg-card p-6 text-center shadow-soft">
          <Loader2 className="mx-auto size-5 animate-spin text-primary" />
          <p className="mt-3 text-sm text-muted-foreground">Conferindo seu link de recuperação…</p>
        </div>
      )}

      {phase === "expired" && (
        <div className="mx-auto -mt-8 w-full max-w-sm space-y-4 rounded-2xl border bg-card p-6 shadow-soft">
          <p className="text-sm">Este link de recuperação expirou, já foi usado ou foi aberto fora do navegador.</p>
          <p className="text-sm text-muted-foreground">Peça um novo link na tela de entrada — é só digitar seu e-mail de novo.</p>
          <Button asChild size="lg" className="w-full">
            <Link to="/auth">Pedir um novo link</Link>
          </Button>
        </div>
      )}

      {phase === "form" && (
        <form onSubmit={submit} className="mx-auto -mt-8 w-full max-w-sm space-y-4 rounded-2xl border bg-card p-6 shadow-soft">
          <div className="space-y-1.5">
            <Label htmlFor="pw">Nova senha</Label>
            <Input id="pw" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className="h-11" required />
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
        </form>
      )}
    </main>
  );
}
