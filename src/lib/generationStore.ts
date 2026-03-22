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

function loadLibrary(): GeneratedImage[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLibrary(items: GeneratedImage[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
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
