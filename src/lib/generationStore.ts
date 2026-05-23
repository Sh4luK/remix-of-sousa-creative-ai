import { supabase } from "@/integrations/supabase/client";

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

// ── Guest localStorage (unauthenticated fallback) ─────────────────────────────
const GUEST_KEY = "sousa-creative-library-guest";
const GUEST_MAX = 3;

function loadGuest(): GeneratedImage[] {
  try {
    return JSON.parse(localStorage.getItem(GUEST_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function saveGuest(items: GeneratedImage[]) {
  try {
    localStorage.setItem(
      GUEST_KEY,
      JSON.stringify(
        items
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
          .slice(0, GUEST_MAX)
      )
    );
  } catch { /* quota exceeded — silently drop */ }
}

// ── Auth helper ───────────────────────────────────────────────────────────────
async function getUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}

// ── DB row → GeneratedImage ───────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function fromRow(row: any): GeneratedImage {
  const meta = (row.metadata ?? {}) as Record<string, unknown>;
  return {
    id: row.id as string,
    imageUrl: row.image_url as string,
    prompt: row.prompt as string,
    productName: (meta.productName as string) ?? "",
    category: (meta.category as string) ?? "",
    style: (meta.style as string) ?? "",
    format: (meta.format as string) ?? "",
    createdAt: row.created_at as string,
    favorite: (meta.favorite as boolean) ?? false,
  };
}

// ── Public API ────────────────────────────────────────────────────────────────
export async function getLibrary(): Promise<GeneratedImage[]> {
  const userId = await getUserId();

  if (!userId) {
    return loadGuest().sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  const { data } = await supabase
    .from("generations")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(20);

  return (data ?? []).map(fromRow);
}

export async function addToLibrary(
  item: Omit<GeneratedImage, "id" | "createdAt" | "favorite">
): Promise<GeneratedImage> {
  const userId = await getUserId();
  const now = new Date().toISOString();

  if (!userId) {
    const newItem: GeneratedImage = { ...item, id: crypto.randomUUID(), createdAt: now, favorite: false };
    const lib = loadGuest();
    lib.unshift(newItem);
    saveGuest(lib);
    return newItem;
  }

  const { data, error } = await supabase
    .from("generations")
    .insert({
      user_id: userId,
      prompt: item.prompt,
      image_url: item.imageUrl,
      metadata: {
        productName: item.productName,
        category: item.category,
        style: item.style,
        format: item.format,
        favorite: false,
      },
    })
    .select()
    .single();

  if (error) throw error;
  return fromRow(data);
}

export async function toggleFavorite(id: string): Promise<void> {
  const userId = await getUserId();

  if (!userId) {
    const lib = loadGuest();
    const idx = lib.findIndex((i) => i.id === id);
    if (idx >= 0) { lib[idx].favorite = !lib[idx].favorite; saveGuest(lib); }
    return;
  }

  const { data } = await supabase
    .from("generations")
    .select("metadata")
    .eq("id", id)
    .eq("user_id", userId)
    .single();

  if (!data) return;
  const meta = (data.metadata ?? {}) as Record<string, unknown>;

  await supabase
    .from("generations")
    .update({ metadata: { ...meta, favorite: !meta.favorite } })
    .eq("id", id)
    .eq("user_id", userId);
}

export async function deleteFromLibrary(id: string): Promise<void> {
  const userId = await getUserId();

  if (!userId) {
    saveGuest(loadGuest().filter((i) => i.id !== id));
    return;
  }

  await supabase
    .from("generations")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);
}
