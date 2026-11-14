import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";

// Synthetic Google identity, isolated IndexedDB and local domain commands only.
// Opponent HP is reduced in explicit fixtures to test reward/record behavior quickly.
// No account, catalogue or reward is written to Firebase.
const browser = await chromium.launch({ timeout: 20000, executablePath: process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
await context.route(/https:\/\/.*googleapis.com\//, route => route.abort());
const page = await context.newPage(), errors = [];
page.on("pageerror", error => errors.push(error.message));
const state = () => page.evaluate(() => JSON.parse(JSON.stringify(window.ng.getComponent(document.querySelector("ww-app")).game())));
const finishPlayback = () => page.evaluate(() => window.ng.getComponent(document.querySelector("ww-app")).finishPlayback());
async function send(command) {
  await page.evaluate(async command => { const a = window.ng.getComponent(document.querySelector("ww-app")); a.finishPlayback(); await a.send(command); a.finishPlayback(); }, command);
}
async function approachMechanism(id, speciesId) {
  return page.evaluate(async ({id, speciesId}) => {
    const a = window.ng.getComponent(document.querySelector("ww-app"));
    const abilities = await import("/src/app/domain/field-abilities.ts");
    const domain = await import("/src/app/domain/game.ts");
    const regions = domain.REGION_ORDER;
    const base = structuredClone(a.game());
    let found;
    for (const region of regions) {
      const game = {...base, region, scene: "exploration", battle: null};
      const mechanism = abilities.fieldMechanisms(game).find(m => m.id === id);
      if (mechanism) { found = {game,mechanism}; break; }
    }
    if (!found) throw new Error(`Missing mechanism ${id}`);
    const {game,mechanism} = found;
    const layout = domain.layoutIn(game, game.region);
    const tile = abilities.explorationTile ?? domain.explorationTile;
    const positions = [{x:mechanism.x-1,y:mechanism.y},{x:mechanism.x+1,y:mechanism.y},{x:mechanism.x,y:mechanism.y-1},{x:mechanism.x,y:mechanism.y+1},mechanism];
    const position = positions.find(p => ["ground","path","grass","healer"].includes(tile ? tile(game,p.x,p.y) : domain.mapTile(p.x,p.y,game.region)) && ![...layout.npcs,...layout.pots].some(o => o.x===p.x && o.y===p.y));
    if (!position) throw new Error(`No approach for ${id}`);
    game.player = {x:position.x,y:position.y};
    const active = game.collection.find(c=>c.id===game.activeId);
    if (speciesId) active.speciesId=speciesId;
    active.hp=domain.creatureMaxHp(active.speciesId,active.level??1,game.balance);
    a.finishPlayback(); await a.session.replaceState(game);
    return {id:mechanism.id,name:mechanism.name,element:mechanism.element};
  }, {id,speciesId});
}
async function openJournal() {
  await page.getByRole("button", {name:"Abrir menu da expedição",exact:true}).click();
  await page.locator(".drawer-navigation").getByRole("button",{name:"Mapa e diário",exact:true}).click();
  await page.locator("ww-journal-panel").getByRole("heading",{name:"Diário de exploração",exact:true}).waitFor();
}
async function npcFixture() {
  return page.evaluate(async () => {
    const a=window.ng.getComponent(document.querySelector("ww-app"));
    const {layoutIn,mapTile,creatureMaxHp}=await import("/src/app/domain/game.ts");
    const game=structuredClone(a.game()); game.region="clearing";game.scene="exploration";game.battle=null;
    const layout=layoutIn(game,"clearing"), npc=layout.npcs[0];
    const position=[{x:npc.x-1,y:npc.y},{x:npc.x+1,y:npc.y},{x:npc.x,y:npc.y-1},{x:npc.x,y:npc.y+1}].find(p=>["ground","path","grass","healer"].includes(mapTile(p.x,p.y,"clearing"))&&![...layout.npcs,...layout.pots].some(o=>o.x===p.x&&o.y===p.y));
    if(!position)throw new Error("No NPC approach");
    game.player=position;const active=game.collection.find(c=>c.id===game.activeId);active.hp=creatureMaxHp(active.speciesId,active.level??1,game.balance);
    a.finishPlayback();await a.session.replaceState(game);return {id:npc.id,name:npc.name,reward:npc.reward};
  });
}
async function weakOpponent() {
  await page.evaluate(async()=>{const a=window.ng.getComponent(document.querySelector("ww-app"));a.finishPlayback();const game=structuredClone(a.game());game.battle.enemy.hp=1;await a.session.replaceState(game);});
}
try {
  await mkdir("artifacts",{recursive:true});
  await page.goto(new URL("/jogar",process.env.BASE_URL??"http://127.0.0.1:5173").href);
  await page.waitForFunction(()=>window.ng?.getComponent(document.querySelector("ww-app"))?.loaded(),null,{timeout:20000});
  await page.evaluate(()=>{const a=window.ng.getComponent(document.querySelector("ww-app"));a.receiveAccount=()=>{};a.profile.set({uid:"activities-test",name:"Guardiã de teste",email:"activities@example.invalid",photoURL:null});a.cloudStatus.set("saved");});
  await page.getByRole("button",{name:"Começar a jornada",exact:false}).click();
  await page.getByRole("button",{name:/Começar com/}).click();
  await page.getByRole("dialog",{name:"Escolha seu Eco inicial"}).waitFor({state:"hidden"});

  // Correct elemental action, invalid element rejection and equivalent free manual route.
  await approachMechanism("clearing-lantern","WW003");
  const wrong=await state();
  await send({type:"restoreEnvironment",id:"clearing-lantern",method:"eco"});
  assert.equal((await state()).revision,wrong.revision,"Wrong element cannot restore a mechanism");
  await page.locator(".environment-controls").waitFor();
  await page.locator(".environment-controls button").filter({hasText:/manual|Alinhar|refletor/i}).first().click();
  await page.waitForFunction(()=>window.ng.getComponent(document.querySelector("ww-app")).game().fieldRestorations?.includes("clearing-lantern"));
  assert.equal((await state()).seeds,wrong.seeds);
  const once=await state();
  await send({type:"restoreEnvironment",id:"clearing-lantern",method:"manual"});
  assert.equal((await state()).revision,once.revision,"Restoration is unique");
  await approachMechanism("old-grove-garden","WW002");
  await send({type:"restoreEnvironment",id:"old-grove-garden",method:"eco"});
  for(const id of ["tide-waterwheel","canopy-beacon","tide-bridge"]){
    await approachMechanism(id);
    if(id==="tide-bridge"){
      await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
      await page.locator("canvas").screenshot({path:"artifacts/activities-bridge-before-390.png"});
    }
    await send({type:"restoreEnvironment",id,method:"manual"});
    if(id==="tide-bridge"){
      await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
      await page.locator("canvas").screenshot({path:"artifacts/activities-bridge-after-390.png"});
    }
  }
  assert.equal((await state()).fieldRestorations.length,5);
  await page.evaluate(async()=>{
    const a=window.ng.getComponent(document.querySelector("ww-app"));
    const {reduceGame}=await import("/src/app/domain/game.ts"),{isGame}=await import("/src/app/domain/save-validation.ts");
    let game={...a.game(),region:"tide-cavern",player:{x:7,y:8},scene:"exploration",battle:null};
    game=reduceGame(game,{type:"walk",dx:-1,dy:0});
    if(game.player.x!==6||!isGame(game))throw new Error("Restored bridge must be walkable and save-valid");
    const recovered=JSON.parse(JSON.stringify(game));if(!isGame(recovered))throw new Error("Restored activities JSON invalid");
    await a.session.replaceState(recovered);
  });
  await page.screenshot({path:"artifacts/activities-bridge-390.png",fullPage:true});

  // First victory keeps its original one-time economy, subsequent training is reward-free.
  const npc=await npcFixture(),beforeFirst=await state();
  await send({type:"rematchNpc",npcId:npc.id});
  assert.equal((await state()).scene,"exploration","Training requires the original duel victory");
  await send({type:"challengeNpc",npcId:npc.id}); await weakOpponent();
  await send({type:"basic",target:(await state()).battle.enemy.pos});
  const firstWin=await state();assert.equal(firstWin.battle.result,"victory");assert.equal(firstWin.seeds,beforeFirst.seeds+npc.reward);
  await send({type:"return"}); await npcFixture();
  const beforeTraining=await state();
  const activeBefore=beforeTraining.collection.find(c=>c.id===beforeTraining.activeId);
  await page.getByRole("button",{name:/Revanche de treino/}).click();
  await page.locator(".training-objective").waitFor();
  assert.equal((await state()).battle.rematch.goal,"skill");
  const noCapture=await state();await send({type:"capture"});assert.equal((await state()).revision,noCapture.revision);
  await weakOpponent();await send({type:"skill",target:(await state()).battle.enemy.pos});
  const trained=await state(),activeAfter=trained.collection.find(c=>c.id===trained.activeId);
  assert.equal(trained.battle.result,"victory");assert.equal(trained.seeds,beforeTraining.seeds);
  assert.equal(activeAfter.level,activeBefore.level);assert.equal(activeAfter.experience,activeBefore.experience);
  assert.equal(trained.trainingRecords[npc.id].wins,1);assert.ok(trained.trainingRecords[npc.id].goals.includes("skill"));
  await send({type:"return"});await npcFixture();await send({type:"rematchNpc",npcId:npc.id});
  assert.equal((await state()).battle.rematch.goal,"guard");
  await send({type:"defend"});await weakOpponent();await send({type:"basic",target:(await state()).battle.enemy.pos});
  const second=await state();assert.equal(second.trainingRecords[npc.id].wins,2);assert.ok(second.trainingRecords[npc.id].goals.includes("guard"));
  assert.equal(second.seeds,beforeTraining.seeds);assert.equal(second.collection.find(c=>c.id===second.activeId).experience,activeBefore.experience);
  await send({type:"return"});
  await page.evaluate(async()=>{const a=window.ng.getComponent(document.querySelector("ww-app")),{isGame}=await import("/src/app/domain/save-validation.ts");const recovered=JSON.parse(JSON.stringify(a.game()));if(!isGame(recovered))throw new Error("Training records must round-trip");await a.session.replaceState(recovered);});

  await openJournal();
  const panel=page.locator("ww-journal-panel"),drawer=page.getByRole("dialog",{name:"Menu da expedição",exact:true});
  await panel.getByRole("button",{name:"Atividades de campo",exact:true}).click();
  await panel.locator(".journal-field-list").waitFor();
  assert.equal(await panel.locator(".journal-field-list > *").count(),5);
  await panel.locator(".journal-training-list").waitFor();
  assert.match(await panel.locator(".journal-training-list").innerText(),/2/);
  for(const[width,height]of[[320,568],[390,844],[768,1024],[1360,900]]){
    await page.setViewportSize({width,height});
    await page.waitForFunction(()=>document.documentElement.scrollWidth<=innerWidth);
    const box=await drawer.boundingBox();assert.ok(box.x>=0&&box.y>=0&&box.x+box.width<=width+1&&box.height<=height+1);
    assert.ok(await panel.evaluate(el=>el.scrollWidth<=el.clientWidth+1));
    await panel.locator(".journal-field-list").evaluate(el=>el.scrollIntoView({block:"start"}));
    await page.screenshot({path:`artifacts/activities-journal-${width}.png`});
  }
  await page.keyboard.press("Escape");await drawer.waitFor({state:"hidden"});
  await page.waitForFunction(()=>document.activeElement?.getAttribute("aria-label")==="Abrir menu da expedição");
  assert.deepEqual(errors,[]);
  console.log("Activities browser passed: elemental/manual restoration, unique completion, five mechanisms, bridge save, first duel reward, reward-free rematches, goals/records, capture rejection, focus and four responsive sizes.");
}catch(error){console.log(await page.evaluate(()=>({body:document.body.innerText.slice(-2200),game:window.ng?.getComponent(document.querySelector("ww-app"))?.game()})).catch(()=>null));throw error;}
finally{await browser.close();}
