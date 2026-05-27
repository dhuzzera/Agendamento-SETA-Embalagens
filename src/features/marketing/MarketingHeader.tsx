import { Link, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { useTheme } from "@/hooks/use-theme";
import { SetaLogo } from "@/components/SetaLogo";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Megaphone,
  Mail,
  Users,
  Zap,
  Star,
  FileText,
  Moon,
  Sun,
  LogOut,
  Menu,
  ArrowLeft,
} from "lucide-react";
import { useState } from "react";

const MKT_NAV = [
  { to: "/marketing", label: "Campanhas", icon: Mail },
  { to: "/marketing/listas", label: "Listas", icon: Users },
  { to: "/marketing/templates", label: "Templates", icon: FileText },
  { to: "/marketing/automacoes", label: "Automações", icon: Zap },
  { to: "/marketing/scoring", label: "Lead Scoring", icon: Star },
];

export function MarketingHeader() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const { theme, toggle: toggleTheme } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = async () => {
    await signOut();
    navigate({ to: "/login" });
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-4">
          <Link to="/marketing" className="flex items-center gap-2">
            <SetaLogo variant="auto" className="h-8" />
            <span className="hidden text-sm font-bold text-primary sm:inline">Marketing</span>
          </Link>
          <Link
            to="/selecionar"
            className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <ArrowLeft className="h-3 w-3" />
            Menu
          </Link>
        </div>

        <nav className="hidden items-center gap-1 md:flex">
          {MKT_NAV.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              activeProps={{ className: "bg-accent text-primary" }}
              activeOptions={{ exact: n.to === "/marketing" }}
            >
              <n.icon className="h-4 w-4" />
              {n.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Button size="icon" variant="ghost" onClick={toggleTheme} className="h-8 w-8">
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
          <Button size="sm" variant="ghost" onClick={handleLogout} className="hidden sm:inline-flex">
            <LogOut className="mr-1.5 h-4 w-4" />
            Sair
          </Button>

          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button size="icon" variant="ghost" className="md:hidden">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-64">
              <SheetHeader>
                <SheetTitle>Marketing</SheetTitle>
              </SheetHeader>
              <div className="mt-6 flex flex-col gap-1">
                {MKT_NAV.map((n) => (
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
