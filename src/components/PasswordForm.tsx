"use client";

import { FormEvent, useState } from "react";

type Locale = "ja" | "en";

type PasswordFormProps = {
  onSubmit: (password: string) => Promise<boolean>;
  isLoading: boolean;
  error: string | null;
  locale?: Locale;
  onToggleLocale?: () => void;
};

export function PasswordForm({
  onSubmit,
  isLoading,
  error,
  locale = "ja",
  onToggleLocale,
}: PasswordFormProps) {
  const [password, setPassword] = useState("");
  const isJa = locale === "ja";

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await onSubmit(password);
  };

  return (
    <div className="w-full max-w-sm rounded-3xl border border-white/20 bg-black/40 p-6 shadow-2xl backdrop-blur">
      <div className="mb-3 flex justify-end">
        <button
          type="button"
          onClick={onToggleLocale}
          className="rounded-md border border-zinc-600 px-2 py-1 text-xs text-zinc-200 hover:bg-zinc-800"
        >
          {isJa ? "EN" : "JP"}
        </button>
      </div>
      <h1 className="text-center text-3xl font-bold tracking-tight text-white">
        {isJa ? "ケンカジャッジ" : "Kenka Judge"}
      </h1>
      <p className="mt-2 text-center text-sm text-zinc-300">
        {isJa
          ? "ルームパスワードを入力して入室"
          : "Enter room password to continue"}
      </p>

      <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder={isJa ? "パスワード" : "Password"}
          className="w-full rounded-xl border border-white/20 bg-zinc-950/60 px-4 py-3 text-white placeholder:text-zinc-500 focus:border-amber-400 focus:outline-none"
          autoComplete="current-password"
          required
        />
        {error && (
          <p className="rounded-lg border border-red-400/40 bg-red-950/40 px-3 py-2 text-sm text-red-200">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={isLoading}
          className="w-full rounded-xl bg-amber-400 px-4 py-3 font-semibold text-zinc-900 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isLoading
            ? isJa
              ? "認証中..."
              : "Authenticating..."
            : isJa
              ? "入室"
              : "Enter"}
        </button>
      </form>
    </div>
  );
}
