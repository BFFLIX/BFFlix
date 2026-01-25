// mobile/src/context/UserContext.tsx

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { fetchCurrentUser } from "../lib/feed";
import { useAuth } from "../auth/AuthContext";
import type { CurrentUser } from "../types/feed";

type UserContextType = {
  user: CurrentUser | null;
  loading: boolean;
  error: string | null;
  refreshUser: () => Promise<void>;
  updateUser: (updates: Partial<CurrentUser>) => void;
};

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: ReactNode }) {
  const { isAuthed, isReady } = useAuth();
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadUser = async () => {
    if (!isReady || !isAuthed) {
      setUser(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const userData = await fetchCurrentUser();
      setUser(userData);
    } catch (err: any) {
      setError(err?.message || "Failed to load user");
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const refreshUser = async () => {
    await loadUser();
  };

  const updateUser = (updates: Partial<CurrentUser>) => {
    setUser((prev) => (prev ? { ...prev, ...updates } : null));
  };

  useEffect(() => {
    loadUser();
  }, [isAuthed, isReady]);

  return (
    <UserContext.Provider value={{ user, loading, error, refreshUser, updateUser }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error("useUser must be used within a UserProvider");
  }
  return context;
}
