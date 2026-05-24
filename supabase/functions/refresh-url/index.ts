import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SIGNED_URL_TTL_SECONDS = 3600; // 1 hour is highly secure and standard for cached pages

const ALLOWED_ORIGINS = [
  "https://app.seudominio.com.br",
  "http://localhost:5173",
  "http://localhost:3000",
];

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
    // ── Service-role Supabase client ───────────────────────────────────────────
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // ── Authenticate caller ────────────────────────────────────────────────────
    const jwt = req.headers.get("Authorization")?.replace("Bearer ", "") ?? "";
    if (!jwt) {
      return new Response(JSON.stringify({ error: "Não autorizado. Token de autenticação ausente." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const { data: authData } = await admin.auth.getUser(jwt);
    const userId = authData.user?.id ?? null;

    if (!userId) {
      return new Response(JSON.stringify({ error: "Não autorizado. Usuário inválido." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // ── Parse body ─────────────────────────────────────────────────────────────
    const { id } = await req.json();
    if (!id) {
      return new Response(JSON.stringify({ error: "ID da geração é obrigatório." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // ── Query the generation path and ownership ───────────────────────────────
    const { data: generation, error: queryError } = await admin
      .from("generations")
      .select("storage_path, user_id")
      .eq("id", id)
      .eq("user_id", userId)
      .single();

    if (queryError || !generation) {
      return new Response(JSON.stringify({ error: "Geração não encontrada ou acesso negado." }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    if (!generation.storage_path) {
      return new Response(JSON.stringify({ error: "Caminho de armazenamento indisponível para esta geração." }), {
        status: 422,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // ── Create a fresh signed URL ──────────────────────────────────────────────
    const { data: signed, error: signError } = await admin.storage
      .from("generated-images")
      .createSignedUrl(generation.storage_path, SIGNED_URL_TTL_SECONDS);

    if (signError || !signed?.signedUrl) {
      console.error("Storage signed URL creation failed:", signError);
      return new Response(JSON.stringify({ error: "Falha ao gerar nova URL de visualização." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    return new Response(JSON.stringify({ imageUrl: signed.signedUrl }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (e) {
    console.error("refresh-url unhandled error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
