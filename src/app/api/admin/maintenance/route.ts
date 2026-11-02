import { z } from "zod";
import { getService, demoSeedAllowed, resetAllowed } from "@/lib/server/context";
import { withOrganizer } from "@/lib/server/admin-guard";
import { errorResponse, json, readJson } from "@/lib/server/http";
import { syntheticSubmission } from "@/lib/demo";

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("recount") }),
  z.object({ action: z.literal("sync-tiles") }),
  z.object({ action: z.literal("seed-tiles") }),
  z.object({ action: z.literal("seed-demo"), count: z.number().int().min(1).max(300) }),
  z.object({ action: z.literal("reset"), confirm: z.literal("RESET") }),
]);

export const GET = withOrganizer(async () => json({ demoSeedAllowed: demoSeedAllowed(), resetAllowed: resetAllowed() }));

export const POST = withOrganizer(async (req, organizer) => {
  const body = schema.parse(await readJson(req));
  const service = await getService();
  console.info("[mosaic] maintenance", { by: organizer.email ?? organizer.id, action: body.action });
  switch (body.action) {
    case "recount":
      return json({ aggregates: await service.recountAggregates() });
    case "sync-tiles":
      await service.syncTiles();
      return json({ ok: true });
    case "seed-tiles":
      return json({ created: await service.seedTiles() });
    case "seed-demo": {
      if (!demoSeedAllowed()) return errorResponse(403, "FORBIDDEN", "Synthetic seeding is disabled on this deployment");
      const start = Date.now();
      let created = 0;
      for (let i = 0; i < body.count; i++) {
        try {
          const r = await service.submit(`demo_${start}_${i}`, syntheticSubmission(start + i));
          if (r.created) created++;
        } catch {
          break; // mosaic full or paused
        }
      }
      return json({ created });
    }
    case "reset":
      if (!resetAllowed()) return errorResponse(403, "FORBIDDEN", "Reset is disabled on this deployment");
      await service.resetAll();
      return json({ ok: true });
  }
});
