"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { DeepgramWord, SpeakerNames, Utterance } from "@/lib/types";
import { groupWordsToUtterances } from "@/lib/utils";

type UseDeepgramOptions = {
  sessionToken: string | null;
  speakerNames: SpeakerNames;
  onAppendUtterances: (utterances: Utterance[]) => void;
};

type DeepgramAlternative = {
  transcript?: string;
  words?: DeepgramWord[];
  confidence?: number;
};

type DeepgramChannel = {
  alternatives: DeepgramAlternative[];
};

type DeepgramTranscriptResponse = {
  channel?: DeepgramChannel;
  type?: string;
  transaction_key?: string;
  duration?: number;
  start?: number;
  is_final?: boolean;
};

export function useDeepgram({
  sessionToken,
  speakerNames,
  onAppendUtterances,
}: UseDeepgramOptions) {
  const [isRecording, setIsRecording] = useState(false);
  const [interimText, setInterimText] = useState("");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const timerIntervalRef = useRef<number | null>(null);
  const speakerNamesRef = useRef(speakerNames);
  const appendRef = useRef(onAppendUtterances);
  const wsRef = useRef<WebSocket | null>(null);
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
  }, []);

  const cleanup = useCallback(async () => {
    clearIntervals();
    
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.close();
    }
    wsRef.current = null;

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }

    if (audioContextRef.current) {
      await audioContextRef.current.close();
      audioContextRef.current = null;
    }

    setInterimText("");
  }, [clearIntervals]);

  const connectToDeepgram = useCallback(async () => {
    const deepgramApiKey = process.env.NEXT_PUBLIC_DEEPGRAM_API_KEY;
    console.log("Deepgram connection attempt - API key exists:", !!deepgramApiKey);
    console.log("Deepgram connection attempt - API key length:", deepgramApiKey?.length);
    
    if (!deepgramApiKey) {
      throw new Error("Deepgram API key is not configured. Please set NEXT_PUBLIC_DEEPGRAM_API_KEY in Vercel.");
    }

    const params = new URLSearchParams({
      model: "nova-3",
      language: "multi",
      punctuate: "true",
      smart_format: "true",
      diarize: "true",
    });

    // URL encode the API key to handle special characters
    const encodedApiKey = encodeURIComponent(deepgramApiKey);
    const wsUrl = `wss://api.deepgram.com/v1/listen?${params.toString()}&api_key=${encodedApiKey}`;
    console.log("Deepgram WebSocket URL:", wsUrl.replace(encodedApiKey, "***"));

    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log("Deepgram WebSocket connected successfully");
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as DeepgramTranscriptResponse;
        
        // Check for error responses from Deepgram
        if (data.type === "Error" || data.type === "error") {
          console.error("Deepgram error response:", data);
          const errMsg = (data as any).error?.message || "Deepgramでエラーが発生しました";
          setError(`文字起こしでエラーが発生しました。: ${errMsg}`);
          return;
        }
        
        const channel = data.channel;
        if (!channel?.alternatives?.[0]) return;

        const alternative = channel.alternatives[0];
        const transcript = alternative.transcript;
        const words = alternative.words || [];

        if (!transcript || words.length === 0) return;

        // Process final results
        if (data.is_final) {
          const newWords = words.filter(
            (word: DeepgramWord) => (word.end ?? 0) > lastProcessedEndRef.current + 0.01
          );
          
          if (newWords.length > 0) {
            const utterances = groupWordsToUtterances(newWords, speakerNamesRef.current);
            if (utterances.length > 0) {
              appendRef.current(utterances);
            }
            
            const maxEnd = words.reduce(
              (acc: number, word: DeepgramWord) => Math.max(acc, word.end ?? 0),
              lastProcessedEndRef.current
            );
            lastProcessedEndRef.current = maxEnd;
          }
          
          setInterimText("");
        } else {
          // Interim result
          setInterimText(transcript);
        }
      } catch (err) {
        console.error("Error parsing Deepgram message:", err);
      }
    };

    ws.onerror = (event) => {
      console.error("Deepgram WebSocket error:", event);
      setError("文字起こしでエラーが発生しました。");
    };

    ws.onclose = (event) => {
      console.log("Deepgram WebSocket closed", event.code, event.reason);
      if (event.code !== 1000 && event.code !== 1001) {
        setError(`文字起こしでエラーが発生しました。（コード: ${event.code}）`);
      }
    };

    wsRef.current = ws;
    return ws;
  }, []);

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
      lastProcessedEndRef.current = 0;

      // Get microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      mediaStreamRef.current = stream;

      // Connect to Deepgram Streaming API
      await connectToDeepgram();

      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        throw new Error("Failed to connect to Deepgram");
      }

      // Create AudioContext
      const audioContext = new AudioContext({
        sampleRate: 16000,
      });
      audioContextRef.current = audioContext;

      // Connect microphone to Deepgram via MediaStreamSource
      const source = audioContext.createMediaStreamSource(stream);
      
      // Create a script processor for processing audio chunks
      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      
      processor.onaudioprocess = (event) => {
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
        
        const inputData = event.inputBuffer.getChannelData(0);
        
        // Convert Float32Array to Int16Array (PCM 16-bit)
        const int16Data = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          const s = Math.max(-1, Math.min(1, inputData[i]));
          int16Data[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
        }
        
        // Send to Deepgram
        wsRef.current.send(int16Data.buffer);
      };

      source.connect(processor);
      processor.connect(audioContext.destination);

      setIsRecording(true);

      timerIntervalRef.current = window.setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      await cleanup();
      const message = err instanceof Error ? err.message : "マイク初期化に失敗しました。権限を確認してください。";
      setError(message);
    }
  }, [cleanup, connectToDeepgram, isRecording, sessionToken]);

  const stopRecording = useCallback(async () => {
    setIsRecording(false);
    setElapsedSeconds(0);
    clearIntervals();
    await cleanup();
  }, [cleanup, clearIntervals]);

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
