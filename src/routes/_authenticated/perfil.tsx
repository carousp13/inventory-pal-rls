import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { Camera, KeyRound, Loader2, UserRound } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/PageHeader";
import { errMsg } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/perfil")({
  head: () => ({
    meta: [
      { title: "Meu perfil — Caderninho" },
      { name: "description", content: "Veja seus dados, troque seu avatar e altere sua senha no Caderninho." },
    ],
  }),
  component: Perfil,
});

function Perfil() {
  const [userId, setUserId] = useState("");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [savingName, setSavingName] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let objectUrl: string | null = null;
    supabase.auth.getUser().then(async ({ data }) => {
      const user = data.user;
      if (!user) return;
      setUserId(user.id);
      setEmail(user.email ?? "");
      setName((user.user_metadata?.full_name as string | undefined) ?? "");
      const path = user.user_metadata?.avatar_path as string | undefined;
      if (path) {
        const { data: blob } = await supabase.storage.from("avatars").download(path);
        if (blob) {
          objectUrl = URL.createObjectURL(blob);
          setAvatarUrl(objectUrl);
        }
      }
    });
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, []);

  async function saveName(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) { toast.error("Digite seu nome."); return; }
    setSavingName(true);
    try {
      const { error } = await supabase.auth.updateUser({ data: { full_name: name.trim() } });
      if (error) throw error;
      toast.success("Nome atualizado!");
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setSavingName(false);
    }
  }

  async function pickAvatar(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !userId) return;
    if (!file.type.startsWith("image/")) { toast.error("Escolha um arquivo de imagem."); return; }
    if (file.size > 2 * 1024 * 1024) { toast.error("A imagem precisa ter no máximo 2 MB."); return; }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${userId}/avatar.${ext}`;
      const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;
      const { error: metaErr } = await supabase.auth.updateUser({ data: { avatar_path: path } });
      if (metaErr) throw metaErr;
      if (avatarUrl) URL.revokeObjectURL(avatarUrl);
      setAvatarUrl(URL.createObjectURL(file));
      toast.success("Avatar atualizado!");
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setUploading(false);
    }
  }

  async function submitPassword(e: FormEvent) {
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

  const initials = (name || email).trim().charAt(0).toUpperCase() || "?";

  return (
    <>
      <PageHeader title="Meu perfil" subtitle="Seus dados de acesso e preferências" />

      <section className="rounded-2xl border bg-card p-5 shadow-soft">
        <div className="flex items-center gap-4">
          <div className="relative">
            {avatarUrl ? (
              <img src={avatarUrl} alt="Seu avatar" className="size-20 rounded-full object-cover" />
            ) : (
              <div className="flex size-20 items-center justify-center rounded-full bg-secondary text-2xl font-bold text-secondary-foreground">
                {initials}
              </div>
            )}
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              aria-label="Trocar avatar"
              className="absolute -bottom-1 -right-1 flex size-8 items-center justify-center rounded-full border bg-primary text-primary-foreground shadow-soft disabled:opacity-50"
            >
              {uploading ? <Loader2 className="size-4 animate-spin" /> : <Camera className="size-4" />}
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={pickAvatar} />
          </div>
          <div className="min-w-0">
            <p className="truncate text-lg font-bold">{name || "Sem nome"}</p>
            <p className="truncate text-sm text-muted-foreground">{email}</p>
          </div>
        </div>

        <form onSubmit={saveName} className="mt-5 space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="name">Nome de usuário</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} className="h-11" placeholder="Como você quer ser chamado(a)" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" value={email} className="h-11" disabled />
            <p className="text-xs text-muted-foreground">O e-mail de acesso não pode ser alterado por aqui.</p>
          </div>
          <Button type="submit" disabled={savingName}>
            {savingName ? <Loader2 className="animate-spin" /> : <UserRound />}
            {savingName ? "Salvando..." : "Salvar nome"}
          </Button>
        </form>
      </section>

      <section className="mt-6">
        <h2 className="mb-3 text-lg font-bold">Alterar senha</h2>
        <form onSubmit={submitPassword} className="space-y-4 rounded-2xl border bg-card p-5 shadow-soft">
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
        </form>
      </section>
    </>
  );
}
