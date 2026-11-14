import test from "node:test";
import assert from "node:assert/strict";
import { initialGame, reduceGame, layoutIn, createBattle, type Game } from "../src/app/domain/game.js";
import { activitiesView } from "../src/app/application/exploration-activities.js";
import { dailyActionTypes } from "../src/app/application/account-expedition.js";

test("activities guide reflects restorations and personal training records without mutating the snapshot", () => {
  const game = reduceGame(initialGame(827361), {type: "chooseStarter", speciesId: "WW001"});
  const npc = layoutIn(game,"clearing").npcs[0]!;
  const fixture: Game = {...game, fieldRestorations: ["clearing-lantern", "tide-bridge"], npcDuelWins: [npc.id], trainingRecords: {[npc.id]: {wins: 2, bestRound: 3, goals: ["skill"]}}};
  const original = JSON.stringify(fixture), view = activitiesView(fixture);
  assert.equal(view.mechanisms.length, 5); assert.equal(view.restored, 2);
  const training = view.training.find(n => n.id === npc.id)!;
  assert.equal(training.wins, 2); assert.equal(training.bestRound, 3);
  assert.equal(training.skill, true); assert.equal(training.guard, false); assert.equal(training.unlocked, true);
  assert.equal(JSON.stringify(fixture), original);
});
test("training actions and victories never advance the daily challenge queue", () => {
  const game = reduceGame(initialGame(123), {type: "chooseStarter", speciesId: "WW001"});
  const battle = createBattle("practice-01", game.collection[0]!, "WW003", false, "npc", "davi", "classic");
  battle.rematch = {goal: "skill", usedSkill: false, usedGuard: false};
  const before: Game = {...game, scene: "battle", battle};
  const defended = reduceGame(before, {type: "defend"});
  assert.notEqual(defended, before);
  assert.deepEqual(dailyActionTypes(before, defended, {type: "defend"}), []);
  const ending: Game = {...before, battle: {...battle, enemy: {...battle.enemy,hp: 1}}};
  const after = reduceGame(ending, {type: "basic", target: battle.enemy.pos});
  assert.equal(after.scene,"result");
  assert.deepEqual(dailyActionTypes(ending, after, {type:"basic",target:battle.enemy.pos}), []);
});
