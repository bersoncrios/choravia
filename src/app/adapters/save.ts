import type { Game } from "../domain/game.js";
import { isGame } from "../domain/save-validation.js";
export { isGame } from "../domain/save-validation.js";
import type { SaveRepository } from "../application/ports.js";
export class IndexedDbSave implements SaveRepository {
  private db: Promise<IDBDatabase>;
  constructor(private readonly scope = "guest") {
    this.db = new Promise((resolve, reject) => {
      const r = indexedDB.open("wildwoods-v1", 1);
      r.onupgradeneeded = () => r.result.createObjectStore("snapshots");
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
      r.onblocked = () =>
        reject(new Error("Feche outras abas para abrir o save."));
    });
  }
  private key(name: string): string {
    return this.scope === "guest" ? name : `${this.scope}:${name}`;
  }
  async load(): Promise<Game | null> {
    const db = await this.db;
    return new Promise((resolve, reject) => {
      const tx = db.transaction("snapshots", "readonly"),
        store = tx.objectStore("snapshots");
      const current = store.get(this.key("current")),
        backup = store.get(this.key("backup"));
      tx.oncomplete = () => {
        if (isGame(current.result)) resolve(current.result);
        else if (isGame(backup.result)) resolve(backup.result);
        else if (current.result !== undefined || backup.result !== undefined)
          reject(
            new Error("Save inválido. Exporte o backup antes de reiniciar."),
          );
        else resolve(null);
      };
      tx.onerror = () => reject(tx.error);
    });
  }
  async save(game: Game): Promise<void> {
    if (!isGame(game)) throw new Error("Estado inválido para salvar");
    const db = await this.db;
    return new Promise((resolve, reject) => {
      const tx = db.transaction("snapshots", "readwrite"),
        store = tx.objectStore("snapshots"),
        read = store.get("current");
      let conflict = false;
      read.onsuccess = () => {
        const old: unknown = read.result;
        if (isGame(old) && old.revision >= game.revision) {
          if (
            old.revision === game.revision &&
            JSON.stringify(old) === JSON.stringify(game)
          )
            return;
          conflict = true;
          tx.abort();
          return;
        }
        if (isGame(old)) store.put(old, this.key("backup"));
        store.put(game, this.key("current"));
      };
      tx.oncomplete = () => resolve();
      tx.onabort = () =>
        reject(
          new Error(
            conflict
              ? "Conflito de save: outra aba gravou progresso. Recarregue para continuar."
              : "Não foi possível salvar. Seu progresso continua em memória.",
          ),
        );
      tx.onerror = () => reject(tx.error);
    });
  }
  async exportRaw(): Promise<string> {
    const db = await this.db;
    return new Promise((resolve, reject) => {
      const tx = db.transaction("snapshots", "readonly"),
        s = tx.objectStore("snapshots"),
        a = s.get(this.key("current")),
        b = s.get(this.key("backup"));
      tx.oncomplete = () =>
        resolve(
          JSON.stringify({ current: a.result, backup: b.result }, null, 2),
        );
      tx.onerror = () => reject(tx.error);
    });
  }
  async replace(game: Game): Promise<Game> {
    if (!isGame(game)) throw new Error("Snapshot inválido.");
    const db = await this.db;
    return new Promise((resolve, reject) => {
      const tx = db.transaction("snapshots", "readwrite"),
        s = tx.objectStore("snapshots"),
        r = s.get(this.key("current"));
      let next = game;
      r.onsuccess = () => {
        const old: unknown = r.result;
        next = {
          ...structuredClone(game),
          revision: Math.max(game.revision, isGame(old) ? old.revision : 0) + 1,
        };
        if (isGame(old)) s.put(old, this.key("backup"));
        s.put(next, this.key("current"));
      };
      tx.oncomplete = () => resolve(next);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () =>
        reject(tx.error ?? new Error("Não foi possível recuperar o save."));
    });
  }
  async readMetadata(): Promise<unknown> {
    const db = await this.db;
    return new Promise((resolve, reject) => {
      const tx = db.transaction("snapshots", "readonly"),
        r = tx.objectStore("snapshots").get(this.key("cloud"));
      tx.oncomplete = () => resolve(r.result ?? null);
      tx.onerror = () => reject(tx.error);
    });
  }
  async writeMetadata(value: unknown): Promise<void> {
    const db = await this.db;
    return new Promise((resolve, reject) => {
      const tx = db.transaction("snapshots", "readwrite");
      tx.objectStore("snapshots").put(value, this.key("cloud"));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  }
}
