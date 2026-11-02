import type { NextRequest } from "next/server";
import { getParticipantUid } from "@/lib/server/auth";
import { getService } from "@/lib/server/context";
import { handleError, json } from "@/lib/server/http";

/** The caller's own contribution (restores state after refresh). */
export async function GET(req: NextRequest) {
  try {
    const uid = await getParticipantUid(req);
    if (!uid) return json({ contribution: null });
    return json({ contribution: await (await getService()).getOwn(uid) });
  } catch (e) {
    return handleError(e);
  }
}
