import { Settings } from "lucide-react";

export default function SettingsPage() {
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
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="font-semibold mb-1">Motor de IA</h3>
          <p className="text-sm text-muted-foreground">Nano Banana 2 (google/gemini-3.1-flash-image-preview)</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="font-semibold mb-1">Versão</h3>
          <p className="text-sm text-muted-foreground">Sousa Creative AI v1.0</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="font-semibold mb-1">Armazenamento</h3>
          <p className="text-sm text-muted-foreground">Armazenamento local (localStorage). Dados persistem no navegador.</p>
        </div>
      </div>
    </div>
  );
}
