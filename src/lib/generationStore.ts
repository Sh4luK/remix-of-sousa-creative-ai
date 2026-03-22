// Simple in-memory + localStorage store for generated images

export interface GeneratedImage {
  id: string;
  imageUrl: string;
  prompt: string;
  productName: string;
  category: string;
  style: string;
  format: string;
  campaign?: string;
  createdAt: string;
  favorite: boolean;
}

const STORAGE_KEY = "sousa-creative-library";
const MAX_LIBRARY_SIZE = 20;

function loadLibrary(): GeneratedImage[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLibrary(items: GeneratedImage[]) {
  try {
    // Keep only the most recent items
    const trimmed = items
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, MAX_LIBRARY_SIZE);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    // If still over quota, try removing oldest items progressively
    try {
      const minimal = items
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 5);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(minimal));
    } catch {
      // Give up on persistence silently
    }
  }
}

export function getLibrary(): GeneratedImage[] {
  return loadLibrary().sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function addToLibrary(item: Omit<GeneratedImage, "id" | "createdAt" | "favorite">): GeneratedImage {
  const lib = loadLibrary();
  const newItem: GeneratedImage = {
    ...item,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    favorite: false,
  };
  lib.push(newItem);
  saveLibrary(lib);
  return newItem;
}

export function toggleFavorite(id: string) {
  const lib = loadLibrary();
  const idx = lib.findIndex((i) => i.id === id);
  if (idx >= 0) {
    lib[idx].favorite = !lib[idx].favorite;
    saveLibrary(lib);
  }
}

export function deleteFromLibrary(id: string) {
  const lib = loadLibrary().filter((i) => i.id !== id);
  saveLibrary(lib);
}
