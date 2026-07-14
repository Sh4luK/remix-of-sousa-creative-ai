import { Settings, LogOut, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { logout } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";

export default function SettingsPage() {
  const { user } = useAuth();

  return (
    <div className="p-6 lg:p-8 max-w-2xl mx-auto">
      <div className="mb-6 animate-fade-up">
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Settings className="h-6 w-6 text-primary" />
          Configurações
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Sua conta e informações do aplicativo</p>
      </div>

      <div className="space-y-4 animate-fade-up" style={{ animationDelay: "80ms" }}>
        {user && (
          <div className="rounded-xl border border-border bg-card p-5 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-9 w-9 rounded-full bg-sky-100 flex items-center justify-center shrink-0">
                <User className="h-4 w-4 text-sky-700" />
              </div>
              <div className="min-w-0">
                <h3 className="font-semibold text-sm">Conta</h3>
                <p className="text-sm text-muted-foreground truncate">{user.email}</p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => logout()}
              className="shrink-0"
            >
              <LogOut className="h-4 w-4 mr-1.5" />
              Sair
            </Button>
          </div>
        )}

        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="font-semibold mb-1">Como funciona</h3>
          <p className="text-sm text-muted-foreground">
            Você escolhe o produto, o preço e o estilo — a inteligência artificial monta a arte pronta para postar.
            Você pode criar até <strong className="text-foreground">10 artes por dia</strong>.
          </p>
        </div>


        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="font-semibold mb-1">Versão</h3>
          <p className="text-sm text-muted-foreground">PJ Mídia v1.0</p>
        </div>
      </div>
    </div>
  );
}
