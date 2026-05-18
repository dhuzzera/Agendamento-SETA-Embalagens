import { useState, useEffect } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  LogOut,
  Calendar,
  Users,
  Settings,
  LayoutDashboard,
  Shield,
  UserCircle2,
  Menu,
  Activity,
  Moon,
  Sun,
} from "lucide-react";
import { SetaLogo } from "./SetaLogo";
import { useAuth } from "@/lib/auth-context";
import { useViewMode, ViewModePermissionError } from "@/lib/view-mode";
import { useTheme } from "@/hooks/use-theme";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const NAV = [
  { to: "/dashboard", label: "Início", icon: LayoutDashboard, adminOnly: false },
  { to: "/agenda", label: "Agenda", icon: Calendar, adminOnly: false },
  { to: "/disponibilidade", label: "Disponibilidade", icon: Settings, adminOnly: false },
  { to: "/perfil", label: "Perfil", icon: UserCircle2, adminOnly: false },
  { to: "/admin/usuarios", label: "Usuários", icon: Users, adminOnly: true },
  { to: "/admin/performance", label: "Performance", icon: Activity, adminOnly: true },
] as const;

export function AppHeader() {
  const { profile, role, signOut } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mode] = useViewMode();
  const { theme, toggle: toggleTheme } = useTheme();
  const [pendingCount, setPendingCount] = useState(0);

  // Conta reuniões pendentes de confirmação
  useEffect(() => {
    if (!profile || role === "admin") return;
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    void supabase
      .from("appointments")
      .select("*", { count: "exact", head: true })
      .eq("representative_id", profile.id)
      .eq("status", "scheduled")
      .lt("appointment_date", todayStr)
      .then(({ count }) => setPendingCount(count ?? 0));
  }, [profile, role]);

  const handleLogout = async () => {
    await signOut();
    navigate({ to: "/login" });
  };

  const isAdmin = role === "admin";
  // Itens admin só aparecem para administradores E quando o modo de
  // visualização atual é "admin". No modo Representante (mesmo para um
  // admin), apenas as opções do representante são exibidas.
  const showAdminItems = isAdmin && mode === "admin";
  const navItems = NAV.filter((n) => !n.adminOnly || showAdminItems);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link to="/dashboard" className="flex items-center">
          <SetaLogo variant="auto" />
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {navItems.map((n) => (
            <NavLink key={n.to} to={n.to} icon={<n.icon className="h-4 w-4" />} badge={n.to === "/agenda" && pendingCount > 0 ? pendingCount : undefined}>
              {n.label}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          {isAdmin && <ViewSwitcher />}
          <Button
            size="icon"
            variant="ghost"
            onClick={toggleTheme}
            aria-label={theme === "dark" ? "Modo claro" : "Modo escuro"}
            className="h-9 w-9"
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
          <div className="hidden text-right text-sm lg:block">
            <div className="font-medium leading-tight text-foreground">
              {profile?.full_name}
            </div>
            <div className="text-xs text-muted-foreground">
              {isAdmin ? "Administrador" : "Representante"}
            </div>
          </div>
          <Button
            size="sm"
            onClick={handleLogout}
            className="hidden rounded-full px-4 sm:inline-flex"
          >
            <LogOut className="mr-1.5 h-4 w-4" />
            Sair
          </Button>

          {/* Mobile menu */}
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button size="icon" variant="ghost" className="md:hidden" aria-label="Abrir menu">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72">
              <SheetHeader>
                <SheetTitle>
                  <SetaLogo variant="auto" />
                </SheetTitle>
              </SheetHeader>
              <div className="mt-6 flex flex-col gap-1">
                {navItems.map((n) => (
                  <Link
                    key={n.to}
                    to={n.to}
                    onClick={() => setMobileOpen(false)}
                    className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-foreground hover:bg-accent"
                    activeProps={{ className: "bg-accent text-accent-foreground" }}
                  >
                    <n.icon className="h-4 w-4 text-primary" />
                    {n.label}
                  </Link>
                ))}
                {isAdmin && (
                  <div className="mt-3 border-t pt-3">
                    <p className="mb-2 px-3 text-xs uppercase tracking-wide text-muted-foreground">
                      Modo de visualização
                    </p>
                    <ViewSwitcher mobile />
                  </div>
                )}
                <div className="mt-4 border-t pt-4">
                  <div className="px-3 text-sm">
                    <div className="font-medium">{profile?.full_name}</div>
                    <div className="text-xs text-muted-foreground">
                      {isAdmin ? "Administrador" : "Representante"}
                    </div>
                  </div>
                  <Button
                    onClick={handleLogout}
                    className="mt-3 w-full rounded-full"
                  >
                    <LogOut className="mr-1.5 h-4 w-4" />
                    Sair
                  </Button>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}

function NavLink({
  to,
  children,
  icon,
  badge,
}: {
  to: string;
  children: React.ReactNode;
  icon: React.ReactNode;
  badge?: number;
}) {
  return (
    <Link
      to={to}
      className="relative flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      activeProps={{ className: "bg-accent text-primary" }}
    >
      {icon}
      {children}
      {badge != null && badge > 0 && (
        <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
          {badge}
        </span>
      )}
    </Link>
  );
}

function ViewSwitcher({ mobile = false }: { mobile?: boolean }) {
  const { role } = useAuth();
  const [mode, setMode] = useViewMode();
  const isAdmin = role === "admin";
  if (!isAdmin) return null;
  const opts: { value: "admin" | "representative"; label: string; icon: React.ReactNode }[] = [
    { value: "admin", label: "Admin", icon: <Shield className="h-3.5 w-3.5" /> },
    { value: "representative", label: "Representante", icon: <UserCircle2 className="h-3.5 w-3.5" /> },
  ];
  const handleClick = (value: "admin" | "representative") => {
    try {
      setMode(value);
    } catch (err) {
      if (err instanceof ViewModePermissionError) {
        toast.error(err.message);
      } else {
        throw err;
      }
    }
  };
  return (
    <div
      className={cn(
        "items-center gap-0.5 rounded-full bg-secondary p-0.5",
        mobile ? "flex" : "hidden sm:flex"
      )}
    >
      {opts.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => handleClick(o.value)}
          className={cn(
            "flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors",
            mode === o.value
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {o.icon}
          {o.label}
        </button>
      ))}
    </div>
  );
}
