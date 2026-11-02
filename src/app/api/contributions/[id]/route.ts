import type { NextRequest } from "next/server";
import { getParticipantUid } from "@/lib/server/auth";
import { getService } from "@/lib/server/context";
import { clientIp, errorResponse, handleError, json, rateLimited } from "@/lib/server/http";
import { limiters } from "@/lib/server/rate-limit";

/** Public share-link view. Never includes participant identifiers. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const rl = limiters.readPerIp.check(clientIp(req));
  if (!rl.ok) return rateLimited(rl.retryAfterSec);
  try {
    const { id } = await params;
    const viewer = await getParticipantUid(req);
    const contribution = await (await getService()).getPublicContribution(id, viewer);
    if (!contribution) return errorResponse(404, "NOT_FOUND", "This tile could not be found.");
    return json({ contribution });
  } catch (e) {
    return handleError(e);
  }
}
