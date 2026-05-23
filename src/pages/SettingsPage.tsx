import { Settings, LogOut, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
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
        <p className="text-sm text-muted-foreground mt-1">Configurações gerais do sistema</p>
      </div>

      <div className="space-y-4 animate-fade-up" style={{ animationDelay: "80ms" }}>
        {user && (
          <div className="rounded-xl border border-border bg-card p-5 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-9 w-9 rounded-full bg-orange-100 flex items-center justify-center shrink-0">
                <User className="h-4 w-4 text-orange-600" />
              </div>
              <div className="min-w-0">
                <h3 className="font-semibold text-sm">Conta</h3>
                <p className="text-sm text-muted-foreground truncate">{user.email}</p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => supabase.auth.signOut()}
              className="shrink-0"
            >
              <LogOut className="h-4 w-4 mr-1.5" />
              Sair
            </Button>
          </div>
        )}

        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="font-semibold mb-1">Motor de IA</h3>
          <p className="text-sm text-muted-foreground">Nano Banana 2 (google/gemini-3.1-flash-image-preview)</p>
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="font-semibold mb-1">Limite de geração</h3>
          <p className="text-sm text-muted-foreground">10 artes por dia por conta.</p>
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="font-semibold mb-1">Versão</h3>
          <p className="text-sm text-muted-foreground">Sousa Creative AI v1.0</p>
        </div>
      </div>
    </div>
  );
}
