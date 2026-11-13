import type { StoreItemId } from "./store.js";
import type { SpeciesId } from "./game.js";

export interface GameMasterPlayer {
  uid: string;
  displayName: string | null;
  hasSave: boolean;
  saveRevision: number | null;
  seeds: number | null;
  region: string | null;
  starterChosen: boolean | null;
  collection: SpeciesId[];
  ownedItems: StoreItemId[];
}

export interface GameMasterSearchResult {
  uid: string;
  displayName: string;
}

export interface GameMasterAuditEntry {
  id: string;
  actorUid: string;
  targetUid: string;
  action: "grantSeeds" | "grantCosmetic" | "resetProgress";
  reason: string;
  amount?: number;
  itemId?: StoreItemId;
  createdAt: number;
}

export type GameMasterRequest =
  | { method: "status" }
  | { method: "lookup"; targetUid: string }
  | { method: "search"; query: string }
  | {
      method: "grantSeeds";
      requestId: string;
      targetUid: string;
      amount: number;
      reason: string;
    }
  | {
      method: "grantCosmetic";
      requestId: string;
      targetUid: string;
      itemId: StoreItemId;
      reason: string;
    }
  | {
      method: "resetProgress";
      requestId: string;
      targetUid: string;
      reason: string;
    }
  | { method: "listAudit" };

export type GameMasterResponse =
  | { isAdmin: boolean }
  | { player: GameMasterPlayer }
  | { players: GameMasterSearchResult[] }
  | { player: GameMasterPlayer; replay: boolean }
  | { entries: GameMasterAuditEntry[] };
