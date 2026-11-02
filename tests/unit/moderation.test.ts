import { describe, expect, it } from "vitest";
import { initialStatus, screenMessage } from "@/lib/moderation";
import { makeService, sub } from "./helpers";

describe("message screening", () => {
  it("flags profanity, links and contact details", () => {
    expect(screenMessage("this is sh1t").flagged).toBe(true);
    expect(screenMessage("visit www.spam.com").reasons).toContain("link");
    expect(screenMessage("email me a@b.co").reasons).toContain("email");
    expect(screenMessage("call 416 555 0199").reasons).toContain("phone");
    expect(screenMessage("A greener Toronto for everyone").flagged).toBe(false);
  });

  it("never auto-approves messages while moderation is on", () => {
    expect(initialStatus("", true).status).toBe("approved");
    expect(initialStatus("Hello future", true).status).toBe("pending");
    expect(initialStatus("Hello future", false).status).toBe("approved");
    expect(initialStatus("fuck this", false)).toEqual({ status: "pending", flagged: true });
  });
});

describe("moderation workflow", () => {
  it("keeps pending messages off public surfaces until approved", async () => {
    const { service } = makeService();
    const { contribution } = await service.submit("u1", sub("Free transit for all"));
    let state = await service.getPublicState();
    expect(state.tiles[0].message).toBeNull();
    expect((await service.getPublicContribution(contribution.id))?.message).toBeNull();

    await service.moderate(contribution.id, "approve");
    state = await service.getPublicState();
    expect(state.tiles[0].message).toBe("Free transit for all");
    expect(state.aggregates.approvedContributions).toBe(1);
    expect(state.aggregates.pendingContributions).toBe(0);
  });

  it("hide keeps the tile but removes the message", async () => {
    const { service } = makeService();
    const { contribution } = await service.submit("u2", sub("Something rude"));
    await service.moderate(contribution.id, "approve");
    await service.moderate(contribution.id, "hide");
    const state = await service.getPublicState();
    expect(state.tiles).toHaveLength(1);
    expect(state.tiles[0].message).toBeNull();
    expect(state.aggregates.approvedContributions).toBe(0);
    expect(state.aggregates.totalContributions).toBe(1);
  });

  it("remove frees the tile and updates aggregates; participant cannot resubmit", async () => {
    const { service } = makeService();
    const { contribution } = await service.submit("u3", sub("bad"));
    await service.moderate(contribution.id, "remove");
    const state = await service.getPublicState();
    expect(state.tiles).toHaveLength(0);
    expect(state.aggregates.totalContributions).toBe(0);
    expect(state.aggregates.remainingTiles).toBe(300);
    expect(await service.getPublicContribution(contribution.id)).toBeNull();
    const again = await service.submit("u3", sub("try again"));
    expect(again.created).toBe(false);
    await expect(service.moderate(contribution.id, "approve")).rejects.toMatchObject({ code: "INVALID" });
  });

  it("public message toggle strips approved messages from tiles", async () => {
    const { service } = makeService();
    const { contribution } = await service.submit("u4", sub("Lake swimming"));
    await service.moderate(contribution.id, "approve");
    await service.updateConfig({ publicMessagesEnabled: false });
    let state = await service.getPublicState();
    expect(state.tiles[0].message).toBeNull();
    // Rules-level guarantee: the stored public tile no longer carries the text.
    const tile = await service.db.get(`tiles/${contribution.tileId}`);
    expect(tile?.displayMessage).toBeNull();
    await service.updateConfig({ publicMessagesEnabled: true });
    state = await service.getPublicState();
    expect(state.tiles[0].message).toBe("Lake swimming");
  });

  it("AI captions only surface once approved", async () => {
    const { service } = makeService();
    const { contribution } = await service.submit("u5", sub("Clean energy"));
    await service.setEnhancement(contribution.id, "Sunlight powering every home", "rays");
    let state = await service.getPublicState();
    expect(state.tiles[0].caption).toBeNull();
    expect(state.tiles[0].motif).toBe("rays");
    await service.moderate(contribution.id, "approve");
    state = await service.getPublicState();
    expect(state.tiles[0].caption).toBe("Sunlight powering every home");
  });

  it("recount reconciles aggregates from source documents", async () => {
    const { service, db } = makeService();
    for (let i = 0; i < 5; i++) await service.submit(`r${i}`, sub(i % 2 ? "msg" : ""));
    await db.set("aggregates/main", { totalContributions: 999 }, { merge: true });
    const agg = await service.recountAggregates();
    expect(agg).toMatchObject({ totalContributions: 5, approvedContributions: 3, pendingContributions: 2, remainingTiles: 295 });
  });
});
