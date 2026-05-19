import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { SetaLogo } from "@/components/SetaLogo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { FullscreenSplashSkeleton } from "@/components/Skeletons";
import { AlertCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

/**
 * Traduz erros do Supabase para mensagens claras e acionáveis.
 */
function translateAuthError(raw: string): string {
  const msg = raw.toLowerCase();
  if (msg.includes("invalid login credentials") || msg.includes("invalid_credentials")) {
    return "E-mail ou senha incorretos. Verifique e tente novamente.";
  }
  if (msg.includes("email not confirmed")) {
    return "Confirme seu e-mail antes de entrar. Verifique sua caixa de entrada.";
  }
  if (msg.includes("too many requests") || msg.includes("rate limit")) {
    return "Muitas tentativas. Aguarde alguns instantes antes de tentar novamente.";
  }
  if (msg.includes("user not found")) {
    return "Não encontramos uma conta com esse e-mail.";
  }
  if (msg.includes("network") || msg.includes("fetch")) {
    return "Sem conexão com o servidor. Verifique sua internet e tente novamente.";
  }
  if (msg.includes("user is banned") || msg.includes("disabled")) {
    return "Sua conta está desativada. Fale com o administrador da SETA.";
  }
  return "Não foi possível entrar. Tente novamente em instantes.";
}

function LoginPage() {
  const { signIn, user, loading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotBusy, setForgotBusy] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);

  useEffect(() => {
    if (user) navigate({ to: "/selecionar" });
  }, [user, navigate]);

  // Evita flash do formulário enquanto a sessão hidrata.
  if (loading || user) return <FullscreenSplashSkeleton />;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;

    // Validação local rápida — antes de bater na rede.
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setErrorMsg("Preencha e-mail e senha para continuar.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setErrorMsg("Digite um e-mail válido (ex.: nome@setaembalagens.com.br).");
      return;
    }

    setErrorMsg(null);
    setBusy(true);
    const { error } = await signIn(trimmedEmail, password);
    setBusy(false);

    if (error) {
      const friendly = translateAuthError(String(error));
      setErrorMsg(friendly);
      toast.error(friendly);
      return;
    }

    toast.success("Login realizado com sucesso!");
    navigate({ to: "/selecionar" });
  };

  const onForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (forgotBusy) return;
    const trimmed = forgotEmail.trim();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      toast.error("Digite um e-mail válido.");
      return;
    }
    setForgotBusy(true);
    const { supabase } = await import("@/integrations/supabase/client");
    await supabase.auth.resetPasswordForEmail(trimmed, {
      redirectTo: `${window.location.origin}/alterar-senha`,
    });
    setForgotBusy(false);
    setForgotSent(true);
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
          © {new Date().getFullYear()} SETA Embalagens — Todos os direitos reservados.
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

          <form
            onSubmit={onSubmit}
            noValidate
            aria-busy={busy}
            className="mt-8 flex flex-col gap-5"
          >
            {errorMsg && (
              <div
                role="alert"
                aria-live="assertive"
                className="flex items-start gap-2.5 rounded-md border border-destructive/30 bg-destructive/10 px-3.5 py-2.5 text-sm text-destructive"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span className="leading-snug">{errorMsg}</span>
              </div>
            )}

            <div className="flex flex-col gap-2">
              <Label htmlFor="email" className="px-0.5">
                E-mail corporativo
              </Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                disabled={busy}
                aria-invalid={!!errorMsg}
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (errorMsg) setErrorMsg(null);
                }}
                placeholder="seu.nome@setaembalagens.com.br"
                className="h-11 w-full px-3.5 text-sm"
              />
            </div>
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between px-0.5">
                <Label htmlFor="password">Senha</Label>
                <button
                  type="button"
                  onClick={() => { setShowForgot(true); setForgotEmail(email.trim()); setForgotSent(false); }}
                  className="text-xs text-primary hover:underline"
                >
                  Esqueci minha senha
                </button>
              </div>
              <PasswordInput
                id="password"
                autoComplete="current-password"
                required
                disabled={busy}
                aria-invalid={!!errorMsg}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (errorMsg) setErrorMsg(null);
                }}
                placeholder="••••••••"
                className="h-11 w-full px-3.5 text-sm"
              />
            </div>
            <Button
              type="submit"
              className="mt-2 h-11 w-full px-3.5 text-sm font-medium shadow-[var(--shadow-elegant)]"
              disabled={busy}
            >
              {busy ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                  <span>Entrando…</span>
                </>
              ) : (
                "Entrar"
              )}
            </Button>
          </form>

          <div className="mt-8 border-t pt-6 text-center text-xs text-muted-foreground">
            Sem conta? Solicite acesso ao administrador da SETA.
            <div className="mt-2">
              <Link to="/" className="font-medium text-primary hover:underline">
                ← Voltar para a página inicial
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Modal: Esqueci minha senha */}
      {showForgot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-sm rounded-xl border bg-background p-6 shadow-xl">
            {forgotSent ? (
              <>
                <h2 className="text-lg font-semibold">E-mail enviado!</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Se esse e-mail estiver cadastrado, você receberá um link para redefinir sua senha em instantes. Verifique também a caixa de spam.
                </p>
                <Button className="mt-4 w-full" onClick={() => setShowForgot(false)}>
                  Fechar
                </Button>
              </>
            ) : (
              <>
                <h2 className="text-lg font-semibold">Recuperar senha</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Digite seu e-mail e enviaremos um link para redefinir sua senha.
                </p>
                <form onSubmit={onForgotSubmit} className="mt-4 flex flex-col gap-3">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="forgot-email">E-mail</Label>
                    <Input
                      id="forgot-email"
                      type="email"
                      autoComplete="email"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      placeholder="seu.nome@setaembalagens.com.br"
                      disabled={forgotBusy}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" className="flex-1" onClick={() => setShowForgot(false)} disabled={forgotBusy}>
                      Cancelar
                    </Button>
                    <Button type="submit" className="flex-1" disabled={forgotBusy}>
                      {forgotBusy ? (
                        <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Enviando…</>
                      ) : "Enviar link"}
                    </Button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
