"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { InterimText } from "@/components/InterimText";
import { JudgeButton } from "@/components/JudgeButton";
import { JudgmentCard } from "@/components/JudgmentCard";
import { RecordButton } from "@/components/RecordButton";
import { SpeakerNameEditor } from "@/components/SpeakerNameEditor";
import { TranscriptDisplay } from "@/components/TranscriptDisplay";
import {
  DEFAULT_SPEAKER_NAMES,
  SESSION_STATE_STORAGE_KEY,
} from "@/lib/constants";
import { Judgment, SpeakerNames, Utterance } from "@/lib/types";
import { formatElapsed, speakerLabel } from "@/lib/utils";
import { useDeepgram } from "@/hooks/useDeepgram";
import { useJudge } from "@/hooks/useJudge";
import { useSession } from "@/hooks/useSession";

const BUILD_TAG = "build-20260218-5";
const LOCALE_KEY = "kenka_ui_locale";
type Locale = "ja" | "en";

function readLocale(): Locale {
  if (typeof window === "undefined") return "ja";
  const stored = localStorage.getItem(LOCALE_KEY);
  return stored === "en" ? "en" : "ja";
}

type StoredSessionState = {
  utterances?: Utterance[];
  speaker_names?: SpeakerNames;
};

function readStoredSessionState(): StoredSessionState {
  if (typeof window === "undefined") return {};
  const raw = localStorage.getItem(SESSION_STATE_STORAGE_KEY);
  if (!raw) return {};
  try {
    return JSON.parse(raw) as StoredSessionState;
  } catch {
    localStorage.removeItem(SESSION_STATE_STORAGE_KEY);
    return {};
  }
}

function createId(): string {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export default function RoomPage() {
  const router = useRouter();
  const { token, isReady, logout } = useSession();
  const { judgeConversation, isJudging, error: judgeError } = useJudge();
  const initialState = useMemo(() => readStoredSessionState(), []);

  const [locale, setLocale] = useState<Locale>(() => readLocale());
  const [utterances, setUtterances] = useState<Utterance[]>(
    Array.isArray(initialState.utterances) ? initialState.utterances : [],
  );
  const [speakerNames, setSpeakerNames] = useState<SpeakerNames>({
    0: initialState.speaker_names?.[0] || DEFAULT_SPEAKER_NAMES[0],
    1: initialState.speaker_names?.[1] || DEFAULT_SPEAKER_NAMES[1],
  });
  const [activeJudgment, setActiveJudgment] = useState<Judgment | null>(null);
  const [roomError, setRoomError] = useState<string | null>(null);

  const isJa = locale === "ja";

  useEffect(() => {
    if (isReady && !token) router.replace("/");
  }, [isReady, token, router]);

  useEffect(() => {
    const payload: StoredSessionState = {
      utterances,
      speaker_names: speakerNames,
    };
    localStorage.setItem(SESSION_STATE_STORAGE_KEY, JSON.stringify(payload));
  }, [utterances, speakerNames]);

  const appendUtterances = useCallback((newUtterances: Utterance[]) => {
    setUtterances((prev) => [...prev, ...newUtterances]);
  }, []);

  const {
    isRecording,
    interimText,
    elapsedSeconds,
    error: deepgramError,
    startRecording,
    stopRecording,
  } = useDeepgram({
    sessionToken: token,
    speakerNames,
    onAppendUtterances: appendUtterances,
  });

  const handleToggleRecording = async () => {
    setRoomError(null);
    if (isRecording) {
      await stopRecording();
    } else {
      await startRecording();
    }
  };

  const handleJudge = async () => {
    if (!token) {
      setRoomError(
        isJa
          ? "セッション切れです。再ログインしてください。"
          : "Session expired. Please login again.",
      );
      return;
    }
    if (utterances.length === 0) {
      setRoomError(
        isJa
          ? "会話ログがありません。録音してから実行してください。"
          : "No transcript yet. Start recording first.",
      );
      return;
    }

    setRoomError(null);
    const result = await judgeConversation({
      sessionToken: token,
      utterances,
      speakerNames,
    });
    if (!result) return;

    const newJudgment: Judgment = {
      id: createId(),
      timestamp: new Date().toISOString(),
      input_utterance_count: utterances.length,
      result,
    };
    setActiveJudgment(newJudgment);
  };

  const handleToggleUtteranceSpeaker = (utteranceId: string) => {
    setUtterances((prev) =>
      prev.map((item) => {
        if (item.id !== utteranceId) return item;
        const nextSpeaker = item.speaker === 0 ? 1 : 0;
        return {
          ...item,
          speaker: nextSpeaker,
          speaker_label: speakerLabel(nextSpeaker, speakerNames),
        };
      }),
    );
  };

  const handleSpeakerNameChange = (speaker: 0 | 1, value: string) => {
    setSpeakerNames((prev) => ({
      ...prev,
      [speaker]: value.trim() || (speaker === 0 ? "話者A" : "話者B"),
    }));
  };

  const handleToggleLocale = () => {
    const next: Locale = isJa ? "en" : "ja";
    setLocale(next);
    localStorage.setItem(LOCALE_KEY, next);
  };

  if (!isReady || !token) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4 text-sm text-zinc-300">
        {isJa ? "認証状態を確認中..." : "Checking session..."}
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-3 pb-8 pt-4 md:px-6">
      <header className="rounded-2xl border border-white/15 bg-black/30 p-4 backdrop-blur">
        <div className="mb-2 flex justify-end gap-2">
          <span className="rounded border border-zinc-600 px-2 py-1 text-[10px] text-zinc-300">
            {BUILD_TAG}
          </span>
          <button
            type="button"
            onClick={handleToggleLocale}
            className="rounded border border-zinc-600 px-2 py-1 text-[10px] text-zinc-200 hover:bg-zinc-800"
          >
            {isJa ? "EN" : "JP"}
          </button>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-2xl font-bold text-white">
              {isJa ? "ケンカジャッジ" : "Kenka Judge"}
            </h1>
            <p className="text-xs text-zinc-400">
              {isJa
                ? "タップで話者A/Bを切り替えできます"
                : "Tap a transcript to swap speaker A/B"}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              logout();
              router.replace("/");
            }}
            className="rounded-lg border border-zinc-600 px-3 py-2 text-xs text-zinc-200 hover:bg-zinc-800"
          >
            {isJa ? "退室" : "Exit"}
          </button>
        </div>
        <div className="mt-3">
          <SpeakerNameEditor
            speakerNames={speakerNames}
            onChange={handleSpeakerNameChange}
            locale={locale}
          />
        </div>
      </header>

      <section className="mt-3 flex-1 overflow-hidden rounded-2xl border border-white/15 bg-black/20 p-3">
        <div className="h-[52vh] overflow-y-auto pr-1 md:h-[58vh]">
          <TranscriptDisplay
            utterances={utterances}
            speakerNames={speakerNames}
            onToggleSpeaker={handleToggleUtteranceSpeaker}
            locale={locale}
          />
        </div>
        <div className="mt-3">
          <InterimText text={interimText} locale={locale} />
        </div>
      </section>

      <section className="mt-3 rounded-2xl border border-white/15 bg-black/30 p-4 backdrop-blur">
        <div className="mb-3 flex items-center gap-2 text-sm text-zinc-200">
          <span
            className={`inline-block h-2.5 w-2.5 rounded-full ${
              isRecording ? "animate-pulse bg-red-500" : "bg-zinc-500"
            }`}
          />
          <span>
            {isRecording
              ? isJa
                ? `録音中 (${formatElapsed(elapsedSeconds)})`
                : `Recording (${formatElapsed(elapsedSeconds)})`
              : isJa
                ? "待機中"
                : "Idle"}
          </span>
        </div>

        {(roomError || deepgramError || judgeError) && (
          <p className="mb-3 rounded-lg border border-red-400/40 bg-red-950/40 px-3 py-2 text-sm text-red-200">
            {roomError || deepgramError || judgeError}
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          <RecordButton
            isRecording={isRecording}
            onClick={handleToggleRecording}
            locale={locale}
          />
          <JudgeButton
            onClick={handleJudge}
            isLoading={isJudging}
            disabled={utterances.length === 0}
            locale={locale}
          />
        </div>
      </section>

      <JudgmentCard
        judgment={activeJudgment}
        speakerNames={speakerNames}
        open={Boolean(activeJudgment)}
        onClose={() => setActiveJudgment(null)}
        locale={locale}
      />
    </main>
  );
}
