import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { SetaLogo } from "@/components/SetaLogo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FullscreenSplashSkeleton } from "@/components/Skeletons";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const { signIn, user, loading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (user) navigate({ to: "/dashboard" });
  }, [user, navigate]);

  // Evita flash do formulário enquanto a sessão hidrata.
  if (loading || user) return <FullscreenSplashSkeleton />;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await signIn(email, password);
    setBusy(false);
    if (error) toast.error("Falha no login: " + error);
    else navigate({ to: "/dashboard" });
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Painel institucional (desktop) */}
      <div
        className="relative hidden flex-col justify-between overflow-hidden p-12 text-primary-foreground lg:flex"
        style={{ background: "var(--gradient-hero)" }}
      >
        {/* Decoração sutil */}
        <div
          aria-hidden
          className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full opacity-20 blur-3xl"
          style={{ background: "var(--primary-foreground)" }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-40 -left-20 h-96 w-96 rounded-full opacity-10 blur-3xl"
          style={{ background: "var(--primary-foreground)" }}
        />

        <div className="relative">
          <SetaLogo variant="light" className="h-14" />
        </div>

        <div className="relative max-w-md">
          <h2 className="text-4xl font-bold leading-tight !text-primary-foreground">
            Bem-vindo ao painel comercial.
          </h2>
          <p className="mt-4 text-base leading-relaxed text-primary-foreground/85">
            Gerencie sua agenda, compartilhe seu link de reuniões e acompanhe
            seus clientes — tudo em um único lugar.
          </p>

          <ul className="mt-8 space-y-3 text-sm text-primary-foreground/90">
            <li className="flex items-start gap-3">
              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary-foreground/80" />
              Agenda integrada com disponibilidade em tempo real
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary-foreground/80" />
              Link público de agendamento para seus clientes
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary-foreground/80" />
              Histórico e perfil do representante centralizados
            </li>
          </ul>
        </div>

        <p className="relative text-xs text-primary-foreground/70">
          © {new Date().getFullYear()} Seta Embalagens — Todos os direitos reservados.
        </p>
      </div>

      {/* Formulário */}
      <div className="flex items-center justify-center bg-background px-6 py-10 sm:px-10">
        <div className="w-full max-w-[400px]">
          {/* Logo mobile */}
          <div className="mb-8 flex justify-center lg:hidden">
            <div
              className="inline-flex items-center justify-center rounded-xl px-5 py-4 shadow-[var(--shadow-elegant)]"
              style={{ background: "var(--gradient-hero)" }}
            >
              <SetaLogo variant="light" className="h-10" />
            </div>
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-semibold tracking-tight">
              Entrar na sua conta
            </h1>
            <p className="text-sm text-muted-foreground">
              Acesse o painel de administrador ou representante.
            </p>
          </div>

          <form onSubmit={onSubmit} className="mt-8 flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <Label htmlFor="email" className="px-0.5">
                E-mail corporativo
              </Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu.nome@setaembalagens.com.br"
                className="h-11 w-full px-3.5 text-sm"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="password" className="px-0.5">
                Senha
              </Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="h-11 w-full px-3.5 text-sm"
              />
            </div>
            <Button
              type="submit"
              className="mt-2 h-11 w-full px-3.5 text-sm font-medium shadow-[var(--shadow-elegant)]"
              disabled={busy}
            >
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {busy ? "Entrando…" : "Entrar"}
            </Button>
          </form>

          <div className="mt-8 border-t pt-6 text-center text-xs text-muted-foreground">
            Sem conta? Solicite acesso ao administrador da Seta.
            <div className="mt-2">
              <Link to="/" className="font-medium text-primary hover:underline">
                ← Voltar para a página inicial
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
