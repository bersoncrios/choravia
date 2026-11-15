import test from "node:test";
import assert from "node:assert/strict";
import { GameService } from "../functions/src/service.js";
import { MemoryStore } from "../functions/src/memory-store.js";
import { initialGame, reduceGame, createBattle, type Creature } from "../src/app/domain/game.js";
import { reconcileExpedition, dailyActionTypes, DailyActionQueue, mergePreviousEncounter } from "../src/app/application/account-expedition.js";
import { isGame } from "../src/app/domain/save-validation.js";
import { validateResponse } from "../src/app/domain/online-validation.js";
import type { CreatureDoc } from "../functions/src/model.js";
import type { RemoteMethod, Responses } from "../src/app/domain/online.js";
function fixture() {
  const store = new MemoryStore();
  const service = new GameService(store, { now: () => Date.UTC(2026, 10, 13, 15) });
  const call = async <K extends RemoteMethod>(uid: string, method: K, input: unknown): Promise<Responses[K]> => validateResponse(method, await service.execute(uid, method, input));
  return { store, call };
}
const source = (id = "starter", speciesId: Creature["speciesId"] = "WW003"): Creature => ({ id, speciesId, level: 4, experience: 12, hp: 15, provenance: "local", cosmeticId: "eco-moss-glyph" });
test("expedition sync paginates the full inventory within Firestore query limits", async () => {
  const f = fixture();
  await f.call("alice", "bootstrap", {});
  const record: CreatureDoc = { ownerId: "alice", speciesId: "WW003", level: 4, experience: 12, createdAt: 1, originEncounterId: "test", revision: 1, lock: null };
  await f.store.transaction(async tx => {
    for (let i = 0; i < 1001; i++) tx.set(`creatures/eco-${String(i).padStart(4, "0")}`, record);
    tx.set("creatures/foreign-eco", { ...record, ownerId: "bob" });
  });
  const queries: { cursor: string | null; size: number }[] = [];
  const owned = f.store.owned.bind(f.store);
  f.store.owned = async (uid, cursor, size) => {
    assert.ok(size <= 10000, "Firestore rejects larger query limits");
    queries.push({ cursor, size });
    return owned(uid, cursor, size);
  };
  const result = await f.call("alice", "syncExpedition", {
    creatures: [
      { ...source("eco-0000"), provenance: "validated" },
      { ...source("eco-1000"), provenance: "validated" },
      { ...source("foreign-eco"), provenance: "validated" },
    ],
  });
  assert.deepEqual(result.mapping, [
    { sourceId: "eco-0000", id: "eco-0000" },
    { sourceId: "eco-1000", id: "eco-1000" },
    { sourceId: "foreign-eco", id: null },
  ]);
  assert.deepEqual(queries, [{ cursor: null, size: 1000 }, { cursor: "eco-0999", size: 1000 }]);
});
test("account import preserves chosen starter, progress and repeated imports without duplicates", async () => {
  const f = fixture(); await f.call("alice", "bootstrap", {});
  const original = (await f.call("alice", "getState", {})).creatures[0]!;
  const migration = await f.call("alice", "syncExpedition", { creatures: [source()] });
  assert.equal(migration.mapping[0]!.id, original.id);
  const inventory = (await f.call("alice", "getState", {})).creatures;
  assert.equal(inventory.length, 1);
  assert.equal(inventory[0]!.speciesId, "WW003");
  assert.equal(inventory[0]!.level, 4);
  assert.equal(inventory[0]!.experience, 12);
  assert.deepEqual(await f.call("alice", "syncExpedition", { creatures: [source()] }), migration);
  assert.equal((await f.call("alice", "getState", {})).creatures.length, 1);
});
test("imported captures are not resurrected after transfer, and other accounts stay isolated", async () => {
  const f = fixture(); await f.call("alice", "bootstrap", {}); await f.call("bob", "bootstrap", {});
  const { mapping } = await f.call("alice", "syncExpedition", { creatures: [source("capture-local-1", "WW002")] });
  const id = mapping[0]!.id!;
  const record = f.store.dump<CreatureDoc>(`creatures/${id}`)!;
  await f.store.seed(`creatures/${id}`, { ...record, ownerId: "bob", revision: record.revision + 1 });
  const again = await f.call("alice", "syncExpedition", { creatures: [source("capture-local-1", "WW002")] });
  assert.equal(again.mapping[0]!.id, null);
  const foreign = await f.call("alice", "syncExpedition", { creatures: [{ ...source(), id, provenance: "validated" }] });
  assert.equal(foreign.mapping[0]!.id, null);
  assert.equal(f.store.dump<CreatureDoc>(`creatures/${id}`)!.ownerId, "bob");
});
test("migration keeps the existing progressed online starter and refuses progress downgrade", async () => {
  const f = fixture(); await f.call("alice", "bootstrap", {});
  const original = (await f.call("alice", "getState", {})).creatures[0]!;
  const path = `creatures/${original.id}`;
  await f.store.seed(path, { ...f.store.dump<CreatureDoc>(path)!, level: 8, experience: 20 });
  const migration = await f.call("alice", "syncExpedition", { creatures: [source()] });
  assert.notEqual(migration.mapping[0]!.id, original.id);
  assert.equal((await f.call("alice", "getState", {})).creatures.length, 2);
  await f.call("alice", "syncExpedition", { creatures: [{ ...source(), id: original.id, speciesId: "WW001", provenance: "validated" }] });
  assert.equal(f.store.dump<CreatureDoc>(path)!.level, 8);
});
test("reconciliation preserves world, damaged PV, cosmetics and active battle across ID migration", () => {
  const g = initialGame(1); g.collection = [source()]; g.activeId = "starter";
  g.avatar = { skin: "umber", hair: "braids", hairColor: "silver", outfit: "river", accessory: "satchel" };
  g.ownedItems = ["eco-moss-glyph"];
  g.seeds = 301; g.region = "old-grove"; g.ancientMarkerHeard = true;
  g.scene = "battle"; g.battle = createBattle("local-1", g.collection[0]!, "WW002", false);
  const before = JSON.stringify(g);
  const merged = reconcileExpedition(g, [{ id: "account-eco-123", speciesId: "WW003", level: 4, experience: 12, lock: null, revision: 1 }], [{ sourceId: "starter", id: "account-eco-123" }]);
  assert.equal(isGame(merged), true);
  assert.equal(merged.activeId, "account-eco-123");
  assert.equal(merged.collection[0]!.hp, 15);
  assert.equal(merged.collection[0]!.cosmeticId, "eco-moss-glyph");
  assert.deepEqual(merged.battle, g.battle); assert.deepEqual(merged.avatar, g.avatar);
  assert.equal(merged.seeds, 301); assert.equal(merged.region, "old-grove"); assert.equal(merged.ancientMarkerHeard, true);
  assert.equal(JSON.stringify(g), before);
});
test("single expedition records daily contracts idempotently and rejects past cycles", async () => {
  const f = fixture(); await f.call("alice", "bootstrap", {});
  const board = await f.call("alice", "getDailyBoard", {});
  const input = { cycleId: board.cycleId, types: ["resolve-encounter", "move-in-battle", "defend-in-battle", "basic-attack"] };
  await f.call("alice", "recordExpeditionDaily", { ...input, types: [...input.types, "visit-region"] });
  const first = await f.call("alice", "getDailyBoard", {});
  await f.call("alice", "recordExpeditionDaily", input);
  assert.deepEqual(await f.call("alice", "getDailyBoard", {}), first);
  assert.ok(first.contracts.every(c => c.completed));
  assert.equal(first.weekly.qualifiedDays, 1); assert.equal(first.completionBonusEarned, true);
  await assert.rejects(f.call("alice", "recordExpeditionDaily", { ...input, cycleId: "2026-11-12" }));
});
test("daily queue survives reload, isolates accounts, and late acknowledgements preserve a new day", () => {
  const map = new Map<string, string>();
  const storage = { getItem: (key: string) => map.get(key) ?? null, setItem: (key: string, value: string) => { map.set(key, value); }, removeItem: (key: string) => { map.delete(key); } };
  const queue = new DailyActionQueue(storage);
  queue.add("alice", ["basic-attack"], "2026-11-13");
  assert.deepEqual(new DailyActionQueue(storage).read("alice", "2026-11-13"), ["basic-attack"]);
  assert.deepEqual(queue.read("bob", "2026-11-13"), []);
  queue.add("alice", ["defend-in-battle"], "2026-11-14");
  queue.acknowledge("alice", ["basic-attack"], "2026-11-13");
  assert.deepEqual(queue.read("alice", "2026-11-14"), ["defend-in-battle"]);
});
test("only accepted combat actions contribute to the unified daily queue", () => {
  const g = initialGame(1); g.scene = "battle"; g.battle = createBattle("local-1", g.collection[0]!, "WW002", false, "wild", undefined, "classic");
  const command = { type: "basic", target: g.battle.enemy.pos } as const;
  assert.deepEqual(dailyActionTypes(g, reduceGame(g, command), command), ["basic-attack"]);
  const invalid = { type: "move", position: { x: 4, y: 4 } } as const;
  assert.deepEqual(dailyActionTypes(g, reduceGame(g, invalid), invalid), []);
});

test("collection reconciliation waits for reward persistence and preserves the latest balance", async () => {
  const { Session, MemorySave } = await import("../src/app/application/session.js");
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  class Repository extends MemorySave { override async save(): Promise<void> { await gate; } }
  const session = new Session(new Repository(), () => {});
  await session.load();
  const reward = session.dispatch({ type: "applyDailyReward", receiptId: "daily:2026-11-13:basic-attack", seeds: 8 });
  const reconcile = session.reconcile(current => ({ ...current, message: "Coleção sincronizada" }));
  release(); await reward; await reconcile;
  assert.equal(session.state.seeds, 128);
  assert.deepEqual(session.state.dailyRewardReceipts, ["daily:2026-11-13:basic-attack"]);
  assert.equal(session.state.message, "Coleção sincronizada");
});

test("an old online encounter never overwrites the world's position, collection or pending battle", () => {
  const world = initialGame(1); world.region = "old-grove"; world.seeds = 420;
  world.scene = "battle"; world.battle = createBattle("local-pending", world.collection[0]!, "WW002", false);
  const online = initialGame(2);
  online.collection = [{ id: "online-eco", speciesId: "WW003", level: 2, experience: 10, hp: 39, provenance: "validated" }];
  online.activeId = "online-eco";
  const result = { ...online, battle: createBattle("remote-pending", online.collection[0]!, "WW002", false) };
  result.battle.ally.hp = 7;
  const merged = mergePreviousEncounter(world, online, result);
  assert.equal(merged.region, "old-grove"); assert.equal(merged.seeds, 420);
  assert.deepEqual(merged.battle, world.battle); assert.equal(merged.activeId, world.activeId);
  assert.equal(merged.collection.find(c => c.id === "online-eco")!.hp, 7);
  assert.equal(isGame(merged), true);
});
