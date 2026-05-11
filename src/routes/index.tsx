import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { SetaLogo } from "@/components/SetaLogo";
import { Button } from "@/components/ui/button";
import { Calendar, Lock, Users } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/dashboard" />;

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-sidebar text-sidebar-foreground">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <SetaLogo variant="light" />
          <Link to="/login">
            <Button variant="secondary" className="rounded-full">
              Entrar
            </Button>
          </Link>
        </div>
      </header>

      <section
        className="px-4 py-20 text-center sm:px-6 lg:py-28"
        style={{ background: "var(--gradient-hero)" }}
      >
        <div className="mx-auto max-w-3xl text-primary-foreground">
          <h1 className="text-4xl font-bold tracking-tight !text-primary-foreground sm:text-5xl">
            Agendamento Comercial Seta Embalagens
          </h1>
          <p className="mt-5 text-lg text-primary-foreground/90">
            Plataforma oficial dos representantes comerciais. Reuniões organizadas,
            sem dupla marcação, com a confiabilidade que a Seta entrega há décadas.
          </p>
          <div className="mt-8 flex justify-center gap-3">
            <Link to="/login">
              <Button size="lg" variant="secondary" className="rounded-full px-8">
                Acessar painel
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="grid gap-6 md:grid-cols-3">
          <Feature
            icon={<Calendar className="h-6 w-6" />}
            title="Agenda inteligente"
            text="Cada representante define seus horários e compartilha o link único com clientes."
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

      <footer className="border-t bg-secondary py-6 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} Seta Embalagens — Produzimos embalagens, entregamos confiança.
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
    <div className="rounded-xl border bg-card p-6 shadow-[var(--shadow-card)]">
      <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-lg bg-secondary text-primary">
        {icon}
      </div>
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="mt-2 text-sm text-muted-foreground">{text}</p>
    </div>
  );
}
