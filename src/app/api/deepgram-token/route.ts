import { NextRequest, NextResponse } from "next/server";

import { isAuthenticatedRequest } from "@/lib/auth";

export async function GET(req: NextRequest) {
  if (!isAuthenticatedRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.DEEPGRAM_API_KEY) {
    return NextResponse.json(
      { error: "DEEPGRAM_API_KEY が未設定です" },
      { status: 500 },
    );
  }

  const deepgramResponse = await fetch("https://api.deepgram.com/v1/auth/grant", {
    method: "POST",
    headers: {
      Authorization: `Token ${process.env.DEEPGRAM_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ttl_seconds: 300 }),
    cache: "no-store",
  });

  if (!deepgramResponse.ok) {
    const errorBody = await deepgramResponse.text();
    return NextResponse.json(
      { error: "Deepgramトークン発行に失敗しました", detail: errorBody },
      { status: 502 },
    );
  }

  const data = (await deepgramResponse.json()) as {
    access_token?: string;
    expires_in?: number;
  };

  if (!data.access_token) {
    return NextResponse.json(
      { error: "Deepgramレスポンスが不正です" },
      { status: 502 },
    );
  }

  return NextResponse.json({
    token: data.access_token,
    expires_in: data.expires_in ?? 300,
  });
}
