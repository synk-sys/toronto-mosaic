import { getService } from "@/lib/server/context";
import { withOrganizer } from "@/lib/server/admin-guard";
import { json } from "@/lib/server/http";
import type { ModerationStatus } from "@/lib/types";

const STATUSES: ModerationStatus[] = ["pending", "approved", "hidden", "removed"];

export const GET = withOrganizer(async (req) => {
  const s = req.nextUrl.searchParams.get("status") as ModerationStatus | null;
  const status = s && STATUSES.includes(s) ? s : undefined;
  const service = await getService();
  const [contributions, aggregates] = await Promise.all([
    service.listForAdmin({ status, limit: 500 }),
    service.getAggregates(),
  ]);
  return json({ contributions, aggregates });
});
