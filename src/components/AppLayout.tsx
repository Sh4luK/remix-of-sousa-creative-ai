import { Link, useLocation } from "react-router-dom";
import { useState } from "react";
import {
  LayoutDashboard,
  PlusCircle,
  Image,
  Layers,
  Settings,
  History,
  Palette,
  Menu,
  X,
} from "lucide-react";
import logoImg from "@/assets/logo-comercial-sousa.png";

const NAV_ITEMS = [
  { to: "/", label: "Início", icon: LayoutDashboard },
  { to: "/nova-arte", label: "Nova Arte", icon: PlusCircle },
  { to: "/presets", label: "Estilos de Arte", icon: Layers },
  { to: "/biblioteca", label: "Minhas Artes", icon: Image },
  { to: "/marca", label: "Config. Marca", icon: Palette },
  { to: "/configuracoes", label: "Configurações", icon: Settings },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

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
          <img src={logoImg} alt="Comercial Sousa" className="h-9 w-9 rounded-lg object-contain" />
          <div>
            <h1 className="text-sm font-bold text-sidebar-primary-foreground leading-none">
              Sousa Creative
            </h1>
            <span className="text-[11px] font-medium text-sidebar-foreground/60">
              AI Image Studio
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

        <div className="border-t border-sidebar-border p-4">
          <div className="rounded-lg bg-sidebar-accent p-3">
            <p className="text-xs font-medium text-sidebar-accent-foreground/80">
              Comercial Sousa
            </p>
            <p className="text-[11px] text-sidebar-foreground/50 mt-0.5">
              Motor: Nano Banana 2
            </p>
          </div>
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
          <img src={logoImg} alt="Comercial Sousa" className="h-7 w-7 rounded object-contain" />
          <span className="font-semibold text-sm">Sousa Creative AI</span>
        </header>

        <main className="min-h-screen">{children}</main>
      </div>
    </div>
  );
}
