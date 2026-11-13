import test from "node:test";
import assert from "node:assert/strict";
import { visualFeedback, progressFeedback } from "../src/app/application/visual-feedback.js";
import { initialGame, createBattle, reduceGame, xpToNextLevel, type Game } from "../src/app/domain/game.js";

function battle(): Game {
  const g = initialGame(827361);
  g.scene = "battle";
  g.battle = createBattle("local-visual", g.collection[0]!, "WW002", false);
  g.battle.ally.pos = { x: 2, y: 2 };
  g.battle.enemy.pos = { x: 2, y: 1 };
  g.battle.plan = { destination: { x: 2, y: 1 }, target: { x: 2, y: 2 }, action: "basic" };
  return g;
}
test("visual damage uses committed PV differences and never changes game snapshots", () => {
  const before = battle();
  const after = reduceGame(before, { type: "basic", target: { x: 2, y: 1 } });
  const frozen = JSON.stringify([before, after]);
  const feedback = visualFeedback(before, after, { type: "basic", target: { x: 2, y: 1 } })!;
  assert.equal(feedback.kind, "basic");
  assert.equal(feedback.allyLoss, before.battle!.ally.hp - after.battle!.ally.hp);
  assert.equal(feedback.enemyLoss, before.battle!.enemy.hp - after.battle!.enemy.hp);
  assert.equal(feedback.enemyActs, true);
  assert.equal(JSON.stringify([before, after]), frozen);
  assert.equal(visualFeedback(before, before, { type: "defend" }), null);
  assert.equal(visualFeedback(before, structuredClone(before), { type: "defend" }), null);
});
test("rejected actions produce no feedback; successful movement stays short", () => {
  const before = battle();
  const invalid = { type: "move", position: { x: 4, y: 4 } } as const;
  assert.equal(visualFeedback(before, reduceGame(before, invalid), invalid), null);
  const move = { type: "move", position: { x: 1, y: 2 } } as const;
  const feedback = visualFeedback(before, reduceGame(before, move), move)!;
  assert.equal(feedback.kind, "move");
  assert.equal(feedback.enemyActs, false);
  assert.ok(feedback.duration < 200);
});
test("capture feedback distinguishes a committed success from a resistance", () => {
  const before = battle();
  const after = structuredClone(before);
  after.revision++;
  after.battle!.result = "capture";
  assert.equal(visualFeedback(before, after, { type: "capture" })!.label, "Vínculo formado!");
  after.battle!.result = null;
  assert.equal(visualFeedback(before, after, { type: "capture" })!.label, "O Eco resistiu");
});
test("level celebrations use committed progression, including XP rollover", () => {
  const before = battle();
  before.collection[0]!.experience = xpToNextLevel(1) - 1;
  const after = structuredClone(before);
  after.collection[0]!.level = 2;
  after.collection[0]!.experience = 5;
  assert.match(progressFeedback(before, after), /Nível 2/);
  assert.equal(progressFeedback(before, before), "");
  after.collection.push({ id: "new", speciesId: "WW002", hp: 34, provenance: "local" });
  after.captured++;
  assert.match(progressFeedback(before, after), /Nível 2/);
});
