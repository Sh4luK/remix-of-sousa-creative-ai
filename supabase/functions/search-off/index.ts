import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const ALLOWED_ORIGINS = [
  "https://app.seudominio.com.br",
  "http://localhost:5173",
  "http://localhost:3000",
];

const CORS_HEADERS = (origin: string) => ({
  "Access-Control-Allow-Origin": ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, content-type",
});

serve(async (req: Request) => {
  const origin = req.headers.get("origin") ?? "";

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS(origin) });
  }

  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405, headers: CORS_HEADERS(origin) });
  }

  let query = "";
  let limit = 8;
  try {
    const body = await req.json();
    query = (body.q as string)?.trim() ?? "";
    limit = Math.min(Number(body.limit ?? 8), 24);
  } catch {
    return new Response(JSON.stringify([]), {
      status: 200,
      headers: { "Content-Type": "application/json", ...CORS_HEADERS(origin) },
    });
  }

  if (query.length < 2) {
    return new Response(JSON.stringify([]), {
      status: 200,
      headers: { "Content-Type": "application/json", ...CORS_HEADERS(origin) },
    });
  }

  const url = new URL("https://world.openfoodfacts.org/cgi/search.pl");
  url.searchParams.set("search_terms", query);
  url.searchParams.set("action", "process");
  url.searchParams.set("json", "1");
  url.searchParams.set("cc", "br");
  url.searchParams.set("lc", "pt");
  url.searchParams.set("fields", "code,product_name,image_front_small_url,brands,categories_tags");
  url.searchParams.set("page_size", String(limit));

  try {
    const res = await fetch(url.toString(), {
      signal: AbortSignal.timeout(8000),
      headers: { "User-Agent": "PJMidia/1.0 (contato@pjmidia.com.br)" },
    });

    if (!res.ok) {
      return new Response(JSON.stringify([]), {
        status: 200,
        headers: { "Content-Type": "application/json", ...CORS_HEADERS(origin) },
      });
    }

    const data = await res.json();
    const products = (data.products ?? []) as Record<string, unknown>[];

    const result = products
      .filter((p) => typeof p.product_name === "string" && (p.product_name as string).trim())
      .map((p) => ({
        barcode: (p.code as string) ?? "",
        name: (p.product_name as string).trim(),
        brand: (p.brands as string) ?? "",
        categoriesTags: (p.categories_tags as string[]) ?? [],
        imageUrl: (p.image_front_small_url as string) || null,
      }));

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json", ...CORS_HEADERS(origin) },
    });
  } catch {
    return new Response(JSON.stringify([]), {
      status: 200,
      headers: { "Content-Type": "application/json", ...CORS_HEADERS(origin) },
    });
  }
});
