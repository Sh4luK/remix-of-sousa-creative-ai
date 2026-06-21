import { api } from "@/lib/api";

export interface Product {
  id: string;
  name: string;
  category: string;
  offImageUrl?: string;
  barcode?: string;
  source: "user" | "openfoodfacts";
  displayUrl?: string; // imagem (upload em MEDIA ou offImageUrl)
  createdAt: string;
}

export interface SaveProductInput {
  name: string;
  category: string;
  offImageUrl?: string;
  barcode?: string;
  source: "user" | "openfoodfacts";
}

interface ApiProduct {
  id: number | string;
  name: string;
  category: string;
  offImageUrl?: string | null;
  barcode?: string | null;
  source: "user" | "openfoodfacts";
  displayUrl?: string | null;
  createdAt: string;
}

function fromApi(p: ApiProduct): Product {
  return {
    id: String(p.id),
    name: p.name,
    category: p.category ?? "outros",
    offImageUrl: p.offImageUrl ?? undefined,
    barcode: p.barcode ?? undefined,
    source: p.source === "openfoodfacts" ? "openfoodfacts" : "user",
    displayUrl: p.displayUrl ?? undefined,
    createdAt: p.createdAt,
  };
}

export async function getUserProducts(query?: string): Promise<Product[]> {
  const params = query?.trim() ? `?q=${encodeURIComponent(query.trim())}` : "";
  try {
    const rows = await api.get<ApiProduct[]>(`/products/${params}`);
    return rows.map(fromApi);
  } catch {
    return [];
  }
}

export async function saveProduct(input: SaveProductInput): Promise<Product | null> {
  try {
    const p = await api.post<ApiProduct>("/products/", {
      name: input.name,
      category: input.category,
      offImageUrl: input.offImageUrl ?? "",
      barcode: input.barcode ?? "",
      source: input.source,
    });
    return fromApi(p);
  } catch {
    return null;
  }
}

export async function deleteProduct(id: string): Promise<void> {
  await api.del(`/products/${id}/`);
}

export async function uploadProductImage(
  file: File,
  name = "Produto",
  category = "outros",
): Promise<{ id: string; displayUrl: string }> {
  const form = new FormData();
  form.append("file", file);
  form.append("name", name);
  form.append("category", category);
  const data = await api.postForm<{ id: number | string; displayUrl: string }>(
    "/products/upload-image/",
    form,
  );
  return { id: String(data.id), displayUrl: data.displayUrl };
}
