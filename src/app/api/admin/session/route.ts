import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { isFirebaseMode } from "@/lib/env";
import { ADMIN_COOKIE, checkPasscode, getOrganizer, issueAdminCookie } from "@/lib/server/auth";
import { clientIp, errorResponse, handleError, json, rateLimited, readJson, sameOrigin } from "@/lib/server/http";
import { limiters } from "@/lib/server/rate-limit";

/** Who am I? Works for both Firebase (Bearer token) and local (cookie) modes. */
export async function GET(req: NextRequest) {
  const organizer = await getOrganizer(req);
  return json({ mode: isFirebaseMode() ? "firebase" : "local", organizer });
}

/** Local mode passcode login. */
export async function POST(req: NextRequest) {
  try {
    if (isFirebaseMode()) return errorResponse(400, "INVALID", "Use Google sign-in");
    if (!sameOrigin(req)) return errorResponse(403, "FORBIDDEN", "Cross-site request blocked");
    const rl = limiters.adminLogin.check(clientIp(req));
    if (!rl.ok) return rateLimited(rl.retryAfterSec);
    const { passcode } = z.object({ passcode: z.string().max(200) }).parse(await readJson(req));
    if (!checkPasscode(passcode)) return errorResponse(401, "UNAUTHORIZED", "Incorrect passcode");
    const res = json({ ok: true });
    issueAdminCookie(res);
    return res;
  } catch (e) {
    return handleError(e);
  }
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(ADMIN_COOKIE);
  return res;
}
