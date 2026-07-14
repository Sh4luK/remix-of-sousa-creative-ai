import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Heart, Trash2, Download, Image as ImageIcon, Search, PlusCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getLibrary, toggleFavorite, deleteFromLibrary, type GeneratedImage } from "@/lib/generationStore";
import { toast } from "sonner";

export default function Library() {
  const [library, setLibrary] = useState<GeneratedImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "favorites">("all");
  const [selected, setSelected] = useState<GeneratedImage | null>(null);

  const refresh = () => getLibrary().then(setLibrary);

  useEffect(() => {
    getLibrary()
      .then(setLibrary)
      .finally(() => setLoading(false));
  }, []);

  const filtered = library.filter((img) => {
    if (filter === "favorites" && !img.favorite) return false;
    if (search && !img.productName.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const handleToggleFav = async (id: string, next: boolean) => {
    await toggleFavorite(id, next);
    refresh();
  };

  const handleDelete = (id: string, name: string) => {
    toast(`Excluir a arte "${name}"?`, {
      description: "Essa ação não pode ser desfeita.",
      action: {
        label: "Sim, excluir",
        onClick: async () => {
          await deleteFromLibrary(id);
          refresh();
          if (selected?.id === id) setSelected(null);
          toast.success("Arte excluída");
        },
      },
      cancel: { label: "Cancelar", onClick: () => {} },
    });
  };

  const handleDownload = (img: GeneratedImage) => {
    const a = document.createElement("a");
    a.href = img.imageUrl;
    a.download = `pjmidia-${img.productName.replace(/\s+/g, "-")}-${Date.now()}.webp`;
    a.click();
    toast.success("Imagem salva! Procure na pasta Downloads ou na galeria.");
  };

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="mb-6 animate-fade-up">
        <h1 className="text-2xl font-bold tracking-tight">Minhas Artes</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {library.length === 0
            ? "Tudo que você criar fica guardado aqui"
            : `Você tem ${library.length} ${library.length === 1 ? "arte salva" : "artes salvas"}`}
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6 animate-fade-up" style={{ animationDelay: "80ms" }}>
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por produto..."
            className="pl-10"
          />
        </div>
        <div className="flex gap-2">
          <Button variant={filter === "all" ? "default" : "outline"} size="sm" onClick={() => setFilter("all")}>
            Todas
          </Button>
          <Button variant={filter === "favorites" ? "default" : "outline"} size="sm" onClick={() => setFilter("favorites")}>
            <Heart className="h-3.5 w-3.5 mr-1.5" /> Favoritas
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="aspect-square rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-border p-12 text-center animate-fade-up">
          <ImageIcon className="h-10 w-10 mx-auto text-muted-foreground/30 mb-4" />
          <p className="font-medium">
            {library.length === 0 ? "Você ainda não criou nenhuma arte" : "Nenhuma arte encontrada"}
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            {library.length === 0
              ? "Leva menos de 1 minuto para criar a primeira."
              : "Tente buscar por outro nome ou limpar o filtro."}
          </p>
          {library.length === 0 && (
            <Button asChild className="mt-4">
              <Link to="/nova-arte">
                <PlusCircle className="h-4 w-4 mr-2" /> Criar minha primeira arte
              </Link>
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 animate-fade-up" style={{ animationDelay: "80ms" }}>
          {filtered.map((img) => (
            <div
              key={img.id}
              className="group relative overflow-hidden rounded-xl border border-border bg-card transition-all duration-200 hover:shadow-lg cursor-pointer active:scale-[0.98]"
              onClick={() => setSelected(img)}
            >
              <div className="aspect-square overflow-hidden">
                <img src={img.imageUrl} alt={img.productName} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
              </div>
              <div className="p-3 space-y-1">
                <p className="text-sm font-medium truncate">{img.productName}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(img.createdAt).toLocaleDateString("pt-BR")}
                </p>
              </div>
              {/* Ações: sempre visíveis no touch (mobile), hover no desktop */}
              <div className="absolute top-2 right-2 flex gap-1.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                <button
                  aria-label="Favoritar"
                  onClick={(e) => { e.stopPropagation(); handleToggleFav(img.id, !img.favorite); }}
                  className="flex h-9 w-9 sm:h-8 sm:w-8 items-center justify-center rounded-full bg-card/95 shadow-sm backdrop-blur transition-colors hover:bg-card"
                >
                  <Heart className={`h-4 w-4 ${img.favorite ? "fill-primary text-primary" : "text-foreground"}`} />
                </button>
                <button
                  aria-label="Baixar"
                  onClick={(e) => { e.stopPropagation(); handleDownload(img); }}
                  className="flex h-9 w-9 sm:h-8 sm:w-8 items-center justify-center rounded-full bg-card/95 shadow-sm backdrop-blur transition-colors hover:bg-card"
                >
                  <Download className="h-4 w-4" />
                </button>
                <button
                  aria-label="Excluir"
                  onClick={(e) => { e.stopPropagation(); handleDelete(img.id, img.productName); }}
                  className="flex h-9 w-9 sm:h-8 sm:w-8 items-center justify-center rounded-full bg-card/95 shadow-sm backdrop-blur transition-colors hover:bg-destructive/90 hover:text-destructive-foreground"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Detail Modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/50 p-4" onClick={() => setSelected(null)}>
          <div
            className="max-w-2xl w-full max-h-[90vh] overflow-y-auto rounded-2xl bg-card p-4 shadow-2xl animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            <img src={selected.imageUrl} alt={selected.productName} className="w-full rounded-xl" />
            <div className="mt-4 space-y-2">
              <h3 className="font-bold text-lg">{selected.productName}</h3>
              <p className="text-xs text-muted-foreground">
                {new Date(selected.createdAt).toLocaleDateString("pt-BR", {
                  day: "2-digit", month: "long", year: "numeric",
                  hour: "2-digit", minute: "2-digit",
                })}
              </p>
              <details className="text-xs">
                <summary className="cursor-pointer text-muted-foreground hover:text-foreground">Detalhes técnicos</summary>
                <p className="mt-2 font-mono bg-muted p-3 rounded-lg break-words">{selected.prompt}</p>
              </details>
              <div className="flex gap-2 pt-2">
                <Button size="sm" onClick={() => handleDownload(selected)}>
                  <Download className="h-4 w-4 mr-1.5" /> Baixar
                </Button>
                <Button size="sm" variant="outline" onClick={() => setSelected(null)}>
                  Fechar
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
