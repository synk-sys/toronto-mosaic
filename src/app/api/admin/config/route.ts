import { getService } from "@/lib/server/context";
import { withOrganizer } from "@/lib/server/admin-guard";
import { json, readJson } from "@/lib/server/http";
import { configPatchSchema } from "@/lib/validation";

export const GET = withOrganizer(async () => json({ config: await (await getService()).getConfig() }));

export const PATCH = withOrganizer(async (req, organizer) => {
  const patch = configPatchSchema.parse(await readJson(req));
  const config = await (await getService()).updateConfig(patch);
  console.info("[mosaic] config updated", { by: organizer.email ?? organizer.id, patch });
  return json({ config });
});
