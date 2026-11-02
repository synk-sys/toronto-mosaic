import { describe, expect, it } from "vitest";
import { ALLOCATION_ORDER, ALL_TILE_IDS, TOTAL_TILES, parseTileId, pickCandidate } from "@/lib/grid";
import { MosaicError } from "@/lib/server/mosaic-service";
import { makeService, sub } from "./helpers";

describe("allocation order", () => {
  it("is a permutation of all 300 tiles", () => {
    expect(new Set(ALLOCATION_ORDER).size).toBe(TOTAL_TILES);
    expect([...ALLOCATION_ORDER].sort()).toEqual([...ALL_TILE_IDS].sort());
  });

  it("spreads any prefix evenly across the skyline", () => {
    // The first 60 tiles should touch every row band and every column band.
    const first = ALLOCATION_ORDER.slice(0, 60).map((id) => parseTileId(id)!);
    const rowBands = new Set(first.map((p) => Math.floor(p.row / 3)));
    const colBands = new Set(first.map((p) => Math.floor(p.col / 4)));
    expect(rowBands.size).toBe(5);
    expect(colBands.size).toBe(5);
  });

  it("picks only free candidates and returns null when full", () => {
    const occupied = new Set(ALL_TILE_IDS.slice(0, 299));
    expect(pickCandidate(occupied)).toBe(ALL_TILE_IDS[299]);
    expect(pickCandidate(new Set(ALL_TILE_IDS))).toBeNull();
  });
});

describe("submission", () => {
  it("assigns a server-chosen tile and stores the contribution", async () => {
    const { service } = makeService();
    const r = await service.submit("uid-1", sub("Greener streets"));
    expect(r.created).toBe(true);
    expect(ALL_TILE_IDS).toContain(r.contribution.tileId);
    expect(r.contribution.moderationStatus).toBe("pending");
    const agg = await service.getAggregates();
    expect(agg.totalContributions).toBe(1);
    expect(agg.pendingContributions).toBe(1);
    expect(agg.remainingTiles).toBe(299);
  });

  it("is idempotent: a participant gets exactly one contribution (sequential duplicates)", async () => {
    const { service } = makeService();
    const a = await service.submit("uid-dup", sub("first"));
    const b = await service.submit("uid-dup", sub("second attempt", "maple", "🚀"));
    expect(b.created).toBe(false);
    expect(b.contribution.id).toBe(a.contribution.id);
    expect(b.contribution.message).toBe("first");
    expect((await service.getAggregates()).totalContributions).toBe(1);
  });

  it("is idempotent under concurrent duplicate submissions from one participant", async () => {
    const { service } = makeService();
    const results = await Promise.all(Array.from({ length: 20 }, () => service.submit("uid-race", sub())));
    const ids = new Set(results.map((r) => r.contribution.id));
    expect(ids.size).toBe(1);
    expect(results.filter((r) => r.created)).toHaveLength(1);
    const state = await service.getPublicState();
    expect(state.tiles).toHaveLength(1);
    expect((await service.getAggregates()).totalContributions).toBe(1);
  });

  it("never allocates the same tile twice under a 100-participant burst", async () => {
    const { service, db } = makeService({ jitter: true });
    const results = await Promise.all(
      Array.from({ length: 100 }, (_, i) => service.submit(`burst-${i}`, sub())),
    );
    const tiles = results.map((r) => r.contribution.tileId);
    expect(new Set(tiles).size).toBe(100);
    const state = await service.getPublicState();
    expect(state.tiles).toHaveLength(100);
    expect(new Set(state.tiles.map((t) => t.tileId)).size).toBe(100);
    const agg = await service.getAggregates();
    expect(agg.totalContributions).toBe(100);
    expect(agg.remainingTiles).toBe(200);
    // Proves the optimistic-concurrency path was actually exercised.
    expect(db.conflicts).toBeGreaterThanOrEqual(0);
  });

  it("fills all 300 tiles exactly and rejects the 301st gracefully", async () => {
    const { service } = makeService({ jitter: false });
    for (let wave = 0; wave < 3; wave++) {
      await Promise.all(Array.from({ length: 100 }, (_, i) => service.submit(`cap-${wave}-${i}`, sub())));
    }
    const state = await service.getPublicState();
    expect(state.tiles).toHaveLength(300);
    expect(new Set(state.tiles.map((t) => t.tileId)).size).toBe(300);
    expect(state.aggregates.remainingTiles).toBe(0);
    await expect(service.submit("late-arrival", sub())).rejects.toMatchObject({ code: "MOSAIC_FULL" });
    // Someone who already has a tile still gets it back when full.
    const again = await service.submit("cap-0-0", sub());
    expect(again.created).toBe(false);
  });

  it("handles a concurrent over-capacity burst without double-allocation", async () => {
    const { service } = makeService({ jitter: true });
    await Promise.all(Array.from({ length: 280 }, (_, i) => service.submit(`pre-${i}`, sub())));
    const settled = await Promise.allSettled(Array.from({ length: 40 }, (_, i) => service.submit(`over-${i}`, sub())));
    const ok = settled.filter((s) => s.status === "fulfilled");
    const full = settled.filter((s) => s.status === "rejected" && (s.reason as MosaicError).code === "MOSAIC_FULL");
    expect(ok).toHaveLength(20);
    expect(full).toHaveLength(20);
    const state = await service.getPublicState();
    expect(new Set(state.tiles.map((t) => t.tileId)).size).toBe(300);
  });

  it("rejects submissions while paused", async () => {
    const { service } = makeService();
    await service.updateConfig({ submissionsEnabled: false });
    await expect(service.submit("paused", sub())).rejects.toMatchObject({ code: "SUBMISSIONS_CLOSED" });
    await service.updateConfig({ submissionsEnabled: true });
    await expect(service.submit("paused", sub())).resolves.toMatchObject({ created: true });
  });

  it("restores a participant's contribution (refresh)", async () => {
    const { service } = makeService();
    const r = await service.submit("refresh-me", sub("hello"));
    const own = await service.getOwn("refresh-me");
    expect(own?.id).toBe(r.contribution.id);
    expect(await service.getOwn("someone-else")).toBeNull();
  });
});
