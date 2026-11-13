import type { DocumentStore, Transaction } from "./store.js";
import type { CreatureDoc, EncounterDoc, TradeDoc } from "./model.js";
/** Test adapter: serial transactions, staged writes and rollback. Not a substitute for emulator tests. */
export class MemoryStore implements DocumentStore {
  private documents = new Map<string, object>();
  private queue: Promise<void> = Promise.resolve();
  async transaction<T>(work: (tx: Transaction) => Promise<T>): Promise<T> {
    const before = this.queue;
    let unlock: () => void = () => {};
    this.queue = new Promise((resolve) => {
      unlock = resolve;
    });
    await before;
    const staged = new Map<string, object>();
    let writing = false;
    try {
      const result = await work({
        get: async <T extends object>(path: string): Promise<T | null> => {
          if (writing)
            throw new Error("Firestore requires reads before writes");
          const value = this.documents.get(path);
          return value ? (structuredClone(value) as T) : null;
        },
        set: <T extends object>(path: string, value: T) => {
          writing = true;
          staged.set(path, structuredClone(value));
        },
      });
      for (const [path, value] of staged) this.documents.set(path, value);
      return result;
    } finally {
      unlock();
    }
  }
  async owned(uid: string, cursor: string | null, limit: number) {
    return [...this.documents]
      .filter(
        ([path, data]) =>
          path.startsWith("creatures/") &&
          (data as CreatureDoc).ownerId === uid &&
          (!cursor || path.slice(10) > cursor),
      )
      .map(([path, data]) => ({
        id: path.slice(10),
        data: structuredClone(data as CreatureDoc),
      }))
      .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
      .slice(0, limit);
  }
  async expiredOwners(now: number, limit: number): Promise<string[]> {
    const found = new Set<string>();
    for (const [path, data] of this.documents) {
      if (path.startsWith("trade_links/")) {
        const t = data as TradeDoc;
        if (t.status === "open" && t.expiresAt <= now) found.add(t.creatorUid);
      }
      if (path.startsWith("encounters/")) {
        const e = data as EncounterDoc;
        if (e.status === "open" && e.expiresAt <= now) found.add(e.uid);
      }
      if (found.size >= limit) break;
    }
    return [...found];
  }
  dump<T extends object>(path: string): T | null {
    return structuredClone(this.documents.get(path) ?? null) as T | null;
  }
  async seed(path: string, value: object): Promise<void> {
    await this.transaction(async (tx) => {
      tx.set(path, value);
    });
  }
  all(prefix: string): object[] {
    return [...this.documents]
      .filter(([p]) => p.startsWith(prefix))
      .map(([, v]) => structuredClone(v));
  }
}
