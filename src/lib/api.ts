// Camada de dados única: wrapper fetch sobre a API REST do Django.
// Substitui o Supabase SDK. JWT no header Authorization (sem cookies).

const BASE = `${import.meta.env.VITE_API_URL ?? ""}/api`;

const ACCESS_KEY = "pj-midia-access";
const REFRESH_KEY = "pj-midia-refresh";
export const AUTH_EVENT = "pj-auth-change";

export interface AuthUser {
  id: number | string;
  email: string;
}

// ── Token store ───────────────────────────────────────────────────────────────
export function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS_KEY);
}
function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_KEY);
}
function setTokens(access: string, refresh?: string) {
  localStorage.setItem(ACCESS_KEY, access);
  if (refresh) localStorage.setItem(REFRESH_KEY, refresh);
}
function clearTokens() {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
}
export function isAuthenticated(): boolean {
  return !!getAccessToken();
}
function emitAuthChange() {
  window.dispatchEvent(new Event(AUTH_EVENT));
}

// ── Erro de API ───────────────────────────────────────────────────────────────
export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

function extractError(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== "object") return fallback;
  const obj = payload as Record<string, unknown>;
  if (typeof obj.error === "string") return obj.error;
  if (typeof obj.detail === "string") return obj.detail;
  // DRF validation: { field: ["msg", ...] } | { non_field_errors: [...] }
  for (const value of Object.values(obj)) {
    if (Array.isArray(value) && typeof value[0] === "string") return value[0];
    if (typeof value === "string") return value;
  }
  return fallback;
}

// ── Refresh (single-flight) ─────────────────────────────────────────────────────
let refreshing: Promise<boolean> | null = null;

async function refreshAccessToken(): Promise<boolean> {
  if (refreshing) return refreshing;
  refreshing = (async () => {
    const refresh = getRefreshToken();
    if (!refresh) return false;
    try {
      const res = await fetch(`${BASE}/auth/token/refresh/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh }),
      });
      if (!res.ok) return false;
      const data = await res.json();
      if (!data.access) return false;
      setTokens(data.access);
      return true;
    } catch {
      return false;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

// ── Core request ────────────────────────────────────────────────────────────────
interface RequestOpts {
  method?: string;
  body?: unknown;       // JSON-serializável; ignorado se form for passado
  form?: FormData;      // multipart
  auth?: boolean;       // injeta Bearer (default true)
  raw?: boolean;        // retorna Response sem parse
}

async function request<T>(path: string, opts: RequestOpts = {}, _retried = false): Promise<T> {
  const { method = "GET", body, form, auth = true, raw = false } = opts;

  const headers: Record<string, string> = {};
  if (auth) {
    const token = getAccessToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  let payload: BodyInit | undefined;
  if (form) {
    payload = form; // browser define Content-Type com boundary
  } else if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }

  const res = await fetch(`${BASE}${path}`, { method, headers, body: payload });

  if (res.status === 401 && auth && !_retried) {
    if (await refreshAccessToken()) return request<T>(path, opts, true);
    clearTokens();
    emitAuthChange();
    throw new ApiError("Sessão expirada. Faça login novamente.", 401);
  }

  if (raw) {
    if (!res.ok) throw new ApiError(`Falha na requisição (${res.status}).`, res.status);
    return res as unknown as T;
  }

  if (res.status === 204) return undefined as T;

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError(extractError(data, `Falha na requisição (${res.status}).`), res.status);
  }
  return data as T;
}

export const api = {
  get: <T>(path: string, auth = true) => request<T>(path, { method: "GET", auth }),
  post: <T>(path: string, body?: unknown, auth = true) => request<T>(path, { method: "POST", body, auth }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: "PATCH", body }),
  put: <T>(path: string, body?: unknown) => request<T>(path, { method: "PUT", body }),
  del: (path: string) => request<void>(path, { method: "DELETE" }),
  postForm: <T>(path: string, form: FormData) => request<T>(path, { method: "POST", form }),
  putForm: <T>(path: string, form: FormData) => request<T>(path, { method: "PUT", form }),
  patchForm: <T>(path: string, form: FormData) => request<T>(path, { method: "PATCH", form }),
};

// ── Auth ────────────────────────────────────────────────────────────────────────
export async function login(email: string, password: string): Promise<AuthUser> {
  const data = await request<{ access: string; refresh: string; user: AuthUser }>(
    "/auth/login/",
    { method: "POST", body: { email, password }, auth: false },
  );
  setTokens(data.access, data.refresh);
  emitAuthChange();
  return data.user;
}

export async function register(
  email: string,
  password: string,
  turnstileToken: string,
): Promise<AuthUser | null> {
  const data = await request<{ access?: string; refresh?: string; user?: AuthUser }>(
    "/auth/registration/",
    {
      method: "POST",
      body: { email, password1: password, password2: password, turnstile_token: turnstileToken },
      auth: false,
    },
  );
  // Com ACCOUNT_EMAIL_VERIFICATION='none' + JWT, o registro já retorna tokens.
  if (data.access) {
    setTokens(data.access, data.refresh);
    emitAuthChange();
    return data.user ?? null;
  }
  return null; // verificação por e-mail ligada → sem sessão imediata
}

export async function loginWithGoogle(code: string): Promise<AuthUser> {
  const data = await request<{ access: string; refresh: string; user: AuthUser }>(
    "/auth/google/",
    { method: "POST", body: { code }, auth: false },
  );
  setTokens(data.access, data.refresh);
  emitAuthChange();
  return data.user;
}

export async function logout(): Promise<void> {
  try {
    await request("/auth/logout/", { method: "POST" });
  } catch {
    // logout server-side é best-effort
  }
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
  emitAuthChange();
}

export function fetchCurrentUser(): Promise<AuthUser> {
  return api.get<AuthUser>("/auth/user/");
}

// ── Imagens protegidas (geração) ─────────────────────────────────────────────────
// O endpoint /generations/<id>/image/ exige Bearer; <img src> não envia header.
// Buscamos o blob autenticado uma vez e devolvemos um object URL cacheado por URL.
const imageCache = new Map<string, string>();

export async function authedImageUrl(protectedUrl: string): Promise<string> {
  const cached = imageCache.get(protectedUrl);
  if (cached) return cached;
  // Caminho relativo ou absoluto: normaliza para path da API.
  const path = protectedUrl.startsWith("http")
    ? protectedUrl.slice(protectedUrl.indexOf("/api") + 4)
    : protectedUrl.replace(/^\/api/, "");
  const res = await request<Response>(path, { raw: true });
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  imageCache.set(protectedUrl, objectUrl);
  return objectUrl;
}
