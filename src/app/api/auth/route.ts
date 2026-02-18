import { NextRequest, NextResponse } from "next/server";

import { issueSessionToken, SESSION_COOKIE_NAME } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const password = body?.password;

  if (typeof password !== "string" || password.length === 0) {
    return NextResponse.json(
      { error: "パスワードを入力してください" },
      { status: 400 },
    );
  }

  if (!process.env.ROOM_PASSWORD || !process.env.SESSION_SECRET) {
    return NextResponse.json(
      { error: "サーバー設定が不足しています" },
      { status: 500 },
    );
  }

  if (password !== process.env.ROOM_PASSWORD) {
    return NextResponse.json(
      { error: "パスワードが違います" },
      { status: 401 },
    );
  }

  const expiresIn = 86_400;
  const token = issueSessionToken(expiresIn);
  const response = NextResponse.json({
    token,
    expires_in: expiresIn,
  });

  response.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: expiresIn,
  });

  return response;
}
