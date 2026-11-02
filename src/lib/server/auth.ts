import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import type { NextRequest, NextResponse } from "next/server";
import { isFirebaseMode } from "@/lib/env";

export const PARTICIPANT_COOKIE = "mosaic_pid";
export const ADMIN_COOKIE = "mosaic_admin";
const YEAR = 60 * 60 * 24 * 365;

function secret() {
  const s = process.env.SESSION_SECRET;
  if (s && s.length >= 16) return s;
  if (process.env.NODE_ENV === "production" && !isFirebaseMode()) {
    throw new Error("SESSION_SECRET (16+ chars) is required in production local mode");
  }
  return "dev-only-insecure-session-secret";
}

function sign(value: string) {
  return createHmac("sha256", secret()).update(value).digest("base64url");
}

function safeEqual(a: string, b: string) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

function verifySigned(raw: string | undefined): string | null {
  if (!raw) return null;
  const i = raw.lastIndexOf(".");
  if (i <= 0) return null;
  const value = raw.slice(0, i);
  return safeEqual(raw.slice(i + 1), sign(value)) ? value : null;
}

const signed = (value: string) => `${value}.${sign(value)}`;

function bearer(req: NextRequest) {
  const h = req.headers.get("authorization") ?? "";
  return h.startsWith("Bearer ") ? h.slice(7).trim() : null;
}

async function verifyFirebaseToken(token: string) {
  const { getAdminAuth } = await import("./firebase-admin");
  return getAdminAuth().verifyIdToken(token);
}

/**
 * Resolve the participant UID from a verified credential — never from the
 * request body. Firebase mode: anonymous-auth ID token. Local mode: signed cookie.
 */
export async function getParticipantUid(req: NextRequest): Promise<string | null> {
  if (isFirebaseMode()) {
    const token = bearer(req);
    if (!token) return null;
    try {
      return (await verifyFirebaseToken(token)).uid;
    } catch {
      return null;
    }
  }
  const value = verifySigned(req.cookies.get(PARTICIPANT_COOKIE)?.value);
  return value?.startsWith("p_") ? value : null;
}

/** Local mode: issue an anonymous participant session cookie if missing. */
export function issueParticipantCookie(res: NextResponse) {
  const uid = `p_${randomUUID().replace(/-/g, "")}`;
  res.cookies.set(PARTICIPANT_COOKIE, signed(uid), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: YEAR,
  });
  return uid;
}

export interface Organizer {
  id: string;
  email: string | null;
}

export function organizerEmails() {
  return (process.env.ORGANIZER_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Server-enforced organizer check.
 * Firebase mode: Google sign-in ID token whose verified email is in
 * ORGANIZER_EMAILS, or which carries the `organizer: true` custom claim.
 * Local mode: signed, expiring cookie obtained with LOCAL_ADMIN_PASSCODE.
 */
export async function getOrganizer(req: NextRequest): Promise<Organizer | null> {
  if (isFirebaseMode()) {
    const token = bearer(req);
    if (!token) return null;
    try {
      const d = await verifyFirebaseToken(token);
      if (d.firebase?.sign_in_provider !== "google.com") return null;
      const email = d.email?.toLowerCase() ?? null;
      const allowed = d.organizer === true || (!!email && d.email_verified === true && organizerEmails().includes(email));
      return allowed ? { id: d.uid, email } : null;
    } catch {
      return null;
    }
  }
  const value = verifySigned(req.cookies.get(ADMIN_COOKIE)?.value);
  if (!value) return null;
  const [kind, exp] = value.split(":");
  if (kind !== "admin" || Number(exp) < Date.now()) return null;
  return { id: "local-admin", email: null };
}

export function localAdminPasscode(): string | null {
  const p = process.env.LOCAL_ADMIN_PASSCODE;
  if (p) return p;
  return process.env.NODE_ENV === "production" ? null : "devfest";
}

export function checkPasscode(input: string) {
  const expected = localAdminPasscode();
  return !!expected && safeEqual(sign(input), sign(expected));
}

export function issueAdminCookie(res: NextResponse) {
  const exp = Date.now() + 12 * 60 * 60 * 1000;
  res.cookies.set(ADMIN_COOKIE, signed(`admin:${exp}`), {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 12 * 60 * 60,
  });
}
