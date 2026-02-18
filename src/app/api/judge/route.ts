import { NextRequest, NextResponse } from "next/server";

import { isAuthenticatedRequest } from "@/lib/auth";
import { DEFAULT_SPEAKER_NAMES, SYSTEM_PROMPT } from "@/lib/constants";
import { SpeakerNames, Utterance } from "@/lib/types";
import {
  buildConversationLog,
  extractJson,
  normalizeJudgmentResult,
} from "@/lib/utils";

type JudgeRequestBody = {
  utterances?: Utterance[];
  speaker_names?: Partial<SpeakerNames>;
};

export async function POST(req: NextRequest) {
  if (!isAuthenticatedRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json(
      { error: "GEMINI_API_KEY が未設定です" },
      { status: 500 },
    );
  }

  const body = (await req.json().catch(() => null)) as JudgeRequestBody | null;
  const utterances = Array.isArray(body?.utterances) ? body.utterances : [];
  if (utterances.length === 0) {
    return NextResponse.json(
      { error: "会話ログが空です" },
      { status: 400 },
    );
  }

  const speakerNames: SpeakerNames = {
    0: body?.speaker_names?.[0] || DEFAULT_SPEAKER_NAMES[0],
    1: body?.speaker_names?.[1] || DEFAULT_SPEAKER_NAMES[1],
  };

  const conversationLog = buildConversationLog(utterances, speakerNames);

  const geminiResponse = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              {
                text: `${SYSTEM_PROMPT}\n\n--- 会話ログ ---\n${conversationLog}`,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 2048,
          responseMimeType: "application/json",
        },
      }),
      cache: "no-store",
    },
  );

  if (!geminiResponse.ok) {
    const errorBody = await geminiResponse.text();
    return NextResponse.json(
      { error: "Gemini API呼び出しに失敗しました", detail: errorBody },
      { status: 502 },
    );
  }

  const data = (await geminiResponse.json()) as {
    candidates?: Array<{
      content?: {
        parts?: Array<{
          text?: string;
        }>;
      };
    }>;
  };

  const resultText =
    data.candidates?.[0]?.content?.parts
      ?.map((part) => part.text || "")
      .join("\n") || "";
  const parsed = extractJson(resultText);
  const result = normalizeJudgmentResult(parsed);

  return NextResponse.json({ result });
}
