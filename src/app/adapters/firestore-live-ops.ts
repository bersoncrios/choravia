import { collection, doc, onSnapshot, getDocsFromServer, query, orderBy, limit, runTransaction, serverTimestamp, Timestamp, type Firestore } from "firebase/firestore";
import { LiveOpsService } from "../domain/online-engine/live-ops-service.js";
import type { Transaction } from "../domain/online-engine/store.js";
import { isCustomAccessory, isBalanceEntry, isBadgeDefinition, type LiveContent, type LiveOpsRequest, type PlayerBadge, type ContentAuditEntry } from "../domain/live-ops.js";
export class FirestoreLiveOps {
 private service: LiveOpsService;
 constructor(private db: Firestore, private uid: () => string) {
  this.service = new LiveOpsService({ transaction: async <T>(work: (tx: Transaction) => Promise<T>) => {
   const uid = this.uid();
   const identity = () => { if (!uid || this.uid() !== uid) throw new Error("A conta mudou."); };
   return runTransaction(this.db, async native => {
    identity();
    return work({
     get: async <D extends object>(path: string) => { const snap = await native.get(doc(this.db, path)); identity(); return snap.exists() ? snap.data() as D : null; },
     set: (path, raw) => {
      identity();
      const data = { ...raw } as Record<string, unknown>;
      for (const key of ["createdAt", "updatedAt", "grantedAt"]) if (key in data) data[key] = serverTimestamp();
      native.set(doc(this.db, path), data);
     },
    });
   });
  } });
 }
 execute(request: LiveOpsRequest) { return this.service.execute(this.uid(), request); }
 async audit(): Promise<ContentAuditEntry[]> {
  const uid = this.uid();
  const result = await getDocsFromServer(query(collection(this.db, "content_audit"), orderBy("createdAt", "desc"), limit(30)));
  if (uid !== this.uid()) throw new Error("A conta mudou.");
  return result.docs.map(d => { const v = d.data(); return { id: d.id, actorUid: String(v["actorUid"]), action: String(v["action"]), entityPath: String(v["entityPath"]), reason: String(v["reason"]), createdAt: v["createdAt"] instanceof Timestamp ? v["createdAt"].toMillis() : 0 }; });
 }
 watch(uid: string, changed: (content: LiveContent) => void, badgesChanged: (badges: PlayerBadge[]) => void, failed: (error: Error) => void): () => void {
  let stopped = false;
  const content: LiveContent = { accessories: [], balance: [], badges: [] };
  const ready = new Set<string>();
  const valid = () => !stopped && this.uid() === uid;
  const watch = (name: string, key: keyof LiveContent, validator: (v: unknown) => boolean) => onSnapshot(collection(this.db, name), snapshot => {
   if (!valid()) return;
   const entries = snapshot.docs.map(d => ({ ...d.data(), id: d.id }));
   if (entries.some(entry => !validator(entry)) || entries.length > 100) { failed(new Error("O catálogo contém dados inválidos ou excede 100 registros.")); return; }
   const keys = key === "accessories" ? ["id", "name", "description", "shape", "color", "price", "active", "revision"] : key === "balance" ? ["id", "hp", "attack", "defense", "revision"] : ["id", "name", "description", "color", "symbol", "category", "active", "revision"];
   Object.assign(content, { [key]: entries.map(entry => Object.fromEntries(keys.map(k => [k, (entry as Record<string, unknown>)[k]]))) }); ready.add(key);
   if (ready.size === 3) changed(structuredClone(content));
  }, error => { if (valid()) failed(error); });
  const stops = [watch("shop_accessories", "accessories", isCustomAccessory), watch("eco_balance", "balance", isBalanceEntry), watch("badge_definitions", "badges", isBadgeDefinition), onSnapshot(collection(this.db, `users/${uid}/badges`), snapshot => {
   if (!valid()) return;
   badgesChanged(snapshot.docs.map(d => { const v = d.data(); return { ...v, grantedAt: v["grantedAt"] instanceof Timestamp ? v["grantedAt"].toMillis() : 0 } as PlayerBadge; }));
  }, error => { if (valid()) failed(error); })];
  return () => { stopped = true; stops.forEach(stop => stop()); };
 }
}
