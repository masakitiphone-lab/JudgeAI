"use client";

import { useCallback, useState } from "react";

import { JudgmentResult, SpeakerNames, Utterance } from "@/lib/types";
import { normalizeJudgmentResult } from "@/lib/utils";

type JudgeParams = {
  sessionToken: string;
  utterances: Utterance[];
  speakerNames: SpeakerNames;
};

export function useJudge() {
  const [isJudging, setIsJudging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const judgeConversation = useCallback(
    async ({ sessionToken, utterances, speakerNames }: JudgeParams) => {
      setIsJudging(true);
      setError(null);

      try {
        const response = await fetch("/api/judge", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${sessionToken}`,
          },
          body: JSON.stringify({
            utterances,
            speaker_names: speakerNames,
          }),
        });

        if (!response.ok) {
          const data = (await response.json().catch(() => null)) as
            | { error?: string }
            | null;
          const message = data?.error || "ジャッジの生成に失敗しました";
          setError(message);
          return null;
        }

        const data = (await response.json()) as {
          result?: JudgmentResult;
        };
        return normalizeJudgmentResult(data.result);
      } catch {
        setError("ネットワークエラーが発生しました");
        return null;
      } finally {
        setIsJudging(false);
      }
    },
    [],
  );

  return {
    judgeConversation,
    isJudging,
    error,
  };
}
