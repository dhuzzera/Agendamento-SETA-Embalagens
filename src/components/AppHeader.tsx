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
  ArrowLeft,
  Handshake,
  ChevronDown,
} from "lucide-react";
import { SetaLogo } from "./SetaLogo";
import { useAuth } from "@/lib/auth-context";
import { useViewMode, ViewModePermissionError } from "@/lib/view-mode";
import { useTheme } from "@/hooks/use-theme";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

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
  const showAdminItems = isAdmin && mode === "admin";

  // Navegação principal (sem Perfil/Disponibilidade — vão em submenu)
  const mainNav = [
    { to: "/agendamento", label: "Início", icon: LayoutDashboard },
    { to: "/agenda", label: "Agenda", icon: Calendar, badge: pendingCount > 0 ? pendingCount : undefined },
    { to: "/negociacoes", label: "Negociações", icon: Handshake },
  ];

  // Mobile nav items (todos flat)
  const mobileNav = [
    { to: "/agendamento", label: "Início", icon: LayoutDashboard },
    { to: "/agenda", label: "Agenda", icon: Calendar },
    { to: "/negociacoes", label: "Negociações", icon: Handshake },
    ...(showAdminItems
      ? [
          { to: "/admin/usuarios", label: "Usuários", icon: Users },
          { to: "/perfil", label: "Perfil", icon: UserCircle2 },
          { to: "/disponibilidade", label: "Disponibilidade", icon: Settings },
        ]
      : [
          { to: "/perfil", label: "Perfil", icon: UserCircle2 },
          { to: "/disponibilidade", label: "Disponibilidade", icon: Settings },
        ]),
  ];

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link to="/agendamento" className="flex items-center gap-3">
          <SetaLogo variant="auto" />
        </Link>
        <Link
          to="/selecionar"
          className="hidden items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground sm:flex"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Menu
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {mainNav.map((n) => (
            <NavLink key={n.to} to={n.to} icon={<n.icon className="h-4 w-4" />} badge={n.badge}>
              {n.label}
            </NavLink>
          ))}

          {/* Admin: Usuários com submenu Perfil + Disponibilidade */}
          {showAdminItems && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
                  <Users className="h-4 w-4" />
                  Usuários
                  <ChevronDown className="h-3 w-3" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem asChild>
                  <Link to="/admin/usuarios" className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Gestão de usuários
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/perfil" className="flex items-center gap-2">
                    <UserCircle2 className="h-4 w-4" />
                    Meu perfil
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/disponibilidade" className="flex items-center gap-2">
                    <Settings className="h-4 w-4" />
                    Disponibilidade
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Representante: Perfil com submenu Disponibilidade */}
          {!showAdminItems && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
                  <UserCircle2 className="h-4 w-4" />
                  Perfil
                  <ChevronDown className="h-3 w-3" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem asChild>
                  <Link to="/perfil" className="flex items-center gap-2">
                    <UserCircle2 className="h-4 w-4" />
                    Meu perfil
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/disponibilidade" className="flex items-center gap-2">
                    <Settings className="h-4 w-4" />
                    Disponibilidade
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
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
                {mobileNav.map((n) => (
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
