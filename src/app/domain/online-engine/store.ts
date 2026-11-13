export interface Transaction {
  get<T extends object>(path: string): Promise<T | null>;
  set<T extends object>(path: string, value: T): void;
}
export interface DocumentStore {
  transaction<T>(work: (tx: Transaction) => Promise<T>): Promise<T>;
  owned(
    uid: string,
    cursor: string | null,
    limit: number,
  ): Promise<Array<{ id: string; data: import("./model.js").CreatureDoc }>>;
  expiredOwners(now: number, limit: number): Promise<string[]>;
}
