import { api } from "@/lib/api";

export interface OFFProduct {
  barcode: string;
  name: string;
  brand: string;
  category: string;
  imageUrl?: string;
}

// O backend (proxy Open Food Facts) já infere a categoria e devolve o shape final.
export async function searchOFF(query: string, limit = 8): Promise<OFFProduct[]> {
  if (query.trim().length < 2) return [];
  try {
    const rows = await api.get<(OFFProduct & { imageUrl?: string | null })[]>(
      `/products/search-off/?q=${encodeURIComponent(query.trim())}&limit=${limit}`,
    );
    return rows.map((p) => ({ ...p, imageUrl: p.imageUrl ?? undefined }));
  } catch {
    return [];
  }
}
