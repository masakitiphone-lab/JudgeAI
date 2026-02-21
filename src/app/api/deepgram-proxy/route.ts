import { NextRequest, NextResponse } from "next/server";

import { isAuthenticatedRequest } from "@/lib/auth";

export async function POST(req: NextRequest) {
  if (!isAuthenticatedRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.DEEPGRAM_API_KEY) {
    return NextResponse.json(
      { error: "DEEPGRAM_API_KEY が未設定です" },
      { status: 500 },
    );
  }

  const contentType = req.headers.get("content-type") || "";
  const audioBuffer = await req.arrayBuffer().catch(() => null);

  if (!audioBuffer || audioBuffer.byteLength === 0) {
    return NextResponse.json(
      { error: "音声データが空です" },
      { status: 400 },
    );
  }

  const params = new URLSearchParams({
    model: "nova-3",
    diarize: "true",
    punctuate: "true",
    smart_format: "true",
  });

  const response = await fetch(
    `https://api.deepgram.com/v1/listen?${params.toString()}`,
    {
      method: "POST",
      headers: {
        Authorization: `Token ${process.env.DEEPGRAM_API_KEY}`,
        "Content-Type": contentType || "audio/webm",
      },
      body: audioBuffer,
      cache: "no-store",
    },
  );

  if (!response.ok) {
    const detail = await response.text();
    return NextResponse.json(
      { error: "Deepgram文字起こしに失敗しました", detail },
      { status: 502 },
    );
  }

  const data = await response.json();
  return NextResponse.json(data);
}
