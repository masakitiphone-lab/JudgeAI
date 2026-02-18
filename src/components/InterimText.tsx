type InterimTextProps = {
  text: string;
};

export function InterimText({ text }: InterimTextProps) {
  if (!text) return null;

  return (
    <div className="rounded-2xl border border-white/10 bg-zinc-900/60 px-4 py-3 text-sm text-zinc-300">
      <p className="mb-1 text-[11px] uppercase tracking-wider text-zinc-500">
        リアルタイム入力中
      </p>
      <p className="leading-relaxed">{text}</p>
    </div>
  );
}
