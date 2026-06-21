import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RATE_LIMIT = 10;
const ANON_RATE_LIMIT = 3;
const MAX_REQUEST_BYTES = 6 * 1024 * 1024;
const SIGNED_URL_TTL_SECONDS = 365 * 24 * 3600;
const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);

// Stability AI only accepts a fixed set of aspect ratios (no arbitrary pixel sizes).
const STABILITY_ASPECT_RATIOS = ["21:9", "16:9", "3:2", "5:4", "1:1", "4:5", "2:3", "9:16", "9:21"];
const NEGATIVE_PROMPT = "blurry, low quality, distorted text, misspelled text, watermark, deformed, jpeg artifacts, extra limbs";
const IMG2IMG_STRENGTH = "0.55";

const ALLOWED_ORIGINS = [
  "https://app.seudominio.com.br",
  "http://localhost:5173",
  "http://localhost:3000",
];

function getMimeFromMagicBytes(bytes: Uint8Array): string | null {
  if (bytes.length < 4) return null;
  
  // JPEG: FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  
  // PNG: 89 50 4E 47
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return "image/png";
  }
  
  // WEBP: RIFF at start and WEBP at byte 8
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 && // RIFF
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50   // WEBP
  ) {
    return "image/webp";
  }
  
  return null;
}

function validateBase64Image(dataUrl: string): { valid: boolean; bytes?: Uint8Array; error?: string } {
  const parts = dataUrl.split(",");
  const base64Data = parts[1];
  if (!base64Data) {
    return { valid: false, error: "Formato de data URL inválido." };
  }
  
  try {
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const mime = getMimeFromMagicBytes(bytes);
    if (!mime || !ALLOWED_MIME.has(mime)) {
      return { valid: false, error: "Tipo de imagem inválido. Use JPEG, PNG ou WebP real." };
    }
    return { valid: true, bytes };
  } catch {
    return { valid: false, error: "Falha ao decodificar base64." };
  }
}

// Map arbitrary width/height to the closest Stability-supported aspect ratio.
function pickAspectRatio(width: number, height: number): string {
  const target = width / height;
  let best = "1:1";
  let bestDiff = Infinity;
  for (const ar of STABILITY_ASPECT_RATIOS) {
    const [w, h] = ar.split(":").map(Number);
    const diff = Math.abs(w / h - target);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = ar;
    }
  }
  return best;
}

// Stability returns raw bytes; anonymous users get an inline data URL (no hosted URL).
function bytesToDataUrl(bytes: Uint8Array, mime = "image/webp"): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return `data:${mime};base64,${btoa(binary)}`;
}

serve(async (req) => {
  const origin = req.headers.get("origin") || "";
  const isAllowed = ALLOWED_ORIGINS.includes(origin) || origin.startsWith("http://localhost:");
  const responseOrigin = isAllowed ? origin : ALLOWED_ORIGINS[0];

  const corsHeaders = {
    "Access-Control-Allow-Origin": responseOrigin,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (!isAllowed) {
    return new Response(JSON.stringify({ error: "Origem não permitida (CORS)" }), {
      status: 403,
      headers: { "Content-Type": "application/json" }
    });
  }

  try {
    // ── Content-length guard ───────────────────────────────────────────────────
    const rawLength = parseInt(req.headers.get("content-length") ?? "0", 10);
    if (rawLength > 0 && rawLength > MAX_REQUEST_BYTES) {
      return new Response(JSON.stringify({ error: "Requisição muito grande. Máximo 6MB." }), {
        status: 413,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
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

    // ── Rate limit check ───────────────────────────────────────────────────────
    if (userId) {
      // Atomic Rate limit for authenticated users via PL/pgSQL
      const { data: allowed, error: rpcError } = await admin.rpc("check_and_log_usage", {
        p_user: userId,
        p_limit: RATE_LIMIT,
        p_window: "24 hours"
      });

      if (rpcError) {
        console.error("RPC rate limit error:", rpcError);
        return new Response(JSON.stringify({ error: "Erro ao processar limite de uso." }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      if (!allowed) {
        return new Response(JSON.stringify({ error: `Limite de ${RATE_LIMIT} gerações por 24h atingido. Tente amanhã.` }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
    } else {
      // Anonymous rate limit via Upstash Redis REST API
      const redisUrl = Deno.env.get("UPSTASH_REDIS_REST_URL");
      const redisToken = Deno.env.get("UPSTASH_REDIS_REST_TOKEN");

      if (redisUrl && redisToken) {
        const ip = req.headers.get("x-real-ip") || req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
        const key = `rate_limit_anon:${ip}`;
        
        try {
          const incrRes = await fetch(`${redisUrl}/incr/${key}`, {
            headers: { Authorization: `Bearer ${redisToken}` }
          });
          if (!incrRes.ok) {
            console.error("Upstash Redis error:", await incrRes.text());
          } else {
            const { result } = await incrRes.json();
            if (result === 1) {
              await fetch(`${redisUrl}/expire/${key}/86400`, {
                headers: { Authorization: `Bearer ${redisToken}` }
              });
            }
            if (result > ANON_RATE_LIMIT) {
              return new Response(JSON.stringify({ error: `Limite de ${ANON_RATE_LIMIT} gerações anônimas por 24h atingido. Faça login para continuar.` }), {
                status: 429,
                headers: { ...corsHeaders, "Content-Type": "application/json" }
              });
            }
          }
        } catch (redisErr) {
          console.error("Upstash connection failed:", redisErr);
        }
      }
    }

    // ── Parse body ─────────────────────────────────────────────────────────────
    const { 
      prompt, 
      width, 
      height, 
      productImage, 
      backgroundImage, 
      logoImage,
      productName,
      category,
      style,
      format
    } = await req.json();

    if (!prompt) {
      return new Response(JSON.stringify({ error: "Prompt é obrigatório." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // ── Validate uploaded image MIME types (Magic Bytes) ──────────────────────
    const imagesToValidate = [
      { name: "productImage", value: productImage },
      { name: "backgroundImage", value: backgroundImage },
      { name: "logoImage", value: logoImage },
    ];

    for (const img of imagesToValidate) {
      if (!img.value) continue;
      const validation = validateBase64Image(img.value);
      if (!validation.valid) {
        return new Response(JSON.stringify({ error: `Imagem inválida em ${img.name}: ${validation.error}` }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
    }

    // ── Deduplicate Logo (retrieve from storage if not sent and user is authenticated) ──
    let activeLogoImage = logoImage;
    if (!activeLogoImage && userId) {
      try {
        const { data: brand } = await admin
          .from("brands")
          .select("logo_path")
          .eq("user_id", userId)
          .single();

        if (brand?.logo_path) {
          const { data: logoBlob, error: logoErr } = await admin.storage
            .from("brand-logos")
            .download(brand.logo_path);

          if (!logoErr && logoBlob) {
            const buffer = await logoBlob.arrayBuffer();
            const bytes = new Uint8Array(buffer);
            let binary = "";
            for (let i = 0; i < bytes.byteLength; i++) {
              binary += String.fromCharCode(bytes[i]);
            }
            activeLogoImage = `data:image/webp;base64,${btoa(binary)}`;
          }
        }
      } catch (logoCatch) {
        console.error("Deduplicated logo retrieval failed:", logoCatch);
      }
    }

    // ── Build AI request with Stability AI (Stable Image) ─────────────────────
    const STABILITY_KEY = Deno.env.get("STABILITY_KEY");
    if (!STABILITY_KEY) throw new Error("STABILITY_KEY não configurada no ambiente.");

    const imageToUse = productImage || backgroundImage;
    const isImageToImage = !!imageToUse;

    // "core" (cheapest) for text-to-image; image-to-image requires the SD3 endpoint.
    const sd3Model = Deno.env.get("STABILITY_SD3_MODEL") || "sd3.5-large";
    const txt2imgModel = Deno.env.get("STABILITY_MODEL") || "core";
    const model = isImageToImage ? "sd3" : txt2imgModel;
    const endpoint = `https://api.stability.ai/v2beta/stable-image/generate/${model}`;

    const form = new FormData();
    form.append("prompt", prompt);
    form.append("negative_prompt", NEGATIVE_PROMPT);
    form.append("output_format", "webp");

    if (isImageToImage) {
      const baseImage = validateBase64Image(imageToUse);
      if (!baseImage.valid || !baseImage.bytes) {
        return new Response(JSON.stringify({ error: "Imagem base inválida para image-to-image." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
      form.append("mode", "image-to-image");
      form.append("model", sd3Model);
      form.append("strength", IMG2IMG_STRENGTH);
      form.append("image", new Blob([baseImage.bytes], { type: "image/webp" }), "input.webp");
    } else {
      // aspect_ratio and image are mutually exclusive on Stability.
      form.append("aspect_ratio", pickAspectRatio(width || 1024, height || 1024));
      if (model === "sd3") {
        form.append("mode", "text-to-image");
        form.append("model", sd3Model);
      }
    }

    const aiResponse = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${STABILITY_KEY}`,
        Accept: "image/*",
      },
      body: form,
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("Stability AI error:", aiResponse.status, errText);

      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições da IA excedido. Tente em alguns segundos." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos da Stability AI esgotados." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
      if (aiResponse.status === 403) {
        return new Response(JSON.stringify({ error: "Conteúdo bloqueado pela moderação da IA. Ajuste o prompt." }), {
          status: 422,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
      return new Response(JSON.stringify({ error: "Erro ao gerar imagem com Stability AI. Tente novamente." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // With Accept: image/*, moderation hits arrive as a header on a 200 response.
    const finishReason = aiResponse.headers.get("finish-reason") || aiResponse.headers.get("finish_reason");
    if (finishReason === "CONTENT_FILTERED") {
      return new Response(JSON.stringify({ error: "Conteúdo bloqueado pelo filtro de segurança da IA. Ajuste o prompt." }), {
        status: 422,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const imageBytes = new Uint8Array(await aiResponse.arrayBuffer());
    if (imageBytes.length === 0) {
      console.error("Empty image buffer from Stability AI");
      return new Response(JSON.stringify({ error: "A Stability AI não retornou uma imagem." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // ── Upload to storage and record in Database (authenticated users only) ────
    // Stability returns no hosted URL: default to inline data URL (anon fallback).
    let finalImageUrl = bytesToDataUrl(imageBytes);
    let dbGenerationRecord = null;

    if (userId) {
      let storagePath = "";
      try {
        storagePath = `${userId}/${crypto.randomUUID()}.webp`;

        const { error: uploadError } = await admin.storage
          .from("generated-images")
          .upload(storagePath, imageBytes, { contentType: "image/webp", upsert: false });

        if (uploadError) {
          console.error("Storage upload failed:", uploadError.message);
        } else {
          const { data: signed } = await admin.storage
            .from("generated-images")
            .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS);
          if (signed?.signedUrl) finalImageUrl = signed.signedUrl;
        }
      } catch (storageErr) {
        console.error("Storage upload error:", storageErr);
      }

      // Record generation directly in database
      try {
        const { data: row, error: insertError } = await admin
          .from("generations")
          .insert({
            user_id: userId,
            prompt: prompt,
            image_url: finalImageUrl,
            storage_path: storagePath,
            metadata: {
              productName: productName || "Produto",
              category: category || "outros",
              style: style || "promocional-popular",
              format: format || "1:1",
              favorite: false,
            },
          })
          .select()
          .single();

        if (insertError) {
          console.error("Database generation record insertion failed:", insertError);
        } else {
          dbGenerationRecord = {
            id: row.id,
            imageUrl: row.image_url,
            prompt: row.prompt,
            productName: (row.metadata as Record<string, unknown>)?.productName || "",
            category: (row.metadata as Record<string, unknown>)?.category || "",
            style: (row.metadata as Record<string, unknown>)?.style || "",
            format: (row.metadata as Record<string, unknown>)?.format || "",
            createdAt: row.created_at,
            favorite: false,
          };
        }
      } catch (dbErr) {
        console.error("Database tracking error:", dbErr);
      }
    }

    return new Response(JSON.stringify({ 
      imageUrl: finalImageUrl,
      generation: dbGenerationRecord
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (e) {
    console.error("generate-image unhandled error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
