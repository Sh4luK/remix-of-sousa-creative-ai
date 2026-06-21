import { api, authedImageUrl } from "@/lib/api";

export interface GeneratedImage {
  id: string;
  imageUrl: string;
  prompt: string;
  productName: string;
  category: string;
  style: string;
  format: string;
  createdAt: string;
  favorite: boolean;
}

// imageUrl da API é protegido (Bearer). Resolve para object URL utilizável em <img>.
async function resolveImage(item: GeneratedImage): Promise<GeneratedImage> {
  try {
    return { ...item, imageUrl: await authedImageUrl(item.imageUrl) };
  } catch {
    return item;
  }
}

export async function getLibrary(cursorCreatedAt?: string, limit = 20): Promise<GeneratedImage[]> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (cursorCreatedAt) params.set("cursor", cursorCreatedAt);
  try {
    const rows = await api.get<GeneratedImage[]>(`/generations/?${params}`);
    return Promise.all(rows.map(resolveImage));
  } catch {
    return [];
  }
}

export async function toggleFavorite(id: string, next?: boolean): Promise<void> {
  await api.patch(`/generations/${id}/`, { favorite: next ?? true });
}

export async function deleteFromLibrary(id: string): Promise<void> {
  try {
    await api.del(`/generations/${id}/`);
  } catch {
    /* swallow — UI já removeu otimisticamente */
  }
}
