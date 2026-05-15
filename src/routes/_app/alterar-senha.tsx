import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/alterar-senha")({
  component: ChangePasswordPage,
});

function ChangePasswordPage() {
  const { user, profile, refresh } = useAuth();
  const navigate = useNavigate();
  const forced = profile?.must_change_password ?? false;
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!pw) {
      toast.error("Digite uma senha");
      return;
    }
    if (pw !== pw2) {
      toast.error("As senhas não conferem");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: pw });
      if (error) throw error;
      if (user) {
        await supabase
          .from("profiles")
          .update({ must_change_password: false })
          .eq("id", user.id);
      }
      await refresh();
      toast.success("Senha atualizada com sucesso");
      // Após trocar a senha obrigatória, redireciona para editar o perfil
      if (forced) {
        navigate({ to: "/perfil", search: { setup: "1" } });
      } else {
        navigate({ to: "/dashboard" });
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Erro ao atualizar senha");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-md">
      <Card>
        <CardHeader>
          <CardTitle>Alterar senha</CardTitle>
          <CardDescription>
            {forced
              ? "Por segurança, defina uma nova senha pessoal para continuar."
              : "Defina uma nova senha de acesso."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Nova senha</Label>
            <div className="relative">
              <Input
                type={show ? "text" : "password"}
                value={pw}
                onChange={(e) => setPw(e.target.value)}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShow((s) => !s)}
                className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground"
                aria-label={show ? "Ocultar senha" : "Mostrar senha"}
              >
                {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div>
            <Label>Confirmar nova senha</Label>
            <Input
              type={show ? "text" : "password"}
              value={pw2}
              onChange={(e) => setPw2(e.target.value)}
            />
          </div>
          <Button onClick={submit} disabled={busy} className="w-full">
            {busy ? "Salvando…" : "Salvar nova senha"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
