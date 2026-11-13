import {
  collection, doc, documentId, getDocFromServer, getDocsFromServer, limit, orderBy,
  query, runTransaction, startAfter, where, type Firestore, type QueryConstraint,
} from "firebase/firestore";
import type { DocumentStore, Transaction } from "../domain/online-engine/store.js";
import type { CreatureDoc } from "../domain/online-engine/model.js";

/** Client transactions preserve atomic ownership changes; Rules authorize every write. */
export class BrowserFirestoreStore implements DocumentStore {
  constructor(private readonly db: Firestore, private readonly currentUid: () => string) {}
  async transaction<T>(work: (tx: Transaction) => Promise<T>): Promise<T> {
    const uid = this.currentUid();
    const identity = () => {
      if (!uid || this.currentUid() !== uid) throw new Error("A conta mudou. Reconecte para continuar.");
    };
    for (let attempt = 0; ; attempt++) {
      const reads = new Map<string, string>();
      try {
        return await runTransaction(this.db, async (native) => {
          identity();
          reads.clear();
          // Buffer writes: the Web SDK requires every read before the first write.
          const writes = new Map<string, object>();
          const result = await work({
            get: async <TDoc extends object>(path: string): Promise<TDoc | null> => {
              identity();
              const snapshot = await native.get(doc(this.db, path));
              identity();
              const data = snapshot.exists() ? snapshot.data() : null;
              reads.set(path, JSON.stringify(data));
              return data as TDoc | null;
            },
            set: (path, value) => { writes.set(path, value); },
          });
          identity();
          for (const [path, value] of writes) {
            // Optional game fields must be omitted, never sent as undefined.
            native.set(doc(this.db, path), JSON.parse(JSON.stringify(value)));
          }
          return result;
        });
      } catch (error) {
        identity();
        if (attempt >= 4 || !(error && typeof error === "object" && "code" in error && error.code === "permission-denied")) throw error;
        // Rules may reject a concurrent create-only receipt before the SDK
        // detects its stale read. Retry only with evidence of changed data.
        let changed = false;
        for (const [path, before] of reads) {
          const snapshot = await getDocFromServer(doc(this.db, path)).catch(() => null);
          identity();
          if (snapshot && JSON.stringify(snapshot.exists() ? snapshot.data() : null) !== before) {
            changed = true;
            break;
          }
        }
        if (!changed) throw error;
      }
    }
  }
  async owned(uid: string, cursor: string | null, pageSize: number) {
    if (this.currentUid() !== uid) throw new Error("A conta mudou.");
    const constraints: QueryConstraint[] = [where("ownerId", "==", uid), orderBy(documentId())];
    if (cursor) constraints.push(startAfter(cursor));
    constraints.push(limit(pageSize));
    const result = await getDocsFromServer(query(collection(this.db, "creatures"), ...constraints));
    if (this.currentUid() !== uid) throw new Error("A conta mudou.");
    return result.docs.map((entry) => ({ id: entry.id, data: entry.data() as CreatureDoc }));
  }
  async expiredOwners(): Promise<string[]> {
    // Each player cleans up their own expired locks when opening the account.
    return this.currentUid() ? [this.currentUid()] : [];
  }
}
