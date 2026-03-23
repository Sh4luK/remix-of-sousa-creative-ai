import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { prompt, width, height, productImage, backgroundImage, logoImage } = await req.json();

    if (!prompt) {
      return new Response(JSON.stringify({ error: "Prompt is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const hasImages = !!(productImage || backgroundImage || logoImage);
    console.log("Generating image with prompt length:", prompt.length, "dimensions:", width, "x", height, "hasImages:", hasImages);
    console.log("Prompt preview:", prompt.slice(0, 500));

    // Build message content — multimodal if images are provided
    let messageContent: any;

    if (hasImages) {
      const parts: any[] = [{ type: "text", text: prompt }];

      if (productImage) {
        parts.push({
          type: "text",
          text: "📦 PRODUCT REFERENCE PHOTO (use this to accurately reproduce the product appearance, packaging, colors, and branding):",
        });
        parts.push({
          type: "image_url",
          image_url: { url: productImage },
        });
      }

      if (backgroundImage) {
        parts.push({
          type: "text",
          text: "🖼️ BACKGROUND REFERENCE PHOTO (use this as the background environment for the composition):",
        });
        parts.push({
          type: "image_url",
          image_url: { url: backgroundImage },
        });
      }

      messageContent = parts;
    } else {
      messageContent = prompt;
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3.1-flash-image-preview",
        messages: [
          {
            role: "user",
            content: messageContent,
          },
        ],
        modalities: ["image", "text"],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns segundos." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos insuficientes. Adicione créditos na sua conta Lovable." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);
      return new Response(
        JSON.stringify({ error: "Erro ao gerar imagem. Tente novamente." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    console.log("AI response received, extracting image...");

    const choice = data.choices?.[0];
    const message = choice?.message;

    let imageBase64 = null;

    // Check message.images array (Lovable AI Gateway format)
    if (message?.images && Array.isArray(message.images)) {
      for (const img of message.images) {
        if (img.image_url?.url) {
          imageBase64 = img.image_url.url;
          break;
        }
      }
    }

    // Fallback: check content array
    if (!imageBase64 && message?.content && Array.isArray(message.content)) {
      for (const part of message.content) {
        if (part.type === "image_url" && part.image_url?.url) {
          imageBase64 = part.image_url.url;
          break;
        }
        if (part.inline_data) {
          imageBase64 = `data:${part.inline_data.mime_type};base64,${part.inline_data.data}`;
          break;
        }
      }
    }

    if (!imageBase64) {
      console.error("No image found in response:", JSON.stringify(data).slice(0, 1000));
      return new Response(
        JSON.stringify({ error: "A IA não retornou uma imagem. Tente reformular seu pedido." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ imageUrl: imageBase64 }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("generate-image error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
