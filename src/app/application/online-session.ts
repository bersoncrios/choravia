import { initialGame, reduceGame, creatureLevel, creatureMaxHp } from "../domain/game.js";
import type { Command, Game, SpeciesId } from "../domain/game.js";
import type {
  OnlineGateway,
  OnlineState,
  PublicEncounter,
  RemoteMethod,
  Requests,
  Responses,
  TradePreview,
} from "../domain/online.js";

type Mutation =
  | "beginEncounter"
  | "submitAction"
  | "cancelEncounter"
  | "createTrade"
  | "acceptTrade"
  | "cancelTrade";
export type PendingRequest = {
  [K in Mutation]: { method: K; input: Requests[K] };
}[Mutation];
export interface PendingStore {
  load(uid: string): unknown;
  save(uid: string, pending: PendingRequest | null): void;
}
export interface Invite {
  tradeId: string;
  token: string;
}
export function parseInvite(href: string, origin: string): Invite | null {
  try {
    const url = new URL(href, origin),
      match = /^\/troca\/([A-Za-z0-9_-]{8,100})\/?$/.exec(url.pathname),
      token = new URLSearchParams(url.hash.slice(1)).get("t");
    return url.origin === origin &&
      match?.[1] &&
      token &&
      /^[A-Za-z0-9_-]{43}$/.test(token)
      ? { tradeId: match[1], token }
      : null;
  } catch {
    return null;
  }
}
export function inviteLink(invite: Invite, origin: string): string {
  const url = new URL(`/troca/${invite.tradeId}`, origin);
  url.hash = new URLSearchParams({ t: invite.token }).toString();
  return url.href;
}
function decodedPending(value: unknown): PendingRequest | null {
  if (
    !value ||
    typeof value !== "object" ||
    !("method" in value) ||
    !("input" in value) ||
    !value.input ||
    typeof value.input !== "object"
  )
    return null;
  if (
    ![
      "beginEncounter",
      "submitAction",
      "cancelEncounter",
      "createTrade",
      "cancelTrade",
    ].includes(String(value.method))
  )
    return null;
  const data = value.input as Record<string, unknown>;
  if (
    typeof data["requestId"] !== "string" ||
    !/^[A-Za-z0-9_-]{8,100}$/.test(data["requestId"]) ||
    "token" in data
  )
    return null;
  return value as PendingRequest;
}
const uncertain = (error: unknown): boolean =>
  !(
    error &&
    typeof error === "object" &&
    "code" in error &&
    [
      "invalid-argument",
      "failed-precondition",
      "not-found",
      "permission-denied",
      "unauthenticated",
      "already-exists",
      "aborted",
      "resource-exhausted",
      "functions/invalid-argument",
      "functions/failed-precondition",
      "functions/not-found",
      "functions/permission-denied",
      "functions/unauthenticated",
      "functions/already-exists",
      "functions/aborted",
      "functions/resource-exhausted",
    ].includes(String(error.code))
  );
export class OnlineSession {
  state: OnlineState | null = null;
  view: Game = initialGame();
  busy = false;
  error = "";
  needsSync = true;
  pending: PendingRequest | null = null;
  outgoing: Invite | null = null;
  preview: TradePreview | null = null;
  private outgoingRevision: number | null = null;
  readonly uid: string;
  constructor(
    private readonly gateway: OnlineGateway,
    private readonly changed: () => void,
    private readonly ids: () => string,
    private readonly pendingStore?: PendingStore,
  ) {
    this.uid = gateway.uid;
    this.pending = decodedPending(pendingStore?.load(this.uid));
  }
  private identity(): void {
    if (this.gateway.uid !== this.uid)
      throw new Error(
        "A conta mudou. Reconecte para carregar o inventário correto.",
      );
  }
  async load(): Promise<void> {
    if (this.busy) return;
    await this.run(async () => {
      this.identity();
      await this.gateway.call("bootstrap", {});
      await this.refreshUnsafe();
      if (this.pending) await this.resolvePending();
    });
  }
  async refresh(): Promise<void> {
    if (this.busy) return;
    await this.run(async () => {
      this.identity();
      if (this.pending) await this.resolvePending();
      else await this.refreshUnsafe();
    });
  }
  private async run(work: () => Promise<void>): Promise<void> {
    this.busy = true;
    this.error = "";
    this.changed();
    try {
      await work();
    } catch (error) {
      this.error =
        error instanceof Error
          ? error.message
          : "Não foi possível sincronizar.";
      this.needsSync = true;
    } finally {
      this.busy = false;
      this.changed();
    }
  }
  private project(encounter: PublicEncounter | null): void {
    if (!this.state) return;
    const creatures = this.state.creatures.map((c) => ({
      id: c.id,
      speciesId: c.speciesId,
      hp: creatureMaxHp(c.speciesId, creatureLevel(c)),
      level: creatureLevel(c),
      experience: c.experience,
      provenance: "validated" as const,
    }));
    if (creatures.length === 0) {
      this.needsSync = true;
      this.error =
        "Nenhuma criatura disponível nesta página. Atualize o inventário.";
      return;
    }
    const active =
      encounter?.activeCreatureId ??
      (creatures.some((c) => c.id === this.view.activeId)
        ? this.view.activeId
        : (creatures.find((c) => !this.locked(c.id))?.id ?? creatures[0]!.id));
    this.view = {
      ...this.view,
      collection: creatures,
      activeId: active,
      captured: Math.max(0, creatures.length - 1),
      battle: encounter ? structuredClone(encounter.battle) : null,
      scene: encounter
        ? encounter.battle.result
          ? "result"
          : "battle"
        : "exploration",
      message:
        encounter?.message ??
        "Expedição online: criaturas da conta e convites de troca disponíveis.",
      events: [],
    };
  }
  private async refreshUnsafe(result?: PublicEncounter): Promise<void> {
    this.identity();
    const next = await this.gateway.call("getState", {});
    // An active creature may be beyond the first inventory page after a long collection.
    while (
      next.encounter &&
      !next.creatures.some((c) => c.id === next.encounter!.activeCreatureId) &&
      next.nextCursor
    ) {
      const page = await this.gateway.call("listInventory", {
        cursor: next.nextCursor,
        revision: next.inventoryRevision,
      });
      next.creatures.push(...page.creatures);
      next.nextCursor = page.nextCursor;
    }
    if (
      next.encounter &&
      !next.creatures.some((c) => c.id === next.encounter!.activeCreatureId)
    )
      throw new Error(
        "Inventário mudou. Atualize antes de continuar o encontro.",
      );
    this.state = next;
    this.needsSync = false;
    const candidate =
      (result?.battle.result ? result : undefined) ??
      (this.view.scene === "result" && this.view.battle
        ? {
            id: this.view.battle.id,
            seq: 0,
            activeCreatureId: this.view.activeId,
            battle: this.view.battle,
            status: "resolved" as const,
            message: this.view.message,
          }
        : undefined);
    const keep =
      candidate &&
      next.creatures.some((c) => c.id === candidate.activeCreatureId)
        ? candidate
        : undefined;
    this.project(next.encounter ?? keep ?? null);
    if (
      this.outgoing &&
      (next.offer?.id !== this.outgoing.tradeId ||
        next.offer.revision !== this.outgoingRevision)
    ) {
      this.outgoing = null;
      this.outgoingRevision = null;
    }
  }
  adoptWorld(world: Game): void {
    this.view = structuredClone(world);
    this.project(this.state?.encounter ?? null);
    this.changed();
  }
  locked(id: string): boolean {
    return !!this.state?.creatures.find((c) => c.id === id)?.lock;
  }
  get ready(): boolean {
    return !!this.state && !this.needsSync && !this.pending;
  }
  async loadMore(): Promise<void> {
    if (this.busy || !this.state?.nextCursor || !this.ready) return;
    await this.run(async () => {
      const page = await this.gateway.call("listInventory", {
        cursor: this.state!.nextCursor!,
        revision: this.state!.inventoryRevision,
      });
      this.state!.creatures.push(...page.creatures);
      this.state!.nextCursor = page.nextCursor;
      this.project(this.state!.encounter);
    });
  }
  async dispatch(command: Command): Promise<void> {
    if (this.busy || !this.ready) return;
    if (command.type === "applyDailyReward") return;
    if (
      command.type === "walk" ||
      command.type === "activate" ||
      command.type === "heal" ||
      command.type === "interact" ||
      command.type === "customize" ||
      command.type === "chooseStarter" ||
      command.type === "breakPot" ||
      command.type === "challengeNpc" ||
      command.type === "purchase" ||
      command.type === "return"
    ) {
      if (command.type === "activate" && this.locked(command.id)) return;
      const next = reduceGame(this.view, command);
      if (next === this.view) return;
      if (command.type === "walk" && next.scene === "battle") {
        if (this.locked(this.view.activeId)) {
          this.error =
            "Seu Eco está reservado numa oferta. Cancele a oferta ou escolha outro.";
          this.changed();
          return;
        }
        const position = next.player;
        await this.mutate({
          method: "beginEncounter",
          input: { requestId: this.ids(), creatureId: this.view.activeId },
        });
        if (this.view.scene === "battle")
          this.view = { ...this.view, player: position, steps: 0 };
        this.changed();
        return;
      }
      this.view = {
        ...next,
        collection: this.view.collection.map((c) => ({
          ...c,
          hp: creatureMaxHp(c.speciesId, creatureLevel(c)),
        })),
        events: [],
      };
      this.changed();
      return;
    }
    if (this.view.scene !== "battle" || !this.state?.encounter) return;
    await this.mutate({
      method: "submitAction",
      input: {
        requestId: this.ids(),
        encounterId: this.state.encounter.id,
        seq: this.state.encounter.seq,
        command,
      },
    });
  }
  private persistPending(): void {
    try {
      this.pendingStore?.save(
        this.uid,
        this.pending?.method === "acceptTrade" ? null : this.pending,
      );
    } catch {
      /* Firestore operation receipts preserve retries when session storage is unavailable. */
    }
  }
  private async mutate(request: PendingRequest): Promise<void> {
    if (this.busy || !this.ready) return;
    this.pending = request;
    this.persistPending();
    await this.run(() => this.resolvePending());
  }
  private async resolvePending(): Promise<void> {
    const pending = this.pending;
    if (!pending) return;
    this.identity();
    const recovering = this.needsSync;
    try {
      let result: PublicEncounter | undefined;
      switch (pending.method) {
        case "beginEncounter":
        case "submitAction":
          result = await this.gateway.call(pending.method, pending.input);
          break;
        case "createTrade": {
          const created = await this.gateway.call("createTrade", pending.input);
          if (created.token) {
            this.outgoing = { tradeId: created.tradeId, token: created.token };
            this.outgoingRevision = 1;
          }
          break;
        }
        case "acceptTrade":
          await this.gateway.call("acceptTrade", pending.input);
          this.preview = this.preview
            ? { ...this.preview, status: "completed" }
            : null;
          break;
        case "cancelTrade":
          await this.gateway.call("cancelTrade", pending.input);
          this.outgoing = null;
          break;
        case "cancelEncounter":
          await this.gateway.call("cancelEncounter", pending.input);
          break;
      }
      this.pending = null;
      this.persistPending();
      if (
        pending.method === "submitAction" &&
        result?.status === "open" &&
        !recovering &&
        this.state?.encounter?.id === result.id &&
        this.state.encounter.seq < result.seq
      ) {
        // Nonterminal battle commands never change the inventory or its lock.
        // Keep the authoritative action response without another inventory query.
        this.state = { ...this.state, encounter: result };
        this.needsSync = false;
        this.project(result);
      } else {
        await this.refreshUnsafe(result);
      }
    } catch (error) {
      if (!uncertain(error)) {
        this.pending = null;
        this.persistPending();
        await this.refreshUnsafe().catch(() => {});
      }
      throw error;
    }
  }
  async retry(): Promise<void> {
    if (this.busy || !this.pending) return;
    await this.run(() => this.resolvePending());
  }
  async createOffer(
    creatureId: string,
    requestedSpeciesId: SpeciesId,
  ): Promise<void> {
    await this.mutate({
      method: "createTrade",
      input: { requestId: this.ids(), creatureId, requestedSpeciesId },
    });
  }
  async cancelOffer(): Promise<void> {
    if (!this.state?.offer) return;
    await this.mutate({
      method: "cancelTrade",
      input: { requestId: this.ids(), tradeId: this.state.offer.id },
    });
  }
  async rotate(): Promise<void> {
    if (this.busy || !this.ready || !this.state?.offer) return;
    await this.run(async () => {
      const own = this.state!.offer!,
        result = await this.gateway.call("rotateTradeToken", {
          tradeId: own.id,
          revision: own.revision,
        });
      this.outgoing = { tradeId: result.tradeId, token: result.token };
      this.outgoingRevision = result.revision;
      await this.refreshUnsafe();
    });
  }
  async inspect(invite: Invite): Promise<void> {
    if (this.busy || !this.state) return;
    this.preview = null;
    await this.run(async () => {
      this.identity();
      this.preview = await this.gateway.call("previewTrade", invite);
    });
  }
  async accept(invite: Invite, creatureId: string): Promise<void> {
    if (this.preview?.status !== "open") return;
    await this.mutate({
      method: "acceptTrade",
      input: { requestId: this.ids(), ...invite, creatureId },
    });
  }
  async abandonEncounter(): Promise<void> {
    if (!this.state?.encounter) return;
    await this.mutate({
      method: "cancelEncounter",
      input: { requestId: this.ids(), encounterId: this.state.encounter.id },
    });
  }
}
