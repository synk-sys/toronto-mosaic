import type { NextRequest } from "next/server";
import { getService } from "@/lib/server/context";
import { clientIp, handleError, json, rateLimited } from "@/lib/server/http";
import { limiters } from "@/lib/server/rate-limit";

/** Public, privacy-safe mosaic state. Short shared-cache lifetime absorbs polling bursts. */
export async function GET(req: NextRequest) {
  const rl = limiters.readPerIp.check(clientIp(req));
  if (!rl.ok) return rateLimited(rl.retryAfterSec);
  try {
    const state = await (await getService()).getPublicState();
    return json(state, { headers: { "cache-control": "public, max-age=0, s-maxage=2, stale-while-revalidate=5" } });
  } catch (e) {
    return handleError(e);
  }
}
