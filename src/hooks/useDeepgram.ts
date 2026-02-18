"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  DEEPGRAM_QUERY_PARAMS_PRIMARY,
  DEEPGRAM_QUERY_PARAMS_SAFE,
} from "@/lib/constants";
import { SpeakerNames, Utterance } from "@/lib/types";
import { buildDeepgramWebSocketUrl, groupWordsToUtterances } from "@/lib/utils";

type UseDeepgramOptions = {
  sessionToken: string | null;
  speakerNames: SpeakerNames;
  onAppendUtterances: (utterances: Utterance[]) => void;
};

const MAX_RECONNECT_ATTEMPTS = 3;

function isFatalCloseCode(code: number): boolean {
  // Deepgram auth/permission/parameter failures are typically non-retryable.
  return code === 1002 || code === 1003 || code === 1007 || code === 1008;
}

export function useDeepgram({
  sessionToken,
  speakerNames,
  onAppendUtterances,
}: UseDeepgramOptions) {
  const [isRecording, setIsRecording] = useState(false);
  const [interimText, setInterimText] = useState("");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const socketRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const workletRef = useRef<AudioWorkletNode | null>(null);
  const silentGainRef = useRef<GainNode | null>(null);
  const keepAliveIntervalRef = useRef<number | null>(null);
  const timerIntervalRef = useRef<number | null>(null);
  const shouldReconnectRef = useRef(false);
  const manualStopRef = useRef(false);
  const reconnectAttemptsRef = useRef(0);
  const speakerNamesRef = useRef(speakerNames);
  const appendRef = useRef(onAppendUtterances);
  const openedRef = useRef(false);
  const safeModeRef = useRef(false);

  useEffect(() => {
    speakerNamesRef.current = speakerNames;
  }, [speakerNames]);

  useEffect(() => {
    appendRef.current = onAppendUtterances;
  }, [onAppendUtterances]);

  const clearIntervals = useCallback(() => {
    if (keepAliveIntervalRef.current) {
      window.clearInterval(keepAliveIntervalRef.current);
      keepAliveIntervalRef.current = null;
    }
    if (timerIntervalRef.current) {
      window.clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
  }, []);

  const cleanupAudio = useCallback(async () => {
    sourceRef.current?.disconnect();
    workletRef.current?.disconnect();
    silentGainRef.current?.disconnect();

    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    mediaStreamRef.current = null;

    if (audioContextRef.current) {
      await audioContextRef.current.close().catch(() => undefined);
      audioContextRef.current = null;
    }

    sourceRef.current = null;
    workletRef.current = null;
    silentGainRef.current = null;
  }, []);

  const cleanupSocket = useCallback((sendCloseStream: boolean) => {
    const ws = socketRef.current;
    if (!ws) return;

    try {
      if (sendCloseStream && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "CloseStream" }));
      }
    } catch {
      // ignore
    }

    if (
      ws.readyState === WebSocket.OPEN ||
      ws.readyState === WebSocket.CONNECTING
    ) {
      ws.close();
    }
    socketRef.current = null;
  }, []);

  const cleanupAll = useCallback(
    async (sendCloseStream: boolean) => {
      clearIntervals();
      cleanupSocket(sendCloseStream);
      await cleanupAudio();
      setInterimText("");
    },
    [cleanupAudio, cleanupSocket, clearIntervals],
  );

  const connect = useCallback(async function connectInternal() {
    if (!sessionToken) {
      setError("セッションが無効です。再ログインしてください。");
      return;
    }

    let tokenData: { token: string };
    try {
      const tokenResponse = await fetch("/api/deepgram-token", {
        headers: {
          Authorization: `Bearer ${sessionToken}`,
        },
      });

      if (!tokenResponse.ok) {
        const data = (await tokenResponse.json().catch(() => null)) as
          | { error?: string }
          | null;
        setError(data?.error || "Deepgramトークン取得に失敗しました");
        return;
      }
      tokenData = (await tokenResponse.json()) as { token: string };
    } catch {
      setError("Deepgramトークン取得でネットワークエラーが発生しました");
      return;
    }

    const queryParams = safeModeRef.current
      ? DEEPGRAM_QUERY_PARAMS_SAFE
      : DEEPGRAM_QUERY_PARAMS_PRIMARY;

    const ws = new WebSocket(buildDeepgramWebSocketUrl(tokenData.token, queryParams));
    ws.binaryType = "arraybuffer";
    socketRef.current = ws;
    openedRef.current = false;

    ws.onopen = async () => {
      openedRef.current = true;
      setError(null);
      reconnectAttemptsRef.current = 0;

      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            channelCount: 1,
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
        mediaStreamRef.current = mediaStream;

        const audioContext = new AudioContext({ sampleRate: 48_000 });
        audioContextRef.current = audioContext;
        await audioContext.audioWorklet.addModule("/resample-processor.js");

        const source = audioContext.createMediaStreamSource(mediaStream);
        const worklet = new AudioWorkletNode(audioContext, "resample-processor");
        const silentGain = audioContext.createGain();
        silentGain.gain.value = 0;

        source.connect(worklet);
        worklet.connect(silentGain);
        silentGain.connect(audioContext.destination);

        sourceRef.current = source;
        workletRef.current = worklet;
        silentGainRef.current = silentGain;

        worklet.port.onmessage = (event: MessageEvent<ArrayBuffer>) => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(event.data);
          }
        };

        keepAliveIntervalRef.current = window.setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "KeepAlive" }));
          }
        }, 8_000);

        timerIntervalRef.current = window.setInterval(() => {
          setElapsedSeconds((prev) => prev + 1);
        }, 1_000);

        setIsRecording(true);
      } catch {
        shouldReconnectRef.current = false;
        setError("マイク初期化に失敗しました。権限を確認してください。");
        await cleanupAll(false);
      }
    };

    ws.onmessage = (event: MessageEvent<string>) => {
      let payload: unknown;
      try {
        payload = JSON.parse(event.data);
      } catch {
        return;
      }

      if (
        typeof payload === "object" &&
        payload !== null &&
        "type" in payload &&
        (payload as { type?: string }).type === "Error"
      ) {
        const message =
          (payload as { description?: string; message?: string }).description ||
          (payload as { description?: string; message?: string }).message ||
          "不明なエラー";
        shouldReconnectRef.current = false;
        setError(`Deepgramエラー: ${message}`);
        ws.close();
        return;
      }

      const resultPayload = payload as {
        type?: string;
        is_final?: boolean;
        channel?: {
          alternatives?: Array<{ transcript?: string; words?: unknown[] }>;
        };
      };
      if (resultPayload.type !== "Results") return;

      const alt = resultPayload.channel?.alternatives?.[0];
      if (!alt) return;

      if (resultPayload.is_final) {
        const utterances = groupWordsToUtterances(
          (alt.words as Parameters<typeof groupWordsToUtterances>[0]) || [],
          speakerNamesRef.current,
        );
        if (utterances.length > 0) {
          appendRef.current(utterances);
        }
        setInterimText("");
      } else {
        setInterimText(alt.transcript || "");
      }
    };

    ws.onerror = () => {
      setError("音声ストリーム接続でエラーが発生しました。");
    };

    ws.onclose = (event: CloseEvent) => {
      clearIntervals();
      cleanupAudio().catch(() => undefined);
      setIsRecording(false);
      setInterimText("");

      const closeDetail = `code=${event.code}${
        event.reason ? ` reason=${event.reason}` : ""
      }`;

      if (!openedRef.current && !safeModeRef.current) {
        safeModeRef.current = true;
        setError(`接続に失敗したため安全モードで再試行します (${closeDetail})`);
        window.setTimeout(() => {
          connectInternal().catch(() => undefined);
        }, 400);
        return;
      }

      if (isFatalCloseCode(event.code)) {
        shouldReconnectRef.current = false;
        setError(`Deepgram接続が拒否されました (${closeDetail})`);
        return;
      }

      if (!manualStopRef.current && shouldReconnectRef.current) {
        if (reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
          reconnectAttemptsRef.current += 1;
          setError(
            `接続が切れたため再接続中 (${reconnectAttemptsRef.current}) [${closeDetail}]`,
          );
          window.setTimeout(() => {
            connectInternal().catch(() => undefined);
          }, 1_500);
        } else {
          shouldReconnectRef.current = false;
          setError(`接続が不安定です。録音を再開してください。 (${closeDetail})`);
        }
      }
    };
  }, [cleanupAll, cleanupAudio, clearIntervals, sessionToken]);

  const startRecording = useCallback(async () => {
    if (isRecording) return;

    manualStopRef.current = false;
    shouldReconnectRef.current = true;
    reconnectAttemptsRef.current = 0;
    safeModeRef.current = false;
    setElapsedSeconds(0);
    setError(null);

    await cleanupAll(false);
    await connect();
  }, [cleanupAll, connect, isRecording]);

  const stopRecording = useCallback(async () => {
    manualStopRef.current = true;
    shouldReconnectRef.current = false;
    reconnectAttemptsRef.current = 0;
    setIsRecording(false);
    setElapsedSeconds(0);
    await cleanupAll(true);
  }, [cleanupAll]);

  useEffect(() => {
    return () => {
      manualStopRef.current = true;
      shouldReconnectRef.current = false;
      cleanupAll(true).catch(() => undefined);
    };
  }, [cleanupAll]);

  return {
    isRecording,
    interimText,
    elapsedSeconds,
    error,
    startRecording,
    stopRecording,
  };
}
