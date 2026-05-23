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

    // ── Build AI request ───────────────────────────────────────────────────────
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const hasImages = !!(productImage || backgroundImage || logoImage);
    console.log("Generating image — prompt length:", prompt.length, "dimensions:", width, "x", height, "hasImages:", hasImages);

    let messageContent: unknown;
    if (hasImages) {
      const parts: unknown[] = [{ type: "text", text: prompt }];
      if (productImage) {
        parts.push({ type: "text", text: "📦 PRODUCT REFERENCE PHOTO (use this to accurately reproduce the product appearance, packaging, colors, and branding):" });
        parts.push({ type: "image_url", image_url: { url: productImage } });
      }
      if (backgroundImage) {
        parts.push({ type: "text", text: "🖼️ BACKGROUND REFERENCE PHOTO (use this as the background environment for the composition):" });
        parts.push({ type: "image_url", image_url: { url: backgroundImage } });
      }
      if (logoImage) {
        parts.push({ type: "text", text: "🏷️ BRAND LOGO (place this logo visibly in the generated image, integrated into the composition, preferably in a corner or header area):" });
        parts.push({ type: "image_url", image_url: { url: logoImage } });
      }
      messageContent = parts;
    } else {
      messageContent = prompt;
    }

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3.1-flash-image-preview",
        messages: [{ role: "user", content: messageContent }],
        modalities: ["image", "text"],
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) return json({ error: "Limite de requisições da IA excedido. Tente em alguns segundos." }, 429);
      if (aiResponse.status === 402) return json({ error: "Créditos insuficientes. Adicione créditos na conta Lovable." }, 402);
      const errText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errText);
      return json({ error: "Erro ao gerar imagem. Tente novamente." }, 500);
    }

    const aiData = await aiResponse.json();
    const message = aiData.choices?.[0]?.message;

    let imageBase64: string | null = null;

    if (message?.images && Array.isArray(message.images)) {
      for (const img of message.images) {
        if (img.image_url?.url) { imageBase64 = img.image_url.url; break; }
      }
    }
    if (!imageBase64 && message?.content && Array.isArray(message.content)) {
      for (const part of message.content) {
        if (part.type === "image_url" && part.image_url?.url) { imageBase64 = part.image_url.url; break; }
        if (part.inline_data) { imageBase64 = `data:${part.inline_data.mime_type};base64,${part.inline_data.data}`; break; }
      }
    }

    if (!imageBase64) {
      console.error("No image in AI response:", JSON.stringify(aiData).slice(0, 500));
      return json({ error: "A IA não retornou uma imagem. Tente reformular seu pedido." }, 500);
    }

    // ── Upload to storage (authenticated users only) ────────────────────────────
    let imageUrl = imageBase64;

    if (userId) {
      try {
        const b64 = imageBase64.replace(/^data:[^;]+;base64,/, "");
        const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
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
          if (signed?.signedUrl) imageUrl = signed.signedUrl;
        }
      } catch (storageErr) {
        console.error("Storage error, falling back to base64:", storageErr);
      }

      // ── Record usage ─────────────────────────────────────────────────────────
      await admin.from("usage_logs").insert({ user_id: userId });
    }

    return json({ imageUrl });
  } catch (e) {
    console.error("generate-image unhandled error:", e);
    return json({ error: e instanceof Error ? e.message : "Erro desconhecido." }, 500);
  }
});
