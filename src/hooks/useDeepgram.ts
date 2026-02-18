"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { DeepgramWord, SpeakerNames, Utterance } from "@/lib/types";
import { groupWordsToUtterances } from "@/lib/utils";

type UseDeepgramOptions = {
  sessionToken: string | null;
  speakerNames: SpeakerNames;
  onAppendUtterances: (utterances: Utterance[]) => void;
};

type DeepgramProxyResponse = {
  results?: {
    channels?: Array<{
      alternatives?: Array<{
        words?: DeepgramWord[];
      }>;
    }>;
  };
};

const CHUNK_MS = 1000;
const REFRESH_MS = 3000;

export function useDeepgram({
  sessionToken,
  speakerNames,
  onAppendUtterances,
}: UseDeepgramOptions) {
  const [isRecording, setIsRecording] = useState(false);
  const [interimText, setInterimText] = useState("");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const timerIntervalRef = useRef<number | null>(null);
  const refreshIntervalRef = useRef<number | null>(null);
  const speakerNamesRef = useRef(speakerNames);
  const appendRef = useRef(onAppendUtterances);
  const chunkBufferRef = useRef<Blob[]>([]);
  const transcribingRef = useRef(false);
  const pendingRef = useRef(false);
  const lastProcessedEndRef = useRef(0);

  useEffect(() => {
    speakerNamesRef.current = speakerNames;
  }, [speakerNames]);

  useEffect(() => {
    appendRef.current = onAppendUtterances;
  }, [onAppendUtterances]);

  const clearIntervals = useCallback(() => {
    if (timerIntervalRef.current) {
      window.clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    if (refreshIntervalRef.current) {
      window.clearInterval(refreshIntervalRef.current);
      refreshIntervalRef.current = null;
    }
  }, []);

  const cleanup = useCallback(async () => {
    clearIntervals();
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    }
    mediaRecorderRef.current = null;
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    mediaStreamRef.current = null;
    setInterimText("");
  }, [clearIntervals]);

  const transcribeCurrentBuffer = useCallback(async () => {
    if (!sessionToken || chunkBufferRef.current.length === 0) return;
    if (transcribingRef.current) {
      pendingRef.current = true;
      return;
    }

    transcribingRef.current = true;
    try {
      const mimeType =
        mediaRecorderRef.current?.mimeType || "audio/webm;codecs=opus";
      const mergedBlob = new Blob(chunkBufferRef.current, { type: mimeType });
      if (mergedBlob.size === 0) return;

      const response = await fetch("/api/deepgram-proxy", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${sessionToken}`,
          "Content-Type": mergedBlob.type || "audio/webm",
        },
        body: mergedBlob,
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as
          | { error?: string; detail?: string }
          | null;
        const detail = data?.detail ? ` (${data.detail})` : "";
        throw new Error((data?.error || "文字起こしに失敗しました") + detail);
      }

      const data = (await response.json()) as DeepgramProxyResponse;
      const words = data.results?.channels?.[0]?.alternatives?.[0]?.words || [];
      if (!words.length) return;

      const maxEnd = words.reduce(
        (acc, word) => Math.max(acc, word.end ?? 0),
        lastProcessedEndRef.current,
      );
      const newWords = words.filter(
        (word) => (word.end ?? 0) > lastProcessedEndRef.current + 0.01,
      );
      if (newWords.length > 0) {
        const utterances = groupWordsToUtterances(newWords, speakerNamesRef.current);
        if (utterances.length > 0) {
          appendRef.current(utterances);
        }
      }
      lastProcessedEndRef.current = maxEnd;
      setInterimText("音声を自動文字起こし中...");
    } finally {
      transcribingRef.current = false;
      if (pendingRef.current) {
        pendingRef.current = false;
        await transcribeCurrentBuffer();
      }
    }
  }, [sessionToken]);

  const startRecording = useCallback(async () => {
    if (isRecording) return;
    if (!sessionToken) {
      setError("セッションが無効です。再ログインしてください。");
      return;
    }

    try {
      setError(null);
      setElapsedSeconds(0);
      setInterimText("録音を開始しました");
      chunkBufferRef.current = [];
      lastProcessedEndRef.current = 0;
      pendingRef.current = false;

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      mediaStreamRef.current = stream;

      const mimeType =
        MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : "audio/webm";

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event: BlobEvent) => {
        if (!event.data || event.data.size === 0) return;
        chunkBufferRef.current.push(event.data);
      };

      recorder.onerror = () => {
        setError("録音中にエラーが発生しました。");
      };

      recorder.onstop = () => {
        setIsRecording(false);
        clearIntervals();
      };

      recorder.start(CHUNK_MS);
      setIsRecording(true);

      timerIntervalRef.current = window.setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);

      refreshIntervalRef.current = window.setInterval(() => {
        transcribeCurrentBuffer().catch((transcribeError) => {
          const message =
            transcribeError instanceof Error
              ? transcribeError.message
              : "文字起こしでエラーが発生しました。";
          setError(message);
        });
      }, REFRESH_MS);
    } catch {
      await cleanup();
      setError("マイク初期化に失敗しました。権限を確認してください。");
    }
  }, [cleanup, clearIntervals, isRecording, sessionToken, transcribeCurrentBuffer]);

  const stopRecording = useCallback(async () => {
    setIsRecording(false);
    setElapsedSeconds(0);
    clearIntervals();
    try {
      await transcribeCurrentBuffer();
    } catch (transcribeError) {
      const message =
        transcribeError instanceof Error
          ? transcribeError.message
          : "文字起こしでエラーが発生しました。";
      setError(message);
    }
    await cleanup();
  }, [cleanup, clearIntervals, transcribeCurrentBuffer]);

  useEffect(() => {
    return () => {
      cleanup().catch(() => undefined);
    };
  }, [cleanup]);

  return {
    isRecording,
    interimText,
    elapsedSeconds,
    error,
    startRecording,
    stopRecording,
  };
}
