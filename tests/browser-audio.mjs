import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";

// Synthetic account and local commands only; all Google/Firebase requests are blocked.
// WebAudio graphs are inspected for behavior, not judged as a subjective listening test.
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true });
const context = await browser.newContext({viewport:{width:390,height:844},reducedMotion:"reduce"});
await context.route(/https:\/\/.*googleapis.com\//, route => route.abort());
await context.addInitScript(() => {
  const NativeAudioContext = window.AudioContext;
  window.__audioStats = {created:0,resumes:0,suspends:0,closes:0,oscillators:0,starts:0,stops:0};
  window.__audioContexts = [];
  if (!NativeAudioContext) return;
  window.AudioContext = class ObservedAudioContext extends NativeAudioContext {
    constructor(...args) { super(...args); window.__audioStats.created++; window.__audioContexts.push(this); }
    resume() { window.__audioStats.resumes++; return super.resume(); }
    suspend() { window.__audioStats.suspends++; return super.suspend(); }
    close() { window.__audioStats.closes++; return super.close(); }
    createOscillator() {
      const node = super.createOscillator(), start = node.start.bind(node), stop = node.stop.bind(node);
      window.__audioStats.oscillators++;
      node.start = (...args) => { window.__audioStats.starts++; return start(...args); };
      node.stop = (...args) => { window.__audioStats.stops++; return stop(...args); };
      return node;
    }
  };
});
const page = await context.newPage(), errors=[];
page.on("pageerror",error=>errors.push(error.message));
const settings = page.getByRole("dialog",{name:"Configurações",exact:true});
const stats = () => page.evaluate(()=>({...window.__audioStats}));
const prefs = () => page.evaluate(()=>window.ng.getComponent(document.querySelector("ww-app")).prefs());
async function boot() {
  await page.goto(new URL("/jogar",process.env.BASE_URL??"http://127.0.0.1:5173").href);
  await page.waitForFunction(()=>window.ng?.getComponent(document.querySelector("ww-app"))?.loaded());
  await page.evaluate(async()=>{
    const a=window.ng.getComponent(document.querySelector("ww-app"));
    a.receiveAccount=()=>{};a.profile.set({uid:"audio-test",name:"Guardiã de teste",email:"audio@example.invalid",photoURL:null});a.cloudStatus.set("saved");
    const {initialGame}=await import("/src/app/domain/game.ts"),{DEFAULT_AVATAR}=await import("/src/app/domain/avatar.ts");
    const g=initialGame(827361);g.avatar={...DEFAULT_AVATAR};g.starterChosen=true;
    await a.session.replaceState(g);a.game.set(g);
  });
  await page.waitForFunction(()=>{const a=window.ng.getComponent(document.querySelector("ww-app"));return !!a.game().avatar&&a.game().starterChosen===true;});
}
async function openSettings() {
  await page.getByRole("button",{name:"Abrir configurações",exact:true}).click();
  await settings.waitFor();
}
async function setVolume(label,value) {
  const slider=settings.getByRole("slider",{name:label,exact:true});
  await slider.fill(String(value));
  await slider.dispatchEvent("input");
}
try {
  await mkdir("artifacts",{recursive:true});
  await boot();
  assert.equal((await stats()).created,0,"audio must stay uninitialized while disabled");
  assert.equal((await prefs()).sound,false);
  await openSettings();
  assert.equal((await stats()).created,0,"opening settings with sound disabled cannot create AudioContext");
  await settings.getByLabel("Sons da floresta",{exact:true}).check();
  await page.waitForFunction(()=>window.__audioStats.created===1);
  await page.waitForFunction(()=>window.__audioContexts[0]?.state==="running");
  assert.equal((await prefs()).sound,true);
  await setVolume("Volume geral",45);
  await setVolume("Música",0);
  await setVolume("Ambiente",0);
  await setVolume("Efeitos",65);
  await page.waitForFunction(()=>{const p=window.ng.getComponent(document.querySelector("ww-app")).prefs();return p.audio.master===.45&&p.audio.music===0&&p.audio.ambience===0&&p.audio.effects===.65;});
  assert.deepEqual((await prefs()).audio,{master:.45,music:0,ambience:0,effects:.65});
  const beforePreview=await stats();
  await settings.getByRole("button",{name:"Ouvir prévia",exact:true}).click();
  await page.waitForFunction(before=>window.__audioStats.starts>before,beforePreview.starts);
  await setVolume("Efeitos",0);
  await page.waitForFunction(()=>{
    const a=window.ng.getComponent(document.querySelector("ww-app"));
    return a.prefs().audio.music===0&&a.prefs().audio.ambience===0&&a.prefs().audio.effects===0&&a.audio.timer===null;
  });
  const muted=await stats();
  await settings.getByRole("button",{name:"Ouvir prévia",exact:true}).click();
  assert.equal((await stats()).starts,muted.starts,"muted effect channel cannot schedule sound");
  assert.equal(await page.evaluate(()=>window.ng.getComponent(document.querySelector("ww-app")).audio.timer),null,"muted music and ambience leave no background timer");
  await setVolume("Efeitos",65);
  await page.evaluate(()=>{
    const a=window.ng.getComponent(document.querySelector("ww-app")), audio=a.audio;
    audio.configure(true,{master:.45,music:.2,ambience:.3,effects:.65});
    const scene={region:a.game().region??"clearing",battle:false,active:true};
    audio.setScene(scene);const timer=audio.timer;
    if(timer===null)throw new Error("Enabled background channels need one scheduler");
    for(let i=0;i<20;i++)audio.setScene(scene);
    if(timer!==audio.timer)throw new Error("Repeated scene updates restarted the scheduler");
    for(let i=0;i<30;i++)audio.cue("confirm");
    if(audio.voices.size>12)throw new Error("Voice cap exceeded");
    a.refreshAudioScene();
  });

  // Real local dispatches choose feedback only after an accepted movement or portal.
  await page.keyboard.press("Escape");await settings.waitFor({state:"hidden"});
  await page.evaluate(async()=>{
    const a=window.ng.getComponent(document.querySelector("ww-app"));
    const {reduceGame}=await import("/src/app/domain/game.ts");
    window.__playedCues=[];
    const original=a.audio.cue.bind(a.audio);
    a.audio.cue=(...args)=>{window.__playedCues.push(args);return original(...args);};
    const command={type:"walk",dx:1,dy:0};
    const g={...a.game(),region:"clearing",player:{x:9,y:10},worldLayouts:{...a.game().worldLayouts,clearing:{pots:[],npcs:[]}}};
    const after=reduceGame(g,command);
    if(after===g)throw new Error("Expected a valid exploration step");
    a.session.state=after;a.game.set(after);a.presentCommand(g,command);
    const accepted=window.__playedCues.length;
    const rejected={type:"walk",dx:4,dy:0};
    const unchanged=reduceGame(after,rejected);a.presentCommand(after,rejected);
    if(unchanged!==after)throw new Error("Invalid test movement unexpectedly changed the game");
    if(window.__playedCues.length!==accepted)throw new Error("Rejected movement played sound");
    const portal={...after,player:{x:16,y:10}},portalCommand={type:"walk",dx:1,dy:0};
    const arrived=reduceGame(portal,portalCommand);
    if(arrived===portal||arrived.region!=="old-grove")throw new Error("Expected an accepted portal transition");
    a.session.state=arrived;a.game.set(arrived);a.presentCommand(portal,portalCommand);
  });
  const cues=await page.evaluate(()=>window.__playedCues);
  assert.ok(cues.some(([cue])=>cue==="step"));
  assert.ok(cues.some(([cue])=>cue==="portal"));

  // Hidden/background scenes stop activity; returning to the game waits for a gesture.
  const beforeHide=await stats();
  await page.evaluate(()=>{Object.defineProperty(document,"hidden",{configurable:true,get:()=>true});document.dispatchEvent(new Event("visibilitychange"));});
  await page.waitForFunction(()=>window.__audioContexts[0]?.state==="suspended");
  assert.ok((await stats()).suspends>beforeHide.suspends);
  await page.evaluate(()=>{Object.defineProperty(document,"hidden",{configurable:true,get:()=>false});document.dispatchEvent(new Event("visibilitychange"));});
  await openSettings();
  await page.waitForFunction(()=>window.__audioContexts[0]?.state==="running");
  assert.equal((await stats()).created,1,"resume must reuse a single context");
  await settings.getByLabel("Sons da floresta",{exact:true}).uncheck();
  await page.waitForFunction(()=>window.__audioContexts[0]?.state==="suspended");
  assert.equal((await prefs()).sound,false);
  await settings.getByLabel("Sons da floresta",{exact:true}).check();
  await page.waitForFunction(()=>window.__audioContexts[0]?.state==="running");
  assert.equal((await stats()).created,1);

  for(const [width,height]of [[320,568],[390,844],[768,1024],[1360,900]]){
    await page.setViewportSize({width,height});
    await settings.getByRole("slider",{name:"Volume geral",exact:true}).scrollIntoViewIfNeeded();
    await page.waitForFunction(()=>document.documentElement.scrollWidth<=innerWidth);
    const box=await settings.boundingBox();assert.ok(box.x>=0&&box.y>=0&&box.x+box.width<=width+1&&box.height<=height+1);
    for(const label of ["Volume geral","Música","Ambiente","Efeitos"]){const slider=settings.getByRole("slider",{name:label,exact:true});assert.equal(await slider.getAttribute("min"),"0");assert.equal(await slider.getAttribute("max"),"100");}
    await page.screenshot({path:`artifacts/audio-settings-${width}.png`});
  }
  await page.keyboard.press("Escape");await settings.waitFor({state:"hidden"});
  await page.evaluate(()=>window.ng.getComponent(document.querySelector("ww-app")).showPresentation());
  await page.waitForFunction(()=>window.__audioContexts[0]?.state==="suspended");
  await page.evaluate(()=>window.ng.getComponent(document.querySelector("ww-app")).enterJourney());
  await openSettings();
  await page.waitForFunction(()=>window.__audioContexts[0]?.state==="running");
  await page.evaluate(()=>window.ng.getComponent(document.querySelector("ww-app")).audio.close());
  await page.waitForFunction(()=>window.__audioContexts[0]?.state==="closed");
  assert.equal(await page.evaluate(()=>window.ng.getComponent(document.querySelector("ww-app")).audio.voices.size),0);
  assert.equal(await page.evaluate(()=>window.ng.getComponent(document.querySelector("ww-app")).audio.timer),null);
  await boot();
  assert.equal((await stats()).created,0,"reloading enabled preferences still requires a gesture");
  assert.deepEqual((await prefs()).audio,{master:.45,music:0,ambience:0,effects:.65});
  await openSettings();await page.waitForFunction(()=>window.__audioStats.created===1);
  await page.keyboard.press("Escape");

  // Old preferences retain existing settings while receiving the new volume defaults.
  await page.evaluate(()=>localStorage.setItem("wildwoods-preferences",JSON.stringify({sound:false,reduced:true,timing:true})));
  await boot();
  const migrated=await prefs();
  assert.equal(migrated.sound,false);assert.equal(migrated.reduced,true);assert.equal(migrated.timing,true);
  assert.deepEqual(migrated.audio,{master:.6,music:.3,ambience:.45,effects:.7});
  assert.equal((await stats()).created,0);
  assert.deepEqual(errors,[]);
  console.log("Audio browser passed: gesture-only start, independent volumes, muted effects, accepted movement/portal cues, visibility suspension/resume, preference persistence/migration and four responsive sizes.");
}catch(error){console.log(await page.evaluate(()=>({text:document.body.innerText.slice(-1800),stats:window.__audioStats,prefs:window.ng?.getComponent(document.querySelector("ww-app"))?.prefs()})).catch(()=>null));throw error;}
finally{await browser.close();}
