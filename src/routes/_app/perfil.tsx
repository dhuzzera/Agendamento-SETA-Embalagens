import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";

import { Camera, Loader2, Trash2, User } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

export const Route = createFileRoute("/_app/perfil")({
  component: ProfilePage,
});

const profileSchema = z.object({
  full_name: z
    .string()
    .trim()
    .min(2, "Informe seu nome completo")
    .max(120, "Nome muito longo"),
  phone: z
    .string()
    .trim()
    .max(30, "Telefone muito longo")
    .optional()
    .or(z.literal("")),
  bio: z
    .string()
    .trim()
    .max(500, "Biografia deve ter no máximo 500 caracteres")
    .optional()
    .or(z.literal("")),
});

const MAX_AVATAR_BYTES = 3 * 1024 * 1024; // 3 MB

function ProfilePage() {
  const { profile, refresh, loading } = useAuth();
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [bio, setBio] = useState("");
  const [allowOnline, setAllowOnline] = useState(true);
  const [allowPresencial, setAllowPresencial] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name ?? "");
      setPhone(profile.phone ?? "");
      setBio(profile.bio ?? "");
      setAllowOnline(profile.allow_online ?? true);
      setAllowPresencial(profile.allow_presencial ?? true);
    }
  }, [profile]);

  if (loading || !profile) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const initials = (profile.full_name ?? "?")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");

  const handleAvatarPick = () => fileInputRef.current?.click();

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Selecione um arquivo de imagem.");
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      toast.error("Imagem muito grande (máximo 3 MB).");
      return;
    }

    setUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${profile.id}/avatar-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;

      const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
      const publicUrl = pub.publicUrl;

      const { error: updErr } = await supabase
        .from("profiles")
        .update({ avatar_url: publicUrl })
        .eq("id", profile.id);
      if (updErr) throw updErr;

      // Best-effort: remove old avatar files from this user's folder
      if (profile.avatar_url) {
        try {
          const { data: files } = await supabase.storage
            .from("avatars")
            .list(profile.id);
          const newName = path.split("/").pop();
          const stale = (files ?? [])
            .filter((f) => f.name !== newName)
            .map((f) => `${profile.id}/${f.name}`);
          if (stale.length) {
            await supabase.storage.from("avatars").remove(stale);
          }
        } catch {
          // ignore cleanup errors
        }
      }

      await refresh();
      toast.success("Foto atualizada!");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao enviar foto";
      toast.error(msg);
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveAvatar = async () => {
    if (!profile.avatar_url) return;
    setUploading(true);
    try {
      // Remove all files in user's folder
      const { data: files } = await supabase.storage
        .from("avatars")
        .list(profile.id);
      if (files?.length) {
        await supabase.storage
          .from("avatars")
          .remove(files.map((f) => `${profile.id}/${f.name}`));
      }
      const { error } = await supabase
        .from("profiles")
        .update({ avatar_url: null })
        .eq("id", profile.id);
      if (error) throw error;
      await refresh();
      toast.success("Foto removida.");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao remover foto";
      toast.error(msg);
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    const parsed = profileSchema.safeParse({ full_name: fullName, phone, bio });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Dados inválidos");
      return;
    }
    if (!allowOnline && !allowPresencial) {
      toast.error("Mantenha pelo menos uma modalidade ativa (online ou presencial).");
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: parsed.data.full_name,
          phone: parsed.data.phone || null,
          bio: parsed.data.bio || null,
          allow_online: allowOnline,
          allow_presencial: allowPresencial,
        })
        .eq("id", profile.id);
      if (error) throw error;
      await refresh();
      toast.success("Perfil atualizado!");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao salvar";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Meu perfil</h1>
        <p className="text-muted-foreground">
          As informações abaixo aparecem no seu link público de agendamento.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Foto de perfil</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-start gap-6 sm:flex-row sm:items-center">
            <div className="relative">
              {profile.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt={profile.full_name}
                  className="h-28 w-28 rounded-full border-4 border-background object-cover shadow-md"
                />
              ) : (
                <div className="flex h-28 w-28 items-center justify-center rounded-full border-4 border-background bg-secondary text-3xl font-bold text-primary shadow-md">
                  {initials || <User className="h-10 w-10" />}
                </div>
              )}
              {uploading && (
                <div className="absolute inset-0 flex items-center justify-center rounded-full bg-background/70">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              )}
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarChange}
              />
              <Button
                type="button"
                variant="outline"
                onClick={handleAvatarPick}
                disabled={uploading}
              >
                <Camera className="mr-1.5 h-4 w-4" />
                {profile.avatar_url ? "Trocar foto" : "Enviar foto"}
              </Button>
              {profile.avatar_url && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleRemoveAvatar}
                  disabled={uploading}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="mr-1.5 h-4 w-4" />
                  Remover
                </Button>
              )}
            </div>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            JPG, PNG ou WEBP. Máximo de 3 MB.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Informações</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="full_name">Nome completo *</Label>
              <Input
                id="full_name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                maxLength={120}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" value={profile.email} disabled />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="phone">Telefone</Label>
              <Input
                id="phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(00) 00000-0000"
                maxLength={30}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="bio">Biografia</Label>
              <Textarea
                id="bio"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Fale um pouco sobre você e como pode ajudar seus clientes…"
                rows={5}
                maxLength={500}
              />
              <div className="flex justify-end text-xs text-muted-foreground">
                {bio.length}/500
              </div>
            </div>
          </div>


          <div className="mt-6 flex justify-end">
            <Button onClick={handleSave} disabled={saving} size="lg">
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {saving ? "Salvando…" : "Salvar alterações"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
