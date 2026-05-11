import { Link, useNavigate } from "@tanstack/react-router";
import { LogOut, Calendar, Users, Settings, LayoutDashboard } from "lucide-react";
import { SetaLogo } from "./SetaLogo";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";

export function AppHeader() {
  const { profile, role, signOut } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut();
    navigate({ to: "/login" });
  };

  const isAdmin = role === "admin";

  return (
    <header className="sticky top-0 z-40 w-full border-b border-sidebar-border bg-sidebar text-sidebar-foreground shadow-sm">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link to="/dashboard" className="flex items-center">
          <SetaLogo variant="light" />
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          <NavLink to="/dashboard" icon={<LayoutDashboard className="h-4 w-4" />}>
            Painel
          </NavLink>
          <NavLink to="/agenda" icon={<Calendar className="h-4 w-4" />}>
            Agenda
          </NavLink>
          <NavLink to="/disponibilidade" icon={<Settings className="h-4 w-4" />}>
            Disponibilidade
          </NavLink>
          {isAdmin && (
            <NavLink to="/admin/usuarios" icon={<Users className="h-4 w-4" />}>
              Usuários
            </NavLink>
          )}
        </nav>

        <div className="flex items-center gap-3">
          <div className="hidden text-right text-sm sm:block">
            <div className="font-medium leading-tight">{profile?.full_name}</div>
            <div className="text-xs text-sidebar-foreground/70">
              {isAdmin ? "Administrador" : "Representante"}
            </div>
          </div>
          <Button
            size="sm"
            variant="secondary"
            onClick={handleLogout}
            className="rounded-full"
          >
            <LogOut className="mr-1.5 h-4 w-4" />
            Sair
          </Button>
        </div>
      </div>
    </header>
  );
}

function NavLink({
  to,
  children,
  icon,
}: {
  to: string;
  children: React.ReactNode;
  icon: React.ReactNode;
}) {
  return (
    <Link
      to={to}
      className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-sidebar-foreground/85 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
      activeProps={{ className: "bg-sidebar-accent text-sidebar-foreground" }}
    >
      {icon}
      {children}
    </Link>
  );
}
