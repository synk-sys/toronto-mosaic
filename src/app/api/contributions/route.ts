import { after, type NextRequest } from "next/server";
import { getParticipantUid } from "@/lib/server/auth";
import { getService } from "@/lib/server/context";
import { enhanceMessage, geminiEnabled } from "@/lib/server/gemini";
import { clientIp, errorResponse, handleError, json, rateLimited, readJson, sameOrigin } from "@/lib/server/http";
import { limiters } from "@/lib/server/rate-limit";
import { submissionSchema } from "@/lib/validation";

export async function POST(req: NextRequest) {
  try {
    if (!sameOrigin(req)) return errorResponse(403, "FORBIDDEN", "Cross-site request blocked");
    const ipLimit = limiters.submitPerIp.check(clientIp(req));
    if (!ipLimit.ok) return rateLimited(ipLimit.retryAfterSec);

    const uid = await getParticipantUid(req);
    if (!uid) return errorResponse(401, "NO_SESSION", "Your session expired. Refresh the page and try again.");
    const userLimit = limiters.submitPerUser.check(uid);
    if (!userLimit.ok) return rateLimited(userLimit.retryAfterSec);

    const input = submissionSchema.parse(await readJson(req));
    const service = await getService();
    const result = await service.submit(uid, input);

    if (result.created && result.contribution.message && geminiEnabled()) {
      const { id, message } = result.contribution;
      after(async () => {
        const enhancement = await enhanceMessage(message);
        if (enhancement) await service.setEnhancement(id, enhancement.caption, enhancement.motif);
      });
    }
    return json(result, { status: result.created ? 201 : 200 });
  } catch (e) {
    return handleError(e);
  }
}
