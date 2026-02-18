import { DEEPGRAM_WS_BASE_URL } from "@/lib/constants";
import {
  DeepgramWord,
  JudgmentResult,
  SpeakerNames,
  Utterance,
  Word,
} from "@/lib/types";

function generateId(): string {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export function formatElapsed(seconds: number): string {
  const mins = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const secs = Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0");
  return `${mins}:${secs}`;
}

export function speakerLabel(speaker: number, speakerNames: SpeakerNames): string {
  if (speaker === 0) return speakerNames[0] || "話者A";
  if (speaker === 1) return speakerNames[1] || "話者B";
  return `話者${speaker}`;
}

export function buildDeepgramWebSocketUrl(
  token: string,
  params: Record<string, string>,
): string {
  const query = new URLSearchParams({
    ...params,
    token,
  });
  return `${DEEPGRAM_WS_BASE_URL}?${query.toString()}`;
}

export function groupWordsToUtterances(
  deepgramWords: DeepgramWord[],
  names: SpeakerNames,
): Utterance[] {
  if (!Array.isArray(deepgramWords) || deepgramWords.length === 0) {
    return [];
  }

  const normalizedWords: Word[] = deepgramWords
    .filter((word) => word.punctuated_word || word.word)
    .map((word) => ({
      word: word.word || word.punctuated_word || "",
      start: word.start ?? 0,
      end: word.end ?? word.start ?? 0,
      confidence: word.confidence ?? 0,
      punctuated_word: word.punctuated_word || word.word || "",
      speaker: word.speaker ?? 0,
    }));

  if (normalizedWords.length === 0) {
    return [];
  }

  const segments: Array<{ speaker: number; words: Word[] }> = [];
  let current = {
    speaker: normalizedWords[0].speaker,
    words: [normalizedWords[0]],
  };

  for (let i = 1; i < normalizedWords.length; i += 1) {
    const word = normalizedWords[i];
    if (word.speaker === current.speaker) {
      current.words.push(word);
    } else {
      segments.push(current);
      current = { speaker: word.speaker, words: [word] };
    }
  }
  segments.push(current);

  return segments.map((segment) => ({
    id: generateId(),
    transcript: segment.words.map((word) => word.punctuated_word).join(""),
    speaker: segment.speaker,
    speaker_label: speakerLabel(segment.speaker, names),
    start: segment.words[0].start,
    end: segment.words[segment.words.length - 1].end,
    confidence:
      segment.words.reduce((sum, word) => sum + word.confidence, 0) /
      segment.words.length,
    words: segment.words,
    timestamp: new Date().toISOString(),
  }));
}

export function buildConversationLog(
  utterances: Utterance[],
  names: SpeakerNames,
): string {
  return utterances
    .map(
      (utterance) =>
        `[${speakerLabel(utterance.speaker, names)}] ${utterance.transcript}`,
    )
    .join("\n");
}

export function extractJson<T>(value: string): T | null {
  if (!value) return null;

  const trimmed = value.trim();
  try {
    return JSON.parse(trimmed) as T;
  } catch {
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (fenced?.[1]) {
      try {
        return JSON.parse(fenced[1]) as T;
      } catch {
        return null;
      }
    }

    const firstBrace = trimmed.indexOf("{");
    const lastBrace = trimmed.lastIndexOf("}");
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      try {
        return JSON.parse(trimmed.slice(firstBrace, lastBrace + 1)) as T;
      } catch {
        return null;
      }
    }

    return null;
  }
}

export function normalizeJudgmentResult(input: unknown): JudgmentResult {
  const defaultResult: JudgmentResult = {
    summary: "要約を生成できませんでした。",
    speaker_0_position: "",
    speaker_1_position: "",
    analysis: {
      speaker_0_valid_points: [],
      speaker_0_issues: [],
      speaker_1_valid_points: [],
      speaker_1_issues: [],
    },
    judgment: {
      verdict: "引き分け",
      confidence: 0.5,
      reasoning: "判定の生成に失敗したため、再試行してください。",
    },
    advice: {
      to_speaker_0: "",
      to_speaker_1: "",
      general: "",
    },
  };

  if (!input || typeof input !== "object") {
    return defaultResult;
  }

  const result = input as Partial<JudgmentResult>;
  return {
    summary:
      typeof result.summary === "string" ? result.summary : defaultResult.summary,
    speaker_0_position:
      typeof result.speaker_0_position === "string"
        ? result.speaker_0_position
        : defaultResult.speaker_0_position,
    speaker_1_position:
      typeof result.speaker_1_position === "string"
        ? result.speaker_1_position
        : defaultResult.speaker_1_position,
    analysis: {
      speaker_0_valid_points: Array.isArray(
        result.analysis?.speaker_0_valid_points,
      )
        ? result.analysis.speaker_0_valid_points
        : defaultResult.analysis.speaker_0_valid_points,
      speaker_0_issues: Array.isArray(result.analysis?.speaker_0_issues)
        ? result.analysis.speaker_0_issues
        : defaultResult.analysis.speaker_0_issues,
      speaker_1_valid_points: Array.isArray(
        result.analysis?.speaker_1_valid_points,
      )
        ? result.analysis.speaker_1_valid_points
        : defaultResult.analysis.speaker_1_valid_points,
      speaker_1_issues: Array.isArray(result.analysis?.speaker_1_issues)
        ? result.analysis.speaker_1_issues
        : defaultResult.analysis.speaker_1_issues,
    },
    judgment: {
      verdict:
        typeof result.judgment?.verdict === "string"
          ? result.judgment.verdict
          : defaultResult.judgment.verdict,
      confidence:
        typeof result.judgment?.confidence === "number"
          ? Math.max(0, Math.min(1, result.judgment.confidence))
          : defaultResult.judgment.confidence,
      reasoning:
        typeof result.judgment?.reasoning === "string"
          ? result.judgment.reasoning
          : defaultResult.judgment.reasoning,
    },
    advice: {
      to_speaker_0:
        typeof result.advice?.to_speaker_0 === "string"
          ? result.advice.to_speaker_0
          : defaultResult.advice.to_speaker_0,
      to_speaker_1:
        typeof result.advice?.to_speaker_1 === "string"
          ? result.advice.to_speaker_1
          : defaultResult.advice.to_speaker_1,
      general:
        typeof result.advice?.general === "string"
          ? result.advice.general
          : defaultResult.advice.general,
    },
  };
}
