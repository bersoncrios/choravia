import test from "node:test";
import assert from "node:assert/strict";
import { initialGame, createBattle, creatureMaxHp, reduceGame, teamOf, type Creature } from "../src/app/domain/game.js";
import { isGame } from "../src/app/domain/save-validation.js";
const reserve: Creature = { id: "reserve", speciesId: "WW002", hp: creatureMaxHp("WW002", 3), level: 3, experience: 0, provenance: "local" };
function fixture(mode: "classic" | "tactical" = "classic") {
  const g = initialGame(12); g.starterChosen = true; g.collection.push(structuredClone(reserve)); g.teamIds = ["starter", "reserve"];
  g.scene = "battle"; g.encountered = 1; g.battle = createBattle("team-test", g.collection[0]!, "WW003", false, "wild", undefined, mode === "classic" ? "classic" : undefined);
  return g;
}
test("team roster is ordered, capped at three, and rejects missing or fainted members", () => {
  const g = initialGame(2); g.collection.push(structuredClone(reserve));
  const team = reduceGame(g, { type: "setTeam", ids: ["starter", "reserve"] });
  assert.deepEqual(teamOf(team), ["starter", "reserve"]); assert.equal(isGame(team), true);
  assert.equal(reduceGame(team, { type: "setTeam", ids: ["starter", "reserve", "missing"] }), team);
  assert.equal(reduceGame(team, { type: "setTeam", ids: ["starter", "starter"] }), team);
});
test("classic knockout persists the pending choice without giving the reserve an extra enemy turn", () => {
  const g = fixture("classic"); g.battle!.ally.hp = 1; g.battle!.plan.action = "basic";
  const knockedOut = reduceGame(g, { type: "defend" });
  assert.equal(knockedOut.battle!.awaitingReplacement, true); assert.equal(knockedOut.battle!.ally.hp, 0); assert.equal(knockedOut.scene, "battle");
  assert.equal(isGame(JSON.parse(JSON.stringify(knockedOut))), true);
  const entered = reduceGame(knockedOut, { type: "switchBattleEco", id: "reserve" });
  assert.equal(entered.activeId, "reserve"); assert.equal(entered.battle!.ally.hp, reserve.hp); assert.equal(entered.battle!.round, 2); assert.equal(entered.battle!.awaitingReplacement, false);
  assert.equal(isGame(entered), true);
  assert.equal(reduceGame(entered, { type: "switchBattleEco", id: "starter" }), entered);
});
test("tactical terrain knockout grants its pending enemy response once after replacement", () => {
  const g = fixture("tactical"); const at = g.battle!.ally.pos; g.battle!.cells[at.y * 5 + at.x] = { terrain: "fire", remaining: 4 };
  g.battle!.ally.hp = 1;
  const knockedOut = reduceGame(g, { type: "defend" });
  assert.equal(knockedOut.battle!.awaitingReplacement, true); assert.equal(knockedOut.battle!.replacementEnemyTurn, true); assert.equal(isGame(knockedOut), true);
  const entered = reduceGame(knockedOut, { type: "switchBattleEco", id: "reserve" });
  assert.equal(entered.battle!.round, 2); assert.equal(entered.battle!.replacementEnemyTurn, false); assert.equal(entered.scene, "battle"); assert.equal(isGame(entered), true);
});
