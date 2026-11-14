import test from "node:test";
import assert from "node:assert/strict";
import {
  Game,
  SPECIES,
  initialGame,
  createBattle,
  reduceGame,
  species,
  damage,
  elementalMultiplier,
  nextRandom,
  waterComponent,
  captureChance,
  canCapture,
  enemyPlan,
} from "../src/app/domain/game.js";
import { isGame } from "../src/app/adapters/save.js";
import { Session } from "../src/app/application/session.js";
function encounter(enemy: (typeof SPECIES)[number]["id"] = "WW002"): Game {
  const g = initialGame();
  g.encountered = 1;
  g.scene = "battle";
  g.battle = createBattle("local-1", g.collection[0]!, enemy, false);
  g.battle.ally.pos = { x: 2, y: 2 };
  g.battle.enemy.pos = { x: 2, y: 1 };
  g.battle.plan = {
    destination: { x: 2, y: 1 },
    target: { x: 0, y: 0 },
    action: "defend",
  };
  return g;
}
test("PRNG golden vectors and nonzero state", () => {
  let s = 1;
  const vectors = [270369, 67634689, 2647435461, 307599695, 2398689233];
  for (const expected of vectors) {
    const r = nextRandom(s);
    assert.equal(r.seed, expected);
    assert.ok(r.value >= 0 && r.value < 1);
    s = r.seed;
  }
});
test("all 25 elemental pairs: one strength and one resistance per element", () => {
  for (const a of SPECIES) {
    const row = SPECIES.map((d) => elementalMultiplier(a.element, d.element));
    assert.equal(row.filter((x) => x === 1.5).length, 1);
    assert.equal(row.filter((x) => x === 0.75).length, 1);
    assert.equal(row.filter((x) => x === 1).length, 3);
    assert.equal(elementalMultiplier("neutral", a.element), 1);
  }
});
test("damage example, defense and minimum", () => {
  assert.equal(damage("WW001", "WW002", 6, "fire"), 12);
  assert.equal(damage("WW001", "WW002", 6, "fire", true), 6);
  assert.equal(damage("WW005", "WW005", -100, "neutral"), 1);
});
test("illegal commands are referentially rejected without RNG, turn or revision changes", () => {
  const g = encounter();
  const copy = structuredClone(g);
  assert.equal(reduceGame(g, { type: "move", position: { x: 9, y: 9 } }), g);
  assert.equal(reduceGame(g, { type: "basic", target: { x: 2, y: 3 } }), g);
  assert.deepEqual(g, copy);
});
test("only one cardinal move before action; occupied and diagonal destinations blocked", () => {
  const g = encounter();
  assert.equal(reduceGame(g, { type: "move", position: { x: 2, y: 1 } }), g);
  assert.equal(reduceGame(g, { type: "move", position: { x: 3, y: 3 } }), g);
  const moved = reduceGame(g, { type: "move", position: { x: 1, y: 2 } });
  assert.notEqual(moved, g);
  assert.equal(
    reduceGame(moved, { type: "move", position: { x: 1, y: 3 } }),
    moved,
  );
  assert.equal(g.battle!.moved, false);
});
test("enemy intent remains fixed after movement", () => {
  const g = encounter();
  const plan = structuredClone(g.battle!.plan);
  const moved = reduceGame(g, { type: "move", position: { x: 1, y: 2 } });
  assert.deepEqual(moved.battle!.plan, plan);
});
test("an action resolves enemy response and begins next turn with movement available", () => {
  const g = encounter();
  g.battle!.moved = true;
  const after = reduceGame(g, { type: "basic", target: { x: 2, y: 1 } });
  assert.equal(after.battle!.round, 2);
  assert.equal(after.battle!.moved, false);
  assert.ok(after.battle!.enemy.hp < 34);
  assert.equal(g.battle!.enemy.hp, species("WW002").hp);
});
test("guard persists through enemy response and clears at next own turn", () => {
  const g = encounter();
  g.battle!.plan = {
    destination: { x: 2, y: 1 },
    target: { x: 2, y: 2 },
    action: "basic",
  };
  const after = reduceGame(g, { type: "defend" });
  const dealt = damage("WW002", "WW001", 8, "neutral", true);
  assert.equal(after.battle!.ally.hp, g.battle!.ally.hp - dealt);
  assert.equal(after.battle!.ally.guarding, false);
  assert.equal(after.battle!.enemy.guarding, false);
});
test("fire lasts four completed turns and becomes ground without propagation", () => {
  let g = encounter();
  g = reduceGame(g, { type: "skill", target: { x: 1, y: 2 } });
  assert.equal(g.battle!.cells[11]!.terrain, "fire");
  assert.equal(g.battle!.cells[11]!.remaining, 2);
  assert.equal(g.battle!.cells[6]!.terrain, "grass");
  g = reduceGame(g, { type: "defend" });
  assert.equal(g.battle!.cells[11]!.terrain, "ground");
  assert.equal(g.battle!.cells[11]!.remaining, 0);
});
test("fire applies fixed damage once to ending actor and ignores guard", () => {
  const g = encounter();
  g.battle!.cells[12] = { terrain: "fire", remaining: 4 };
  const after = reduceGame(g, { type: "defend" });
  assert.equal(after.battle!.ally.hp, g.battle!.ally.hp - 3);
});
test("water component excludes diagonal water", () => {
  const g = encounter();
  g.battle!.cells[24] = { terrain: "water", remaining: 0 };
  assert.deepEqual(
    waterComponent(g.battle!.cells, { x: 3, y: 2 })
      .map((p) => p.y * 5 + p.x)
      .sort((a, b) => a - b),
    [13, 14, 19, 24],
  );
  g.battle!.cells[19] = { terrain: "ground", remaining: 0 };
  assert.deepEqual(
    waterComponent(g.battle!.cells, { x: 3, y: 2 })
      .map((p) => p.y * 5 + p.x)
      .sort((a, b) => a - b),
    [13, 14],
  );
});
test("electric conduction hits both occupants once; simultaneous knockout is defeat", () => {
  const g = encounter("WW003");
  g.collection[0]!.speciesId = "WW004";
  g.collection[0]!.hp = 28;
  const b = g.battle!;
  b.ally.speciesId = "WW004";
  b.ally.pos = { x: 3, y: 2 };
  b.enemy.pos = { x: 4, y: 2 };
  b.ally.hp = 1;
  b.enemy.hp = 1;
  const after = reduceGame(g, { type: "skill", target: { x: 4, y: 2 } });
  assert.equal(after.battle!.result, "defeat");
  assert.equal(after.battle!.ally.hp, 0);
  assert.equal(after.battle!.enemy.hp, 0);
  assert.equal(after.collection.length, 1);
});
test("capture eligibility, probability and pity limits", () => {
  const g = encounter();
  const b = g.battle!;
  b.enemy.hp = 17;
  assert.ok(canCapture(b));
  assert.ok(Math.abs(captureChance(17, 34, 0) - 0.65) < 1e-9);
  assert.ok(Math.abs(captureChance(17, 34, 2) - 0.85) < 1e-9);
  assert.equal(captureChance(1, 34, 20), 0.95);
  b.enemy.hp = species("WW002").hp / 2 + 1;
  assert.equal(canCapture(b), false);
  b.enemy.hp = 0;
  assert.equal(canCapture(b), false);
  b.enemy.hp = 17;
  b.ally.pos = { x: 0, y: 4 };
  assert.equal(canCapture(b), false);
});
test("guided capture succeeds without drawing RNG and is idempotent", () => {
  const g = encounter();
  g.battle!.guided = true;
  g.battle!.enemy.hp = 17;
  const after = reduceGame(g, { type: "capture" });
  assert.equal(after.scene, "result");
  assert.equal(after.battle!.result, "capture");
  assert.equal(after.collection.length, 2);
  assert.equal(after.rng, g.rng);
  assert.equal(
    after.events.filter((e) => e.type === "first_capture").length,
    1,
  );
  assert.equal(reduceGame(after, { type: "capture" }), after);
  assert.equal(isGame(after), true);
});
test("ordinary capture uses exactly one PRNG sample", () => {
  for (const seed of [1, 827361]) {
    const g = encounter();
    g.rng = seed;
    g.battle!.enemy.hp = 17;
    const r = nextRandom(g.rng);
    const chance = captureChance(17, species(g.battle!.enemy.speciesId).hp, 0);
    const after = reduceGame(g, { type: "capture" });
    assert.equal(after.rng, r.seed);
    assert.equal(after.battle!.result === "capture", r.value < chance);
  }
});
test("flee and knockout never grant creatures", () => {
  for (const kind of ["flee", "kill"]) {
    const g = encounter();
    g.battle!.enemy.hp = 1;
    const after = reduceGame(
      g,
      kind === "flee"
        ? { type: "flee" }
        : { type: "basic", target: { x: 2, y: 1 } },
    );
    assert.equal(after.collection.length, 1);
    assert.equal(after.captured, 0);
    assert.equal(after.scene, "result");
  }
});
test("40-round cap returns escape, with no extra round", () => {
  const g = encounter();
  g.battle!.round = 40;
  const after = reduceGame(g, { type: "defend" });
  assert.equal(after.battle!.result, "escaped");
  assert.equal(after.battle!.round, 40);
});
test("encounter trigger and rearm require leaving grass", () => {
  let g = initialGame(827361);
  g.player = { x: 8, y: 5 };
  g.steps = 7;
  g = reduceGame(g, { type: "walk", dx: 1, dy: 0 });
  assert.equal(g.scene, "battle");
  assert.equal(g.battle!.enemy.speciesId, "WW002");
  g = reduceGame(g, { type: "flee" });
  g = reduceGame(g, { type: "return" });
  assert.equal(g.armed, false);
  g = reduceGame(g, { type: "walk", dx: 1, dy: 0 });
  assert.equal(g.scene, "exploration");
  assert.equal(g.steps, 0);
});
test("defeat restores a playable companion and returns to Iara if all fainted", () => {
  const g = encounter();
  g.battle!.ally.hp = 1;
  g.battle!.plan = {
    destination: { x: 2, y: 1 },
    target: { x: 2, y: 2 },
    action: "basic",
  };
  const result = reduceGame(g, { type: "defend" });
  assert.equal(result.battle!.result, "defeat");
  const after = reduceGame(result, { type: "return" });
  assert.equal(after.collection[0]!.hp, species("WW001").hp);
  assert.deepEqual(after.player, { x: 8, y: 10 });
});
test("untrusted saves reject broken IDs, fighter positions, cells and unknown species", () => {
  const valid = encounter();
  assert.ok(isGame(valid));
  assert.ok(isGame(JSON.parse(JSON.stringify(valid))));
  for (const mutation of [
    (g: Game) => {
      g.activeId = "missing";
    },
    (g: Game) => {
      g.rng = 0;
    },
    (g: Game) => {
      g.battle!.enemy.pos = { ...g.battle!.ally.pos };
    },
    (g: Game) => {
      g.battle!.cells = [];
    },
    (g: Game) => {
      g.collection[0]!.hp = -1;
    },
  ]) {
    const bad = structuredClone(valid);
    mutation(bad);
    assert.equal(isGame(bad), false);
  }
  assert.equal(isGame(null), false);
});
test("save serialization retains deterministic battle continuation", () => {
  const g = encounter();
  const restored = JSON.parse(JSON.stringify(g)) as Game;
  const cmd = { type: "basic", target: { x: 2, y: 1 } } as const;
  assert.deepEqual(reduceGame(restored, cmd), reduceGame(g, cmd));
});
test("AI produces legal positions for all species and does not choose self conduction", () => {
  for (const s of SPECIES) {
    const g = encounter(s.id),
      b = g.battle!;
    const plan = enemyPlan(b);
    assert.ok(plan.destination.x >= 0 && plan.destination.x <= 4);
    assert.ok(plan.destination.y >= 0 && plan.destination.y <= 4);
    assert.notDeepEqual(plan.destination, b.ally.pos);
  }
});
test("session commits save before publishing capture and serializes repeated clicks", async () => {
  let release: () => void = () => {};
  const gate = new Promise<void>((r) => (release = r));
  const stored: Game[] = [];
  const g = encounter();
  g.battle!.guided = true;
  g.battle!.enemy.hp = 17;
  const session = new Session(
    {
      load: async () => g,
      save: async (next) => {
        await gate;
        stored.push(next);
      },
    },
    () => {},
  );
  await session.load();
  const pending = session.dispatch({ type: "capture" });
  assert.equal(session.state.scene, "battle");
  await session.dispatch({ type: "capture" });
  release();
  await pending;
  assert.equal(stored.length, 1);
  assert.equal(session.state.collection.length, 2);
});
test("save failure keeps recoverable state in memory and freezes further writes", async () => {
  const session = new Session(
    {
      load: async () => null,
      save: async () => {
        throw new Error("quota");
      },
    },
    () => {},
  );
  await session.load();
  await session.dispatch({ type: "walk", dx: 0, dy: -1 });
  assert.equal(session.ready, false);
  assert.equal(session.error, "quota");
  assert.equal(session.state.player.y, 10);
  const state = session.state;
  await session.dispatch({ type: "walk", dx: 0, dy: -1 });
  assert.equal(session.state, state);
});
test("complete real journey: spawn, classic encounter, capture, reload and return", () => {
  let g = initialGame(827361);
  for (let i = 0; i < 4; i++)
    g = reduceGame(g, { type: "walk", dx: 0, dy: -1 });
  assert.equal(g.player.y, 7);
  for (let i = 0; i < 7; i++)
    g = reduceGame(g, { type: "walk", dx: i % 2 === 0 ? -1 : 1, dy: 0 });
  assert.equal(g.scene, "battle");
  assert.equal(g.battle!.mode, "classic");
  for (let i = 0; i < 3; i++)
    g = reduceGame(g, { type: "basic", target: g.battle!.enemy.pos });
  assert.equal(canCapture(g.battle!), true);
  g = reduceGame(g, { type: "capture" });
  assert.equal(g.battle!.result, "capture");
  assert.equal(g.collection.length, 2);
  assert.equal(isGame(g), true);
  const restored = JSON.parse(JSON.stringify(g)) as Game;
  g = reduceGame(restored, { type: "return" });
  assert.equal(g.scene, "exploration");
  assert.equal(g.collection[1]!.speciesId, "WW002");
  assert.equal(g.events.filter((e) => e.type === "first_capture").length, 1);
  assert.equal(isGame(g), true);
});
test("event queue is bounded even when beginning another encounter", () => {
  const g = initialGame();
  g.player = { x: 9, y: 7 };
  g.steps = 7;
  g.events = Array.from({ length: 100 }, (_, i) => ({
    id: String(i),
    type: "capture",
    encounterId: String(i),
  }));
  const after = reduceGame(g, { type: "walk", dx: -1, dy: 0 });
  assert.equal(after.events.length, 100);
  assert.equal(isGame(after), true);
});
test("a slow storage read times out without overwriting a later temporary session", async () => {
  let finish: (game: Game) => void = () => {};
  const delayed = new Promise<Game>((resolve) => {
    finish = resolve;
  });
  const session = new Session(
    { load: () => delayed, save: async () => {} },
    () => {},
  );
  await session.load(10);
  assert.equal(session.ready, false);
  assert.match(session.error, /demorou/);
  const state = session.state;
  const old = initialGame();
  old.player = { x: 5, y: 5 };
  finish(old);
  await Promise.resolve();
  assert.equal(session.state, state);
});

test("changing appearance preserves the existing expedition and starter", () => {
  const original = encounter();
  original.starterChosen = true;
  original.avatar = { skin: "umber", hair: "braids", hairColor: "silver", outfit: "river", accessory: "satchel" };
  const avatar = { ...original.avatar, outfit: "sunset" as const, accessory: "scarf" as const };
  const changed = reduceGame(original, { type: "customize", avatar });
  assert.notEqual(changed, original);
  assert.deepEqual(changed.avatar, avatar);
  assert.deepEqual(changed.collection, original.collection);
  assert.deepEqual(changed.battle, original.battle);
  assert.deepEqual(changed.player, original.player);
  assert.equal(changed.starterChosen, true);
  assert.equal(changed.scene, original.scene);
  assert.equal(changed.seeds, original.seeds);
  assert.equal(changed.rng, original.rng);
  assert.equal(original.avatar.outfit, "river");
  Object.assign(avatar, { outfit: "river" });
  assert.equal(changed.avatar?.outfit, "sunset");
});
