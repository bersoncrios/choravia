import { FieldPath, type Firestore } from "firebase-admin/firestore";
import type { DocumentStore, Transaction } from "./store.js";
import type { CreatureDoc } from "./model.js";
export class FirestoreStore implements DocumentStore {
  constructor(private readonly db: Firestore) {}
  transaction<T>(work: (tx: Transaction) => Promise<T>): Promise<T> {
    return this.db.runTransaction(async (native) =>
      work({
        get: async <TDoc extends object>(
          path: string,
        ): Promise<TDoc | null> => {
          const doc = await native.get(this.db.doc(path));
          return doc.exists ? (doc.data() as TDoc) : null;
        },
        set: <TDoc extends object>(path: string, value: TDoc) => {
          native.set(this.db.doc(path), value);
        },
      }),
    );
  }
  async owned(uid: string, cursor: string | null, limit: number) {
    let query = this.db
      .collection("creatures")
      .where("ownerId", "==", uid)
      .orderBy(FieldPath.documentId())
      .limit(limit);
    if (cursor) query = query.startAfter(cursor);
    const result = await query.get();
    return result.docs.map((doc) => ({
      id: doc.id,
      data: doc.data() as CreatureDoc,
    }));
  }
  async expiredOwners(now: number, limit: number): Promise<string[]> {
    const [trades, encounters] = await Promise.all([
      this.db
        .collection("trade_links")
        .where("status", "==", "open")
        .where("expiresAt", "<=", now)
        .orderBy("expiresAt")
        .limit(limit)
        .get(),
      this.db
        .collection("encounters")
        .where("status", "==", "open")
        .where("expiresAt", "<=", now)
        .orderBy("expiresAt")
        .limit(limit)
        .get(),
    ]);
    return [
      ...new Set([
        ...trades.docs.map((d) => String(d.get("creatorUid"))),
        ...encounters.docs.map((d) => String(d.get("uid"))),
      ]),
    ].slice(0, limit);
  }
}
