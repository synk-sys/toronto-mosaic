import { describe, expect, it } from "vitest";
import { makeService, sub } from "./helpers";

describe("public/private data access", () => {
  it("public mosaic state never contains participant identifiers", async () => {
    const { service } = makeService();
    await service.submit("secret-uid-123", sub("hello"));
    const state = await service.getPublicState();
    const raw = JSON.stringify(state);
    expect(raw).not.toContain("secret-uid-123");
    expect(raw).not.toContain("participantUid");
  });

  it("share view hides uid; owners see their own pending message, others do not", async () => {
    const { service } = makeService();
    const { contribution } = await service.submit("owner-uid", sub("My pending hope"));
    const asOwner = await service.getPublicContribution(contribution.id, "owner-uid");
    const asStranger = await service.getPublicContribution(contribution.id, "other-uid");
    expect(asOwner?.message).toBe("My pending hope");
    expect(asStranger?.message).toBeNull();
    expect(JSON.stringify(asStranger)).not.toContain("owner-uid");
  });

  it("admin listing and export omit participant identifiers", async () => {
    const { service } = makeService();
    const { contribution } = await service.submit("admin-hidden-uid", sub("Exported"));
    await service.moderate(contribution.id, "approve");
    expect(JSON.stringify(await service.listForAdmin())).not.toContain("admin-hidden-uid");
    const exported = await service.exportApproved();
    expect(exported).toHaveLength(1);
    expect(JSON.stringify(exported)).not.toContain("admin-hidden-uid");
  });

  it("rejects malformed contribution ids without touching the database", async () => {
    const { service } = makeService();
    expect(await service.getPublicContribution("../participants/x")).toBeNull();
  });
});
