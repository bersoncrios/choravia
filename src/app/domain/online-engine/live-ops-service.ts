import { parseLiveOpsRequest, type LiveOpsResult, type BadgeDefinition } from "../live-ops.js";
import type { DocumentStore } from "./store.js";
import { sha256 } from "./crypto.js";
import { GameError } from "./model.js";
export class LiveOpsService {
 constructor(private store: Pick<DocumentStore, "transaction">, private now: () => number = Date.now) {}
 async execute(actorUid: string, raw: unknown): Promise<LiveOpsResult> {
  let request;
  try { request = parseLiveOpsRequest(raw); } catch (e) { throw new GameError("invalid-argument", (e as Error).message); }
  if (!actorUid || actorUid.includes("/")) throw new GameError("unauthenticated", "Entre com uma conta administrativa.");
  const requestHash = await sha256(JSON.stringify(request));
  const auditId = `op-${await sha256(`${actorUid}:${request.requestId}`)}`;
  const entityPath = request.method === "grantBadge" ? `users/${request.targetUid}/badges/${request.badgeId}` : `${request.method === "saveAccessory" ? "shop_accessories" : request.method === "saveBalance" ? "eco_balance" : "badge_definitions"}/${request.value.id}`;
  return this.store.transaction(async tx => {
   const actor = await tx.get<{ role?: string }>(`users/${actorUid}`);
   if (actor?.role !== "admin") throw new GameError("permission-denied", "Acesso restrito ao Game Master.");
   const audit = await tx.get<{ requestHash: string }>(`content_audit/${auditId}`);
   if (audit) {
    if (audit.requestHash !== requestHash) throw new GameError("already-exists", "Este ID de operação já foi usado com outros dados.");
    return { replay: true };
   }
   const current = await tx.get<{ revision?: number }>(entityPath);
   const now = this.now();
   if (request.method === "grantBadge") {
    const [badge, player] = await Promise.all([tx.get<BadgeDefinition>(`badge_definitions/${request.badgeId}`), tx.get(`users/${request.targetUid}`)]);
    if (!badge?.active) throw new GameError("failed-precondition", "Escolha uma badge publicada e ativa.");
    if (!player && !await tx.get(`users/${request.targetUid}/online/state`) && !await tx.get(`users/${request.targetUid}/saves/solo`)) throw new GameError("not-found", "Jogador não encontrado.");
    if (current) throw new GameError("already-exists", "O jogador já possui esta badge.");
    tx.set(entityPath, { badgeId: badge.id, name: badge.name, description: badge.description, color: badge.color, symbol: badge.symbol, category: badge.category, reason: request.reason.trim(), grantedBy: actorUid, grantedAt: now, auditId });
   } else {
    const group = request.method === "saveAccessory" ? "shop_accessories" : request.method === "saveBadge" ? "badge_definitions" : null;
    const counter = group && !current ? await tx.get<{ count: number }>(`content_limits/${group}`) : null;
    if (group && !current && (counter?.count ?? 0) >= 100) throw new GameError("failed-precondition", "O catálogo atingiu o limite de 100 registros. Edite um existente.");
    if ((current?.revision ?? 0) !== request.value.revision) throw new GameError("failed-precondition", "Outro GM alterou este conteúdo. Recarregue a versão antes de salvar.");
    if (group && !current) tx.set(`content_limits/${group}`, { count: (counter?.count ?? 0) + 1, auditId });
    tx.set(entityPath, { ...request.value, revision: request.value.revision + 1, updatedBy: actorUid, updatedAt: now, auditId });
   }
   tx.set(`content_audit/${auditId}`, { actorUid, action: request.method, entityPath, entityId: request.method === "grantBadge" ? request.badgeId : request.value.id, targetUid: request.method === "grantBadge" ? request.targetUid : "", reason: request.reason.trim(), requestHash, createdAt: now });
   return { replay: false };
  });
 }
}
