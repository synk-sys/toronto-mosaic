import { NextResponse, type NextRequest } from "next/server";
import { ZodError } from "zod";
import { MosaicError } from "./mosaic-service";

export function clientIp(req: NextRequest) {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
}

export function json<T>(data: T, init: ResponseInit = {}) {
  return NextResponse.json(data, {
    ...init,
    headers: { "cache-control": "no-store", ...(init.headers ?? {}) },
  });
}

export function errorResponse(status: number, code: string, message: string, extra: Record<string, unknown> = {}) {
  return json({ error: { code, message, ...extra } }, { status });
}

export function rateLimited(retryAfterSec: number) {
  return json(
    { error: { code: "RATE_LIMITED", message: "Too many requests — please wait a moment and try again.", retryAfterSec } },
    { status: 429, headers: { "retry-after": String(retryAfterSec) } },
  );
}

const STATUS: Record<string, number> = {
  SUBMISSIONS_CLOSED: 423,
  MOSAIC_FULL: 409,
  BUSY: 503,
  NOT_FOUND: 404,
  INVALID: 400,
};

/** Map thrown errors to safe JSON responses (no stack traces to clients). */
export function handleError(e: unknown) {
  if (e instanceof MosaicError) return errorResponse(STATUS[e.code] ?? 400, e.code, e.message);
  if (e instanceof ZodError) {
    return errorResponse(400, "INVALID", e.issues[0]?.message ?? "Invalid request");
  }
  console.error("[mosaic] unexpected error", e);
  return errorResponse(500, "INTERNAL", "Something went wrong on our side. Please try again.");
}

export async function readJson(req: NextRequest): Promise<unknown> {
  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > 4096) throw new MosaicError("INVALID", "Request too large");
  try {
    return await req.json();
  } catch {
    throw new MosaicError("INVALID", "Invalid JSON body");
  }
}

/** Reject cross-site state-changing requests (cookie-auth CSRF defence). */
export function sameOrigin(req: NextRequest) {
  const origin = req.headers.get("origin");
  if (!origin) return true; // non-browser clients / same-origin navigations
  try {
    return new URL(origin).host === (req.headers.get("x-forwarded-host") ?? req.headers.get("host"));
  } catch {
    return false;
  }
}
