"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { PasswordForm } from "@/components/PasswordForm";
import { useSession } from "@/hooks/useSession";

type Locale = "ja" | "en";
const LOCALE_KEY = "kenka_ui_locale";

function readLocale(): Locale {
  if (typeof window === "undefined") return "ja";
  const stored = localStorage.getItem(LOCALE_KEY);
  return stored === "en" ? "en" : "ja";
}

export default function Home() {
  const router = useRouter();
  const { token, isReady, isAuthenticating, error, login } = useSession();
  const [locale, setLocale] = useState<Locale>(() => readLocale());

  useEffect(() => {
    if (isReady && token) {
      router.replace("/room");
    }
  }, [isReady, token, router]);

  const toggleLocale = () => {
    const next: Locale = locale === "ja" ? "en" : "ja";
    setLocale(next);
    localStorage.setItem(LOCALE_KEY, next);
  };

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(81,126,255,0.2),transparent_45%),radial-gradient(circle_at_80%_10%,rgba(255,143,143,0.16),transparent_42%)]" />
      <PasswordForm
        onSubmit={login}
        isLoading={isAuthenticating || !isReady}
        error={error}
        locale={locale}
        onToggleLocale={toggleLocale}
      />
    </main>
  );
}
