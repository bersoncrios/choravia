import test from "node:test";
import assert from "node:assert/strict";
import { initialGame, reduceGame, createBattle, mapTile, REGION_ORDER, REGION_PORTALS, type Game, type SpeciesId } from "../src/app/domain/game.js";
import { fieldMechanisms, fieldMechanismReady, explorationTile, FIELD_MECHANISM_IDS } from "../src/app/domain/field-abilities.js";
import { isGame } from "../src/app/domain/save-validation.js";

const elements: Record<string,SpeciesId>={fire:"WW001",plant:"WW002",water:"WW003",electric:"WW004",earth:"WW005"};
function ready(seed=1,id:SpeciesId="WW001"): Game { return reduceGame(initialGame(seed),{type:"chooseStarter",speciesId:id}); }
function duelist(): Game {
  const game=ready(8,"WW005");
  return {...game,player:{x:12,y:10},worldLayouts:{...game.worldLayouts,clearing:{pots:[],npcs:[{id:"davi",name:"Davi",x:13,y:10,speciesId:"WW003",reward:24}]}}};
}

test("all five field mechanisms are deterministic, reachable and avoid legacy object positions",()=>{
  for(let seed=1;seed<=50;seed++) {
    const game=ready(seed), original=JSON.stringify(game), found:string[]=[];
    for(const region of REGION_ORDER) {
      const area={...game,region}, mechanisms=fieldMechanisms(area), layout=area.worldLayouts![region]!;
      assert.equal(mechanisms.length,region==="tide-cavern"?2:1);
      assert.deepEqual(mechanisms,fieldMechanisms({...area}));
      for(const mechanism of mechanisms) {
        found.push(mechanism.id);
        assert.ok(["ground","path"].includes(mapTile(mechanism.x,mechanism.y,region)));
        assert.ok(![...layout.pots,...layout.npcs].some(o=>o.x===mechanism.x&&o.y===mechanism.y));
        if(region==="clearing") assert.ok(!(mechanism.x>=5&&mechanism.y>=8));
      }
    }
    assert.deepEqual(found.sort(),[...FIELD_MECHANISM_IDS].sort()); assert.equal(JSON.stringify(game),original);
  }
});
test("every elemental restoration and free manual alternative produces the same persistent world change",()=>{
  for(const region of REGION_ORDER) for(const mechanism of fieldMechanisms({...ready(3),region})) {
    const base=ready(3,elements[mechanism.element]!);
    const game={...base,region,player:{x:mechanism.x,y:mechanism.y}};
    assert.ok(fieldMechanismReady(game,mechanism));
    const elemental=reduceGame(game,{type:"restoreEnvironment",id:mechanism.id,method:"eco"});
    const manual=reduceGame(game,{type:"restoreEnvironment",id:mechanism.id,method:"manual"});
    assert.deepEqual(elemental.fieldRestorations,manual.fieldRestorations);
    assert.equal(elemental.seeds,game.seeds); assert.equal(elemental.rng,game.rng);
    assert.deepEqual(elemental.collection,game.collection); assert.ok(isGame(elemental));
    assert.equal(reduceGame(elemental,{type:"restoreEnvironment",id:mechanism.id,method:"manual"}),elemental);
  }
});
test("wrong elements, fainted Ecos, range and battle cannot bypass restoration preconditions",()=>{
  const game=ready(2,"WW003"), mechanism=fieldMechanisms(game)[0]!;
  const near={...game,player:{x:mechanism.x,y:mechanism.y}};
  assert.equal(reduceGame(near,{type:"restoreEnvironment",id:mechanism.id,method:"eco"}),near);
  const fainted={...near,collection:near.collection.map(c=>({...c,hp:0}))};
  assert.notEqual(reduceGame(fainted,{type:"restoreEnvironment",id:mechanism.id,method:"manual"}),fainted);
  assert.equal(reduceGame(game,{type:"restoreEnvironment",id:mechanism.id,method:"manual"}),game);
  assert.equal(reduceGame(near,{type:"restoreEnvironment",id:"unknown",method:"manual"}),near);
  const battle={...near,scene:"battle" as const,battle:createBattle("field-blocked",near.collection[0]!,"WW002",false,"wild",undefined,"classic")};
  assert.equal(reduceGame(battle,{type:"restoreEnvironment",id:mechanism.id,method:"manual"}),battle);
});
test("restored tide bridge changes only optional channel tiles and remains valid after save/reload",()=>{
  let game={...ready(7,"WW005"),region:"tide-cavern" as const,player:{x:7,y:8}};
  assert.equal(explorationTile(game,6,8),"water"); assert.equal(reduceGame(game,{type:"walk",dx:-1,dy:0}),game);
  const mechanism=fieldMechanisms(game).find(m=>m.id==="tide-bridge")!;
  const near={...game,player:{x:mechanism.x,y:mechanism.y}};
  let restored=reduceGame(near,{type:"restoreEnvironment",id:mechanism.id,method:"manual"});
  restored={...restored,player:{x:7,y:8}};
  restored=reduceGame(restored,{type:"walk",dx:-1,dy:0});
  assert.deepEqual(restored.player,{x:6,y:8}); assert.equal(explorationTile(restored,6,8),"path");
  const loaded=JSON.parse(JSON.stringify(restored)); assert.ok(isGame(loaded));
  assert.equal(isGame({...loaded,fieldRestorations:[]}),false);
  for(const region of REGION_ORDER) assert.equal(explorationTile({...restored,region},REGION_PORTALS[region].position.x,REGION_PORTALS[region].position.y),"gate");
});
test("first duel keeps its rewards while repeat training awards only personal records and goals",()=>{
  let game=duelist();
  assert.equal(reduceGame(game,{type:"rematchNpc",npcId:"davi"}),game);
  game=reduceGame(game,{type:"challengeNpc",npcId:"davi"}); game.battle!.enemy.hp=1;
  game=reduceGame(game,{type:"basic",target:game.battle!.enemy.pos});
  assert.equal(game.seeds,144); assert.equal(game.battle!.result,"victory");
  assert.ok(game.collection[0]!.experience!>0); game=reduceGame(game,{type:"return"});
  const seeds=game.seeds,level=game.collection[0]!.level,xp=game.collection[0]!.experience;
  game=reduceGame(game,{type:"rematchNpc",npcId:"davi"});
  const firstId=game.battle!.id; assert.equal(game.battle!.rematch!.goal,"skill"); assert.ok(isGame(game));
  game.battle!.enemy.hp=1;
  assert.equal(reduceGame(game,{type:"capture"}),game);
  game=reduceGame(game,{type:"skill",target:game.battle!.enemy.pos});
  assert.deepEqual(game.trainingRecords!.davi,{wins:1,bestRound:1,goals:["skill"]});
  assert.equal(game.seeds,seeds); assert.equal(game.collection[0]!.level,level); assert.equal(game.collection[0]!.experience,xp);
  assert.ok(isGame(game)); game=reduceGame(game,{type:"return"});
  game=reduceGame(game,{type:"rematchNpc",npcId:"davi"}); assert.notEqual(game.battle!.id,firstId);
  assert.equal(game.battle!.rematch!.goal,"guard"); game=reduceGame(game,{type:"defend"});
  game.battle!.enemy.hp=1; game=reduceGame(game,{type:"basic",target:game.battle!.enemy.pos});
  assert.deepEqual(game.trainingRecords!.davi,{wins:2,bestRound:1,goals:["skill","guard"]});
  assert.equal(game.seeds,seeds); assert.equal(game.collection[0]!.experience,xp);
});
test("fleeing or losing practice grants no record, XP or Sementes and does not satisfy goals",()=>{
  for(const result of ["flee","defeat"] as const) {
    let game={...duelist(),npcDuelWins:["davi"]};
    const old=JSON.stringify(game.collection);
    let battle=reduceGame(game,{type:"rematchNpc",npcId:"davi"});
    if(result==="flee") battle=reduceGame(battle,{type:"flee"});
    else {battle.battle!.ally.hp=1; battle=reduceGame(battle,{type:"defend"});}
    assert.equal(battle.scene,"result"); assert.equal(battle.trainingRecords,undefined);
    assert.equal(battle.seeds,game.seeds); assert.equal(battle.collection[0]!.experience,game.collection[0]!.experience);
    if(result==="flee") assert.equal(JSON.stringify(battle.collection),old);
  }
});
test("untrusted field and training data are bounded and old saves still validate",()=>{
  const game=duelist(); assert.ok(isGame(game));
  for(const fieldRestorations of [["unknown"],["tide-bridge","tide-bridge"],null]) assert.equal(isGame({...game,fieldRestorations}),false);
  const known={...game,npcDuelWins:["davi"]};
  for(const trainingRecords of [{unknown:{wins:1,bestRound:1,goals:[]}}, {davi:{wins:10000,bestRound:1,goals:[]}}, {davi:{wins:1,bestRound:0,goals:[]}}, {davi:{wins:1,bestRound:1,goals:["skill","skill"]}}, {davi:{wins:1,bestRound:1,goals:["capture"]}}, null]) assert.equal(isGame({...known,trainingRecords}),false);
  const rematch=reduceGame(known,{type:"rematchNpc",npcId:"davi"}); assert.ok(isGame(rematch));
  assert.equal(isGame({...rematch,battle:{...rematch.battle!,rematch:{goal:"capture",usedSkill:false,usedGuard:false}}}),false);
  assert.equal(isGame({...rematch,battle:{...rematch.battle!,mode:undefined}}),false);
  assert.equal(isGame({...rematch,npcDuelWins:[]}),false);
});
