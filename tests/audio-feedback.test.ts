import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_AUDIO_MIX, normalizeAudioMix } from "../src/app/domain/audio.js";
import { battleFrameSound, commandSound, levelIncreased } from "../src/app/application/audio-feedback.js";
import { createBattle, initialGame, reduceGame, REGION_PORTALS, type Game } from "../src/app/domain/game.js";

test("audio mix migrates old preferences and clamps untrusted volumes without sharing defaults", () => {
  for (const input of [undefined, null, [], "volume", 12]) assert.deepEqual(normalizeAudioMix(input), DEFAULT_AUDIO_MIX);
  assert.deepEqual(normalizeAudioMix({master: -1,music: 2,ambience: NaN,effects: Infinity}), {...DEFAULT_AUDIO_MIX,master: 0,music: 1});
  const mix = normalizeAudioMix({master: 0,effects: 0});
  assert.equal(mix.master,0); assert.equal(mix.effects,0);
  mix.music = 1; assert.equal(DEFAULT_AUDIO_MIX.music,0.3);
});
test("rejected movement never plays a step while accepted path and portal have distinct cues", () => {
  let game = reduceGame(initialGame(33), {type: "chooseStarter",speciesId: "WW001"});
  const invalid = {type:"walk",dx:0,dy:0} as const;
  assert.equal(commandSound(game,reduceGame(game,invalid),invalid),null);
  const walk = {type:"walk",dx:0,dy:-1} as const;
  const moved = reduceGame(game,walk);
  assert.deepEqual(commandSound(game,moved,walk),{cue:"step",variant:"path"});
  const portal = REGION_PORTALS.clearing;
  game = {...game,player:{x:portal.position.x-1,y:portal.position.y},worldLayouts:{...game.worldLayouts,clearing:{pots:[],npcs:[]}}};
  const crossing = {type:"walk",dx:1,dy:0} as const;
  assert.deepEqual(commandSound(game,reduceGame(game,crossing),crossing),{cue:"portal"});
});
test("collection and environmental cues follow committed state rather than rejected input", () => {
  const game = reduceGame(initialGame(7),{type:"chooseStarter",speciesId:"WW001"});
  const received = reduceGame(game,{type:"applyDailyReward",receiptId:"daily:2026-11-14:basic-attack",seeds:6});
  assert.deepEqual(commandSound(game,received,{type:"applyDailyReward",receiptId:"daily:2026-11-14:basic-attack",seeds:6}),{cue:"collect"});
  const bad = {type:"restoreEnvironment",id:"unknown",method:"manual"} as const;
  assert.equal(commandSound(game,reduceGame(game,bad),bad),null);
});
test("capture resistance and success differ and use no random presentation state", () => {
  const game = reduceGame(initialGame(8),{type:"chooseStarter",speciesId:"WW001"});
  const battle = createBattle("audio-capture-01",game.collection[0]!,"WW002",true,"wild",undefined,"classic");
  const before: Game = {...game,scene:"battle",battle:{...battle,enemy:{...battle.enemy,hp:1}}};
  const captured = reduceGame(before,{type:"capture"});
  assert.deepEqual(commandSound(before,captured,{type:"capture"}),{cue:"capture"});
  const frame = {actor:"player" as const,action:"capture" as const,ally:battle.ally,enemy:battle.enemy,message:"Vínculo"};
  assert.deepEqual(battleFrameSound(frame,captured),{cue:"capture"});
  assert.deepEqual(battleFrameSound(frame,{...captured,battle:{...captured.battle!,result:null}}),{cue:"resist"});
});
test("battle phases choose the performing Eco's element without changing their snapshots", () => {
  const game = initialGame(5), battle = createBattle("audio-frame-01",game.collection[0]!,"WW003",false,"wild",undefined,"classic");
  const frame = {actor:"enemy" as const,action:"skill" as const,ally:battle.ally,enemy:battle.enemy,message:"Água"};
  const original = JSON.stringify(frame);
  assert.deepEqual(battleFrameSound(frame,{...game,battle}),{cue:"skill",variant:"water"});
  assert.equal(JSON.stringify(frame),original);
});
test("progress sound only marks a real level increase of a previously owned Eco", () => {
  const game = initialGame(4);
  assert.equal(levelIncreased(game,{...game,collection:game.collection.map(c=>({...c,experience:5}))}),false);
  const leveled = {...game,revision:game.revision+1,collection:game.collection.map(c=>({...c,level:2}))};
  assert.equal(levelIncreased(game,leveled),true);
  assert.deepEqual(commandSound(game,leveled,{type:"return"}),{cue:"level"});
});
