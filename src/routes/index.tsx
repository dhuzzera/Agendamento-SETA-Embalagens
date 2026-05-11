import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { SetaLogo } from "@/components/SetaLogo";
import { Button } from "@/components/ui/button";
import { Calendar, Lock, Users, ArrowRight, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/dashboard" />;

  return (
    <div className="min-h-screen bg-background">
      {/* Header institucional branco */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <SetaLogo variant="dark" />
          <div className="flex items-center gap-2">
            <a
              href="https://setaembalagens.com.br"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden text-sm font-medium text-muted-foreground hover:text-foreground sm:inline-flex"
            >
              Site institucional
            </a>
            <Link to="/login">
              <Button className="rounded-full px-5 shadow-sm">
                Acessar painel
                <ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero institucional — segue padrão visual do site */}
      <section
        className="relative overflow-hidden px-4 py-20 text-center sm:px-6 lg:py-32"
        style={{ background: "var(--gradient-hero)" }}
      >
        <div
          aria-hidden
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 20%, white 0.5px, transparent 0.5px), radial-gradient(circle at 80% 70%, white 0.5px, transparent 0.5px)",
            backgroundSize: "40px 40px",
          }}
        />
        <div className="relative mx-auto max-w-3xl text-primary-foreground">
          <span className="inline-flex items-center rounded-full border border-primary-foreground/30 bg-primary-foreground/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider">
            Plataforma oficial Seta Embalagens
          </span>
          <h1 className="mt-5 text-4xl font-bold tracking-tight !text-primary-foreground sm:text-5xl lg:text-6xl">
            Agendamento comercial,<br className="hidden sm:block" /> com a confiança Seta.
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-primary-foreground/90">
            Plataforma oficial dos representantes comerciais da Seta Embalagens.
            Reuniões organizadas, sem dupla marcação e com o padrão institucional
            que entregamos há décadas ao mercado B2B.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link to="/login">
              <Button size="lg" variant="secondary" className="rounded-full px-8 shadow-md">
                Acessar painel
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <a
              href="https://setaembalagens.com.br"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-primary-foreground/90 underline-offset-4 hover:underline"
            >
              Conheça a Seta Embalagens →
            </a>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <div className="mb-12 text-center">
          <h2 className="text-3xl font-bold sm:text-4xl">Tudo que sua equipe comercial precisa</h2>
          <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">
            Uma extensão oficial do site institucional, voltada à eficiência do atendimento
            comercial e industrial.
          </p>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          <Feature
            icon={<Calendar className="h-6 w-6" />}
            title="Agenda inteligente"
            text="Cada representante define seus horários e compartilha um link único com clientes."
          />
          <Feature
            icon={<Lock className="h-6 w-6" />}
            title="Sem dupla marcação"
            text="O sistema bloqueia automaticamente horários reservados, validando em tempo real."
          />
          <Feature
            icon={<Users className="h-6 w-6" />}
            title="Visão consolidada"
            text="Administradores acompanham todas as reuniões, representantes e métricas da equipe."
          />
        </div>
      </section>

      {/* Bloco institucional B2B */}
      <section className="bg-secondary/60 px-4 py-20 sm:px-6">
        <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-2 lg:items-center">
          <div>
            <span className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">
              Padrão Seta
            </span>
            <h2 className="mt-3 text-3xl font-bold sm:text-4xl">
              Atendimento profissional, do primeiro contato ao fechamento.
            </h2>
            <p className="mt-4 text-muted-foreground">
              Construída sob a identidade visual e os valores da Seta Embalagens —
              respeito, resultado, transparência, confiança e qualidade.
            </p>
            <ul className="mt-6 space-y-3 text-sm">
              {[
                "Identidade visual oficial Seta Embalagens",
                "Compatível com Apple Calendar, Google Calendar e Outlook",
                "Disponível em qualquer dispositivo — celular, tablet ou desktop",
                "Acesso seguro com perfis de Administrador e Representante",
              ].map((it) => (
                <li key={it} className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
                  <span>{it}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border bg-card p-8 shadow-[var(--shadow-elegant)]">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Missão
            </p>
            <p className="mt-2 text-xl font-semibold text-primary">
              Transformar papelão em solução.
            </p>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="rounded-lg bg-secondary p-4">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Visão</p>
                <p className="mt-1 text-sm font-medium">
                  Estar entre as 5 maiores cartonagens do Brasil até 2030.
                </p>
              </div>
              <div className="rounded-lg bg-secondary p-4">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Valores</p>
                <p className="mt-1 text-sm font-medium">
                  Respeito, resultado, transparência, confiança e qualidade.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t bg-background py-8">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-4 text-center text-sm text-muted-foreground sm:flex-row sm:px-6">
          <SetaLogo variant="dark" />
          <p>
            © {new Date().getFullYear()} Seta Embalagens — Produzimos embalagens, entregamos
            confiança.
          </p>
        </div>
      </footer>
    </div>
  );
}

function Feature({
  icon,
  title,
  text,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <div className="group rounded-xl border bg-card p-6 shadow-[var(--shadow-card)] transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-[var(--shadow-elegant)]">
      <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-secondary text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
        {icon}
      </div>
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="mt-2 text-sm text-muted-foreground">{text}</p>
    </div>
  );
}
