import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 24 * 60 * 60 * 1000;
const MAX_REQUEST_BYTES = 6 * 1024 * 1024;
const SIGNED_URL_TTL_SECONDS = 365 * 24 * 3600;
const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function mimeFromDataUrl(dataUrl: string): string | null {
  return dataUrl.match(/^data:([^;]+);base64,/)?.[1] ?? null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // ── Content-length guard (best-effort — not all clients set this) ──────────
    const rawLength = parseInt(req.headers.get("content-length") ?? "0", 10);
    if (rawLength > 0 && rawLength > MAX_REQUEST_BYTES) {
      return json({ error: "Requisição muito grande. Máximo 6MB." }, 413);
    }

    // ── Service-role Supabase client ───────────────────────────────────────────
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // ── Authenticate caller ────────────────────────────────────────────────────
    const jwt = req.headers.get("Authorization")?.replace("Bearer ", "") ?? "";
    let userId: string | null = null;
    if (jwt) {
      const { data } = await admin.auth.getUser(jwt);
      userId = data.user?.id ?? null;
    }

    // ── Rate limit (authenticated users only) ──────────────────────────────────
    if (userId) {
      const windowStart = new Date(Date.now() - RATE_WINDOW_MS).toISOString();
      const { count } = await admin
        .from("usage_logs")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .gte("created_at", windowStart);

      if ((count ?? 0) >= RATE_LIMIT) {
        return json({ error: `Limite de ${RATE_LIMIT} gerações por 24h atingido. Tente amanhã.` }, 429);
      }
    }

    // ── Parse body ─────────────────────────────────────────────────────────────
    const { prompt, width, height, productImage, backgroundImage, logoImage } = await req.json();

    if (!prompt) return json({ error: "Prompt é obrigatório." }, 400);

    // ── Validate uploaded image MIME types ─────────────────────────────────────
    for (const [field, value] of [
      ["productImage", productImage],
      ["backgroundImage", backgroundImage],
      ["logoImage", logoImage],
    ] as [string, string | undefined][]) {
      if (!value) continue;
      const mime = mimeFromDataUrl(value);
      if (mime && !ALLOWED_MIME.has(mime)) {
        return json({ error: `Tipo de imagem inválido em ${field}. Use JPEG, PNG ou WebP.` }, 400);
      }
    }

    // ── Build AI request with fal.ai (Flux) ──────────────────────────────────
    const FAL_KEY = Deno.env.get("FAL_KEY");
    if (!FAL_KEY) throw new Error("FAL_KEY não configurada no ambiente (FAL_KEY)");

    const FAL_MODEL = Deno.env.get("FAL_MODEL") || "fal-ai/flux/schnell";

    // Se houver imagem de produto, usamos o modelo de image-to-image
    const imageToUse = productImage || backgroundImage;
    const isImageToImage = !!imageToUse;

    const endpoint = isImageToImage
      ? `https://queue.fal.run/${FAL_MODEL}/image-to-image?sync_mode=true`
      : `https://queue.fal.run/${FAL_MODEL}?sync_mode=true`;

    console.log("Generating image with fal.ai model:", FAL_MODEL, "endpoint:", endpoint, "dimensions:", width, "x", height, "isImageToImage:", isImageToImage);

    const requestBody: Record<string, any> = {
      prompt: prompt,
      image_size: {
        width: width || 1024,
        height: height || 1024,
      },
      num_inference_steps: FAL_MODEL.includes("schnell") ? 4 : 28,
      enable_safety_checker: true,
      sync_mode: true,
    };

    if (isImageToImage) {
      requestBody.image_url = imageToUse;
      requestBody.strength = 0.55; // Força balanceada para compor mantendo as cores/detalhes do produto
    }

    const aiResponse = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Key ${FAL_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) return json({ error: "Limite de requisições da IA fal.ai excedido. Tente em alguns segundos." }, 429);
      if (aiResponse.status === 401 || aiResponse.status === 403) return json({ error: "Credenciais inválidas na API fal.ai." }, 401);
      const errText = await aiResponse.text();
      console.error("fal.ai API error:", aiResponse.status, errText);
      return json({ error: "Erro ao gerar imagem com fal.ai. Tente novamente." }, 500);
    }

    const aiData = await aiResponse.json();
    const imageUrl = aiData.images?.[0]?.url;

    if (!imageUrl) {
      console.error("No image URL in fal.ai response:", JSON.stringify(aiData).slice(0, 500));
      return json({ error: "A fal.ai não retornou uma URL de imagem. Tente reformular seu pedido." }, 500);
    }

    // ── Upload to storage (authenticated users only) ────────────────────────────
    let finalImageUrl = imageUrl;

    if (userId) {
      try {
        const imageFetch = await fetch(imageUrl);
        if (imageFetch.ok) {
          const arrayBuffer = await imageFetch.arrayBuffer();
          const bytes = new Uint8Array(arrayBuffer);
          const storagePath = `${userId}/${crypto.randomUUID()}.webp`;

          const { error: uploadError } = await admin.storage
            .from("generated-images")
            .upload(storagePath, bytes, { contentType: "image/webp", upsert: false });

          if (uploadError) {
            console.error("Storage upload failed:", uploadError.message);
          } else {
            const { data: signed } = await admin.storage
              .from("generated-images")
              .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS);
            if (signed?.signedUrl) finalImageUrl = signed.signedUrl;
          }
        }
      } catch (storageErr) {
        console.error("Storage error, falling back to direct fal.ai URL:", storageErr);
      }

      // ── Record usage ─────────────────────────────────────────────────────────
      await admin.from("usage_logs").insert({ user_id: userId });
    }

    return json({ imageUrl: finalImageUrl });
  } catch (e) {
    console.error("generate-image unhandled error:", e);
    return json({ error: e instanceof Error ? e.message : "Erro desconhecido." }, 500);
  }
});
