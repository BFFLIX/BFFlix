// mobile/src/auth/AuthContext.tsx

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  setTokens,
  clearTokens,
  getAccessToken,
  getRefreshToken,
} from "../lib/tokenStore";
import { apiJson } from "../lib/api";

type AuthState = {
  isReady: boolean;
  isAuthed: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<string | null>; // returns new access token or null
};

const AuthContext = createContext<AuthState | null>(null);

type LoginResponse = {
  accessToken: string;
  refreshToken: string;
};

type RefreshResponse = {
  accessToken: string;
  refreshToken: string;
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isReady, setIsReady] = useState(false);
  const [isAuthed, setIsAuthed] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const access = await getAccessToken();
        const refresh = await getRefreshToken();
        setIsAuthed(Boolean(access || refresh));
      } catch {
        setIsAuthed(false);
      } finally {
        setIsReady(true);
      }
    })();
  }, []);

  async function login(email: string, password: string) {
    const data = await apiJson<LoginResponse>("/auth/login", {
      method: "POST",
      skipAuth: true,
      body: JSON.stringify({ email, password }),
    });

    await setTokens(data.accessToken, data.refreshToken);
    setIsAuthed(true);
  }

  async function refresh() {
    const rt = await getRefreshToken();
    if (!rt) return null;

    try {
      const data = await apiJson<RefreshResponse>("/auth/refresh", {
        method: "POST",
        skipAuth: true,
        body: JSON.stringify({ refreshToken: rt }),
      });

      await setTokens(data.accessToken, data.refreshToken);
      setIsAuthed(true);
      return data.accessToken;
    } catch {
      await clearTokens();
      setIsAuthed(false);
      return null;
    }
  }

  async function logout() {
    const rt = await getRefreshToken();

    // Best-effort revoke on the server
    if (rt) {
      try {
        await apiJson("/auth/logout", {
          method: "POST",
          skipAuth: true,
          body: JSON.stringify({ refreshToken: rt }),
        });
      } catch {
        // ignore
      }
    }

    await clearTokens();
    setIsAuthed(false);
  }

  const value = useMemo(
    () => ({ isReady, isAuthed, login, logout, refresh }),
    [isReady, isAuthed]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}