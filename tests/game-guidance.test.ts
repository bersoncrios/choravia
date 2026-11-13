import test from "node:test";
import assert from "node:assert/strict";
import { explorationObjective, battleGuidance } from "../src/app/application/game-guidance.js";
import { initialGame, createBattle } from "../src/app/domain/game.js";

test("objective follows recovery, first capture, seals and collection", () => {
  const g = initialGame(1);
  assert.match(explorationObjective(g).title, /primeiro vínculo/);
  g.collection[0]!.hp = 0;
  assert.match(explorationObjective(g).title, /Recupere/);
  g.collection[0]!.hp = 30;
  g.captured = 1;
  assert.match(explorationObjective(g).title, /selo/);
  g.ancientMarkerHeard = true;
  assert.match(explorationObjective(g).title, /1\/5/);
});

test("combat guidance distinguishes neutral attacks, elemental skills and movement", () => {
  const g = initialGame(1);
  assert.equal(battleGuidance(g, "basic"), null);
  g.scene = "battle";
  g.battle = createBattle("local-test", g.collection[0]!, "WW002", false);
  g.battle.ally.pos = { x: 2, y: 2 };
  g.battle.enemy.pos = { x: 2, y: 1 };
  assert.match(battleGuidance(g, "basic")!.detail, /ao alcance/);
  assert.match(battleGuidance(g, "basic")!.detail, /neutro/);
  assert.match(battleGuidance(g, "skill")!.detail, /Vantagem elemental · ×1,5/);
  g.battle.enemy.speciesId = "WW003";
  assert.match(battleGuidance(g, "skill")!.detail, /Desvantagem elemental · ×0,75/);
  g.battle.enemy.pos = { x: 4, y: 4 };
  assert.match(battleGuidance(g, "basic")!.detail, /fora do alcance/);
  g.battle.moved = true;
  assert.match(battleGuidance(g, "move")!.detail, /já se moveu/);
  g.battle.ally.speciesId = "WW004";
  assert.match(battleGuidance(g, "skill")!.detail, /próprio Eco/);
});
