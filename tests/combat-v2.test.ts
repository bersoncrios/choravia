import test from "node:test";
import assert from "node:assert/strict";
import { SPECIES, initialGame, createBattle, creatureMaxHp, classicAttackPower, damage, nextRandom, reduceGame, canCapture, type SpeciesId } from "../src/app/domain/game.js";
import { isGame } from "../src/app/domain/save-validation.js";
import { frameGame } from "../src/app/application/battle-playback.js";
function classic(ally: SpeciesId = "WW001", enemy: SpeciesId = "WW002", level = 1) {
  const g = initialGame(827361);
  g.collection[0] = { id: "starter", speciesId: ally, hp: creatureMaxHp(ally, level), level, experience: 0, provenance: "local" };
  g.scene = "battle"; g.encountered = 1;
  g.battle = createBattle("local-classic", g.collection[0], enemy, false, "wild", undefined, "classic");
  return g;
}
test("classic round records player then enemy, without grid movement or range requirements", () => {
  const g = classic();
  assert.equal(reduceGame(g, { type: "move", position: { x: 1, y: 2 } }), g);
  const next = reduceGame(g, { type: "basic", target: g.battle!.enemy.pos });
  assert.equal(next.battle!.round, 2);
  const frames = next.battle!.turnFrames!;
  assert.deepEqual(frames.map(f => f.actor), ["player", "enemy"]);
  assert.equal(frames[0]!.ally.hp, g.battle!.ally.hp);
  assert.ok(frames[0]!.enemy.hp < g.battle!.enemy.hp);
  assert.ok(frames[1]!.ally.hp < frames[0]!.ally.hp);
  assert.equal(isGame(next), true);
  assert.equal(isGame(JSON.parse(JSON.stringify(next))), true);
  const snapshot = JSON.stringify(next);
  assert.equal(frameGame(next, frames[0]!, 1).scene, "battle");
  assert.equal(JSON.stringify(next), snapshot);
});
test("all five Ecos have a legal elemental skill, one-round cooldown, and no terrain self damage", () => {
  for (const s of SPECIES) {
    const g = classic(s.id, s.id, 15);
    g.battle!.cells.forEach(c => { c.terrain = "water"; c.remaining = 0; });
    const first = reduceGame(g, { type: "skill", target: g.battle!.enemy.pos });
    assert.notEqual(first, g);
    assert.equal(first.battle!.allyCooldown, 1);
    assert.equal(first.battle!.turnFrames![0]!.ally.hp, g.battle!.ally.hp);
    assert.equal(reduceGame(first, { type: "skill", target: first.battle!.enemy.pos }), first);
    const second = reduceGame(first, { type: "defend" });
    assert.equal(second.battle!.allyCooldown, 0);
    assert.notEqual(reduceGame(second, { type: "skill", target: second.battle!.enemy.pos }), second);
  }
});
test("defense halves the real enemy response and defeated opponents cannot retaliate", () => {
  const g = classic();
  const defended = reduceGame(g, { type: "defend" });
  const attack = reduceGame(g, { type: "basic", target: g.battle!.enemy.pos });
  assert.ok(g.battle!.ally.hp - defended.battle!.ally.hp < g.battle!.ally.hp - attack.battle!.ally.hp);
  g.battle!.enemy.hp = 1;
  const victory = reduceGame(g, { type: "basic", target: g.battle!.enemy.pos });
  assert.equal(victory.battle!.result, "victory");
  assert.equal(victory.battle!.turnFrames!.length, 1);
  assert.equal(victory.battle!.turnFrames![0]!.ally.hp, g.battle!.ally.hp);
});
test("capture requires half PV but no proximity; NPC capture stays forbidden", () => {
  const g = classic();
  g.battle!.enemy.hp = creatureMaxHp("WW002", 1) / 2;
  g.battle!.guided = true;
  assert.ok(canCapture(g.battle!));
  const captured = reduceGame(g, { type: "capture" });
  assert.equal(captured.battle!.result, "capture");
  assert.equal(captured.battle!.turnFrames!.length, 1);
  g.battle!.kind = "npc";
  assert.equal(canCapture(g.battle!), false);
});
test("classic damage stays in the target pacing band at levels 1, 15 and 30", () => {
  const rows: { level: number; min: number; max: number }[] = [];
  for (const level of [1, 15, 30]) {
    const hits = SPECIES.flatMap(a => SPECIES.map(d => Math.ceil(creatureMaxHp(d.id, level) / damage(a.id, d.id, classicAttackPower("basic", level), "neutral", false, level, level))));
    rows.push({ level, min: Math.min(...hits), max: Math.max(...hits) });
    for (const hitCount of hits) assert.ok(hitCount >= 4 && hitCount <= 7, `neutral KO attacks at level ${level}: ${hitCount}`);
  }
  console.log("Classic neutral pacing:", rows);
});
test("presentation data validation rejects malformed phases and cooldowns", () => {
  const g = classic();
  const next = reduceGame(g, { type: "defend" });
  const invalid = structuredClone(next);
  invalid.battle!.allyCooldown = 50;
  assert.equal(isGame(invalid), false);
  const malformed = structuredClone(next);
  malformed.battle!.turnFrames!.push(malformed.battle!.turnFrames![0]!);
  assert.equal(isGame(malformed), false);
});

test("failed capture yields the enemy turn; timeout and defeat stop future actions", () => {
  const g = classic();
  g.battle!.enemy.hp = 20;
  let seed = 1;
  while (nextRandom(seed).value < .96) seed++;
  g.rng = seed;
  const failure = reduceGame(g, { type: "capture" });
  assert.equal(failure.battle!.failures, 1);
  assert.equal(failure.battle!.turnFrames!.length, 2);
  assert.equal(failure.battle!.round, 2);
  const last = classic(); last.battle!.round = 40;
  const escaped = reduceGame(last, { type: "defend" });
  assert.equal(escaped.battle!.result, "escaped");
  assert.equal(reduceGame(escaped, { type: "defend" }), escaped);
  const weak = classic(); weak.battle!.ally.hp = 1;
  const defeat = reduceGame(weak, { type: "basic", target: weak.battle!.enemy.pos });
  assert.equal(defeat.battle!.result, "defeat");
  assert.equal(defeat.battle!.turnFrames![1]!.ally.hp, 0);
  assert.equal(isGame(defeat), true);
});
