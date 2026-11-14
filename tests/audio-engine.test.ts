import test from "node:test";
import assert from "node:assert/strict";
import { GameAudio } from "../src/app/adapters/audio.js";
import type { AudioMix, AudioScene } from "../src/app/domain/audio.js";

class FakeParam {
  value = 1;
  setValueAtTime(value: number): void { this.value = value; }
  setTargetAtTime(value: number): void { this.value = value; }
  exponentialRampToValueAtTime(value: number): void { this.value = value; }
}
class FakeGain {
  gain = new FakeParam();
  connected = false;
  connect(): void { this.connected = true; }
  disconnect(): void { this.connected = false; }
}
class FakeOscillator {
  type = "sine";
  frequency = new FakeParam();
  onended: (() => void) | null = null;
  started = false;
  stopped = false;
  connected = false;
  connect(): void { this.connected = true; }
  disconnect(): void { this.connected = false; }
  start(): void { this.started = true; }
  stop(at?: number): void { if (at === undefined) { this.stopped = true; this.onended?.(); } }
  finish(): void { this.stopped = true; this.onended?.(); }
}
class FakeContext {
  state: AudioContextState = "suspended";
  currentTime = 10;
  destination = {};
  gains: FakeGain[] = [];
  oscillators: FakeOscillator[] = [];
  resumes = 0;
  suspends = 0;
  closes = 0;
  resumeFailure = false;
  resumeHook: (() => Promise<void>) | undefined;
  createGain(): FakeGain { const gain = new FakeGain(); this.gains.push(gain); return gain; }
  createOscillator(): FakeOscillator { const oscillator = new FakeOscillator(); this.oscillators.push(oscillator); return oscillator; }
  async resume(): Promise<void> {
    this.resumes++;
    if (this.resumeFailure) throw new Error("Device unavailable");
    if (this.resumeHook) await this.resumeHook();
    this.state = "running";
  }
  async suspend(): Promise<void> { this.suspends++; this.state = "suspended"; }
  async close(): Promise<void> { this.closes++; this.state = "closed"; }
}
class FakeScheduler {
  callbacks = new Map<number, () => void>();
  time = 0;
  private serial = 0;
  set(callback: () => void, _delay: number): number { const id = ++this.serial; this.callbacks.set(id, callback); return id; }
  clear(handle: unknown): void { this.callbacks.delete(Number(handle)); }
  now(): number { return this.time; }
  tick(): void {
    const entry = this.callbacks.entries().next().value as [number, () => void] | undefined;
    if (!entry) return;
    this.callbacks.delete(entry[0]); this.time += 900; entry[1]();
  }
}
const MIX: AudioMix = {master: .6, music: .3, ambience: .4, effects: .7};
const SCENE: AudioScene = {region: "clearing", battle: false, active: true};
const settled = async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); };
function fixture() {
  const context = new FakeContext(), clock = new FakeScheduler(); let creations = 0;
  const audio = new GameAudio(() => { creations++; return context as unknown as AudioContext; }, clock);
  return {audio, context, clock, creations: () => creations};
}

test("audio never creates a device or schedules playback before an enabled active user gesture", async () => {
  const f = fixture();
  f.audio.configure(true, MIX); f.audio.setScene(SCENE); f.audio.cue("capture");
  assert.equal(f.creations(), 0); assert.equal(f.clock.callbacks.size, 0);
  f.audio.setScene({...SCENE, active: false}); f.audio.unlock(); assert.equal(f.creations(), 0);
  f.audio.setScene(SCENE); f.audio.configure(false, MIX); f.audio.unlock(); assert.equal(f.creations(), 0);
  f.audio.configure(true, MIX); f.audio.unlock(); await settled();
  assert.equal(f.creations(), 1); assert.equal(f.context.resumes, 1); assert.equal(f.clock.callbacks.size, 1);
  f.audio.close();
});
test("a single scheduler serves repeated scene updates and silent channels create no voices", async () => {
  const f = fixture(); f.audio.configure(true, MIX); f.audio.setScene(SCENE); f.audio.unlock(); await settled();
  for (let n = 0; n < 30; n++) { f.audio.setScene(SCENE); f.audio.configure(true, MIX); }
  assert.equal(f.clock.callbacks.size, 1);
  f.clock.tick(); assert.ok(f.context.oscillators.length > 0); assert.equal(f.clock.callbacks.size, 1);
  f.audio.configure(true, {...MIX,music:0,ambience:0});
  assert.equal(f.clock.callbacks.size, 0);
  const start = f.context.oscillators.length; f.audio.cue("collect"); assert.equal(f.context.oscillators.length-start, 2);
  f.audio.configure(true, {...MIX,music:0,ambience:0,effects:0}); f.audio.cue("capture");
  assert.equal(f.context.oscillators.length, start+2);
  assert.ok(f.context.oscillators.every(o => o.stopped));
  f.audio.configure(true, {...MIX,master:0}); assert.equal(f.clock.callbacks.size, 0);
  f.audio.close();
});
test("step throttling and the voice cap bound rapid inputs, with ended voices released", async () => {
  const f = fixture(); f.audio.configure(true, {...MIX,music:0,ambience:0}); f.audio.setScene(SCENE); f.audio.unlock(); await settled();
  f.audio.cue("step","grass"); f.audio.cue("step","path"); assert.equal(f.context.oscillators.length, 1);
  f.clock.time = 140; f.audio.cue("step","path"); assert.equal(f.context.oscillators.length, 2);
  for (let n=0; n<50; n++) f.audio.cue("collect");
  assert.equal(f.context.oscillators.length, 12);
  f.context.oscillators[0]!.finish(); f.audio.cue("confirm"); assert.equal(f.context.oscillators.length, 13);
  f.audio.close(); assert.ok(f.context.oscillators.every(o=>!o.connected));
});
test("hiding and disabling cancel sound immediately and reactivation requires another gesture", async () => {
  const f = fixture(); f.audio.configure(true,MIX); f.audio.setScene(SCENE); f.audio.unlock(); await settled();
  f.audio.cue("portal"); f.audio.setScene({...SCENE,active:false});
  assert.equal(f.context.suspends,1); assert.equal(f.clock.callbacks.size,0); assert.ok(f.context.oscillators.every(o=>o.stopped));
  f.audio.setScene(SCENE); f.audio.cue("confirm"); assert.equal(f.clock.callbacks.size,0); assert.equal(f.context.resumes,1);
  f.audio.unlock(); await settled(); assert.equal(f.clock.callbacks.size,1); assert.equal(f.context.resumes,2);
  f.audio.configure(false,MIX); assert.equal(f.clock.callbacks.size,0); assert.equal(f.context.suspends,2);
  f.audio.configure(true,MIX); assert.equal(f.clock.callbacks.size,0);
  f.audio.close(); f.audio.close(); assert.equal(f.context.closes,1);
  f.audio.unlock(); assert.equal(f.creations(),1);
});
test("rejected and stale device resumes cannot produce background playback", async () => {
  const failed = fixture(); failed.context.resumeFailure=true;
  failed.audio.configure(true,MIX); failed.audio.setScene(SCENE); failed.audio.unlock(); await settled();
  assert.equal(failed.clock.callbacks.size,0); failed.audio.cue("confirm"); assert.equal(failed.context.oscillators.length,0);
  failed.context.resumeFailure=false; failed.audio.unlock(); await settled(); assert.equal(failed.clock.callbacks.size,1); failed.audio.close();
  const stale = fixture(); let release!: () => void;
  stale.context.resumeHook=()=>new Promise(resolve=>{release=resolve;});
  stale.audio.configure(true,MIX); stale.audio.setScene(SCENE); stale.audio.unlock();
  stale.audio.setScene({...SCENE,active:false}); release(); await settled();
  assert.equal(stale.context.state,"suspended"); assert.equal(stale.clock.callbacks.size,0); stale.audio.close();
});
test("biomes, battle motifs and skill variants produce distinct musical signatures", async () => {
  const f = fixture(); f.audio.configure(true,MIX); f.audio.setScene(SCENE); f.audio.unlock(); await settled();
  const signatures:number[]=[];
  for(const region of ["clearing","old-grove","canopy-trail","tide-cavern"] as const) {
    f.audio.setScene({...SCENE,region}); const before=f.context.oscillators.length; f.clock.tick();
    signatures.push(f.context.oscillators[before]!.frequency.value);
  }
  assert.equal(new Set(signatures).size,4);
  f.audio.setScene({...SCENE,battle:true}); assert.equal(f.clock.callbacks.size,1); f.clock.tick();
  const notes=f.context.oscillators.slice(-2); assert.equal(notes[0]!.type,"triangle");
  for(const oscillator of f.context.oscillators) oscillator.finish();
  const types:string[]=[];
  for(const element of ["fire","plant","water","electric","earth"]) {
    const before=f.context.oscillators.length; f.audio.cue("skill",element); types.push(f.context.oscillators[before]!.type);
  }
  assert.ok(new Set(types).size>=3); f.audio.close();
});
