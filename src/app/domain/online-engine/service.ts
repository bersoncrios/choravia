import { sha256 as sha, randomToken, randomSeed } from "./crypto.js";
import {
  initialGame,
  createBattle,
  reduceGame,
  SPECIES,
  species,
  creatureLevel,
  creatureMaxHp,
} from "../game.js";
import type { Creature, SpeciesId } from "../game.js";
import { dailyTemplates, DAILY_COMPLETION_BONUS } from "../daily-challenges.js";
import type { DailyBoard, DailyReward } from "../daily-challenges.js";
import type {
  OnlineState,
  PublicEncounter,
  RemoteMethod,
  Responses,
  TradePreview,
  ValidatedCreature,
} from "../online.js";
import type { DocumentStore, Transaction } from "./store.js";
import { GameError } from "./model.js";
import type {
  UserDoc,
  DailyChallengeDoc,
  WeeklyChallengeDoc,
  CreatureDoc,
  TradeDoc,
  EncounterDoc,
  OperationDoc,
} from "./model.js";
import {
  object,
  id,
  integer,
  speciesId,
  token,
  battleCommand,
} from "./validation.js";
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`)
      .join(",")}}`;
  return JSON.stringify(value) ?? "null";
}
const fail = (
  code: ConstructorParameters<typeof GameError>[0],
  message: string,
): never => {
  throw new GameError(code, message);
};
function must<T>(value: T | null): T {
  if (value === null) return fail("not-found", "Recurso não encontrado.");
  return value;
}
const userPath = (uid: string) => `users/${uid}/online/state`;
const profilePath = (uid: string) => `users/${uid}`;
const creaturePath = (creatureId: string) => `creatures/${creatureId}`;
const offerPath = (tradeId: string) => `trade_links/${tradeId}`;
const encounterPath = (encounterId: string) => `encounters/${encounterId}`;
const operationPath = (uid: string, requestId: string) =>
  `users/${uid}/operations/${requestId}`;
const publicCreature = (entry: {
  id: string;
  data: CreatureDoc;
}): ValidatedCreature => ({
  id: entry.id,
  speciesId: entry.data.speciesId,
  level: creatureLevel(entry.data),
  experience: entry.data.experience ?? 0,
  lock: entry.data.lock,
  revision: entry.data.revision,
});
function projection(encounterId: string, e: EncounterDoc): PublicEncounter {
  return {
    id: encounterId,
    seq: e.nextSeq,
    activeCreatureId: e.creatureId,
    battle: structuredClone(must(e.state.battle)),
    status: e.status,
    message: e.state.message,
  };
}
async function correctToken(secret: string, t: TradeDoc): Promise<boolean> {
  return await sha(secret) === t.tokenHash;
}
export interface ServiceClock {
  now(): number;
}
export class GameService {
  private readonly quotaQueue = new Map<string, Promise<void>>();
  constructor(
    private readonly store: DocumentStore,
    private readonly clock: ServiceClock = { now: () => Date.now() },
  ) {}
  private compatibleUser(value: UserDoc): UserDoc {
    if (
      value.schemaVersion !== 1 ||
      value.starterGranted !== true ||
      !Number.isSafeInteger(value.inventoryRevision) ||
      value.inventoryRevision < 1 ||
      !Number.isSafeInteger(value.lastEncounterAt) ||
      ![
        value.activeEncounterId,
        value.activeTradeId,
        value.firstCaptureEncounterId,
      ].every((id) => id === null || typeof id === "string")
    ) {
      return fail(
        "failed-precondition",
        "Esta conta possui dados de outro formato. É necessária uma migração antes de jogar online; nenhum dado foi substituído.",
      );
    }
    return value;
  }
  private async user(tx: Transaction, uid: string): Promise<UserDoc> {
    return this.compatibleUser(must(await tx.get<UserDoc>(userPath(uid))));
  }
  async execute(
    uid: string,
    method: RemoteMethod,
    input: unknown,
  ): Promise<Responses[RemoteMethod]> {
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(uid))
      return fail("unauthenticated", "Identidade inválida.");
    await this.quota(uid);
    switch (method) {
      case "syncExpedition": {
        const d = object(input, ["creatures"]);
        if (!Array.isArray(d["creatures"]) || d["creatures"].length > 100 || !d["creatures"].every((c: unknown) => {
          if (!c || typeof c !== "object") return false;
          const value = c as Creature;
          return typeof value.id === "string" && /^[A-Za-z0-9_-]{1,100}$/.test(value.id) && SPECIES.some(s => s.id === value.speciesId) && ["local", "validated"].includes(value.provenance) && Number.isInteger(value.level ?? 1) && (value.level ?? 1) >= 1 && (value.level ?? 1) <= 30 && Number.isInteger(value.experience ?? 0) && (value.experience ?? 0) >= 0 && (value.experience ?? 0) < (creatureLevel(value) === 30 ? 1 : 30 + 12 * creatureLevel(value));
        })) return fail("invalid-argument", "Coleção inválida.");
        const sources = d["creatures"] as Creature[];
        const owned = new Set<string>();
        const pageSize = 1000;
        let cursor: string | null = null;
        // Read the complete inventory without exceeding Firestore query limits.
        // A truncated inventory would incorrectly discard sources on later pages.
        for (;;) {
          const page = await this.store.owned(uid, cursor, pageSize);
          for (const entry of page) owned.add(entry.id);
          if (page.length < pageSize) break;
          cursor = page[page.length - 1]!.id;
        }
        const mapping = [];
        for (const creature of sources) {
          const result = await this.syncExpeditionCreature(uid, creature, owned);
          if (result.id) owned.add(result.id);
          mapping.push(result);
        }
        return { mapping };
      }
      case "recordExpeditionDaily": {
        const d = object(input, ["cycleId", "types"]);
        if (typeof d["cycleId"] !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(d["cycleId"]) || !Array.isArray(d["types"]) || d["types"].length > 4 || !d["types"].every(type => ["resolve-encounter", "move-in-battle", "defend-in-battle", "basic-attack"].includes(String(type)))) return fail("invalid-argument", "Objetivos inválidos.");
        if (d["cycleId"] !== this.localCycle(this.clock.now()).id) return fail("failed-precondition", "As trilhas do dia foram renovadas. Atualize a expedição.");
        await this.store.transaction(async tx => {
          await this.user(tx, uid);
          const { id: cycleId, resetAt } = this.localCycle(this.clock.now());
          if (d["cycleId"] !== cycleId) return fail("failed-precondition", "As trilhas foram renovadas.");
          await this.advanceDaily(tx, uid, cycleId, resetAt, d["types"] as string[]);
        });
        return { recorded: true };
      }
      case "bootstrap":
        object(input, []);
        return this.bootstrap(uid);
      case "getDailyBoard":
        object(input, []);
        return this.dailyBoard(uid);
      case "ackDailyRewards": {
        const d = object(input, ["receiptIds"]);
        if (!Array.isArray(d["receiptIds"]) || d["receiptIds"].length > 20 || !d["receiptIds"].every((x) => typeof x === "string" && (/^daily:[0-9]{4}-[0-9]{2}-[0-9]{2}:[a-z-]+(?::bonus)?$/.test(x) || /^weekly:[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(x)))) return fail("invalid-argument", "Recibos inválidos.");
        await this.ackDailyRewards(uid, d["receiptIds"] as string[]);
        return { acknowledged: true };
      }
      case "getState":
        object(input, []);
        return this.state(uid);
      case "listInventory": {
        const d = object(input, ["cursor", "revision"]);
        return this.inventory(uid, id(d["cursor"]), integer(d["revision"]));
      }
      case "beginEncounter": {
        const d = object(input, ["requestId", "creatureId"]);
        return this.begin(uid, id(d["requestId"]), id(d["creatureId"]));
      }
      case "submitAction": {
        const d = object(input, ["requestId", "encounterId", "seq", "command"]);
        return this.action(
          uid,
          id(d["requestId"]),
          id(d["encounterId"]),
          integer(d["seq"], 300),
          battleCommand(d["command"]),
        );
      }
      case "cancelEncounter": {
        const d = object(input, ["requestId", "encounterId"]);
        return this.cancelEncounter(
          uid,
          id(d["requestId"]),
          id(d["encounterId"]),
        );
      }
      case "createTrade": {
        const d = object(input, [
          "requestId",
          "creatureId",
          "requestedSpeciesId",
        ]);
        return this.createTrade(
          uid,
          id(d["requestId"]),
          id(d["creatureId"]),
          speciesId(d["requestedSpeciesId"]),
        );
      }
      case "rotateTradeToken": {
        const d = object(input, ["tradeId", "revision"]);
        return this.rotate(uid, id(d["tradeId"]), integer(d["revision"]));
      }
      case "previewTrade": {
        const d = object(input, ["tradeId", "token"]);
        return this.preview(id(d["tradeId"]), token(d["token"]));
      }
      case "acceptTrade": {
        const d = object(input, [
          "requestId",
          "tradeId",
          "token",
          "creatureId",
        ]);
        return this.accept(
          uid,
          id(d["requestId"]),
          id(d["tradeId"]),
          token(d["token"]),
          id(d["creatureId"]),
        );
      }
      case "cancelTrade": {
        const d = object(input, ["requestId", "tradeId"]);
        return this.cancelTrade(uid, id(d["requestId"]), id(d["tradeId"]));
      }
      default:
        return fail("invalid-argument", "Operação desconhecida.");
    }
  }
  private localCycle(now: number): { id: string; resetAt: number } {
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
    const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "00";
    const id = `${get("year")}-${get("month")}-${get("day")}`;
    // America/Sao_Paulo currently has no seasonal clock changes; derive the
    // next local midnight from the UTC instant of the next calendar date.
    const nextDate = new Date(Date.UTC(Number(get("year")), Number(get("month")) - 1, Number(get("day")) + 1));
    const midnight = Date.UTC(nextDate.getUTCFullYear(), nextDate.getUTCMonth(), nextDate.getUTCDate()) + 3 * 60 * 60 * 1000;
    return { id, resetAt: midnight > now ? midnight : now + 60_000 };
  }
  private dailyPath(uid: string, cycleId: string): string { return `users/${uid}/daily_challenges/${cycleId}`; }
  private weekId(cycleId: string): string { const date = new Date(`${cycleId}T00:00:00Z`); date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7)); return date.toISOString().slice(0, 10); }
  private weeklyPath(uid: string, weekId: string): string { return `users/${uid}/weekly_challenges/${weekId}`; }
  private async dailySeed(uid: string, cycleId: string): Promise<number> { return parseInt((await sha(`${uid}:${cycleId}`)).slice(0, 8), 16) || 1; }
  private async advanceDaily(tx: Transaction, uid: string, cycleId: string, resetAt: number, contractTypes: string[]): Promise<void> {
    const dailyPath = this.dailyPath(uid, cycleId);
    const oldDaily = await tx.get<DailyChallengeDoc>(dailyPath);
    const daily: DailyChallengeDoc = oldDaily ?? { cycleId, resetAt, progress: {}, claimed: [], rewards: [], completionBonusEarned: false, qualifiedForWeek: false };
    let dailyChanged = !oldDaily;
      const selected = dailyTemplates(await this.dailySeed(uid, cycleId));
      for (const contractType of contractTypes) {
        const template = selected.find((contract) => contract.id === contractType);
        if (!template || daily.progress[contractType]) continue;
        daily.progress[contractType] = 1;
        daily.rewards.push({ receiptId: `daily:${cycleId}:${contractType}`, seeds: template.rewardSeeds });
        dailyChanged = true;
      }
      if (!daily.completionBonusEarned && selected.every((contract) => daily.progress[contract.id] === 1)) {
        daily.completionBonusEarned = true;
        daily.rewards.push({ receiptId: `daily:${cycleId}:completion:bonus`, seeds: DAILY_COMPLETION_BONUS });
        dailyChanged = true;
      }
      let weekUpdate: { path: string; doc: WeeklyChallengeDoc } | null = null;
      if (!daily.qualifiedForWeek && Object.values(daily.progress).filter((progress) => progress === 1).length >= 2) {
        const weekId = this.weekId(cycleId), path = this.weeklyPath(uid, weekId);
        const oldWeek = await tx.get<WeeklyChallengeDoc>(path);
        const week: WeeklyChallengeDoc = oldWeek ?? { weekId, qualifiedDays: [], reward: null, claimed: [] };
        week.qualifiedDays = [...new Set([...week.qualifiedDays, cycleId])].sort();
        if (!week.reward && week.qualifiedDays.length >= 4) {
          const cosmetics = ["forest-cloak", "sun-scarf", "moon-pin"] as const;
          const itemId = cosmetics[(await this.dailySeed(uid, weekId)) % cosmetics.length]!;
          week.reward = { receiptId: `weekly:${weekId}`, seeds: 0, itemId, fallbackSeeds: 25 };
        }
        daily.qualifiedForWeek = true;
        dailyChanged = true;
        weekUpdate = { path, doc: week };
      }
    if (dailyChanged) tx.set(dailyPath, daily);
    if (weekUpdate) tx.set(weekUpdate.path, weekUpdate.doc);
  }
  private async syncExpeditionCreature(uid: string, source: Creature, owned: Set<string>): Promise<{ sourceId: string; id: string | null }> {
    const key = `expedition-${(await sha(`${uid}:${source.id}`)).slice(0, 32)}`;
    const starterId = `starter-${(await sha(uid)).slice(0, 32)}`;
    return this.store.transaction(async tx => {
      const user = await this.user(tx, uid);
      const receipt = source.provenance === "local" ? await tx.get<OperationDoc>(operationPath(uid, key)) : null;
      const starter = source.id === "starter" && !receipt && owned.has(starterId) ? await tx.get<CreatureDoc>(creaturePath(starterId)) : null;
      const choice = source.id === "starter" && !receipt ? await tx.get<OperationDoc>(operationPath(uid, "starter-choice")) : null;
      const replaceStarter = starter?.ownerId === uid && !starter.lock && creatureLevel(starter) === 1 && !(starter.experience ?? 0) && !choice;
      const targetId = source.provenance === "validated" ? source.id : receipt ? String((receipt.result as { id: string }).id) : replaceStarter ? starterId : key;
      if ((source.provenance === "validated" || receipt) && !owned.has(targetId)) return { sourceId: source.id, id: null };
      const current = targetId === starterId && starter ? starter : await tx.get<CreatureDoc>(creaturePath(targetId));
      if (current && current.ownerId !== uid || source.provenance === "validated" && !current || receipt && !current) return { sourceId: source.id, id: null };
      let changed = false;
      if (!current) {
        tx.set(creaturePath(targetId), { ownerId: uid, speciesId: source.speciesId, level: creatureLevel(source), experience: source.experience ?? 0, createdAt: this.clock.now(), originEncounterId: key, revision: 1, lock: null } satisfies CreatureDoc);
        changed = true;
      } else if (!current.lock && (replaceStarter || (current.speciesId === source.speciesId && (creatureLevel(source) > creatureLevel(current) || creatureLevel(source) === creatureLevel(current) && (source.experience ?? 0) > (current.experience ?? 0))))) {
        tx.set(creaturePath(targetId), { ...current, speciesId: replaceStarter ? source.speciesId : current.speciesId, level: creatureLevel(source), experience: source.experience ?? 0, revision: current.revision + 1 });
        changed = true;
      }
      if (source.provenance === "local" && !receipt) {
        tx.set(operationPath(uid, key), { kind: "expedition-import", payloadHash: key, createdAt: this.clock.now(), result: { id: targetId, sourceId: source.id, speciesId: source.speciesId } } satisfies OperationDoc);
        if (replaceStarter) tx.set(operationPath(uid, "starter-choice"), { kind: "starter-choice", payloadHash: key, createdAt: this.clock.now(), result: { id: targetId, speciesId: source.speciesId } } satisfies OperationDoc);
      }
      if (changed) tx.set(userPath(uid), { ...user, inventoryRevision: user.inventoryRevision + 1 });
      return { sourceId: source.id, id: targetId };
    });
  }
  private async dailyBoard(uid: string): Promise<DailyBoard> {
    const { id: cycleId, resetAt } = this.localCycle(this.clock.now());
    const path = this.dailyPath(uid, cycleId);
    const weekId = this.weekId(cycleId);
    const [current, weekly] = await this.store.transaction(async (tx) => {
      const old = await tx.get<DailyChallengeDoc>(path);
      const currentWeek = await tx.get<WeeklyChallengeDoc>(this.weeklyPath(uid, weekId));
      const value: DailyChallengeDoc = old ?? { cycleId, resetAt, progress: {}, claimed: [], rewards: [], completionBonusEarned: false, qualifiedForWeek: false };
      const week: WeeklyChallengeDoc = currentWeek ?? { weekId, qualifiedDays: [], reward: null, claimed: [] };
      if (!old) tx.set(path, value);
      if (!currentWeek) tx.set(this.weeklyPath(uid, weekId), week);
      return [value, week] as const;
    });
    const contracts = dailyTemplates(await this.dailySeed(uid, cycleId)).map((template) => ({ ...template, progress: current.progress[template.id] ?? 0, completed: (current.progress[template.id] ?? 0) >= 1 }));
    return { cycleId, resetAt: current.resetAt, contracts, completionBonusSeeds: DAILY_COMPLETION_BONUS, completionBonusEarned: current.completionBonusEarned, weekly: { qualifiedDays: weekly.qualifiedDays.length, requiredDays: 4, completed: weekly.reward !== null, rewardItemId: weekly.reward?.itemId ?? null }, pendingRewards: [...current.rewards.filter((reward) => !current.claimed.includes(reward.receiptId)), ...(weekly.reward && !weekly.claimed.includes(weekly.reward.receiptId) ? [weekly.reward] : [])] };
  }
  private async ackDailyRewards(uid: string, receiptIds: string[]): Promise<void> {
    await this.store.transaction(async (tx) => {
      const paths = [...new Set(receiptIds.map((receipt) => {
        const match = /^(daily|weekly):([0-9]{4}-[0-9]{2}-[0-9]{2}):?/.exec(receipt);
        if (!match) return "";
        return match[1] === "daily" ? this.dailyPath(uid, match[2]!) : this.weeklyPath(uid, match[2]!);
      }))].filter(Boolean);
      const docs = await Promise.all(paths.map((path) => tx.get<DailyChallengeDoc>(path)));
      for (let i = 0; i < paths.length; i++) {
        const doc = docs[i] as (DailyChallengeDoc | WeeklyChallengeDoc | null);
        if (!doc) continue;
        const owned = new Set("rewards" in doc ? doc.rewards.map((reward) => reward.receiptId) : doc.reward ? [doc.reward.receiptId] : []);
        const matching = receiptIds.filter((receipt) => owned.has(receipt));
        tx.set(paths[i]!, { ...doc, claimed: [...new Set([...doc.claimed, ...matching])] });
      }
    });
  }
  private async quota(uid: string): Promise<void> {
    // Every online call writes the same counter. Serialize only that transaction
    // per account so parallel refreshes do not consume the SDK's conflict retries.
    const previous = this.quotaQueue.get(uid) ?? Promise.resolve();
    const pending = previous.then(() => this.updateQuota(uid));
    const settled = pending.catch(() => {});
    this.quotaQueue.set(uid, settled);
    try {
      await pending;
    } finally {
      if (this.quotaQueue.get(uid) === settled) this.quotaQueue.delete(uid);
    }
  }
  private async updateQuota(uid: string): Promise<void> {
    await this.store.transaction(async (tx) => {
      const path = `rate_limits/${uid}`,
        old = await tx.get<{ window: number; count: number }>(path),
        window = Math.floor(this.clock.now() / 60000);
      if (old?.window === window && old.count >= 120)
        return fail("resource-exhausted", "Muitos pedidos. Aguarde um minuto.");
      tx.set(path, {
        window,
        count: old?.window === window ? old.count + 1 : 1,
      });
    });
  }
  private async replay<T extends object>(
    tx: Transaction,
    uid: string,
    requestId: string,
    kind: string,
    payload: object,
  ): Promise<T | null> {
    const op = await tx.get<OperationDoc>(operationPath(uid, requestId));
    if (!op) return null;
    if (op.kind !== kind || op.payloadHash !== await sha(canonical(payload)))
      return fail(
        "already-exists",
        "Este pedido já foi usado com outros dados.",
      );
    return structuredClone(op.result) as T;
  }
  private async remember(
    tx: Transaction,
    uid: string,
    requestId: string,
    kind: string,
    payload: object,
    result: object,
  ): Promise<void> {
    tx.set(operationPath(uid, requestId), {
      kind,
      payloadHash: await sha(canonical(payload)),
      result,
      createdAt: this.clock.now(),
    } satisfies OperationDoc);
  }
  private event(
    tx: Transaction,
    eventId: string,
    type: string,
    uid: string,
    entityId: string,
  ): void {
    tx.set(`domain_events/${eventId}`, {
      type,
      actorUid: uid,
      entityId,
      createdAt: this.clock.now(),
      schemaVersion: 1,
    });
  }
  private async bootstrap(uid: string): Promise<{ ready: true }> {
    return this.store.transaction(async (tx) => {
      const old = await tx.get<UserDoc>(userPath(uid));
      const profile = await tx.get<Record<string, unknown>>(profilePath(uid));
      const starterId = `starter-${(await sha(uid)).slice(0, 32)}`;
      const starter = await tx.get<CreatureDoc>(creaturePath(starterId));
      if (old) {
        this.compatibleUser(old);
        return { ready: true };
      }
      if (profile?.["schemaVersion"] === 1) {
        const legacy = this.compatibleUser(profile as unknown as UserDoc);
        const migrated: UserDoc = {
          schemaVersion: 1,
          createdAt: legacy.createdAt,
          inventoryRevision: legacy.inventoryRevision,
          starterGranted: true,
          firstCaptureEncounterId: legacy.firstCaptureEncounterId,
          activeEncounterId: legacy.activeEncounterId,
          activeTradeId: legacy.activeTradeId,
          lastEncounterAt: legacy.lastEncounterAt,
        };
        tx.set(userPath(uid), migrated);
        return { ready: true };
      }
      if (starter)
        return fail(
          "failed-precondition",
          "Conta inconsistente; não será concedida outra criatura.",
        );
      const now = this.clock.now();
      tx.set(userPath(uid), {
        createdAt: now,
        inventoryRevision: 1,
        starterGranted: true,
        schemaVersion: 1,
        firstCaptureEncounterId: null,
        activeEncounterId: null,
        activeTradeId: null,
        lastEncounterAt: 0,
      } satisfies UserDoc);
      tx.set(creaturePath(starterId), {
        ownerId: uid,
        speciesId: "WW001",
        level: 1,
        experience: 0,
        createdAt: now,
        originEncounterId: "starter",
        revision: 1,
        lock: null,
      } satisfies CreatureDoc);
      return { ready: true };
    });
  }
  async housekeeping(uid: string): Promise<void> {
    await this.store.transaction(async (tx) => {
      const u = await tx.get<UserDoc>(userPath(uid));
      if (!u) return;
      this.compatibleUser(u);
      const e = u.activeEncounterId
        ? await tx.get<EncounterDoc>(encounterPath(u.activeEncounterId))
        : null;
      const t = u.activeTradeId
        ? await tx.get<TradeDoc>(offerPath(u.activeTradeId))
        : null;
      const ec = e
        ? await tx.get<CreatureDoc>(creaturePath(e.creatureId))
        : null;
      const tc = t
        ? await tx.get<CreatureDoc>(creaturePath(t.offeredCreatureId))
        : null;
      const now = this.clock.now();
      let changed = false;
      if (e && e.status === "open" && e.expiresAt <= now) {
        tx.set(encounterPath(must(u.activeEncounterId)), {
          ...e,
          status: "expired",
        });
        if (
          ec?.ownerId === uid &&
          ec.lock?.kind === "encounter" &&
          ec.lock.id === u.activeEncounterId
        )
          tx.set(creaturePath(e.creatureId), {
            ...ec,
            lock: null,
            revision: ec.revision + 1,
          });
        u.activeEncounterId = null;
        changed = true;
      }
      if (t && t.status === "open" && t.expiresAt <= now) {
        tx.set(offerPath(must(u.activeTradeId)), {
          ...t,
          status: "expired",
          revision: t.revision + 1,
        });
        if (
          tc?.ownerId === uid &&
          tc.lock?.kind === "trade" &&
          tc.lock.id === u.activeTradeId
        )
          tx.set(creaturePath(t.offeredCreatureId), {
            ...tc,
            lock: null,
            revision: tc.revision + 1,
          });
        u.activeTradeId = null;
        changed = true;
      }
      if (changed)
        tx.set(userPath(uid), {
          ...u,
          inventoryRevision: u.inventoryRevision + 1,
        });
    });
  }
  async maintenance(limit = 100): Promise<number> {
    const owners = await this.store.expiredOwners(this.clock.now(), limit);
    for (const uid of owners) await this.housekeeping(uid);
    return owners.length;
  }
  private async state(uid: string): Promise<OnlineState> {
    await this.housekeeping(uid);
    for (let attempt = 0; attempt < 3; attempt++) {
      const snap = await this.store.transaction(async (tx) => {
        const u = await this.user(tx, uid);
        const e = u.activeEncounterId
          ? await tx.get<EncounterDoc>(encounterPath(u.activeEncounterId))
          : null;
        const t = u.activeTradeId
          ? await tx.get<TradeDoc>(offerPath(u.activeTradeId))
          : null;
        return { u, e, t };
      });
      const page = await this.store.owned(uid, null, 51);
      const current = must(
        await this.store.transaction((tx) => this.user(tx, uid)),
      );
      if (current.inventoryRevision !== snap.u.inventoryRevision) continue;
      const visible = page.slice(0, 50);
      return {
        creatures: visible.map(publicCreature),
        nextCursor: page.length > 50 ? (visible.at(-1)?.id ?? null) : null,
        inventoryRevision: snap.u.inventoryRevision,
        encounter:
          snap.e && snap.u.activeEncounterId
            ? projection(snap.u.activeEncounterId, snap.e)
            : null,
        offer:
          snap.t?.status === "open" && snap.u.activeTradeId
            ? {
                id: snap.u.activeTradeId,
                offeredCreatureId: snap.t.offeredCreatureId,
                offeredSpeciesId: snap.t.offeredSpeciesId,
                offeredLevel: snap.t.offeredLevel ?? 1,
                requestedSpeciesId: snap.t.requestedSpeciesId,
                expiresAt: snap.t.expiresAt,
                revision: snap.t.revision,
              }
            : null,
      };
    }
    return fail("aborted", "O inventário mudou. Atualize para continuar.");
  }
  private async inventory(
    uid: string,
    cursor: string,
    revision: number,
  ): Promise<Responses["listInventory"]> {
    const u = must(await this.store.transaction((tx) => this.user(tx, uid)));
    if (u.inventoryRevision !== revision)
      return fail("aborted", "O inventário mudou; atualize a primeira página.");
    const page = await this.store.owned(uid, cursor, 51),
      visible = page.slice(0, 50);
    const current = must(
      await this.store.transaction((tx) => this.user(tx, uid)),
    );
    if (current.inventoryRevision !== revision)
      return fail("aborted", "O inventário mudou; atualize a primeira página.");
    return {
      creatures: visible.map(publicCreature),
      nextCursor: page.length > 50 ? (visible.at(-1)?.id ?? null) : null,
      inventoryRevision: revision,
    };
  }
  private async begin(
    uid: string,
    requestId: string,
    creatureId: string,
  ): Promise<PublicEncounter> {
    await this.housekeeping(uid);
    const encounterId = crypto.randomUUID(),
      seed = randomSeed() || 1;
    return this.store.transaction(async (tx) => {
      const payload = { creatureId },
        cached = await this.replay<PublicEncounter>(
          tx,
          uid,
          requestId,
          "begin",
          payload,
        );
      if (cached) return cached;
      const u = await this.user(tx, uid),
        c = must(await tx.get<CreatureDoc>(creaturePath(creatureId)));
      const now = this.clock.now();
      if (c.ownerId !== uid)
        return fail("permission-denied", "Esta criatura não pertence a você.");
      if (c.lock || u.activeEncounterId)
        return fail(
          "failed-precondition",
          "Resolva o encontro ou oferta em aberto.",
        );
      if (now - u.lastEncounterAt < 10000)
        return fail(
          "resource-exhausted",
          "Aguarde alguns segundos antes de outro encontro.",
        );
      const state = initialGame(seed);
      state.collection = [
        {
          id: creatureId,
          speciesId: c.speciesId,
          hp: creatureMaxHp(c.speciesId, creatureLevel(c)),
          level: creatureLevel(c),
          experience: c.experience ?? 0,
          provenance: "local",
        },
      ];
      state.activeId = creatureId;
      state.captured = u.firstCaptureEncounterId ? 1 : 0;
      const enemy = u.firstCaptureEncounterId
        ? (SPECIES[Math.floor(randomFromSeed(seed) * 5)]?.id ?? "WW002")
        : "WW002";
      state.scene = "battle";
      state.battle = createBattle(
        encounterId,
        state.collection[0]!,
        enemy,
        !u.firstCaptureEncounterId,
        "wild",
        undefined,
        "classic",
      );
      state.message = `Um ${species(enemy).name} surgiu. Este encontro é salvo na sua conta.`;
      const e: EncounterDoc = {
        uid,
        creatureId,
        rulesVersion: 1,
        status: "open",
        expiresAt: now + 15 * 60000,
        nextSeq: 0,
        state,
      };
      const result = projection(encounterId, e);
      tx.set(encounterPath(encounterId), e);
      tx.set(creaturePath(creatureId), {
        ...c,
        lock: { kind: "encounter", id: encounterId },
        revision: c.revision + 1,
      });
      tx.set(userPath(uid), {
        ...u,
        activeEncounterId: encounterId,
        lastEncounterAt: now,
        inventoryRevision: u.inventoryRevision + 1,
      });
      await this.remember(tx, uid, requestId, "begin", payload, result);
      this.event(
        tx,
        `${encounterId}-started`,
        "encounter_started",
        uid,
        encounterId,
      );
      return result;
    });
  }
  private async action(
    uid: string,
    requestId: string,
    encounterId: string,
    seq: number,
    command: import("../online.js").BattleCommand,
  ): Promise<PublicEncounter> {
    await this.housekeeping(uid);
    return this.store.transaction(async (tx) => {
      const payload = { encounterId, seq, command },
        cached = await this.replay<PublicEncounter>(
          tx,
          uid,
          requestId,
          "action",
          payload,
        );
      if (cached) return cached;
      const u = await this.user(tx, uid),
        e = must(await tx.get<EncounterDoc>(encounterPath(encounterId))),
        c = must(await tx.get<CreatureDoc>(creaturePath(e.creatureId)));
      const captureId = `capture-${encounterId}`,
        existing = await tx.get<CreatureDoc>(creaturePath(captureId));
      if (e.uid !== uid)
        return fail("permission-denied", "Encontro indisponível.");
      if (
        e.status !== "open" ||
        e.expiresAt <= this.clock.now() ||
        u.activeEncounterId !== encounterId
      )
        return fail(
          "failed-precondition",
          "Este encontro terminou ou expirou.",
        );
      if (e.rulesVersion !== 1 || seq !== e.nextSeq)
        return fail(
          "aborted",
          "Sequência desatualizada; sincronize o encontro.",
        );
      if (
        c.ownerId !== uid ||
        c.lock?.kind !== "encounter" ||
        c.lock.id !== encounterId
      )
        return fail(
          "failed-precondition",
          "Criatura não está reservada para este encontro.",
        );
      const next = reduceGame(e.state, command);
      if (next === e.state)
        return fail("failed-precondition", "Essa ação não é válida agora.");
      const ended = next.scene === "result";
      const { id: cycleId, resetAt } = this.localCycle(this.clock.now());
      const contractTypes: string[] = [];
      if (ended) contractTypes.push("resolve-encounter");
      if (command.type === "move" || (e.state.battle?.mode === "classic" && command.type === "skill")) contractTypes.push("move-in-battle");
      if (command.type === "defend") contractTypes.push("defend-in-battle");
      if (command.type === "basic") contractTypes.push("basic-attack");
      if (contractTypes.length) await this.advanceDaily(tx, uid, cycleId, resetAt, contractTypes);
      const updated: EncounterDoc = {
        ...e,
        state: next,
        nextSeq: seq + 1,
        status: ended ? "resolved" : "open",
      };
      const result = projection(encounterId, updated);
      if (ended) {
        if (next.battle?.result === "capture") {
          if (existing)
            return fail("already-exists", "A captura já foi concedida.");
          tx.set(creaturePath(captureId), {
            ownerId: uid,
            speciesId: next.battle.enemy.speciesId,
            level: creatureLevel(next.battle.enemy),
            experience: 0,
            createdAt: this.clock.now(),
            originEncounterId: encounterId,
            revision: 1,
            lock: null,
          } satisfies CreatureDoc);
          this.event(
            tx,
            `${encounterId}-capture`,
            u.firstCaptureEncounterId ? "capture" : "first_capture",
            uid,
            encounterId,
          );
        }
        tx.set(creaturePath(e.creatureId), {
          ...c,
          level: creatureLevel(next.collection.find((creature) => creature.id === e.creatureId) ?? c),
          experience: next.collection.find((creature) => creature.id === e.creatureId)?.experience ?? c.experience ?? 0,
          lock: null,
          revision: c.revision + 1,
        });
        tx.set(userPath(uid), {
          ...u,
          activeEncounterId: null,
          inventoryRevision: u.inventoryRevision + 1,
          firstCaptureEncounterId:
            u.firstCaptureEncounterId ??
            (next.battle?.result === "capture" ? encounterId : null),
        });
        this.event(
          tx,
          `${encounterId}-finished`,
          "battle_finished",
          uid,
          encounterId,
        );
      }
      tx.set(encounterPath(encounterId), updated);
      await this.remember(tx, uid, requestId, "action", payload, result);
      return result;
    });
  }
  private async cancelEncounter(
    uid: string,
    requestId: string,
    encounterId: string,
  ): Promise<{ cancelled: true }> {
    return this.store.transaction(async (tx) => {
      const payload = { encounterId },
        cached = await this.replay<{ cancelled: true }>(
          tx,
          uid,
          requestId,
          "cancelEncounter",
          payload,
        );
      if (cached) return cached;
      const u = await this.user(tx, uid),
        e = must(await tx.get<EncounterDoc>(encounterPath(encounterId))),
        c = must(await tx.get<CreatureDoc>(creaturePath(e.creatureId)));
      if (e.uid !== uid)
        return fail("permission-denied", "Encontro indisponível.");
      if (e.status === "open") {
        tx.set(encounterPath(encounterId), { ...e, status: "expired" });
        if (
          c.ownerId === uid &&
          c.lock?.kind === "encounter" &&
          c.lock.id === encounterId
        )
          tx.set(creaturePath(e.creatureId), {
            ...c,
            lock: null,
            revision: c.revision + 1,
          });
        if (u.activeEncounterId === encounterId)
          tx.set(userPath(uid), {
            ...u,
            activeEncounterId: null,
            inventoryRevision: u.inventoryRevision + 1,
          });
      }
      const result = { cancelled: true } as const;
      await this.remember(tx, uid, requestId, "cancelEncounter", payload, result);
      return result;
    });
  }
  private async createTrade(
    uid: string,
    requestId: string,
    creatureId: string,
    requestedSpeciesId: SpeciesId,
  ): Promise<Responses["createTrade"]> {
    await this.housekeeping(uid);
    const tradeId = crypto.randomUUID(),
      secret = randomToken();
    const response = await this.store.transaction(async (tx) => {
      const payload = { creatureId, requestedSpeciesId },
        cached = await this.replay<{ tradeId: string; expiresAt: number }>(
          tx,
          uid,
          requestId,
          "createTrade",
          payload,
        );
      if (cached) return { ...cached, fresh: false };
      const u = await this.user(tx, uid),
        c = must(await tx.get<CreatureDoc>(creaturePath(creatureId)));
      if (c.ownerId !== uid)
        return fail(
          "permission-denied",
          "Você só pode ofertar suas criaturas da conta.",
        );
      if (!c.originEncounterId)
        return fail("failed-precondition", "Criatura sem origem registrada.");
      if (c.lock || u.activeTradeId)
        return fail(
          "failed-precondition",
          "Cancele a oferta ou conclua o encontro antes de ofertar.",
        );
      const world = await tx.get<{ activeCreatureId: string | null }>(`users/${uid}/expedition/status`);
      if (world?.activeCreatureId === creatureId) return fail("failed-precondition", "Conclua a batalha da sua expedição antes de oferecer este Eco.");
      const expiresAt = this.clock.now() + 86400000;
      const offer: TradeDoc = {
        creatorUid: uid,
        offeredCreatureId: creatureId,
        offeredSpeciesId: c.speciesId,
        offeredLevel: creatureLevel(c),
        requestedSpeciesId,
        status: "open",
        expiresAt,
        tokenHash: await sha(secret),
        revision: 1,
        acceptedBy: null,
        receivedCreatureId: null,
        completedAt: null,
      };
      const result = { tradeId, expiresAt };
      tx.set(offerPath(tradeId), offer);
      tx.set(creaturePath(creatureId), {
        ...c,
        lock: { kind: "trade", id: tradeId },
        revision: c.revision + 1,
      });
      tx.set(userPath(uid), {
        ...u,
        activeTradeId: tradeId,
        inventoryRevision: u.inventoryRevision + 1,
      });
      await this.remember(tx, uid, requestId, "createTrade", payload, result);
      this.event(tx, `${tradeId}-created`, "trade_link_created", uid, tradeId);
      return { ...result, fresh: true };
    });
    return {
      tradeId: response.tradeId,
      expiresAt: response.expiresAt,
      ...(response.fresh ? { token: secret } : {}),
    };
  }
  private async rotate(
    uid: string,
    tradeId: string,
    revision: number,
  ): Promise<Responses["rotateTradeToken"]> {
    await this.housekeeping(uid);
    const secret = randomToken();
    return this.store.transaction(async (tx) => {
      const t = must(await tx.get<TradeDoc>(offerPath(tradeId)));
      if (t.creatorUid !== uid)
        return fail(
          "permission-denied",
          "Só o remetente pode renovar o convite.",
        );
      if (t.status !== "open" || t.expiresAt <= this.clock.now())
        return fail("failed-precondition", "Oferta encerrada.");
      if (t.revision !== revision)
        return fail(
          "aborted",
          "O convite mudou. Atualize antes de gerar outro.",
        );
      tx.set(offerPath(tradeId), {
        ...t,
        tokenHash: await sha(secret),
        revision: t.revision + 1,
      });
      return { tradeId, token: secret, revision: t.revision + 1 };
    });
  }
  private async preview(
    tradeId: string,
    secret: string,
  ): Promise<TradePreview> {
    let t = must(
      await this.store.transaction((tx) =>
        tx.get<TradeDoc>(offerPath(tradeId)),
      ),
    );
    if (!await correctToken(secret, t))
      return fail("not-found", "Convite inválido ou substituído.");
    if (t.status === "open" && t.expiresAt <= this.clock.now()) {
      await this.expireTrade(tradeId);
      t = must(await this.store.transaction((tx) => tx.get<TradeDoc>(offerPath(tradeId))));
    }
    return {
      id: tradeId,
      offeredSpeciesId: t.offeredSpeciesId,
      offeredLevel: t.offeredLevel ?? 1,
      requestedSpeciesId: t.requestedSpeciesId,
      expiresAt: t.expiresAt,
      status: t.status === "open" && t.expiresAt <= this.clock.now() ? "expired" : t.status,
    };
  }
  private async expireTrade(tradeId: string): Promise<void> {
    await this.store.transaction(async (tx) => {
      const t = must(await tx.get<TradeDoc>(offerPath(tradeId)));
      if (t.status !== "open" || t.expiresAt > this.clock.now()) return;
      const c = must(await tx.get<CreatureDoc>(creaturePath(t.offeredCreatureId)));
      const u = await this.user(tx, t.creatorUid);
      tx.set(offerPath(tradeId), { ...t, status: "expired", revision: t.revision + 1 });
      if (c.ownerId === t.creatorUid && c.lock?.kind === "trade" && c.lock.id === tradeId)
        tx.set(creaturePath(t.offeredCreatureId), { ...c, lock: null, revision: c.revision + 1 });
      if (u.activeTradeId === tradeId)
        tx.set(userPath(t.creatorUid), { ...u, activeTradeId: null, inventoryRevision: u.inventoryRevision + 1 });
    });
  }
  private async accept(
    uid: string,
    requestId: string,
    tradeId: string,
    secret: string,
    creatureId: string,
  ): Promise<Responses["acceptTrade"]> {
    await this.housekeeping(uid);
    return this.store.transaction(async (tx) => {
      const payload = { tradeId, tokenHash: await sha(secret), creatureId },
        cached = await this.replay<Responses["acceptTrade"]>(
          tx,
          uid,
          requestId,
          "acceptTrade",
          payload,
        );
      if (cached) return cached;
      const t = must(await tx.get<TradeDoc>(offerPath(tradeId))),
        offered = must(
          await tx.get<CreatureDoc>(creaturePath(t.offeredCreatureId)),
        ),
        received = must(await tx.get<CreatureDoc>(creaturePath(creatureId))),
        creator = await this.user(tx, t.creatorUid),
        recipient = await this.user(tx, uid);
      if (!await correctToken(secret, t))
        return fail("not-found", "Convite inválido ou substituído.");
      if (t.creatorUid === uid)
        return fail("failed-precondition", "Troque com outro Guardião.");
      if (t.status !== "open" || t.expiresAt <= this.clock.now())
        return fail("failed-precondition", "Oferta encerrada ou expirada.");
      if (
        offered.ownerId !== t.creatorUid ||
        offered.lock?.kind !== "trade" ||
        offered.lock.id !== tradeId ||
        creator.activeTradeId !== tradeId
      )
        return fail("failed-precondition", "A oferta já não está disponível.");
      if (received.ownerId !== uid)
        return fail(
          "permission-denied",
          "A criatura oferecida não pertence a você.",
        );
      if (
        received.lock ||
        received.speciesId !== t.requestedSpeciesId ||
        !received.originEncounterId
      )
        return fail(
          "failed-precondition",
          "Escolha uma criatura da conta, livre e da espécie solicitada.",
        );
      const world = await tx.get<{ activeCreatureId: string | null }>(`users/${uid}/expedition/status`);
      if (world?.activeCreatureId === creatureId) return fail("failed-precondition", "Conclua a batalha antes de trocar este Eco.");
      const result = { tradeId, receivedCreatureId: t.offeredCreatureId };
      tx.set(creaturePath(t.offeredCreatureId), {
        ...offered,
        ownerId: uid,
        transferTradeId: tradeId,
        lock: null,
        revision: offered.revision + 1,
      });
      tx.set(creaturePath(creatureId), {
        ...received,
        ownerId: t.creatorUid,
        transferTradeId: tradeId,
        lock: null,
        revision: received.revision + 1,
      });
      tx.set(userPath(t.creatorUid), {
        ...creator,
        activeTradeId: null,
        inventoryRevision: creator.inventoryRevision + 1,
      });
      tx.set(userPath(uid), {
        ...recipient,
        inventoryRevision: recipient.inventoryRevision + 1,
      });
      tx.set(offerPath(tradeId), {
        ...t,
        status: "completed",
        acceptedBy: uid,
        receivedCreatureId: creatureId,
        completedAt: this.clock.now(),
        tokenProof: secret,
        revision: t.revision + 1,
      });
      await this.remember(tx, uid, requestId, "acceptTrade", payload, result);
      this.event(tx, `${tradeId}-completed`, "trade_completed", uid, tradeId);
      return result;
    });
  }
  private async cancelTrade(
    uid: string,
    requestId: string,
    tradeId: string,
  ): Promise<{ cancelled: true }> {
    await this.housekeeping(uid);
    return this.store.transaction(async (tx) => {
      const payload = { tradeId },
        cached = await this.replay<{ cancelled: true }>(
          tx,
          uid,
          requestId,
          "cancelTrade",
          payload,
        );
      if (cached) return cached;
      const t = must(await tx.get<TradeDoc>(offerPath(tradeId))),
        c = must(await tx.get<CreatureDoc>(creaturePath(t.offeredCreatureId))),
        u = await this.user(tx, uid);
      if (t.creatorUid !== uid)
        return fail("permission-denied", "Só o remetente pode cancelar.");
      if (t.status === "completed")
        return fail("failed-precondition", "Troca já concluída.");
      if (t.status === "open") {
        tx.set(offerPath(tradeId), {
          ...t,
          status: "cancelled",
          revision: t.revision + 1,
        });
        if (
          c.ownerId === uid &&
          c.lock?.kind === "trade" &&
          c.lock.id === tradeId
        )
          tx.set(creaturePath(t.offeredCreatureId), {
            ...c,
            lock: null,
            revision: c.revision + 1,
          });
        if (u.activeTradeId === tradeId)
          tx.set(userPath(uid), {
            ...u,
            activeTradeId: null,
            inventoryRevision: u.inventoryRevision + 1,
          });
      }
      const result = { cancelled: true } as const;
      await this.remember(tx, uid, requestId, "cancelTrade", payload, result);
      return result;
    });
  }
}
function randomFromSeed(seed: number): number {
  return (seed >>> 0) / 4294967296;
}
