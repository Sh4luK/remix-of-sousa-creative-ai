import { Link, useLocation } from "react-router-dom";
import { useState } from "react";
import {
  LayoutDashboard,
  PlusCircle,
  Image,
  Layers,
  Settings,
  Palette,
  Menu,
  LogOut,
  Package,
} from "lucide-react";
import logoImg from "@/assets/logo-comercial-sousa.png";
import { logout } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

const NAV_ITEMS = [
  { to: "/", label: "Início", icon: LayoutDashboard },
  { to: "/nova-arte", label: "Criar Encarte", icon: PlusCircle },
  { to: "/presets", label: "Modelos Prontos", icon: Layers },
  { to: "/biblioteca", label: "Minhas Artes", icon: Image },
  { to: "/catalogo", label: "Meus Produtos", icon: Package },
  { to: "/marca", label: "Minha Marca", icon: Palette },
  { to: "/configuracoes", label: "Configurações", icon: Settings },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { user } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = () => {
    toast("Sair da sua conta?", {
      action: { label: "Sim, sair", onClick: () => logout() },
      cancel: { label: "Cancelar", onClick: () => {} },
    });
  };

  return (
    <div className="flex min-h-screen">
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-foreground/40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-sidebar text-sidebar-foreground transition-transform duration-300 lg:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-16 items-center gap-2.5 px-5 border-b border-sidebar-border">
          <img src={logoImg} alt="PJ Mídia" className="h-9 w-9 rounded-lg object-contain" />
          <div>
            <h1 className="text-sm font-bold text-sidebar-primary-foreground leading-none">
              PJ Mídia
            </h1>
            <span className="text-[11px] font-medium text-sidebar-foreground/60">
              Criador de Encartes
            </span>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          {NAV_ITEMS.map((item) => {
            const isActive = location.pathname === item.to;
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors duration-150 ${
                  isActive
                    ? "bg-sidebar-primary text-sidebar-primary-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-sidebar-border p-4 space-y-2">
          {user && (
            <div className="rounded-lg bg-sidebar-accent p-2.5">
              <p className="text-[10px] uppercase tracking-wide text-sidebar-accent-foreground/50 font-semibold">Sua conta</p>
              <p className="text-xs font-medium text-sidebar-accent-foreground/90 truncate">{user.email}</p>
            </div>
          )}
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
          >
            <LogOut className="h-3.5 w-3.5 shrink-0" />
            Sair da conta
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 lg:pl-64">
        {/* Mobile header */}
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-background/95 px-4 backdrop-blur lg:hidden">
          <button
            onClick={() => setMobileOpen(true)}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-border hover:bg-secondary transition-colors active:scale-95"
          >
            <Menu className="h-5 w-5" />
          </button>
          <img src={logoImg} alt="PJ Mídia" className="h-7 w-7 rounded object-contain" />
          <span className="font-semibold text-sm">PJ Mídia</span>
        </header>

        <main className="min-h-screen">{children}</main>
      </div>
    </div>
  );
}
