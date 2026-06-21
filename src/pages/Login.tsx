import { useState } from "react";
import { Navigate } from "react-router-dom";
import { LogIn, Mail, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { login, register } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import logoImg from "@/assets/logo-comercial-sousa.png";
import { Turnstile } from "@marsidev/react-turnstile";

export default function Login() {
  const { session, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [busy, setBusy] = useState(false);

  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);

  if (!loading && session) return <Navigate to="/" replace />;

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === "signup" && !turnstileToken) {
      toast.error("Por favor, conclua a validação anti-bot (captcha) antes de prosseguir.");
      return;
    }

    setBusy(true);
    try {
      if (mode === "signin") {
        await login(email, password);
      } else {
        const user = await register(email, password, turnstileToken || "");
        if (!user) toast.success("Conta criada! Verifique seu e-mail antes de entrar.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha na autenticação.");
    } finally {
      setBusy(false);
    }
  };

  const handleGoogle = () => {
    toast.info("Login com Google em breve.");
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <img
            src={logoImg}
            alt="PJ Mídia"
            className="h-16 w-16 mx-auto rounded-2xl object-contain mb-4"
          />
          <h1 className="text-3xl font-bold text-slate-900">PJ Mídia</h1>
          <p className="text-base text-slate-600 mt-2">Entre para criar suas artes</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-4">
          <form onSubmit={handleEmailAuth} className="space-y-4">
            <div>
              <Label className="text-sm font-medium text-slate-700">E-mail</Label>
              <div className="relative mt-1.5">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  required
                  autoComplete="email"
                  className="pl-10 h-12 text-base"
                />
              </div>
            </div>
            <div>
              <Label className="text-sm font-medium text-slate-700">Senha</Label>
              <div className="relative mt-1.5">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={6}
                  autoComplete={mode === "signin" ? "current-password" : "new-password"}
                  className="pl-10 h-12 text-base"
                />
              </div>
            </div>
            {mode === "signup" && (
              <div className="flex justify-center py-2">
                <Turnstile
                  siteKey={import.meta.env.VITE_TURNSTILE_SITE_KEY || "1x00000000000000000000AA"}
                  onSuccess={(token) => setTurnstileToken(token)}
                />
              </div>
            )}

            <Button
              type="submit"
              disabled={busy}
              className="w-full h-12 bg-sky-600 hover:bg-sky-700 text-white font-semibold text-base"
            >
              <LogIn className="h-5 w-5 mr-2" />
              {busy ? "Aguarde..." : mode === "signin" ? "Entrar" : "Criar conta"}
            </Button>
          </form>

          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-slate-200" />
            <span className="text-xs text-slate-400">ou</span>
            <div className="flex-1 h-px bg-slate-200" />
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={handleGoogle}
            disabled={busy}
            className="w-full h-12 font-medium text-base"
          >
            <svg className="h-4 w-4 mr-2 shrink-0" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Continuar com Google
          </Button>

          <p className="text-center text-sm text-slate-500">
            {mode === "signin" ? "Não tem conta? " : "Já tem conta? "}
            <button
              type="button"
              onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
              className="text-sky-700 font-medium hover:underline"
            >
              {mode === "signin" ? "Criar agora" : "Entrar"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
