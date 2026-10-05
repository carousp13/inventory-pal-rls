import { createFileRoute, Link } from "@tanstack/react-router";
import { BookOpen, Package, HandCoins, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Caderninho — Do papel para o celular" },
      { name: "description", content: "Controle estoque, vendas e fiado da sua loja direto pelo celular." },
      { property: "og:title", content: "Caderninho — Do papel para o celular" },
      { property: "og:description", content: "Controle estoque, vendas e fiado da sua loja direto pelo celular." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

const features = [
  { icon: Package, title: "Estoque sempre em dia", text: "Cadastre produtos ou importe da nota fiscal." },
  { icon: HandCoins, title: "Fiado sem caderno", text: "Saiba quem deve e quanto, na hora." },
  { icon: TrendingUp, title: "O que mais vende", text: "Ranking e avisos de estoque baixo." },
];

function Index() {
  return (
    <main className="min-h-screen">
      <section className="bg-hero px-6 pb-16 pt-12 text-primary-foreground">
        <div className="mx-auto max-w-xl">
          <div className="flex items-center gap-2 font-display text-lg font-bold">
            <BookOpen className="size-6" /> Caderninho
          </div>
          <h1 className="mt-10 text-4xl font-extrabold leading-tight sm:text-5xl">
            Sua loja saiu do papel.
          </h1>
          <p className="mt-4 text-lg opacity-90">
            Estoque, vendas e fiado organizados no celular — simples como anotar no caderno.
          </p>
          <div className="mt-8 flex gap-3">
            <Button asChild variant="accent" size="lg"><Link to="/auth">Começar grátis</Link></Button>
          </div>
        </div>
      </section>
      <section className="mx-auto grid max-w-xl gap-3 px-6 py-10">
        {features.map((f) => (
          <div key={f.title} className="flex gap-4 rounded-2xl border bg-card p-5 shadow-soft">
            <f.icon className="size-6 shrink-0 text-primary" />
            <div>
              <h3 className="font-bold">{f.title}</h3>
              <p className="text-sm text-muted-foreground">{f.text}</p>
            </div>
          </div>
        ))}
      </section>
    </main>
  );
}
