import type { FirebaseApp } from "firebase/app";
import { doc, getDocFromServer, runTransaction, serverTimestamp, setDoc, Timestamp, type Firestore } from "firebase/firestore";
import { firestore } from "./cloud-save.js";
import { FIELD_DAY_MS, fieldCycle, initialField, isFieldState, reduceField, type FieldAction, type FieldGateway, type FieldResult, type FieldState } from "../domain/field.js";
const clocks = new WeakMap<Firestore, Map<string, Promise<number>>>();
/** Rules protect inventory transitions and request-time cycles. Location remains client-side. */
export class FirestoreField implements FieldGateway {
 private readonly db: Firestore;
 constructor(app: FirebaseApp, readonly uid: string, private readonly currentUid: () => string, emulators: boolean) { this.db = firestore(app, emulators); }
 private identity(): void { if (!this.uid || this.currentUid() !== this.uid) throw new Error("A conta mudou durante a atualização da mochila."); }
 private state(value: unknown): FieldState { if (!isFieldState(value)) throw new Error("A mochila da conta contém dados inválidos."); return value; }
 private time(): Promise<number> {
  let byUid = clocks.get(this.db);
  if (!byUid) { byUid = new Map(); clocks.set(this.db, byUid); }
  const pending = byUid.get(this.uid); if (pending) return pending.then(now => { this.identity(); return now; });
  const task = this.readTime().finally(() => { if (byUid.get(this.uid) === task) byUid.delete(this.uid); });
  byUid.set(this.uid, task); return task;
 }
 private async readTime(): Promise<number> {
  this.identity(); const ref = doc(this.db, "users", this.uid, "field", "clock");
  await setDoc(ref, { updatedAt: serverTimestamp() }); this.identity();
  const clock = await getDocFromServer(ref); this.identity(); const stamp = clock.get("updatedAt");
  if (!(stamp instanceof Timestamp)) throw new Error("Não foi possível confirmar o ciclo de coleta.");
  return stamp.toMillis();
 }
 async load(): Promise<FieldResult> {
  const now = await this.time(); const ref = doc(this.db,"users",this.uid,"field","state");
  const initialize = () => runTransaction(this.db, async tx => {
   this.identity(); const snap = await tx.get(ref); this.identity();
   if (snap.exists()) return this.state(snap.get("state"));
   const state = initialField(); tx.set(ref, { state, updatedAt: serverTimestamp(), cycleStart: fieldCycle(now)*FIELD_DAY_MS, operationId:"bootstrap", action:{type:"bootstrap"} }); return state;
  });
  let state: FieldState;
  try { state = await initialize(); } catch (error) {
   this.identity();
   if ((error as {code?:string})?.code !== "permission-denied") throw error;
   const existing = await getDocFromServer(ref); this.identity();
   if (!existing.exists()) throw error;
   state = this.state(existing.get("state"));
  }
  this.identity(); return { state, now };
 }
 async execute(action: FieldAction, requestId = crypto.randomUUID()): Promise<FieldResult> {
  if (!/^[A-Za-z0-9_-]{8,100}$/.test(requestId)) throw new Error("Identificador da coleta inválido.");
  const now = await this.time(); const ref = doc(this.db,"users",this.uid,"field","state"), receipt = doc(this.db,"users",this.uid,"field_receipts",requestId);
  let attemptedRevision = -1;
  const transact = () => runTransaction(this.db, async tx => {
   this.identity(); const snap = await tx.get(ref), replay = await tx.get(receipt); this.identity();
   const old = snap.exists() ? this.state(snap.get("state")) : null;
   if (!old) throw new Error("Abra a mochila para preparar a coleta da conta.");
   attemptedRevision = old.revision;
   if (replay.exists()) { if (replay.get("action")?.type !== action.type || (action.type === "gather" && replay.get("action")?.node !== action.node)) throw new Error("Pedido reutilizado para outra ação."); return old; }
   const next = reduceField(old, action, fieldCycle(now)); if (next === old) return old;
   tx.set(ref, {state:next, updatedAt:serverTimestamp(), cycleStart:fieldCycle(now)*FIELD_DAY_MS, operationId:requestId, action});
   tx.set(receipt, {action,stateRevision:next.revision,createdAt:serverTimestamp()}); return next;
  });
  let state: FieldState;
  try { state = await transact(); } catch (error) {
   // Rules may see a concurrent commit before the SDK reports its stale precondition.
   // Only retry after proving the ledger revision advanced; genuine denials stay errors.
   this.identity();
   if ((error as {code?:string})?.code !== "permission-denied") throw error;
   const latest = await getDocFromServer(ref); this.identity();
   if (!latest.exists() || this.state(latest.get("state")).revision <= attemptedRevision) throw error;
   state = await transact();
  }
  this.identity(); return {state,now};
 }
}
