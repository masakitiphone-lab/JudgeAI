type Locale = "ja" | "en";

type InterimTextProps = {
  text: string;
  locale?: Locale;
};

export function InterimText({ text, locale = "ja" }: InterimTextProps) {
  if (!text) return null;
  const isJa = locale === "ja";

  return (
    <div className="rounded-2xl border border-white/10 bg-zinc-900/60 px-4 py-3 text-sm text-zinc-300">
      <p className="mb-1 text-[11px] uppercase tracking-wider text-zinc-500">
        {isJa ? "リアルタイム入力中" : "Live preview"}
      </p>
      <p className="leading-relaxed">{text}</p>
    </div>
  );
}
