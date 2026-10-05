import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { BookOpen, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { errMsg } from "@/lib/format";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar — Caderninho" },
      { name: "description", content: "Entre ou crie sua conta no Caderninho." },
      { property: "og:title", content: "Entrar — Caderninho" },
      { property: "og:description", content: "Entre ou crie sua conta no Caderninho." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/painel", replace: true });
    });
  }, [navigate]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password) { toast.error("Preencha e-mail e senha."); return; }
    if (password.length < 6) { toast.error("A senha precisa ter pelo menos 6 caracteres."); return; }
    setLoading(true);
    try {
      if (mode === "in") {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
        navigate({ to: "/painel", replace: true });
      } else {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { emailRedirectTo: window.location.origin + "/painel" },
        });
        if (error) throw error;
        if (data.session) navigate({ to: "/painel", replace: true });
        else {
          toast.success("Conta criada! Confira seu e-mail para confirmar o cadastro.");
          setMode("in");
        }
      }
    } catch (err) {
      const m = errMsg(err);
      toast.error(m.includes("Invalid login") ? "E-mail ou senha incorretos." : m);
    } finally {
      setLoading(false);
    }
  }

  async function forgot() {
    const e = email.trim();
    if (!e) { toast.error("Digite seu e-mail primeiro."); return; }
    setSending(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(e, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      toast.success("Se esse e-mail estiver cadastrado, você receberá um link para criar uma nova senha.");
    } catch (err) {
      const m = errMsg(err);
      toast.error(m.toLowerCase().includes("rate limit") ? "Muitas solicitações seguidas. Aguarde alguns minutos e tente de novo." : m);
    } finally {
      setSending(false);
    }
  }

  return (
    <main className="flex min-h-screen flex-col">
      <div className="bg-hero px-6 pb-14 pt-10 text-primary-foreground">
        <div className="mx-auto flex max-w-sm items-center gap-2 font-display text-lg font-bold">
          <BookOpen className="size-6" /> Caderninho
        </div>
        <h1 className="mx-auto mt-6 max-w-sm text-3xl font-extrabold">
          {mode === "in" ? "Bem-vindo de volta" : "Crie sua conta"}
        </h1>
      </div>
      <form onSubmit={submit} className="mx-auto -mt-8 w-full max-w-sm space-y-4 rounded-2xl border bg-card p-6 shadow-soft">
        <div className="space-y-1.5">
          <Label htmlFor="email">E-mail</Label>
          <Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="h-11" required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pw">Senha</Label>
          <Input id="pw" type="password" autoComplete={mode === "in" ? "current-password" : "new-password"} value={password} onChange={(e) => setPassword(e.target.value)} className="h-11" required />
          {mode === "in" && (
            <button type="button" onClick={forgot} disabled={sending} className="text-xs font-medium text-primary underline-offset-4 hover:underline disabled:opacity-50">
              {sending ? "Enviando…" : "Esqueci minha senha"}
            </button>
          )}
        </div>
        <Button type="submit" size="lg" className="w-full" disabled={loading}>
          {loading && <Loader2 className="animate-spin" />}
          {mode === "in" ? "Entrar" : "Criar conta"}
        </Button>
        <button type="button" onClick={() => setMode(mode === "in" ? "up" : "in")} className="w-full text-center text-sm text-primary underline-offset-4 hover:underline">
          {mode === "in" ? "Ainda não tem conta? Cadastre-se" : "Já tem conta? Entrar"}
        </button>
      </form>
    </main>
  );
}
