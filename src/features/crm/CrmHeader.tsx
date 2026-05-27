import { Link, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { useViewMode } from "@/lib/view-mode";
import { useTheme } from "@/hooks/use-theme";
import { SetaLogo } from "@/components/SetaLogo";
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
import {
  Handshake,
  Building2,
  Users,
  CheckSquare,
  Plus,
  Moon,
  Sun,
  LogOut,
  Menu,
  ArrowLeft,
  AlertTriangle,
  Settings2,
  BarChart3,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

const CRM_NAV = [
  { to: "/crm", label: "Negociações", icon: Handshake },
  { to: "/crm/empresas", label: "Empresas", icon: Building2 },
  { to: "/crm/contatos", label: "Contatos", icon: Users },
  { to: "/crm/tarefas", label: "Tarefas", icon: CheckSquare },
  { to: "/crm/analises", label: "Análises", icon: BarChart3 },
  { to: "/crm/duplicados", label: "Duplicados", icon: AlertTriangle },
  { to: "/crm/funis", label: "Funis", icon: Settings2 },
];

export function CrmHeader() {
  const { profile, role, signOut } = useAuth();
  const [viewMode] = useViewMode();
  const isAdmin = role === "admin" && viewMode === "admin";
  const navigate = useNavigate();
  const { theme, toggle: toggleTheme } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Filter nav items by role
  const navItems = isAdmin
    ? CRM_NAV
    : CRM_NAV.filter((n) => ["/crm", "/crm/tarefas"].includes(n.to));

  const handleLogout = async () => {
    await signOut();
    navigate({ to: "/login" });
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-4">
          <Link to="/crm" className="flex items-center gap-2">
            <SetaLogo variant="auto" className="h-8" />
            <span className="hidden text-sm font-bold text-primary sm:inline">CRM</span>
          </Link>

          <Link
            to="/selecionar"
            className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <ArrowLeft className="h-3 w-3" />
            Menu
          </Link>
        </div>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-1 md:flex">
          {navItems.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              activeProps={{ className: "bg-accent text-primary" }}
              activeOptions={{ exact: n.to === "/crm" }}
            >
              <n.icon className="h-4 w-4" />
              {n.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          {/* + Criar dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm">
                <Plus className="mr-1.5 h-4 w-4" />
                Criar
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link to="/crm" search={{ criar: "negociacao" }} className="flex items-center gap-2">
                  <Handshake className="h-4 w-4" />
                  Criar Negociação
                </Link>
              </DropdownMenuItem>
              {isAdmin && (
                <>
                  <DropdownMenuItem asChild>
                    <Link to="/crm/empresas" search={{ criar: true }} className="flex items-center gap-2">
                      <Building2 className="h-4 w-4" />
                      Criar Empresa
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/crm/contatos" search={{ criar: true }} className="flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      Criar Contato
                    </Link>
                  </DropdownMenuItem>
                </>
              )}
              <DropdownMenuItem asChild>
                <Link to="/crm/tarefas" search={{ criar: true }} className="flex items-center gap-2">
                  <CheckSquare className="h-4 w-4" />
                  Criar Tarefa
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button size="icon" variant="ghost" onClick={toggleTheme} className="h-8 w-8">
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>

          <Button size="sm" variant="ghost" onClick={handleLogout} className="hidden sm:inline-flex">
            <LogOut className="mr-1.5 h-4 w-4" />
            Sair
          </Button>

          {/* Mobile */}
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button size="icon" variant="ghost" className="md:hidden">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-64">
              <SheetHeader>
                <SheetTitle>CRM SETA</SheetTitle>
              </SheetHeader>
              <div className="mt-6 flex flex-col gap-1">
                {navItems.map((n) => (
                  <Link
                    key={n.to}
                    to={n.to}
                    onClick={() => setMobileOpen(false)}
                    className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium hover:bg-accent"
                    activeProps={{ className: "bg-accent text-primary" }}
                  >
                    <n.icon className="h-4 w-4 text-primary" />
                    {n.label}
                  </Link>
                ))}
                <div className="mt-4 border-t pt-4">
                  <div className="px-3 text-sm font-medium">{profile?.full_name}</div>
                  <Button onClick={handleLogout} className="mt-3 w-full" size="sm">
                    <LogOut className="mr-1.5 h-4 w-4" /> Sair
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
