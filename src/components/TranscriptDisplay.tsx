"use client";

import { useEffect, useRef } from "react";

import { SpeakerNames, Utterance } from "@/lib/types";
import { speakerLabel } from "@/lib/utils";

type TranscriptDisplayProps = {
  utterances: Utterance[];
  speakerNames: SpeakerNames;
  onToggleSpeaker: (utteranceId: string) => void;
};

function toClock(value: number): string {
  const mins = Math.floor(value / 60)
    .toString()
    .padStart(2, "0");
  const secs = Math.floor(value % 60)
    .toString()
    .padStart(2, "0");
  return `${mins}:${secs}`;
}

export function TranscriptDisplay({
  utterances,
  speakerNames,
  onToggleSpeaker,
}: TranscriptDisplayProps) {
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [utterances]);

  if (utterances.length === 0) {
    return (
      <div className="rounded-2xl border border-white/10 bg-black/20 p-6 text-center text-sm text-zinc-400">
        まだ会話ログがありません。録音を開始してください。
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {utterances.map((utterance) => {
        const isSpeaker0 = utterance.speaker === 0;
        return (
          <button
            key={utterance.id}
            type="button"
            onClick={() => onToggleSpeaker(utterance.id)}
            className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
              isSpeaker0
                ? "border-blue-500/60 bg-blue-500/15 text-blue-100 hover:bg-blue-500/25"
                : "border-pink-500/60 bg-pink-500/15 text-pink-100 hover:bg-pink-500/25"
            }`}
          >
            <p className="text-xs opacity-80">
              {speakerLabel(utterance.speaker, speakerNames)} ({toClock(utterance.start)})
            </p>
            <p className="mt-1 text-sm leading-relaxed">{utterance.transcript}</p>
          </button>
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
}
