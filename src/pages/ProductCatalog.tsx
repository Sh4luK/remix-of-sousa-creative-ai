import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Package, Trash2, PlusCircle, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getUserProducts, deleteProduct, type Product } from "@/lib/productStore";
import { toast } from "sonner";

export default function ProductCatalog() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [deleting, setDeleting] = useState<string | null>(null);

  const load = () =>
    getUserProducts()
      .then(setProducts)
      .catch(() => setProducts([]))
      .finally(() => setLoading(false));

  useEffect(() => { load(); }, []);

  const filtered = products.filter((p) =>
    !search.trim() || p.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleDelete = async (p: Product) => {
    if (!confirm(`Remover "${p.name}" do catálogo?`)) return;
    setDeleting(p.id);
    try {
      await deleteProduct(p.id);
      setProducts((prev) => prev.filter((x) => x.id !== p.id));
      toast.success("Produto removido.");
    } catch {
      toast.error("Não foi possível remover.");
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6 animate-fade-up">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Package className="h-6 w-6 text-primary" />
            Meu Catálogo
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Produtos salvos das suas gerações anteriores
          </p>
        </div>
        <Button asChild className="bg-sky-600 hover:bg-sky-700 text-white shrink-0">
          <Link to="/nova-arte">
            <PlusCircle className="h-4 w-4 mr-2" /> Adicionar produto
          </Link>
        </Button>
      </div>

      {/* Busca */}
      {products.length > 0 && (
        <div className="relative mb-5 max-w-sm animate-fade-up" style={{ animationDelay: "60ms" }}>
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Filtrar por nome..." className="pl-10"
          />
        </div>
      )}

      {/* Lista */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-24 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-border p-12 text-center animate-fade-up">
          <Package className="h-10 w-10 mx-auto text-muted-foreground/30 mb-4" />
          {products.length === 0 ? (
            <>
              <p className="font-semibold text-lg">Catálogo vazio</p>
              <p className="text-sm text-muted-foreground mt-1 mb-5">
                Quando você enviar uma foto de produto ou usar o Open Food Facts, ele aparece aqui.
              </p>
              <Button asChild>
                <Link to="/nova-arte"><PlusCircle className="h-4 w-4 mr-2" /> Criar primeira arte</Link>
              </Button>
            </>
          ) : (
            <p className="text-muted-foreground">Nenhum produto encontrado para "{search}"</p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 animate-fade-up" style={{ animationDelay: "80ms" }}>
          {filtered.map((p) => (
            <div key={p.id} className="bg-card border border-border rounded-xl p-4 flex items-center gap-3 group">
              {/* Thumbnail */}
              <div className="h-14 w-14 rounded-lg bg-slate-100 flex items-center justify-center overflow-hidden shrink-0">
                {p.displayUrl
                  ? <img src={p.displayUrl} alt={p.name} className="h-full w-full object-cover" />
                  : <span className="text-2xl">📦</span>}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm truncate">{p.name}</p>
                <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                  <span className="text-[10px] bg-secondary text-secondary-foreground rounded px-1.5 py-0.5 capitalize">
                    {p.category}
                  </span>
                  {p.source === "openfoodfacts" && (
                    <span className="text-[10px] bg-sky-100 text-sky-700 rounded px-1.5 py-0.5">
                      Open Food Facts
                    </span>
                  )}
                </div>
              </div>

              {/* Delete */}
              <button
                onClick={() => handleDelete(p)}
                disabled={deleting === p.id}
                className="opacity-0 group-hover:opacity-100 transition-opacity flex h-8 w-8 items-center justify-center rounded-lg hover:bg-destructive/10 hover:text-destructive text-muted-foreground"
                aria-label="Remover"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
