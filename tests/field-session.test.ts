import test from "node:test";
import assert from "node:assert/strict";
import { FieldSession } from "../src/app/application/field-session.js";
import { initialField, reduceField, type FieldGateway, type FieldAction, type FieldResult } from "../src/app/domain/field.js";
import { fieldPoints } from "../src/app/domain/field-world.js";
import { initialGame, layoutIn, mapTile, distance } from "../src/app/domain/game.js";
import { isGame } from "../src/app/domain/save-validation.js";

function storage() {
  const values = new Map<string, string>();
  return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); }, removeItem: (key: string) => { values.delete(key); } };
}
test("uncertain crafting commit survives reload and replays its receipt without crafting twice", async () => {
  const disk = storage();
  let state = reduceField(reduceField(initialField(), { type: "gather", node: "herb" }, 3), { type: "gather", node: "sap" }, 3);
  const receipts = new Set<string>(); let fail = true;
  const gateway: FieldGateway = {
    load: async () => ({state, now: 3 * 86400000}),
    execute: async (action, id = "") => {
      if (!receipts.has(id)) { state = reduceField(state, action, 3); receipts.add(id); }
      if (fail) { fail = false; throw new Error("Confirmação perdida"); }
      return { state, now: 3 * 86400000 };
    },
  };
  const first = new FieldSession(disk, () => {}, () => "craft-request-01");
  first.bind("alice", gateway); await first.refresh(); await first.perform({type: "craft"});
  assert.match(first.error, /Confirmação perdida/); assert.equal(state.inventory.lantern, 1);
  const restored = new FieldSession(disk, () => {});
  restored.bind("alice", gateway); await restored.refresh();
  assert.equal(restored.error, ""); assert.equal(restored.state!.inventory.lantern, 1);
  assert.equal(disk.getItem("choravia-field-pending:alice"), null);
});
test("late field responses cannot populate the next account", async () => {
  let resolve!: (value: FieldResult) => void;
  const session = new FieldSession(storage(), () => {});
  session.bind("alice", {load: () => new Promise(r => { resolve = r; }), execute: async () => { throw new Error("unused"); }});
  const loading = session.refresh();
  session.bind("bob", null); resolve({state: initialField(), now: 20}); await loading;
  assert.equal(session.state, null); assert.equal(session.now, null); assert.equal(session.busy, false);
});
test("a failed local pending write never invokes a remote mutation", async () => {
  let calls = 0;
  const session = new FieldSession({getItem: () => null, setItem: () => { throw new Error("Disco cheio"); }, removeItem: () => {}}, () => {});
  session.bind("alice", {load: async () => ({state: initialField(), now: 1}), execute: async (_action: FieldAction) => { calls++; return {state: initialField(), now: 1}; }});
  await session.refresh(); await session.perform({type: "treasure"});
  assert.equal(calls, 0); assert.match(session.error, /Disco cheio/);
});
test("network timeout releases the interface and retains the operation for a safe retry", async () => {
  const disk = storage();
  const session = new FieldSession(disk, () => {}, () => "network-request-01", 20);
  session.bind("alice", { load: async () => ({state: initialField(), now: 1}), execute: () => new Promise(() => {}) });
  await session.refresh(); await session.perform({type: "treasure"});
  assert.equal(session.busy, false); assert.match(session.error, /não confirmou/);
  assert.ok(disk.getItem("choravia-field-pending:alice"));
});
test("malformed pending storage is discarded before recovering the confirmed account stock", async () => {
  for (const raw of ["{invalid", JSON.stringify({id: "invalid", action: {type: "craft"}}), JSON.stringify({id: "field-request-01", action: {type: "gather", node: "unknown"}})]) {
    const disk = storage(); disk.setItem("choravia-field-pending:alice", raw);
    let calls = 0;
    const session = new FieldSession(disk, () => {});
    session.bind("alice", {load: async () => ({state: initialField(), now: 1}), execute: async () => { calls++; throw new Error("Must not run"); }});
    await session.refresh();
    assert.equal(session.error, ""); assert.equal(calls, 0); assert.equal(disk.getItem("choravia-field-pending:alice"), null);
    assert.ok(session.state); assert.match(session.message, /inválido/);
  }
});
test("field points preserve legacy layouts and remain reachable without overlapping objects", () => {
  for (let seed = 1; seed <= 100; seed++) {
    const game = initialGame(seed), original = JSON.stringify(game), layout = layoutIn(game, "clearing");
    const points = fieldPoints(game, 10), tomorrow = fieldPoints(game, 11);
    assert.equal(points.length, 6);
    assert.equal(new Set(points.map(p => `${p.x}:${p.y}`)).size, 6);
    for (const point of points) {
      assert.ok(["ground", "path"].includes(mapTile(point.x, point.y)));
      assert.ok(![...layout.pots, ...layout.npcs].some(p => distance(p, point) === 0));
    }
    assert.deepEqual(points.filter(p => p.id !== "cache"), tomorrow.filter(p => p.id !== "cache"));
    assert.notDeepEqual(points.find(p => p.id === "cache"), tomorrow.find(p => p.id === "cache"));
    assert.equal(JSON.stringify(game), original); assert.ok(isGame(game));
  }
});
