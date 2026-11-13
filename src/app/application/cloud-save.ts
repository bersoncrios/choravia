import type { Game } from "../domain/game.js";
import { isGame } from "../domain/save-validation.js";
import { CloudConflict } from "../domain/cloud-snapshot.js";
import type { CloudRecord, CloudWrite } from "../domain/cloud-snapshot.js";
export { CloudConflict } from "../domain/cloud-snapshot.js";
export type { CloudRecord, CloudWrite } from "../domain/cloud-snapshot.js";
export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  photoURL: string | null;
}
export interface AccountAccess {
  profile: UserProfile;
  cloud: () => Promise<CloudSaveGateway>;
}
export interface CloudSaveGateway {
  readonly uid: string;
  load(): Promise<CloudRecord | null>;
  write(request: CloudWrite): Promise<CloudRecord>;
}
export interface CloudBinding {
  uid: string;
  revision: number;
  fingerprint: string;
  pending: CloudWrite | null;
}
export interface CloudBindingStore {
  load(): Promise<unknown>;
  save(binding: CloudBinding): Promise<void>;
}
export interface LocalCloudPort {
  current(): Game;
  restore(snapshot: Game, expectedRevision: number): Promise<void>;
}
export type CloudStatus =
  | "loading"
  | "local"
  | "saving"
  | "saved"
  | "pending"
  | "conflict";
function binding(value: unknown, uid: string): CloudBinding | null {
  if (!value || typeof value !== "object") return null;
  const b = value as Partial<CloudBinding>;
  if (
    b.uid !== uid ||
    !Number.isSafeInteger(b.revision) ||
    Number(b.revision) < 0 ||
    typeof b.fingerprint !== "string"
  )
    return null;
  if (
    b.pending !== null &&
    (!b.pending ||
      !Number.isSafeInteger(b.pending.expectedRevision) ||
      b.pending.expectedRevision < 0 ||
      typeof b.pending.writeId !== "string" ||
      !/^[A-Za-z0-9_-]{8,100}$/.test(b.pending.writeId) ||
      !isGame(b.pending.snapshot))
  )
    return null;
  return {
    uid,
    revision: Number(b.revision),
    fingerprint: b.fingerprint,
    pending: b.pending ?? null,
  };
}
export class CloudSaveSession {
  status: CloudStatus = "loading";
  error = "";
  errorCode = "";
  busy = false;
  conflict: CloudRecord | null = null;
  private metadata: CloudBinding;
  private stopped = false;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private retryTimer: ReturnType<typeof setTimeout> | undefined;
  private retryAttempt = 0;
  private observedRevision = -1;
  constructor(
    readonly uid: string,
    private readonly gateway: CloudSaveGateway,
    private readonly local: LocalCloudPort,
    private readonly store: CloudBindingStore,
    private readonly digest: (game: Game) => Promise<string>,
    private readonly ids: () => string,
    private readonly changed: () => void,
    private readonly hadCache: boolean,
  ) {
    this.metadata = { uid, revision: 0, fingerprint: "", pending: null };
  }
  private async work(action: () => Promise<void>): Promise<void> {
    if (this.stopped || this.busy) return;
    clearTimeout(this.retryTimer);
    this.retryTimer = undefined;
    this.busy = true;
    this.error = "";
    this.errorCode = "";
    this.changed();
    try {
      await action();
    } catch (error) {
      if (this.stopped) return;
      this.error =
        error instanceof Error ? error.message : "Falha ao salvar na conta.";
      this.errorCode =
        error && typeof error === "object" && "code" in error
          ? String(error.code)
          : "";
      if (error instanceof CloudConflict) {
        this.conflict = await this.gateway.load().catch(() => null);
        this.status = "conflict";
      } else this.status = "pending";
    } finally {
      this.busy = false;
      if (!this.stopped) {
        if (this.status === "pending") this.scheduleRetry();
        else this.retryAttempt = 0;
        this.changed();
      }
    }
  }
  private scheduleRetry(): void {
    if (this.retryTimer || this.stopped || this.status !== "pending") return;
    const code = this.errorCode.replace(/^firestore\//, "");
    if (["permission-denied", "unauthenticated", "invalid-argument"].includes(code)) return;
    const delay = Math.min(1000 * 2 ** Math.min(this.retryAttempt++, 6), 60000);
    this.retryTimer = setTimeout(() => {
      this.retryTimer = undefined;
      void this.retry();
    }, delay);
  }
  async start(): Promise<void> {
    await this.work(async () => {
      this.metadata =
        binding(await this.store.load(), this.uid) ?? this.metadata;
      await this.reconcile();
    });
  }
  private async record(record: CloudRecord): Promise<void> {
    this.metadata = {
      uid: this.uid,
      revision: record.revision,
      fingerprint: await this.digest(record.snapshot),
      pending: null,
    };
    await this.store.save(this.metadata);
  }
  private async recover(
    record: CloudRecord,
    expectedRevision: number,
  ): Promise<void> {
    if (this.local.current().revision !== expectedRevision) {
      this.conflict = record;
      this.status = "conflict";
      return;
    }
    try {
      await this.local.restore(record.snapshot, expectedRevision);
    } catch (error) {
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        error.code === "local/conflict"
      ) {
        this.conflict = record;
        this.status = "conflict";
        return;
      }
      throw error;
    }
    if (this.stopped) return;
    await this.record(record);
    this.status = "saved";
  }
  private async reconcile(): Promise<void> {
    if (this.metadata.pending) await this.sendPending();
    if (this.stopped) return;
    const atStart = this.local.current().revision,
      remote = await this.gateway.load();
    if (this.stopped) return;
    const current = this.local.current(),
      hash = await this.digest(current);
    if (!remote) {
      if (this.metadata.revision > 0) {
        this.conflict = null;
        this.status = "conflict";
        this.error = "O save da conta foi removido. Escolha como continuar.";
        return;
      }
      await this.commit();
      return;
    }
    if (this.metadata.revision === 0) {
      if (
        (!this.hadCache && current.revision === atStart) ||
        hash === (await this.digest(remote.snapshot))
      ) {
        await this.recover(remote, current.revision);
        return;
      }
      this.conflict = remote;
      this.status = "conflict";
      return;
    }
    if (remote.revision === this.metadata.revision) {
      if (hash === this.metadata.fingerprint) {
        this.status = "saved";
        return;
      }
      await this.commit();
      return;
    }
    if (
      remote.revision > this.metadata.revision &&
      hash === this.metadata.fingerprint &&
      current.revision === atStart
    ) {
      await this.recover(remote, current.revision);
      return;
    }
    this.conflict = remote;
    this.status = "conflict";
  }
  private async commit(): Promise<void> {
    if (this.stopped) return;
    const snapshot = structuredClone(this.local.current());
    if (!isGame(snapshot))
      throw new Error(
        "Somente o progresso pessoal pode ser salvo neste espaço.",
      );
    this.metadata = {
      ...this.metadata,
      pending: {
        expectedRevision: this.metadata.revision,
        writeId: this.ids(),
        snapshot,
      },
    };
    await this.sendPending();
  }
  private async sendPending(): Promise<void> {
    if (!this.metadata.pending || this.stopped) return;
    await this.store.save(this.metadata);
    if (this.stopped) return;
    this.status = "saving";
    this.changed();
    const result = await this.gateway.write(this.metadata.pending);
    if (this.stopped) return;
    await this.record(result);
    this.status = "saved";
    if (
      (await this.digest(this.local.current())) !== this.metadata.fingerprint
    ) {
      this.status = "local";
      this.schedule();
    }
  }
  observe(immediate = false): void {
    if (
      this.stopped ||
      this.status === "loading" ||
      this.status === "conflict" ||
      this.status === "pending"
    )
      return;
    const revision = this.local.current().revision;
    if (revision === this.observedRevision && !immediate) return;
    this.observedRevision = revision;
    if (this.busy) return;
    this.status = "local";
    this.changed();
    if (immediate) {
      clearTimeout(this.timer);
      this.timer = undefined;
      void this.flush();
    } else this.schedule();
  }
  private schedule(): void {
    if (this.timer || this.stopped) return;
    this.timer = setTimeout(() => {
      this.timer = undefined;
      void this.flush();
    }, 1500);
  }
  async flush(): Promise<void> {
    if (this.stopped || this.busy || this.status === "conflict") return;
    clearTimeout(this.timer);
    this.timer = undefined;
    await this.work(async () => {
      if (this.metadata.pending) await this.sendPending();
      if (this.stopped) return;
      if (
        (await this.digest(this.local.current())) !== this.metadata.fingerprint
      )
        await this.commit();
      else this.status = "saved";
    });
  }
  async retry(): Promise<void> {
    if (this.status === "conflict") return;
    await this.work(() => this.reconcile());
  }
  async useCloud(): Promise<void> {
    await this.work(async () => {
      const revision = this.local.current().revision,
        remote = await this.gateway.load();
      if (!remote) throw new Error("Nenhum save disponível na conta.");
      this.conflict = null;
      await this.recover(remote, revision);
    });
  }
  async useLocal(): Promise<void> {
    await this.work(async () => {
      const remote = await this.gateway.load();
      this.metadata = {
        uid: this.uid,
        revision: remote?.revision ?? 0,
        fingerprint: remote ? await this.digest(remote.snapshot) : "",
        pending: null,
      };
      await this.store.save(this.metadata);
      this.conflict = null;
      await this.commit();
    });
  }
  stop(): void {
    this.stopped = true;
    clearTimeout(this.timer);
    clearTimeout(this.retryTimer);
  }
}
