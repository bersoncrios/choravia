import type { Battle, Command, SpeciesId } from "./game.js";
import type { DailyBoard } from "./daily-challenges.js";
export type BattleCommand = Extract<
  Command,
  { type: "move" | "basic" | "skill" | "defend" | "capture" | "flee" }
>;
export interface CreatureLock {
  kind: "trade" | "encounter";
  id: string;
}
export interface ValidatedCreature {
  id: string;
  speciesId: SpeciesId;
  level: number;
  experience: number;
  lock: CreatureLock | null;
  revision: number;
}
export interface PublicEncounter {
  id: string;
  seq: number;
  activeCreatureId: string;
  battle: Battle;
  status: "open" | "resolved" | "expired";
  message: string;
}
export interface OwnOffer {
  id: string;
  offeredCreatureId: string;
  offeredSpeciesId: SpeciesId;
  offeredLevel: number;
  requestedSpeciesId: SpeciesId;
  expiresAt: number;
  revision: number;
}
export interface TradePreview {
  id: string;
  offeredSpeciesId: SpeciesId;
  offeredLevel: number;
  requestedSpeciesId: SpeciesId;
  expiresAt: number;
  status: "open" | "completed" | "cancelled" | "expired";
}
export interface OnlineState {
  creatures: ValidatedCreature[];
  nextCursor: string | null;
  inventoryRevision: number;
  encounter: PublicEncounter | null;
  offer: OwnOffer | null;
}
export interface Requests {
  syncExpedition: { creatures: import("./game.js").Creature[] };
  recordExpeditionDaily: { cycleId: string; types: import("./daily-challenges.js").DailyContractType[] };
  getDailyBoard: Record<string, never>;
  ackDailyRewards: { receiptIds: string[] };
  bootstrap: Record<string, never>;
  getState: Record<string, never>;
  listInventory: { cursor: string; revision: number };
  beginEncounter: { requestId: string; creatureId: string };
  submitAction: {
    requestId: string;
    encounterId: string;
    seq: number;
    command: BattleCommand;
  };
  cancelEncounter: { requestId: string; encounterId: string };
  createTrade: {
    requestId: string;
    creatureId: string;
    requestedSpeciesId: SpeciesId;
  };
  rotateTradeToken: { tradeId: string; revision: number };
  previewTrade: { tradeId: string; token: string };
  acceptTrade: {
    requestId: string;
    tradeId: string;
    token: string;
    creatureId: string;
  };
  cancelTrade: { requestId: string; tradeId: string };
}
export interface Responses {
  syncExpedition: { mapping: { sourceId: string; id: string | null }[] };
  recordExpeditionDaily: { recorded: true };
  getDailyBoard: DailyBoard;
  ackDailyRewards: { acknowledged: true };
  bootstrap: { ready: true };
  getState: OnlineState;
  listInventory: {
    creatures: ValidatedCreature[];
    nextCursor: string | null;
    inventoryRevision: number;
  };
  beginEncounter: PublicEncounter;
  submitAction: PublicEncounter;
  cancelEncounter: { cancelled: true };
  createTrade: { tradeId: string; expiresAt: number; token?: string };
  rotateTradeToken: { tradeId: string; token: string; revision: number };
  previewTrade: TradePreview;
  acceptTrade: { tradeId: string; receivedCreatureId: string };
  cancelTrade: { cancelled: true };
}
export type RemoteMethod = keyof Requests;
export interface OnlineGateway {
  readonly uid: string;
  call<K extends RemoteMethod>(
    method: K,
    input: Requests[K],
  ): Promise<Responses[K]>;
}
