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
  error?: string;
};

const CHUNK_MS = 2500;

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
  const speakerNamesRef = useRef(speakerNames);
  const appendRef = useRef(onAppendUtterances);
  const isStoppingRef = useRef(false);

  useEffect(() => {
    speakerNamesRef.current = speakerNames;
  }, [speakerNames]);

  useEffect(() => {
    appendRef.current = onAppendUtterances;
  }, [onAppendUtterances]);

  const clearTimer = useCallback(() => {
    if (timerIntervalRef.current) {
      window.clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
  }, []);

  const cleanup = useCallback(async () => {
    clearTimer();
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    }
    mediaRecorderRef.current = null;
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    mediaStreamRef.current = null;
    setInterimText("");
  }, [clearTimer]);

  const transcribeChunk = useCallback(
    async (blob: Blob) => {
      if (!sessionToken || blob.size === 0 || isStoppingRef.current) return;

      const response = await fetch("/api/deepgram-proxy", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${sessionToken}`,
          "Content-Type": blob.type || "audio/webm",
        },
        body: blob,
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as
          | { error?: string; detail?: string }
          | null;
        const detail = data?.detail ? ` (${data.detail})` : "";
        throw new Error((data?.error || "文字起こしに失敗しました") + detail);
      }

      const data = (await response.json()) as DeepgramProxyResponse;
      const words =
        data.results?.channels?.[0]?.alternatives?.[0]?.words || [];
      if (!words.length) return;

      const utterances = groupWordsToUtterances(words, speakerNamesRef.current);
      if (utterances.length > 0) {
        appendRef.current(utterances);
      }
    },
    [sessionToken],
  );

  const startRecording = useCallback(async () => {
    if (isRecording) return;
    if (!sessionToken) {
      setError("セッションが無効です。再ログインしてください。");
      return;
    }

    try {
      isStoppingRef.current = false;
      setError(null);
      setElapsedSeconds(0);

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

      recorder.ondataavailable = async (event: BlobEvent) => {
        if (!event.data || event.data.size === 0) return;
        try {
          await transcribeChunk(event.data);
        } catch (chunkError) {
          const message =
            chunkError instanceof Error
              ? chunkError.message
              : "文字起こしでエラーが発生しました。";
          setError(message);
        }
      };

      recorder.onerror = () => {
        setError("録音中にエラーが発生しました。");
      };

      recorder.onstop = () => {
        setIsRecording(false);
        clearTimer();
      };

      recorder.start(CHUNK_MS);
      setIsRecording(true);

      timerIntervalRef.current = window.setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
    } catch {
      await cleanup();
      setError("マイク初期化に失敗しました。権限を確認してください。");
    }
  }, [cleanup, clearTimer, isRecording, sessionToken, transcribeChunk]);

  const stopRecording = useCallback(async () => {
    isStoppingRef.current = true;
    setIsRecording(false);
    setElapsedSeconds(0);
    await cleanup();
  }, [cleanup]);

  useEffect(() => {
    return () => {
      isStoppingRef.current = true;
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
