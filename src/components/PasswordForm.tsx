"use client";

import { FormEvent, useState } from "react";

type PasswordFormProps = {
  onSubmit: (password: string) => Promise<boolean>;
  isLoading: boolean;
  error: string | null;
};

export function PasswordForm({ onSubmit, isLoading, error }: PasswordFormProps) {
  const [password, setPassword] = useState("");

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await onSubmit(password);
  };

  return (
    <div className="w-full max-w-sm rounded-3xl border border-white/20 bg-black/40 p-6 shadow-2xl backdrop-blur">
      <h1 className="text-center text-3xl font-bold tracking-tight text-white">
        ケンカジャッジ
      </h1>
      <p className="mt-2 text-center text-sm text-zinc-300">
        ルームパスワードを入力して入室
      </p>

      <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="パスワード"
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
          {isLoading ? "認証中..." : "入室"}
        </button>
      </form>
    </div>
  );
}
