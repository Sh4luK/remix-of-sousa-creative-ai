import { supabase } from "@/integrations/supabase/client";

export interface Product {
  id: string;
  name: string;
  category: string;
  storagePath?: string;
  offImageUrl?: string;
  barcode?: string;
  source: "user" | "openfoodfacts";
  displayUrl?: string; // signed URL (user-uploaded) ou offImageUrl (OFF)
  createdAt: string;
}

export interface SaveProductInput {
  name: string;
  category: string;
  storagePath?: string;
  offImageUrl?: string;
  barcode?: string;
  source: "user" | "openfoodfacts";
}

async function getUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}

function fromRow(row: Record<string, unknown>): Product {
  return {
    id: row.id as string,
    name: row.name as string,
    category: (row.category as string) ?? "outros",
    storagePath: (row.storage_path as string) ?? undefined,
    offImageUrl: (row.off_image_url as string) ?? undefined,
    barcode: (row.barcode as string) ?? undefined,
    source: ((row.source as string) === "openfoodfacts" ? "openfoodfacts" : "user"),
    createdAt: row.created_at as string,
  };
}

export async function getProductSignedUrl(storagePath: string): Promise<string | null> {
  const { data } = await supabase.storage
    .from("product-images")
    .createSignedUrl(storagePath, 7 * 24 * 3600);
  return data?.signedUrl ?? null;
}

export async function getUserProducts(query?: string): Promise<Product[]> {
  const userId = await getUserId();
  if (!userId) return [];

  let req = supabase
    .from("products")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (query?.trim()) {
    req = req.ilike("name", `%${query.trim()}%`);
  }

  const { data } = await req;
  const products = ((data ?? []) as Record<string, unknown>[]).map(fromRow);

  // Attach display URLs in parallel
  await Promise.all(
    products.map(async (p) => {
      if (p.offImageUrl) {
        p.displayUrl = p.offImageUrl;
      } else if (p.storagePath) {
        p.displayUrl = (await getProductSignedUrl(p.storagePath)) ?? undefined;
      }
    })
  );

  return products;
}

export async function saveProduct(input: SaveProductInput): Promise<Product | null> {
  const userId = await getUserId();
  if (!userId) return null;

  // Avoid exact-name duplicates per user
  const { data: existing } = await supabase
    .from("products")
    .select("id")
    .eq("user_id", userId)
    .ilike("name", input.name)
    .maybeSingle();

  if (existing) return null; // already saved

  const { data, error } = await supabase
    .from("products")
    .insert({
      user_id: userId,
      name: input.name,
      category: input.category,
      storage_path: input.storagePath ?? null,
      off_image_url: input.offImageUrl ?? null,
      barcode: input.barcode ?? null,
      source: input.source,
    })
    .select()
    .single();

  if (error) throw error;
  return fromRow(data as Record<string, unknown>);
}

export async function deleteProduct(id: string): Promise<void> {
  const userId = await getUserId();
  if (!userId) return;

  const { data } = await supabase
    .from("products")
    .select("storage_path")
    .eq("id", id)
    .eq("user_id", userId)
    .single();

  if (data?.storage_path) {
    await supabase.storage
      .from("product-images")
      .remove([data.storage_path as string]);
  }

  await supabase.from("products").delete().eq("id", id).eq("user_id", userId);
}

export async function uploadProductImage(
  file: File
): Promise<{ storagePath: string; signedUrl: string }> {
  const userId = await getUserId();
  if (!userId) throw new Error("Não autenticado");

  const storagePath = `${userId}/${crypto.randomUUID()}.webp`;

  const { error } = await supabase.storage
    .from("product-images")
    .upload(storagePath, file, { contentType: "image/webp", upsert: false });

  if (error) throw error;

  const { data: signed } = await supabase.storage
    .from("product-images")
    .createSignedUrl(storagePath, 7 * 24 * 3600);

  if (!signed?.signedUrl) throw new Error("Falha ao gerar URL da imagem");
  return { storagePath, signedUrl: signed.signedUrl };
}
