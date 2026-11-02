import type { ColorId, Motif } from "./palette";

export type ModerationStatus = "pending" | "approved" | "hidden" | "removed";
export type RevealMode = "collecting" | "revealed";

/** contributions/{id} — private (contains participantUid). Server-only. */
export interface Contribution {
  id: string;
  participantUid: string;
  tileId: string;
  color: ColorId;
  symbol: string;
  message: string;
  moderationStatus: ModerationStatus;
  createdAt: Date;
  updatedAt?: Date;
  /** Optional AI-generated caption (never required). */
  aiCaption?: string | null;
  motif?: Motif;
  /** Set when an automatic filter held the message back. */
  flagged?: boolean;
}

/** tiles/{tileId} — public. Never contains participant identifiers. */
export interface TileDoc {
  occupied: boolean;
  contributionId: string | null;
  displayColor: ColorId | null;
  displaySymbol: string | null;
  /** Only populated for approved messages while public messages are enabled. */
  displayMessage?: string | null;
  displayCaption?: string | null;
  displayMotif?: Motif | null;
  /** Monotonic placement sequence, used for animations/ordering. */
  seq?: number;
  updatedAt: Date;
}

/** eventConfig/main — public. */
export interface EventConfig {
  submissionsEnabled: boolean;
  moderationEnabled: boolean;
  revealMode: RevealMode;
  targetContributions: number;
  publicMessagesEnabled: boolean;
  updatedAt?: Date;
}

/** aggregates/main — public. */
export interface Aggregates {
  totalContributions: number;
  approvedContributions: number;
  pendingContributions: number;
  remainingTiles: number;
  lastUpdated: Date;
}

/** Shape sent to every public client. */
export interface PublicTile {
  tileId: string;
  contributionId: string;
  color: ColorId;
  symbol: string;
  message: string | null;
  caption: string | null;
  motif: Motif;
  seq: number;
}

export interface PublicMosaicState {
  config: Omit<EventConfig, "updatedAt">;
  aggregates: Omit<Aggregates, "lastUpdated"> & { lastUpdated: string };
  tiles: PublicTile[];
  demo?: boolean;
}

/** What an attendee sees about their own contribution. */
export interface OwnContribution {
  id: string;
  tileId: string;
  color: ColorId;
  symbol: string;
  message: string;
  moderationStatus: ModerationStatus;
  caption: string | null;
  motif: Motif;
  createdAt: string;
}

/** Public view of a single contribution (share link). */
export interface PublicContribution {
  id: string;
  tileId: string | null;
  color: ColorId;
  symbol: string;
  message: string | null;
  caption: string | null;
  motif: Motif;
  createdAt: string;
}

/** Admin view — still omits participantUid. */
export interface AdminContribution extends OwnContribution {
  flagged: boolean;
  aiCaption: string | null;
}

export const DEFAULT_CONFIG: EventConfig = {
  submissionsEnabled: true,
  moderationEnabled: true,
  revealMode: "collecting",
  targetContributions: 300,
  publicMessagesEnabled: true,
};
