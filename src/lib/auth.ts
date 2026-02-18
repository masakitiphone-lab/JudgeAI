import { createHmac, timingSafeEqual } from "node:crypto";

import { NextRequest } from "next/server";

export const SESSION_COOKIE_NAME = "kenka_session";
const SESSION_PREFIX = "session_";

type SessionPayload = {
  exp: number;
  iat: number;
  nonce: string;
};

function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("SESSION_SECRET is not configured");
  }
  return secret;
}

function sign(value: string): string {
  return createHmac("sha256", getSessionSecret())
    .update(value)
    .digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const aBuffer = Buffer.from(a);
  const bBuffer = Buffer.from(b);
  if (aBuffer.length !== bBuffer.length) {
    return false;
  }
  return timingSafeEqual(aBuffer, bBuffer);
}

export function issueSessionToken(ttlSeconds = 86_400): string {
  const now = Math.floor(Date.now() / 1000);
  const payload: SessionPayload = {
    exp: now + ttlSeconds,
    iat: now,
    nonce: globalThis.crypto.randomUUID().slice(0, 8),
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString(
    "base64url",
  );
  const signature = sign(encodedPayload);
  return `${SESSION_PREFIX}${encodedPayload}.${signature}`;
}

export function verifySessionToken(token: string | null | undefined): boolean {
  if (!token || !token.startsWith(SESSION_PREFIX)) {
    return false;
  }

  const rawToken = token.slice(SESSION_PREFIX.length);
  const parts = rawToken.split(".");
  if (parts.length !== 2) {
    return false;
  }

  const [encodedPayload, signature] = parts;
  try {
    if (!safeEqual(signature, sign(encodedPayload))) {
      return false;
    }

    const payload = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf-8"),
    ) as SessionPayload;

    if (typeof payload.exp !== "number") {
      return false;
    }

    return payload.exp > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}

export function getRequestSessionToken(req: NextRequest): string | null {
  const authorization = req.headers.get("authorization");
  if (authorization?.startsWith("Bearer ")) {
    return authorization.slice("Bearer ".length).trim();
  }
  return req.cookies.get(SESSION_COOKIE_NAME)?.value ?? null;
}

export function isAuthenticatedRequest(req: NextRequest): boolean {
  return verifySessionToken(getRequestSessionToken(req));
}
