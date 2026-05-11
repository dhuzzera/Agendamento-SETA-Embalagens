import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { SetaLogo } from "@/components/SetaLogo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const { signIn, user } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  if (user) {
    navigate({ to: "/dashboard" });
  }

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
      <div
        className="hidden flex-col justify-between p-10 text-primary-foreground lg:flex"
        style={{ background: "var(--gradient-hero)" }}
      >
        <SetaLogo variant="light" />
        <div>
          <h2 className="text-3xl font-bold !text-primary-foreground">
            Bem-vindo ao painel comercial.
          </h2>
          <p className="mt-3 max-w-md text-primary-foreground/85">
            Gerencie sua agenda, compartilhe seu link de reuniões e acompanhe seus
            clientes — tudo em um único lugar.
          </p>
        </div>
        <p className="text-xs text-primary-foreground/70">
          © {new Date().getFullYear()} Seta Embalagens
        </p>
      </div>

      <div className="flex items-center justify-center bg-background p-6">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <div className="rounded-lg bg-sidebar p-3">
              <SetaLogo variant="light" />
            </div>
          </div>
          <h1 className="text-2xl font-semibold">Entrar</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Acesse sua conta de administrador ou representante.
          </p>

          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">E-mail corporativo</Label>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu.nome@setaembalagens.com.br"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? "Entrando…" : "Entrar"}
            </Button>
          </form>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            Sem conta? Solicite acesso ao administrador da Seta.{" "}
            <Link to="/" className="text-primary hover:underline">
              Voltar
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
