import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import AppLayout from "@/components/AppLayout";
import Dashboard from "@/pages/Dashboard";
import NewGeneration from "@/pages/NewGeneration";
import Library from "@/pages/Library";
import Presets from "@/pages/Presets";
import PromptHistory from "@/pages/PromptHistory";
import BrandSettings from "@/pages/BrandSettings";
import SettingsPage from "@/pages/SettingsPage";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AppLayout>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/nova-arte" element={<NewGeneration />} />
            <Route path="/biblioteca" element={<Library />} />
            <Route path="/presets" element={<Presets />} />
            <Route path="/historico" element={<PromptHistory />} />
            <Route path="/marca" element={<BrandSettings />} />
            <Route path="/configuracoes" element={<SettingsPage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AppLayout>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
