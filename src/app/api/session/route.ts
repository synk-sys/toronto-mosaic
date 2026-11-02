import type { NextRequest } from "next/server";
import { isFirebaseMode } from "@/lib/env";
import { getParticipantUid, issueParticipantCookie } from "@/lib/server/auth";
import { clientIp, json, rateLimited } from "@/lib/server/http";
import { limiters } from "@/lib/server/rate-limit";

/** Local mode: establish an anonymous participant session (signed cookie). */
export async function POST(req: NextRequest) {
  if (isFirebaseMode()) return json({ mode: "firebase" });
  if (await getParticipantUid(req)) return json({ mode: "local", ok: true });
  const rl = limiters.sessionPerIp.check(clientIp(req));
  if (!rl.ok) return rateLimited(rl.retryAfterSec);
  const res = json({ mode: "local", ok: true });
  issueParticipantCookie(res);
  return res;
}
