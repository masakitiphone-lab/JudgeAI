"use client";

import { Judgment, SpeakerNames } from "@/lib/types";

type JudgmentCardProps = {
  judgment: Judgment | null;
  speakerNames: SpeakerNames;
  open: boolean;
  onClose: () => void;
};

function Percentage({ value }: { value: number }) {
  return <span>{Math.round(Math.max(0, Math.min(1, value)) * 100)}%</span>;
}

function DotList({ items }: { items: string[] }) {
  if (items.length === 0) {
    return <p className="text-zinc-400">特記事項なし</p>;
  }
  return (
    <div className="space-y-1 text-sm text-zinc-100">
      {items.map((item, index) => (
        <p key={`${index}-${item}`}>・{item}</p>
      ))}
    </div>
  );
}

export function JudgmentCard({
  judgment,
  speakerNames,
  open,
  onClose,
}: JudgmentCardProps) {
  if (!open || !judgment) return null;

  const result = judgment.result;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-3 backdrop-blur-sm md:items-center">
      <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-3xl border border-amber-300/30 bg-zinc-950 p-5 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-amber-300">ジャッジ結果</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-zinc-600 px-3 py-1 text-sm text-zinc-200 hover:bg-zinc-800"
          >
            閉じる
          </button>
        </div>

        <div className="space-y-4">
          <section className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3">
            <p className="text-xs text-zinc-400">要約</p>
            <p className="mt-1 text-sm text-zinc-100">{result.summary}</p>
          </section>

          <section className="grid gap-3 md:grid-cols-2">
            <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 p-3">
              <p className="text-xs text-blue-200">{speakerNames[0]}の主張</p>
              <p className="mt-1 text-sm text-blue-100">{result.speaker_0_position}</p>
            </div>
            <div className="rounded-xl border border-pink-500/30 bg-pink-500/10 p-3">
              <p className="text-xs text-pink-200">{speakerNames[1]}の主張</p>
              <p className="mt-1 text-sm text-pink-100">{result.speaker_1_position}</p>
            </div>
          </section>

          <section className="grid gap-3 md:grid-cols-2">
            <div className="rounded-xl border border-blue-500/30 bg-zinc-900/70 p-3">
              <p className="mb-2 text-xs text-blue-200">✅ {speakerNames[0]}の正当な点</p>
              <DotList items={result.analysis.speaker_0_valid_points} />
              <p className="mb-2 mt-4 text-xs text-blue-200">⚠️ {speakerNames[0]}の問題点</p>
              <DotList items={result.analysis.speaker_0_issues} />
            </div>
            <div className="rounded-xl border border-pink-500/30 bg-zinc-900/70 p-3">
              <p className="mb-2 text-xs text-pink-200">✅ {speakerNames[1]}の正当な点</p>
              <DotList items={result.analysis.speaker_1_valid_points} />
              <p className="mb-2 mt-4 text-xs text-pink-200">⚠️ {speakerNames[1]}の問題点</p>
              <DotList items={result.analysis.speaker_1_issues} />
            </div>
          </section>

          <section className="rounded-xl border border-amber-400/40 bg-amber-500/10 p-4">
            <p className="text-sm font-semibold text-amber-300">
              判定: {result.judgment.verdict}
            </p>
            <p className="mt-1 text-sm text-zinc-100">
              確信度: <Percentage value={result.judgment.confidence} />
            </p>
            <p className="mt-2 text-sm text-zinc-200">{result.judgment.reasoning}</p>
          </section>

          <section className="space-y-2 rounded-xl border border-zinc-800 bg-zinc-900/60 p-3">
            <p className="text-xs text-zinc-400">アドバイス</p>
            <p className="text-sm text-blue-100">💡 {speakerNames[0]}へ: {result.advice.to_speaker_0}</p>
            <p className="text-sm text-pink-100">💡 {speakerNames[1]}へ: {result.advice.to_speaker_1}</p>
            <p className="text-sm text-zinc-100">💡 2人へ: {result.advice.general}</p>
          </section>
        </div>
      </div>
    </div>
  );
}
