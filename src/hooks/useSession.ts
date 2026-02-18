"use client";

import { useCallback, useEffect, useState } from "react";

import { SESSION_STORAGE_KEY } from "@/lib/constants";

type AuthResponse = {
  token: string;
  expires_in: number;
};

export function useSession() {
  const [token, setToken] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const storedToken = localStorage.getItem(SESSION_STORAGE_KEY);
      if (storedToken) {
        setToken(storedToken);
      }
    } finally {
      setIsReady(true);
    }
  }, []);

  const login = useCallback(async (password: string) => {
    setIsAuthenticating(true);
    setError(null);

    try {
      const response = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        const message = data?.error || "認証に失敗しました";
        setError(message);
        return false;
      }

      const data = (await response.json()) as AuthResponse;
      localStorage.setItem(SESSION_STORAGE_KEY, data.token);
      setToken(data.token);
      return true;
    } catch {
      setError("ネットワークエラーが発生しました");
      return false;
    } finally {
      setIsAuthenticating(false);
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(SESSION_STORAGE_KEY);
    setToken(null);
  }, []);

  return {
    token,
    isReady,
    isAuthenticating,
    isAuthenticated: Boolean(token),
    error,
    login,
    logout,
  };
}
