import { useState, useEffect } from "react";
import { AUTH_EVENT, fetchCurrentUser, isAuthenticated, type AuthUser } from "@/lib/api";

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const sync = async () => {
      if (!isAuthenticated()) {
        if (active) { setUser(null); setLoading(false); }
        return;
      }
      try {
        const u = await fetchCurrentUser();
        if (active) setUser(u);
      } catch {
        if (active) setUser(null);
      } finally {
        if (active) setLoading(false);
      }
    };

    sync();
    window.addEventListener(AUTH_EVENT, sync);
    return () => { active = false; window.removeEventListener(AUTH_EVENT, sync); };
  }, []);

  return {
    user,
    session: user ? { user } : null,
    loading,
  };
}
