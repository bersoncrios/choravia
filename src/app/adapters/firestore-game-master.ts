import { isCustomAccessoryId, isCustomAccessory, type CustomAccessory } from "../domain/live-ops.js";
import { collection, doc, endAt, getDocFromServer, getDocsFromServer, limit, orderBy,
  query, where, runTransaction, serverTimestamp, startAt, Timestamp, type Firestore } from "firebase/firestore";
import { sha256 } from "../domain/online-engine/crypto.js";
import { initialGame, type SpeciesId } from "../domain/game.js";
import { isGame } from "../domain/save-validation.js";
import type {
  GameMasterAuditEntry,
  GameMasterPlayer,
  GameMasterRequest,
  GameMasterResponse,
  GameMasterSearchResult,
} from "../domain/game-master.js";
import { isStoreItemId, storeItem } from "../domain/store.js";
import type { StoreItemId } from "../domain/store.js";
import { GameError } from "../domain/online-engine/model.js";

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

export class FirestoreGameMaster {
  constructor(private readonly db: Firestore, private readonly currentUid: () => string) {}
  private async admin(uid: string): Promise<boolean> {
    if (!validUid(uid)) return fail("unauthenticated", "Identidade inválida.");
    const snap = await getDocFromServer(doc(this.db, userPath(uid)));
    return snap.get("role") === "admin";
  }
  async execute(raw: unknown): Promise<GameMasterResponse> {
    const actorUid = this.currentUid();
    const request = parseRequest(raw);
    if (request.method === "status") return { isAdmin: await this.admin(actorUid) };
    if (!(await this.admin(actorUid))) return fail("permission-denied", "Acesso restrito ao Game Master.");
    if (request.method === "lookup") return { player: await this.lookup(request.targetUid) };
    if (request.method === "search") return { players: await this.search(request.query) };
    if (request.method === "listAudit") return { entries: await this.audit() };
    return this.mutate(actorUid, request);
  }
  private async lookup(uid: string): Promise<GameMasterPlayer> {
    const profile = await getDocFromServer(doc(this.db, userPath(uid)));
    const [saveSnap, creatures] = await Promise.all([
      getDocFromServer(doc(this.db, savePath(uid))),
      getDocsFromServer(query(collection(this.db, "creatures"),
        where("ownerId", "==", uid), limit(100))),
    ]);
    if (!profile.exists() && !saveSnap.exists() && creatures.empty)
      return fail("not-found", "Conta sem dados no Firestore.");
    let game: ReturnType<typeof initialGame> | null = null;
    let revision: number | null = null;
    if (saveSnap.exists()) {
      const save = decodedSave(saveSnap.data());
      game = save.game;
      revision = Number(save.data["revision"]);
    }
    return {
      uid,
      displayName: profile.get("displayName") || null,
      hasSave: !!game,
      saveRevision: revision,
      seeds: game ? (game.seeds ?? 120) : null,
      region: game ? (game.region ?? "clearing") : null,
      starterChosen: game ? (game.starterChosen ?? false) : null,
      collection: creatures.docs.map((doc) => doc.get("speciesId") as SpeciesId),
      ownedItems: game?.ownedItems ?? [],
    };
  }
  private async search(searchText: string): Promise<GameMasterSearchResult[]> {
    const prefix = normalizeName(searchText);
    const result = await getDocsFromServer(query(collection(this.db, "users"),
      orderBy("displayNameSearch"), startAt(prefix), endAt(`${prefix}\uf8ff`), limit(10)));
    return result.docs.map((entry) => ({ uid: entry.id, displayName: String(entry.get("displayName") ?? "") }));
  }
  private async audit(): Promise<GameMasterAuditEntry[]> {
    const result = await getDocsFromServer(query(collection(this.db, "game_master_audit"), orderBy("createdAt", "desc"), limit(30)));
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
    const requestHash = await sha256(JSON.stringify(payload));
    const auditId = `gm-${requestHash}`;
    const auditRef = doc(this.db, "game_master_audit", auditId);
    let replay = false;
    await runTransaction(this.db, async (tx) => {
      if (this.currentUid() !== actorUid) return fail("unauthenticated", "A conta mudou.");
      const [actor, existingAudit] = await Promise.all([tx.get(doc(this.db, userPath(actorUid))), tx.get(auditRef)]);
      if (actor.get("role") !== "admin") return fail("permission-denied", "Acesso restrito ao Game Master.");
      if (existingAudit.exists()) {
        if (existingAudit.get("requestHash") !== requestHash)
          return fail("already-exists", "Este ID de operação já foi usado com outros dados.");
        replay = true;
        return;
      }
      const saveRef = doc(this.db, savePath(targetUid));
      const saveSnap = await tx.get(saveRef);
      const { data, game } = decodedSave(saveSnap.data());
      let next = structuredClone(game);
      const custom = request.method === "grantCosmetic" && isCustomAccessoryId(request.itemId) ? await tx.get(doc(this.db, "shop_accessories", request.itemId)) : null;
      if (custom && (!custom.exists() || !isCustomAccessory(custom.data()))) return fail("invalid-argument", "Acessório não encontrado no catálogo.");
      if (request.method === "grantSeeds") next.seeds = (next.seeds ?? 120) + request.amount;
      else if (request.method === "grantCosmetic") {
        const customItem = custom?.data() as CustomAccessory | undefined;
        if (customItem) next.shopCatalog = [...(next.shopCatalog ?? []).filter(v => v.id !== customItem.id), customItem];
        const item = storeItem(request.itemId, next.shopCatalog);
        const owned = next.ownedItems ?? [];
        if (owned.includes(item.id)) return fail("already-exists", "O jogador já possui este item.");
        next.ownedItems = [...owned, item.id];
        if (item.id === "forest-cloak" && next.avatar) next.avatar.outfit = "cloak";
        else if (item.id === "sun-scarf" && next.avatar) next.avatar.accessory = "sun-scarf";
        else if (item.id === "moon-pin" && next.avatar) next.avatar.accessory = "moon-pin";
        else if (isCustomAccessoryId(item.id) && next.avatar && customItem) next.avatar = { ...next.avatar, accessory: "none", customAccessory: { id: customItem.id, shape: customItem.shape, color: customItem.color } };
        else if (item.id === "eco-moss-glyph") {
          const active = next.collection.find((creature) => creature.id === next.activeId);
          if (active) active.cosmeticId = "eco-moss-glyph";
        }
      } else next = initialGame();
      if (!isGame(next)) return fail("failed-precondition", "A alteração produziu um save inválido.");
      tx.update(saveRef, {
        snapshot: JSON.stringify(next),
        revision: Number(data["revision"]) + 1,
        writeId: auditId,
        updatedAt: serverTimestamp(),
      });
      tx.set(auditRef, {
        ...payload,
        requestHash,
        createdAt: serverTimestamp(),
        ...(request.method === "grantSeeds" ? { amount: request.amount } : {}),
        ...(request.method === "grantCosmetic" ? { itemId: request.itemId } : {}),
        targetSaveRevision: Number(data["revision"]) + 1,
      });
    });
    return { player: await this.lookup(targetUid), replay };
  }
}
