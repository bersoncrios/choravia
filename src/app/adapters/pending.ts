import type {
  PendingRequest,
  PendingStore,
} from "../application/online-session.js";
export class BrowserPendingStore implements PendingStore {
  load(uid: string): unknown {
    try {
      return JSON.parse(
        sessionStorage.getItem(`wildwoods-pending:${uid}`) ?? "null",
      );
    } catch {
      return null;
    }
  }
  save(uid: string, pending: PendingRequest | null): void {
    const key = `wildwoods-pending:${uid}`;
    if (!pending || pending.method === "acceptTrade")
      sessionStorage.removeItem(key);
    else sessionStorage.setItem(key, JSON.stringify(pending));
  }
}
