import { createHash, randomUUID } from "node:crypto";
import { getAuth, type Auth } from "firebase-admin/auth";
import {
  FieldValue,
  Timestamp,
  type Firestore,
} from "firebase-admin/firestore";
import { initialGame, type SpeciesId } from "../../src/app/domain/game.js";
import { isGame } from "../../src/app/domain/save-validation.js";
import type {
  GameMasterAuditEntry,
  GameMasterPlayer,
  GameMasterRequest,
  GameMasterResponse,
  GameMasterSearchResult,
} from "../../src/app/domain/game-master.js";
import { isStoreItemId, storeItem } from "../../src/app/domain/store.js";
import type { StoreItemId } from "../../src/app/domain/store.js";
import { GameError } from "./model.js";

const userPath = (uid: string) => `users/${uid}`;
const savePath = (uid: string) => `users/${uid}/saves/solo`;
const fail = (
  code: ConstructorParameters<typeof GameError>[0],
  message: string,
): never => {
  throw new GameError(code, message);
};
const validUid = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0 && value.length <= 128 && !value.includes("/");
const validReason = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length >= 5 && value.trim().length <= 240;
const validRequestId = (value: unknown): value is string =>
  typeof value === "string" && /^[A-Za-z0-9_-]{8,100}$/.test(value);
const normalizeName = (value: string): string =>
  value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
function parseRequest(value: unknown): GameMasterRequest {
  if (!value || typeof value !== "object" || Array.isArray(value))
    return fail("invalid-argument", "Pedido inválido.");
  const data = value as Record<string, unknown>;
  const method = data["method"];
  const exact = (keys: string[]) => {
    if (Object.keys(data).sort().join("|") !== keys.sort().join("|"))
      fail("invalid-argument", "Campos inválidos no pedido administrativo.");
  };
  if (method === "status" || method === "listAudit") {
    exact(["method"]);
    return { method };
  }
  if (method === "lookup") {
    exact(["method", "targetUid"]);
    if (!validUid(data["targetUid"])) return fail("invalid-argument", "UID inválido.");
    return { method, targetUid: data["targetUid"] };
  }
  if (method === "search") {
    exact(["method", "query"]);
    if (typeof data["query"] !== "string" || normalizeName(data["query"]).length < 2 || data["query"].trim().length > 80)
      return fail("invalid-argument", "Digite ao menos 2 caracteres do nome.");
    return { method, query: data["query"].trim() };
  }
  if (method === "grantSeeds") {
    exact(["method", "requestId", "targetUid", "amount", "reason"]);
    if (!validUid(data["targetUid"]) || !validRequestId(data["requestId"]) ||
      !Number.isSafeInteger(data["amount"]) || Number(data["amount"]) < 1 || Number(data["amount"]) > 5000 || !validReason(data["reason"]))
      return fail("invalid-argument", "Informe UID, quantidade entre 1 e 5.000 e um motivo de 5 a 240 caracteres.");
    return { method, requestId: data["requestId"], targetUid: data["targetUid"], amount: Number(data["amount"]), reason: data["reason"].trim() };
  }
  if (method === "grantCosmetic") {
    exact(["method", "requestId", "targetUid", "itemId", "reason"]);
    if (!validUid(data["targetUid"]) || !validRequestId(data["requestId"]) || !isStoreItemId(data["itemId"]) || !validReason(data["reason"]))
      return fail("invalid-argument", "UID, item ou motivo inválido.");
    return { method, requestId: data["requestId"], targetUid: data["targetUid"], itemId: data["itemId"], reason: data["reason"].trim() };
  }
  if (method === "resetProgress") {
    exact(["method", "requestId", "targetUid", "reason"]);
    if (!validUid(data["targetUid"]) || !validRequestId(data["requestId"]) || !validReason(data["reason"]))
      return fail("invalid-argument", "UID ou motivo inválido.");
    return { method, requestId: data["requestId"], targetUid: data["targetUid"], reason: data["reason"].trim() };
  }
  return fail("invalid-argument", "Operação administrativa desconhecida.");
}
function hash(value: object): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}
function decodedSave(raw: unknown): { data: Record<string, unknown>; game: ReturnType<typeof initialGame> } {
  if (!raw || typeof raw !== "object") return fail("failed-precondition", "Este jogador ainda não possui save na nuvem.");
  const data = raw as Record<string, unknown>;
  let snapshot: unknown;
  try { snapshot = JSON.parse(String(data["snapshot"] ?? "")); }
  catch { return fail("failed-precondition", "O save do jogador está corrompido."); }
  if (!isGame(snapshot) || !Number.isSafeInteger(data["revision"]) || Number(data["revision"]) < 1)
    return fail("failed-precondition", "O save do jogador não passou na validação.");
  return { data, game: snapshot };
}

export class GameMasterService {
  constructor(private readonly db: Firestore, private readonly auth: Auth = getAuth()) {}
  private async admin(uid: string): Promise<boolean> {
    if (!validUid(uid)) return fail("unauthenticated", "Identidade inválida.");
    const snap = await this.db.doc(userPath(uid)).get();
    return snap.get("role") === "admin";
  }
  async execute(actorUid: string, raw: unknown): Promise<GameMasterResponse> {
    const request = parseRequest(raw);
    if (request.method === "status") return { isAdmin: await this.admin(actorUid) };
    if (!(await this.admin(actorUid))) return fail("permission-denied", "Acesso restrito ao Game Master.");
    if (request.method === "lookup") return { player: await this.lookup(request.targetUid) };
    if (request.method === "search") return { players: await this.search(request.query) };
    if (request.method === "listAudit") return { entries: await this.audit() };
    return this.mutate(actorUid, request);
  }
  private async lookup(uid: string): Promise<GameMasterPlayer> {
    const authUser = await this.auth.getUser(uid).catch(() => null);
    if (!authUser) return fail("not-found", "Conta não encontrada.");
    const [saveSnap, creatures] = await Promise.all([
      this.db.doc(savePath(uid)).get(),
      this.db.collection("creatures").where("ownerId", "==", uid).limit(100).get(),
    ]);
    let game: ReturnType<typeof initialGame> | null = null;
    let revision: number | null = null;
    if (saveSnap.exists) {
      const save = decodedSave(saveSnap.data());
      game = save.game;
      revision = Number(save.data["revision"]);
    }
    return {
      uid,
      displayName: authUser.displayName || null,
      hasSave: !!game,
      saveRevision: revision,
      seeds: game ? (game.seeds ?? 120) : null,
      region: game ? (game.region ?? "clearing") : null,
      starterChosen: game ? (game.starterChosen ?? false) : null,
      collection: creatures.docs.map((doc) => doc.get("speciesId") as SpeciesId),
      ownedItems: game?.ownedItems ?? [],
    };
  }
  private async search(query: string): Promise<GameMasterSearchResult[]> {
    const prefix = normalizeName(query);
    const users = this.db.collection("users");
    const [indexed, legacy] = await Promise.all([
      users.orderBy("displayNameSearch").startAt(prefix).endAt(`${prefix}\uf8ff`).limit(30).get(),
      users.orderBy("displayName").startAt(query.trim()).endAt(`${query.trim()}\uf8ff`).limit(30).get(),
    ]);
    const candidates = new Map([...indexed.docs, ...legacy.docs].map((doc) => [doc.id, doc]));
    const verified = await Promise.all([...candidates.values()].map(async (doc) => {
      const user = await this.auth.getUser(doc.id).catch(() => null);
      const displayName = user?.displayName?.trim() ?? "";
      return displayName && normalizeName(displayName).startsWith(prefix)
        ? { uid: doc.id, displayName }
        : null;
    }));
    return verified.filter((entry): entry is GameMasterSearchResult => entry !== null).slice(0, 10);
  }
  private async audit(): Promise<GameMasterAuditEntry[]> {
    const result = await this.db.collection("game_master_audit").orderBy("createdAt", "desc").limit(30).get();
    return result.docs.map((doc) => {
      const d = doc.data();
      return {
        id: doc.id,
        actorUid: String(d["actorUid"]),
        targetUid: String(d["targetUid"]),
        action: d["action"] as GameMasterAuditEntry["action"],
        reason: String(d["reason"]),
        ...(Number.isSafeInteger(d["amount"]) ? { amount: Number(d["amount"]) } : {}),
        ...(isStoreItemId(d["itemId"]) ? { itemId: d["itemId"] as StoreItemId } : {}),
        createdAt: d["createdAt"] instanceof Timestamp ? d["createdAt"].toMillis() : 0,
      };
    });
  }
  private async mutate(
    actorUid: string,
    request: Exclude<GameMasterRequest, { method: "status" | "lookup" | "search" | "listAudit" }>,
  ): Promise<GameMasterResponse> {
    const targetUid = request.targetUid;
    const action = request.method;
    const payload = { actorUid, targetUid, action, reason: request.reason,
      ...(request.method === "grantSeeds" ? { amount: request.amount } : {}),
      ...(request.method === "grantCosmetic" ? { itemId: request.itemId } : {}),
    };
    const requestHash = hash(payload);
    const auditId = `${actorUid}_${request.requestId}`;
    const auditRef = this.db.collection("game_master_audit").doc(auditId);
    let replay = false;
    await this.db.runTransaction(async (tx) => {
      const [actor, existingAudit] = await Promise.all([tx.get(this.db.doc(userPath(actorUid))), tx.get(auditRef)]);
      if (actor.get("role") !== "admin") return fail("permission-denied", "Acesso restrito ao Game Master.");
      if (existingAudit.exists) {
        if (existingAudit.get("requestHash") !== requestHash)
          return fail("already-exists", "Este ID de operação já foi usado com outros dados.");
        replay = true;
        return;
      }
      const saveRef = this.db.doc(savePath(targetUid));
      const saveSnap = await tx.get(saveRef);
      const { data, game } = decodedSave(saveSnap.data());
      let next = structuredClone(game);
      if (request.method === "grantSeeds") next.seeds = (next.seeds ?? 120) + request.amount;
      else if (request.method === "grantCosmetic") {
        const item = storeItem(request.itemId);
        const owned = next.ownedItems ?? [];
        if (owned.includes(item.id)) return fail("already-exists", "O jogador já possui este item.");
        next.ownedItems = [...owned, item.id];
        if (item.id === "forest-cloak" && next.avatar) next.avatar.outfit = "cloak";
        else if (item.id === "sun-scarf" && next.avatar) next.avatar.accessory = "sun-scarf";
        else if (item.id === "moon-pin" && next.avatar) next.avatar.accessory = "moon-pin";
        else if (item.id === "eco-moss-glyph") {
          const active = next.collection.find((creature) => creature.id === next.activeId);
          if (active) active.cosmeticId = "eco-moss-glyph";
        }
      } else next = initialGame();
      if (!isGame(next)) return fail("failed-precondition", "A alteração produziu um save inválido.");
      tx.update(saveRef, {
        snapshot: JSON.stringify(next),
        revision: Number(data["revision"]) + 1,
        writeId: `gm-${randomUUID()}`,
        updatedAt: FieldValue.serverTimestamp(),
      });
      tx.create(auditRef, {
        ...payload,
        requestHash,
        createdAt: Timestamp.now(),
        ...(request.method === "grantSeeds" ? { amount: request.amount } : {}),
        ...(request.method === "grantCosmetic" ? { itemId: request.itemId } : {}),
        targetSaveRevision: Number(data["revision"]) + 1,
      });
    });
    return { player: await this.lookup(targetUid), replay };
  }
}
