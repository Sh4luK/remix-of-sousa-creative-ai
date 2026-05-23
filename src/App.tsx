import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Sparkles } from "lucide-react";
import { Toaster } from "@/components/ui/sonner";
import AppLayout from "@/components/AppLayout";
import Dashboard from "@/pages/Dashboard";
import NewGeneration from "@/pages/NewGeneration";
import Library from "@/pages/Library";
import Presets from "@/pages/Presets";
import BrandSettings from "@/pages/BrandSettings";
import SettingsPage from "@/pages/SettingsPage";
import Login from "@/pages/Login";
import NotFound from "./pages/NotFound.tsx";
import { useAuth } from "@/hooks/useAuth";

function ProtectedRoutes() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex items-center gap-2 text-slate-400">
          <Sparkles className="h-5 w-5 animate-pulse" />
          <span className="text-sm">Carregando...</span>
        </div>
      </div>
    );
  }

  if (!session) return <Navigate to="/login" replace />;

  return (
    <AppLayout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/nova-arte" element={<NewGeneration />} />
        <Route path="/biblioteca" element={<Library />} />
        <Route path="/presets" element={<Presets />} />
        <Route path="/marca" element={<BrandSettings />} />
        <Route path="/configuracoes" element={<SettingsPage />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AppLayout>
  );
}

const App = () => (
  <BrowserRouter>
    <Toaster />
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/*" element={<ProtectedRoutes />} />
    </Routes>
  </BrowserRouter>
);

export default App;
