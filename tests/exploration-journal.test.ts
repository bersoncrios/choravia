import test from "node:test";
import assert from "node:assert/strict";
import { initialGame, reduceGame, createBattle, journalOf, REGION_ORDER, REGION_NAMES, REGION_ENCOUNTERS, REGION_PORTALS, type Game } from "../src/app/domain/game.js";
import { journalView } from "../src/app/application/exploration-journal.js";
import { reconcileExpedition, mergePreviousEncounter } from "../src/app/application/account-expedition.js";
import { isGame } from "../src/app/domain/save-validation.js";
import { encodeSnapshot, decodeCloudRecord } from "../src/app/domain/cloud-snapshot.js";

test("starter discovery begins with the actual choice and rejected commands add no history", () => {
  const game = initialGame(12);
  assert.deepEqual(journalOf(game), {regions: ["clearing"], species: []});
  const selected = reduceGame(game, {type: "chooseStarter", speciesId: "WW005"});
  assert.deepEqual(selected.journal, {regions: ["clearing"], species: ["WW005"]});
  const rejected = reduceGame(selected, {type: "walk", dx: 10, dy: 10});
  assert.equal(rejected, selected); assert.equal(journalView(selected).ownedCount, 1);
});
test("portal traversal records source and destination, preserves circuit and survives cloud encoding", () => {
  let game = reduceGame(initialGame(44), {type: "chooseStarter", speciesId: "WW001"});
  for (const region of REGION_ORDER) {
    const portal = REGION_PORTALS[region];
    // All portal approach cells lie on the existing horizontal path.
    game = {...game, region, player: {x: portal.position.x === 2 ? 3 : portal.position.x - 1, y: portal.position.y}, worldLayouts: Object.fromEntries(REGION_ORDER.map(id => [id, {pots: [], npcs: []}]))};
    game = reduceGame(game, {type: "walk", dx: portal.position.x === 2 ? -1 : 1, dy: 0});
    assert.equal(game.region, portal.target); assert.ok(isGame(game));
  }
  assert.deepEqual(game.journal!.regions, REGION_ORDER);
  const restored = decodeCloudRecord({schemaVersion: 1, revision: 1, writeId: "journal-save-001", snapshot: encodeSnapshot(game)}).snapshot;
  assert.deepEqual(restored.journal, game.journal);
  assert.equal(journalView(restored).visitedCount, 5);
});
test("observing a duel records its opponent after fleeing and returning without awarding ownership", () => {
  let game = reduceGame(initialGame(12), {type: "chooseStarter", speciesId: "WW001"});
  game = {...game, player: {x: 12, y: 10}, worldLayouts: {...game.worldLayouts, clearing: {pots: [], npcs: [{id: "test-duelist", name: "Nilo", x: 13,y: 10,speciesId: "WW003",reward: 24}]}}};
  game = reduceGame(game, {type: "challengeNpc", npcId: "test-duelist"});
  assert.equal(game.scene, "battle"); assert.ok(journalOf(game).species.includes("WW003"));
  game = reduceGame(game, {type: "flee"}); game = reduceGame(game, {type: "return"});
  const eco = journalView(game).ecos.find(e => e.id === "WW003")!;
  assert.equal(eco.seen, true); assert.equal(eco.owned, false); assert.equal(game.collection.length, 1);
});
test("old saves infer current region, collection and active encounter without inventing historic visits", () => {
  const game = {...initialGame(17), region: "old-grove", starterChosen: true} as Game;
  game.battle = createBattle("old-battle", game.collection[0]!, "WW005", false); game.scene = "battle";
  assert.equal(game.journal, undefined);
  assert.deepEqual(journalOf(game), {regions: ["old-grove"], species: ["WW001", "WW005"]});
  const original = JSON.stringify(game); journalView(game);
  assert.equal(JSON.stringify(game), original);
});
test("trades preserve species memories while distinguishing current ownership and new arrivals", () => {
  const game = reduceGame(initialGame(23), {type: "chooseStarter", speciesId: "WW001"});
  const next = reconcileExpedition(game, [{id: "received-eco-01",speciesId: "WW003",level: 1,experience: 0,lock: null,revision: 1}], []);
  assert.deepEqual(next.journal!.species, ["WW001", "WW003"]);
  assert.equal(journalView(next).ecos.find(e => e.id === "WW001")!.owned, false);
  assert.equal(journalView(next).ecos.find(e => e.id === "WW003")!.owned, true);
  assert.equal(journalView(next).seenCount, 2);
});
test("legacy arena merge remembers its Eco without adding arena placeholder regions", () => {
  const world = {...initialGame(5), region: "old-grove", starterChosen: true} as Game;
  const arena = initialGame(8); arena.battle = createBattle("arena-legacy", arena.collection[0]!, "WW005", false);
  const merged = mergePreviousEncounter(world, arena, arena);
  assert.deepEqual(merged.journal!.regions, ["old-grove"]);
  assert.ok(merged.journal!.species.includes("WW005"));
});
test("habitat guide uses normal encounter catalog and all map exits match actual portals", () => {
  const game = {...initialGame(33), starterChosen: true, journal: {regions: [...REGION_ORDER],species: ["WW001", "WW002", "WW003", "WW004", "WW005"]}} as Game;
  const view = journalView(game);
  for (const region of view.regions) {
    assert.equal(region.nextName, REGION_NAMES[REGION_PORTALS[region.id].target]);
    assert.equal(region.habitats.length, REGION_ENCOUNTERS[region.id].length);
  }
  for (const eco of view.ecos) assert.deepEqual(eco.habitats, REGION_ORDER.filter(id => REGION_ENCOUNTERS[id].includes(eco.id)).map(id => REGION_NAMES[id]));
});
test("untrusted journal rejects unknown IDs, duplicates, oversize and malformed entries", () => {
  const game = initialGame(19);
  assert.ok(isGame(game));
  for (const journal of [{regions: ["unknown"],species: []}, {regions: ["clearing","clearing"],species: []}, {regions: [],species: ["WW999"]}, {regions: [],species: ["WW001","WW001"]}, {regions: [],species: [],extra: true}, {regions: null,species: []}, null]) assert.equal(isGame({...game,journal}), false);
});
