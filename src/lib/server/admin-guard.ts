import type { NextRequest } from "next/server";
import { getOrganizer, type Organizer } from "./auth";
import { errorResponse, handleError, sameOrigin } from "./http";

type Handler<C> = (req: NextRequest, organizer: Organizer, ctx: C) => Promise<Response>;

/** Wrap an admin route: verify organizer server-side, block cross-site writes. */
export function withOrganizer<C = unknown>(handler: Handler<C>) {
  return async (req: NextRequest, ctx: C) => {
    try {
      if (req.method !== "GET" && !sameOrigin(req)) return errorResponse(403, "FORBIDDEN", "Cross-site request blocked");
      const organizer = await getOrganizer(req);
      if (!organizer) return errorResponse(401, "UNAUTHORIZED", "Organizer sign-in required");
      return await handler(req, organizer, ctx);
    } catch (e) {
      return handleError(e);
    }
  };
}
