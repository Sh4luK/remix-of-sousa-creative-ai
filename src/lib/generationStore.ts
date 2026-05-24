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

interface DBRow {
  id: string;
  user_id: string;
  prompt: string;
  image_url: string;
  storage_path?: string | null;
  metadata?: unknown;
  created_at: string;
}

// ── Guest localStorage (unauthenticated fallback) ─────────────────────────────
const GUEST_KEY = "pj-midia-library-guest";
const GUEST_MAX = 50; // raised maximum capacity for guests to enjoy pagination

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
function fromRow(row: DBRow): GeneratedImage {
  const meta = (row.metadata || {}) as Record<string, unknown>;
  return {
    id: row.id,
    imageUrl: row.image_url,
    prompt: row.prompt,
    productName: (meta.productName as string) ?? "",
    category: (meta.category as string) ?? "",
    style: (meta.style as string) ?? "",
    format: (meta.format as string) ?? "",
    createdAt: row.created_at,
    favorite: (meta.favorite as boolean) ?? false,
  };
}

// ── Public API with Cursor Pagination ─────────────────────────────────────────
export async function getLibrary(cursorCreatedAt?: string, limit = 20): Promise<GeneratedImage[]> {
  const userId = await getUserId();

  if (!userId) {
    const local = loadGuest().sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    if (cursorCreatedAt) {
      return local.filter(item => new Date(item.createdAt).getTime() < new Date(cursorCreatedAt).getTime()).slice(0, limit);
    }
    return local.slice(0, limit);
  }

  let query = supabase
    .from("generations")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (cursorCreatedAt) {
    query = query.lt("created_at", cursorCreatedAt);
  }

  const { data, error } = await query.limit(limit);

  if (error) {
    console.error("Failed to query generations:", error.message);
    return [];
  }

  return (data as DBRow[] || []).map(fromRow);
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
      storage_path: "", // inserted via Edge Function normally, this is fallback/redundancy
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
  return fromRow(data as DBRow);
}

export async function toggleFavorite(id: string): Promise<void> {
  const userId = await getUserId();

  if (!userId) {
    const lib = loadGuest();
    const idx = lib.findIndex((i) => i.id === id);
    if (idx >= 0) { lib[idx].favorite = !lib[idx].favorite; saveGuest(lib); }
    return;
  }

  const { data, error } = await supabase
    .from("generations")
    .select("metadata")
    .eq("id", id)
    .eq("user_id", userId)
    .single();

  if (error || !data) return;
  const meta = (data.metadata || {}) as Record<string, unknown>;

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

  const { error } = await supabase
    .from("generations")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) {
    console.error("Failed to delete generation row:", error.message);
  }
}
