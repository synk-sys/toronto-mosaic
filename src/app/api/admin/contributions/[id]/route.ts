import { getService } from "@/lib/server/context";
import { withOrganizer } from "@/lib/server/admin-guard";
import { json, readJson } from "@/lib/server/http";
import { moderationActionSchema } from "@/lib/validation";

export const PATCH = withOrganizer<{ params: Promise<{ id: string }> }>(async (req, _org, { params }) => {
  const { id } = await params;
  const { action } = moderationActionSchema.parse(await readJson(req));
  const contribution = await (await getService()).moderate(id, action);
  return json({ contribution });
});
