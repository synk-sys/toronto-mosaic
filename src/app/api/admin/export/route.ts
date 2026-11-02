import { getService } from "@/lib/server/context";
import { withOrganizer } from "@/lib/server/admin-guard";
import { json } from "@/lib/server/http";

function csvCell(v: unknown) {
  const s = v == null ? "" : String(v);
  // Quote everything; neutralise spreadsheet formula injection.
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return `"${safe.replace(/"/g, '""')}"`;
}

export const GET = withOrganizer(async (req) => {
  const rows = await (await getService()).exportApproved();
  const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
  if (req.nextUrl.searchParams.get("format") === "csv") {
    const header = ["id", "tileId", "color", "symbol", "message", "caption", "createdAt"];
    const csv = [header.join(","), ...rows.map((r) => header.map((h) => csvCell(r[h as keyof typeof r])).join(","))].join("\n");
    return new Response("﻿" + csv, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="toronto-mosaic-approved-${stamp}.csv"`,
        "cache-control": "no-store",
      },
    });
  }
  return json(
    { exportedAt: new Date().toISOString(), count: rows.length, contributions: rows },
    { headers: { "content-disposition": `attachment; filename="toronto-mosaic-approved-${stamp}.json"` } },
  );
});
