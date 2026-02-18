"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { PasswordForm } from "@/components/PasswordForm";
import { useSession } from "@/hooks/useSession";

export default function Home() {
  const router = useRouter();
  const { token, isReady, isAuthenticating, error, login } = useSession();

  useEffect(() => {
    if (isReady && token) {
      router.replace("/room");
    }
  }, [isReady, token, router]);

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(81,126,255,0.2),transparent_45%),radial-gradient(circle_at_80%_10%,rgba(255,143,143,0.16),transparent_42%)]" />
      <PasswordForm
        onSubmit={login}
        isLoading={isAuthenticating || !isReady}
        error={error}
      />
    </main>
  );
}
