"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { DeepgramWord, SpeakerNames, Utterance } from "@/lib/types";
import { groupWordsToUtterances } from "@/lib/utils";

type UseDeepgramOptions = {
  sessionToken: string | null;
  speakerNames: SpeakerNames;
  onAppendUtterances: (utterances: Utterance[]) => void;
};

export function useDeepgram({
  sessionToken,
  speakerNames,
  onAppendUtterances,
}: UseDeepgramOptions) {
  const [isRecording, setIsRecording] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const timerIntervalRef = useRef<number | null>(null);
  const speakerNamesRef = useRef(speakerNames);
  const appendRef = useRef(onAppendUtterances);

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

  const updateAudioLevel = useCallback(() => {
    if (!analyserRef.current) return;
    
    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(dataArray);
    
    // Calculate average volume
    const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
    const level = Math.min(100, (average / 128) * 100);
    setAudioLevel(level);
    
    if (isRecording) {
      animationFrameRef.current = requestAnimationFrame(updateAudioLevel);
    }
  }, [isRecording]);

  const startRecording = useCallback(async () => {
    if (isRecording) return;
    if (!sessionToken) {
      setError("セッションが無効です。再ログインしてください。");
      return;
    }

    try {
      setError(null);
      setElapsedSeconds(0);
      setAudioLevel(0);
      audioChunksRef.current = [];

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

      // Set up audio visualization
      const audioContext = new AudioContext();
      const analyser = audioContext.createAnalyser();
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);
      analyser.fftSize = 256;
      
      audioContextRef.current = audioContext;
      analyserRef.current = analyser;

      // Start audio level visualization
      animationFrameRef.current = requestAnimationFrame(updateAudioLevel);

      // Create MediaRecorder
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : undefined;
      
      if (!mimeType) {
        throw new Error("WebM format not supported");
      }

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.start(1000); // Collect data every second
      mediaRecorderRef.current = mediaRecorder;

      setIsRecording(true);

      timerIntervalRef.current = window.setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      await cleanup();
      const message = err instanceof Error ? err.message : "マイクの初期化に失敗しました";
      setError(message);
    }
  }, [isRecording, sessionToken, updateAudioLevel]);

  const stopRecording = useCallback(async () => {
    if (!isRecording) return;

    setIsRecording(false);
    clearIntervals();

    // Stop audio visualization
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    setAudioLevel(0);

    // Stop MediaRecorder and get final data
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }

    // Wait for final data
    await new Promise<void>((resolve) => {
      if (!mediaRecorderRef.current) {
        resolve();
        return;
      }
      
      const checkData = () => {
        if (mediaRecorderRef.current?.state === "inactive") {
          resolve();
        } else {
          setTimeout(checkData, 100);
        }
      };
      checkData();
    });

    // Create audio blob
    const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
    
    // Clean up MediaRecorder and stream
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current = null;
    }
    
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    analyserRef.current = null;

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }

    // Start transcription
    setIsTranscribing(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("audio", audioBlob, "recording.webm");

      const response = await fetch("/api/transcribe", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "文字起こしに失敗しました");
      }

      const data = await response.json();
      
      if (data.words && data.words.length > 0) {
        const utterances = groupWordsToUtterances(data.words, speakerNamesRef.current);
        if (utterances.length > 0) {
          appendRef.current(utterances);
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "文字起こしに失敗しました";
      setError(message);
    } finally {
      setIsTranscribing(false);
      setElapsedSeconds(0);
    }
  }, [isRecording, clearIntervals]);

  const cleanup = useCallback(async () => {
    clearIntervals();

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    mediaRecorderRef.current = null;

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    analyserRef.current = null;

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }

    setAudioLevel(0);
  }, [clearIntervals]);

  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  return {
    isRecording,
    audioLevel,
    elapsedSeconds,
    isTranscribing,
    error,
    startRecording,
    stopRecording,
  };
}
