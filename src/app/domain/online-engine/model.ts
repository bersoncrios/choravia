import type { Game, SpeciesId } from "../game.js";
import type { CreatureLock } from "../online.js";
export interface UserDoc {
  schemaVersion: 1;
  createdAt: number;
  inventoryRevision: number;
  starterGranted: true;
  firstCaptureEncounterId: string | null;
  activeEncounterId: string | null;
  activeTradeId: string | null;
  lastEncounterAt: number;
}
export interface DailyChallengeDoc {
  cycleId: string;
  resetAt: number;
  progress: Record<string, 0 | 1>;
  claimed: string[];
  rewards: import("../daily-challenges.js").DailyReward[];
  completionBonusEarned: boolean;
  qualifiedForWeek: boolean;
}
export interface WeeklyChallengeDoc {
  weekId: string;
  qualifiedDays: string[];
  reward: import("../daily-challenges.js").DailyReward | null;
  claimed: string[];
}
export interface CreatureDoc {
  transferTradeId?: string;
  ownerId: string;
  speciesId: SpeciesId;
  level?: number;
  experience?: number;
  createdAt: number;
  originEncounterId: string;
  revision: number;
  lock: CreatureLock | null;
}
export interface EncounterDoc {
  uid: string;
  creatureId: string;
  rulesVersion: 1;
  status: "open" | "resolved" | "expired";
  expiresAt: number;
  nextSeq: number;
  state: Game;
}
export interface TradeDoc {
  creatorUid: string;
  offeredCreatureId: string;
  offeredSpeciesId: SpeciesId;
  offeredLevel?: number;
  requestedSpeciesId: SpeciesId;
  status: "open" | "completed" | "cancelled" | "expired";
  expiresAt: number;
  tokenHash: string;
  tokenProof?: string;
  revision: number;
  acceptedBy: string | null;
  receivedCreatureId: string | null;
  completedAt: number | null;
}
export interface OperationDoc {
  kind: string;
  payloadHash: string;
  result: object;
  createdAt: number;
}
export type ErrorCode =
  | "invalid-argument"
  | "unauthenticated"
  | "permission-denied"
  | "not-found"
  | "already-exists"
  | "failed-precondition"
  | "aborted"
  | "resource-exhausted";
export class GameError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
  ) {
    super(message);
  }
}
