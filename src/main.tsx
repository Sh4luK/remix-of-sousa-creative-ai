import { createRoot } from "react-dom/client";
import { GoogleOAuthProvider } from "@react-oauth/google";
import App from "./App.tsx";
import "./index.css";
import { initObservability } from "@/lib/observability";

initObservability();

// initCodeClient do GSI lança erro síncrono se client_id vier vazio (derruba a árvore React).
// Placeholder evita o crash; login real fica bloqueado no clique por handleGoogleClick até configurar.
const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || "not-configured.apps.googleusercontent.com";

createRoot(document.getElementById("root")!).render(
  <GoogleOAuthProvider clientId={googleClientId}>
    <App />
  </GoogleOAuthProvider>,
);
