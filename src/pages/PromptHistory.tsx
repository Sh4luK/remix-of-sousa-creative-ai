import { useState } from "react";
import { getLibrary } from "@/lib/generationStore";
import { History as HistoryIcon, Copy, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function PromptHistory() {
  const library = getLibrary();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const handleCopy = (prompt: string) => {
    navigator.clipboard.writeText(prompt);
    toast.success("Prompt copiado!");
  };

  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto">
      <div className="mb-6 animate-fade-up">
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <HistoryIcon className="h-6 w-6 text-primary" />
          Histórico de Prompts
        </h1>
        <p className="text-sm text-muted-foreground mt-1">{library.length} gerações registradas</p>
      </div>

      {library.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-border p-12 text-center animate-fade-up">
          <HistoryIcon className="h-10 w-10 mx-auto text-muted-foreground/30 mb-4" />
          <p className="font-medium">Nenhum histórico ainda</p>
        </div>
      ) : (
        <div className="space-y-3 animate-fade-up" style={{ animationDelay: "80ms" }}>
          {library.map((item) => (
            <div key={item.id} className="rounded-xl border border-border bg-card p-4 transition-all duration-200 hover:shadow-sm">
              <div className="flex items-start gap-3">
                <img src={item.imageUrl} alt={item.productName} className="h-14 w-14 rounded-lg object-cover shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-sm">{item.productName}</h3>
                    <span className="text-xs text-muted-foreground shrink-0 ml-2">
                      {new Date(item.createdAt).toLocaleDateString("pt-BR")}
                    </span>
                  </div>
                  <div className="flex gap-1.5 mt-1">
                    <span className="inline-block rounded bg-secondary px-1.5 py-0.5 text-[10px] font-medium">{item.style}</span>
                    <span className="inline-block rounded bg-secondary px-1.5 py-0.5 text-[10px] font-medium">{item.format}</span>
                  </div>
                  {expandedId === item.id && (
                    <p className="mt-3 text-xs font-mono bg-muted p-3 rounded-lg break-words leading-relaxed animate-scale-in">
                      {item.prompt}
                    </p>
                  )}
                  <div className="flex gap-2 mt-2">
                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}>
                      {expandedId === item.id ? <><EyeOff className="h-3 w-3 mr-1" /> Ocultar</> : <><Eye className="h-3 w-3 mr-1" /> Ver prompt</>}
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => handleCopy(item.prompt)}>
                      <Copy className="h-3 w-3 mr-1" /> Copiar
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
