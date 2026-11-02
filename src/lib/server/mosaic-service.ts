import { randomBytes } from "node:crypto";
import { pickCandidate, TOTAL_TILES, isValidTileId, ALL_TILE_IDS } from "@/lib/grid";
import { defaultMotif, MOTIFS, type ColorId, type Motif } from "@/lib/palette";
import { initialStatus } from "@/lib/moderation";
import type { Submission } from "@/lib/validation";
import {
  DEFAULT_CONFIG,
  type AdminContribution,
  type Aggregates,
  type Contribution,
  type EventConfig,
  type ModerationStatus,
  type OwnContribution,
  type PublicContribution,
  type PublicMosaicState,
  type PublicTile,
  type TileDoc,
} from "@/lib/types";
import type { Data, DocDb, Tx } from "./db";

export type MosaicErrorCode =
  | "SUBMISSIONS_CLOSED"
  | "MOSAIC_FULL"
  | "BUSY"
  | "NOT_FOUND"
  | "INVALID";

export class MosaicError extends Error {
  constructor(
    public code: MosaicErrorCode,
    message: string,
  ) {
    super(message);
  }
}

class TileTakenError extends Error {}

const P = {
  config: "eventConfig/main",
  aggregates: "aggregates/main",
  contribution: (id: string) => `contributions/${id}`,
  tile: (id: string) => `tiles/${id}`,
  participant: (uid: string) => `participants/${uid}`,
};

/** Statuses that count towards each aggregate. */
const countsOf = (s: ModerationStatus | null) => ({
  totalContributions: s && s !== "removed" ? 1 : 0,
  approvedContributions: s === "approved" ? 1 : 0,
  pendingContributions: s === "pending" ? 1 : 0,
});

function newId() {
  // 16 chars of URL-safe randomness — unguessable share links.
  return randomBytes(12).toString("base64url");
}

function toContribution(id: string, d: Data): Contribution {
  return { id, ...(d as Omit<Contribution, "id">) };
}

function ownView(c: Contribution): OwnContribution {
  return {
    id: c.id,
    tileId: c.tileId,
    color: c.color,
    symbol: c.symbol,
    message: c.message,
    moderationStatus: c.moderationStatus,
    caption: c.moderationStatus === "approved" ? (c.aiCaption ?? null) : null,
    motif: c.motif ?? defaultMotif(c.symbol),
    createdAt: new Date(c.createdAt).toISOString(),
  };
}

/** Public projection of a contribution onto its tile. Never includes participantUid. */
function tileFor(c: Contribution, config: EventConfig, seq: number): TileDoc {
  const showText = c.moderationStatus === "approved" && config.publicMessagesEnabled;
  return {
    occupied: true,
    contributionId: c.id,
    displayColor: c.color,
    displaySymbol: c.symbol,
    displayMessage: showText && c.message ? c.message : null,
    displayCaption: showText ? (c.aiCaption ?? null) : null,
    displayMotif: c.motif ?? defaultMotif(c.symbol),
    seq,
    updatedAt: new Date(),
  };
}

const EMPTY_TILE = (): TileDoc => ({
  occupied: false,
  contributionId: null,
  displayColor: null,
  displaySymbol: null,
  displayMessage: null,
  displayCaption: null,
  displayMotif: null,
  updatedAt: new Date(),
});

export interface SubmitResult {
  created: boolean;
  contribution: OwnContribution;
}

export class MosaicService {
  private occupiedCache: { ids: Set<string>; at: number } | null = null;
  private publicCache: { state: PublicMosaicState; at: number } | null = null;
  private init: Promise<void> | null = null;
  private seqCounter = 0;

  constructor(
    readonly db: DocDb,
    private opts: { publicCacheMs?: number; occupiedCacheMs?: number } = {},
  ) {}

  /** Create config/aggregates docs on first use (idempotent). */
  ensureInitialized() {
    this.init ??= (async () => {
      await this.db.runTransaction(async (tx) => {
        const [cfg, agg] = [await tx.get(P.config), await tx.get(P.aggregates)];
        if (!cfg) tx.set(P.config, { ...DEFAULT_CONFIG, updatedAt: new Date() });
        if (!agg) {
          const a: Aggregates = {
            totalContributions: 0,
            approvedContributions: 0,
            pendingContributions: 0,
            remainingTiles: TOTAL_TILES,
            lastUpdated: new Date(),
          };
          tx.set(P.aggregates, a as unknown as Data);
        }
      });
    })().catch((e) => {
      this.init = null;
      throw e;
    });
    return this.init;
  }

  async getConfig(): Promise<EventConfig> {
    await this.ensureInitialized();
    const d = await this.db.get(P.config);
    return { ...DEFAULT_CONFIG, ...(d as Partial<EventConfig>) };
  }

  async updateConfig(patch: Partial<EventConfig>): Promise<EventConfig> {
    const before = await this.getConfig();
    await this.db.set(P.config, { ...patch, updatedAt: new Date() }, { merge: true });
    if (patch.publicMessagesEnabled !== undefined && patch.publicMessagesEnabled !== before.publicMessagesEnabled) {
      await this.syncTiles();
    }
    this.publicCache = null;
    return this.getConfig();
  }

  async getAggregates(): Promise<Aggregates> {
    await this.ensureInitialized();
    return (await this.db.get(P.aggregates)) as unknown as Aggregates;
  }

  private async occupiedTiles(force = false): Promise<Set<string>> {
    const ttl = this.opts.occupiedCacheMs ?? 1500;
    if (!force && this.occupiedCache && Date.now() - this.occupiedCache.at < ttl) return this.occupiedCache.ids;
    const rows = await this.db.query("tiles", { where: [["occupied", "==", true]] });
    this.occupiedCache = { ids: new Set(rows.map((r) => r.id)), at: Date.now() };
    return this.occupiedCache.ids;
  }

  private nextSeq() {
    // Millisecond timestamp + per-instance counter: monotonic enough for ordering animations.
    this.seqCounter = Math.max(this.seqCounter + 1, Date.now());
    return this.seqCounter;
  }

  /**
   * Atomic, idempotent tile assignment.
   *
   * - The participant UID comes from a verified session, never from the client body.
   * - `participants/{uid}` is read inside the transaction, so a participant can
   *   only ever own one contribution, even with parallel requests.
   * - The candidate tile is re-read inside the transaction; if another request
   *   claimed it first the transaction either conflicts (and is retried by the
   *   database) or sees it occupied and we move on to a different candidate.
   */
  async submit(uid: string, input: Submission): Promise<SubmitResult> {
    if (!uid) throw new MosaicError("INVALID", "Missing participant");
    await this.ensureInitialized();

    // Fast path: already contributed.
    const existing = await this.getOwn(uid);
    if (existing) return { created: false, contribution: existing };

    const tried = new Set<string>();
    for (let attempt = 0; attempt < 40; attempt++) {
      const occupied = await this.occupiedTiles(attempt > 0 && attempt % 4 === 0);
      let candidate = pickCandidate(occupied, tried);
      if (!candidate) {
        // Cache may be stale — confirm against the database before declaring full.
        const fresh = await this.occupiedTiles(true);
        candidate = pickCandidate(fresh, tried);
        if (!candidate) {
          if (fresh.size >= TOTAL_TILES) throw new MosaicError("MOSAIC_FULL", "Every tile in the mosaic has been claimed");
          tried.clear();
          continue;
        }
      }
      const tileId = candidate;
      try {
        const outcome = await this.db.runTransaction(async (tx: Tx) => {
          const participant = await tx.get(P.participant(uid));
          if (participant) return { kind: "existing" as const, id: participant.contributionId as string };
          const config = { ...DEFAULT_CONFIG, ...((await tx.get(P.config)) as Partial<EventConfig>) };
          if (!config.submissionsEnabled) throw new MosaicError("SUBMISSIONS_CLOSED", "Submissions are paused right now");
          const tile = await tx.get(P.tile(tileId));
          if (tile?.occupied) throw new TileTakenError();

          const id = newId();
          const { status, flagged } = initialStatus(input.message, config.moderationEnabled);
          const now = new Date();
          const contribution: Contribution = {
            id,
            participantUid: uid,
            tileId,
            color: input.color as ColorId,
            symbol: input.symbol,
            message: input.message,
            moderationStatus: status,
            createdAt: now,
            updatedAt: now,
            aiCaption: null,
            motif: defaultMotif(input.symbol),
            flagged,
          };
          const { id: _omit, ...docData } = contribution;
          void _omit;
          tx.set(P.contribution(id), docData as Data);
          tx.set(P.tile(tileId), tileFor(contribution, config, this.nextSeq()) as unknown as Data);
          tx.set(P.participant(uid), { contributionId: id, createdAt: now });
          return { kind: "created" as const, contribution };
        });

        if (outcome.kind === "existing") {
          const own = await this.getContribution(outcome.id);
          if (!own) throw new MosaicError("NOT_FOUND", "Contribution not found");
          return { created: false, contribution: ownView(own) };
        }

        this.occupiedCache?.ids.add(tileId);
        this.publicCache = null;
        await this.db.increment(
          P.aggregates,
          { ...countsOf(outcome.contribution.moderationStatus), remainingTiles: -1 },
          { lastUpdated: new Date() },
        );
        return { created: true, contribution: ownView(outcome.contribution) };
      } catch (e) {
        if (e instanceof TileTakenError) {
          tried.add(tileId);
          this.occupiedCache?.ids.add(tileId);
          continue;
        }
        if (e instanceof MosaicError) throw e;
        if ((e as Error).name === "TransactionAbortedError" || /contention|aborted/i.test(String(e))) {
          tried.add(tileId);
          continue;
        }
        throw e;
      }
    }
    throw new MosaicError("BUSY", "The mosaic is very busy — please try again in a moment");
  }

  private async getContribution(id: string): Promise<Contribution | null> {
    if (!/^[A-Za-z0-9_-]{8,40}$/.test(id)) return null;
    const d = await this.db.get(P.contribution(id));
    return d ? toContribution(id, d) : null;
  }

  async getOwn(uid: string): Promise<OwnContribution | null> {
    const p = await this.db.get(P.participant(uid));
    if (!p) return null;
    const c = await this.getContribution(p.contributionId as string);
    return c ? ownView(c) : null;
  }

  /**
   * Share-link view. Owners see their own message regardless of status;
   * everyone else only sees approved text while public messages are enabled.
   */
  async getPublicContribution(id: string, viewerUid?: string | null): Promise<PublicContribution | null> {
    const c = await this.getContribution(id);
    if (!c || c.moderationStatus === "removed") return null;
    const config = await this.getConfig();
    const isOwner = !!viewerUid && viewerUid === c.participantUid;
    const showText = isOwner || (c.moderationStatus === "approved" && config.publicMessagesEnabled);
    return {
      id: c.id,
      tileId: c.tileId,
      color: c.color,
      symbol: c.symbol,
      message: showText && c.message ? c.message : null,
      caption: showText && c.moderationStatus === "approved" ? (c.aiCaption ?? null) : null,
      motif: c.motif ?? defaultMotif(c.symbol),
      createdAt: new Date(c.createdAt).toISOString(),
    };
  }

  async getPublicState(): Promise<PublicMosaicState> {
    const ttl = this.opts.publicCacheMs ?? 1000;
    if (this.publicCache && Date.now() - this.publicCache.at < ttl) return this.publicCache.state;
    const [config, aggregates, rows] = await Promise.all([
      this.getConfig(),
      this.getAggregates(),
      this.db.query("tiles", { where: [["occupied", "==", true]] }),
    ]);
    const tiles: PublicTile[] = rows
      .filter((r) => isValidTileId(r.id))
      .map(({ id, data }) => {
        const t = data as unknown as TileDoc;
        return {
          tileId: id,
          contributionId: t.contributionId!,
          color: t.displayColor!,
          symbol: t.displaySymbol!,
          message: config.publicMessagesEnabled ? (t.displayMessage ?? null) : null,
          caption: config.publicMessagesEnabled ? (t.displayCaption ?? null) : null,
          motif: (t.displayMotif as Motif) ?? defaultMotif(t.displaySymbol ?? ""),
          seq: t.seq ?? 0,
        };
      })
      .sort((a, b) => a.seq - b.seq);
    const { updatedAt: _u, ...publicConfig } = config;
    void _u;
    const state: PublicMosaicState = {
      config: publicConfig,
      aggregates: {
        totalContributions: aggregates.totalContributions,
        approvedContributions: aggregates.approvedContributions,
        pendingContributions: aggregates.pendingContributions,
        remainingTiles: aggregates.remainingTiles,
        lastUpdated: new Date(aggregates.lastUpdated ?? Date.now()).toISOString(),
      },
      tiles,
    };
    this.publicCache = { state, at: Date.now() };
    return state;
  }

  async listForAdmin(opts: { status?: ModerationStatus; limit?: number } = {}): Promise<AdminContribution[]> {
    const rows = await this.db.query("contributions", {
      where: opts.status ? [["moderationStatus", "==", opts.status]] : [],
      orderBy: ["createdAt", "desc"],
      limit: Math.min(opts.limit ?? 500, 1000),
    });
    return rows.map(({ id, data }) => {
      const c = toContribution(id, data);
      return { ...ownView(c), flagged: !!c.flagged, aiCaption: c.aiCaption ?? null };
    });
  }

  /** approve | hide (message hidden, tile stays) | remove (tile freed). */
  async moderate(id: string, action: "approve" | "hide" | "remove"): Promise<AdminContribution> {
    const result = await this.db.runTransaction(async (tx) => {
      const d = await tx.get(P.contribution(id));
      if (!d) throw new MosaicError("NOT_FOUND", "Contribution not found");
      const c = toContribution(id, d);
      const config = { ...DEFAULT_CONFIG, ...((await tx.get(P.config)) as Partial<EventConfig>) };
      const tile = c.tileId ? await tx.get(P.tile(c.tileId)) : null;
      const prev = c.moderationStatus;
      if (prev === "removed") throw new MosaicError("INVALID", "Removed contributions cannot be changed");
      const next: ModerationStatus = action === "approve" ? "approved" : action === "hide" ? "hidden" : "removed";
      const updated: Contribution = { ...c, moderationStatus: next, updatedAt: new Date() };
      tx.merge(P.contribution(id), { moderationStatus: next, updatedAt: updated.updatedAt });
      const ownsTile = tile && tile.contributionId === id;
      if (ownsTile) {
        if (next === "removed") tx.set(P.tile(c.tileId), EMPTY_TILE() as unknown as Data);
        else tx.set(P.tile(c.tileId), tileFor(updated, config, (tile.seq as number) ?? 0) as unknown as Data);
      }
      return { prev, next, updated, freedTile: next === "removed" && !!ownsTile };
    });

    const a = countsOf(result.prev);
    const b = countsOf(result.next);
    const deltas: Record<string, number> = {
      totalContributions: b.totalContributions - a.totalContributions,
      approvedContributions: b.approvedContributions - a.approvedContributions,
      pendingContributions: b.pendingContributions - a.pendingContributions,
    };
    if (result.freedTile) {
      deltas.remainingTiles = 1;
      this.occupiedCache?.ids.delete(result.updated.tileId);
    }
    await this.db.increment(P.aggregates, deltas, { lastUpdated: new Date() });
    this.publicCache = null;
    return { ...ownView(result.updated), flagged: !!result.updated.flagged, aiCaption: result.updated.aiCaption ?? null };
  }

  /** Store an optional AI caption/motif. Visible publicly only once approved. */
  async setEnhancement(id: string, caption: string | null, motif: Motif | null) {
    await this.db.runTransaction(async (tx) => {
      const d = await tx.get(P.contribution(id));
      if (!d) return;
      const c = toContribution(id, d);
      const config = { ...DEFAULT_CONFIG, ...((await tx.get(P.config)) as Partial<EventConfig>) };
      const tile = await tx.get(P.tile(c.tileId));
      const safeMotif = motif && (MOTIFS as readonly string[]).includes(motif) ? motif : (c.motif ?? defaultMotif(c.symbol));
      const updated = { ...c, aiCaption: caption, motif: safeMotif };
      tx.merge(P.contribution(id), { aiCaption: caption, motif: safeMotif });
      if (tile && tile.contributionId === id) {
        tx.set(P.tile(c.tileId), tileFor(updated, config, (tile.seq as number) ?? 0) as unknown as Data);
      }
    });
    this.publicCache = null;
  }

  /** Rebuild every occupied tile's public projection (e.g. after toggling public messages). */
  async syncTiles() {
    const config = await this.getConfig();
    const tiles = await this.db.query("tiles", { where: [["occupied", "==", true]] });
    const ops = [];
    for (const { id, data } of tiles) {
      const c = data.contributionId ? await this.getContribution(data.contributionId as string) : null;
      if (!c) continue;
      ops.push({ path: P.tile(id), data: tileFor(c, config, (data.seq as number) ?? 0) as unknown as Data });
    }
    await this.db.writeBatch(ops);
    this.publicCache = null;
  }

  /** Recompute aggregates from source documents (reconciliation tool). */
  async recountAggregates(): Promise<Aggregates> {
    const [contributions, occupied] = await Promise.all([
      this.db.query("contributions"),
      this.db.query("tiles", { where: [["occupied", "==", true]] }),
    ]);
    const agg: Aggregates = {
      totalContributions: 0,
      approvedContributions: 0,
      pendingContributions: 0,
      remainingTiles: TOTAL_TILES - occupied.length,
      lastUpdated: new Date(),
    };
    for (const { data } of contributions) {
      const c = countsOf(data.moderationStatus as ModerationStatus);
      agg.totalContributions += c.totalContributions;
      agg.approvedContributions += c.approvedContributions;
      agg.pendingContributions += c.pendingContributions;
    }
    await this.db.set(P.aggregates, agg as unknown as Data);
    this.publicCache = null;
    return agg;
  }

  /** Approved contributions for export. No participant identifiers. */
  async exportApproved() {
    const rows = await this.listForAdmin({ status: "approved", limit: 1000 });
    return rows
      .map((r) => ({
        id: r.id,
        tileId: r.tileId,
        color: r.color,
        symbol: r.symbol,
        message: r.message,
        caption: r.aiCaption,
        createdAt: r.createdAt,
      }))
      .sort((a, b) => a.tileId.localeCompare(b.tileId));
  }

  /** Pre-create the 300 tile documents (optional; missing tiles are treated as free). */
  async seedTiles() {
    const existing = new Set(await this.db.listIds("tiles"));
    const ops = ALL_TILE_IDS.filter((id) => !existing.has(id)).map((id) => ({
      path: P.tile(id),
      data: EMPTY_TILE() as unknown as Data,
    }));
    await this.db.writeBatch(ops);
    return ops.length;
  }

  /** Delete every contribution, participant and tile; reset aggregates. Rehearsal only. */
  async resetAll() {
    const ops = [];
    for (const col of ["contributions", "participants", "tiles"]) {
      for (const id of await this.db.listIds(col)) ops.push({ path: `${col}/${id}`, data: null });
    }
    await this.db.writeBatch(ops);
    await this.db.set(P.config, { ...DEFAULT_CONFIG, updatedAt: new Date() });
    this.occupiedCache = null;
    await this.recountAggregates();
  }
}
