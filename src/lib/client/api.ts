"use client";

import { isFirebaseMode } from "@/lib/env";
import { ensureAnonymousUser, getClientAuth } from "./firebase";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public retryAfterSec?: number,
  ) {
    super(message);
  }
  get retryable() {
    return this.status === 0 || this.status === 429 || this.status >= 500;
  }
}

type AuthKind = "participant" | "organizer" | "none";

async function authHeader(kind: AuthKind): Promise<Record<string, string>> {
  if (!isFirebaseMode() || kind === "none") return {};
  const auth = await getClientAuth();
  if (!auth) return {};
  await auth.authStateReady();
  const user = kind === "participant" ? (auth.currentUser ?? (await ensureAnonymousUser())) : auth.currentUser;
  return user ? { authorization: `Bearer ${await user.getIdToken()}` } : {};
}

export async function api<T>(path: string, init: RequestInit & { auth?: AuthKind } = {}): Promise<T> {
  const { auth = "participant", ...rest } = init;
  let res: Response;
  try {
    res = await fetch(path, {
      ...rest,
      credentials: "same-origin",
      headers: {
        ...(rest.body ? { "content-type": "application/json" } : {}),
        ...(await authHeader(auth)),
        ...(rest.headers ?? {}),
      },
    });
  } catch {
    throw new ApiError(0, "NETWORK", "You appear to be offline. Check your connection and try again.");
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = body?.error ?? {};
    throw new ApiError(res.status, err.code ?? "ERROR", err.message ?? "Request failed", err.retryAfterSec);
  }
  return body as T;
}

/** Retry transient failures (network, 429, 5xx) with jittered backoff. */
export async function withRetry<T>(fn: () => Promise<T>, attempts = 4): Promise<T> {
  let last: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      last = e;
      if (!(e instanceof ApiError) || !e.retryable || i === attempts - 1) throw e;
      const wait = e.retryAfterSec ? e.retryAfterSec * 1000 : 400 * 2 ** i + Math.random() * 400;
      await new Promise((r) => setTimeout(r, Math.min(wait, 8000)));
    }
  }
  throw last;
}

/** Ensure the visitor has an anonymous identity (Firebase anon auth or local signed cookie). */
export async function ensureSession() {
  if (isFirebaseMode()) {
    await ensureAnonymousUser();
    return;
  }
  await api("/api/session", { method: "POST", auth: "none" });
}
