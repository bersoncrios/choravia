import type { AudioCue, AudioMix, AudioScene } from "../domain/audio.js";

interface AudioScheduler {
  set(callback: () => void, delay: number): unknown;
  clear(handle: unknown): void;
  now(): number;
}
type Channel = "music" | "ambience" | "effects";
interface Voice { oscillator: OscillatorNode; gain: GainNode; channel: Channel }
interface Note { frequency: number; end?: number; duration: number; delay?: number; shape?: OscillatorType; volume?: number }
const scheduler: AudioScheduler = {
  set: (callback, delay) => setTimeout(callback, delay),
  clear: handle => clearTimeout(handle as ReturnType<typeof setTimeout>),
  now: () => performance.now(),
};
const PALETTES = {
  clearing: { notes: [392, 494, 587, 494, 440, 392, 330, 392], root: 196, air: 1175, shape: "sine" as const },
  "old-grove": { notes: [294, 349, 440, 392, 349, 294, 262, 294], root: 147, air: 880, shape: "triangle" as const },
  "canopy-trail": { notes: [440, 554, 659, 554, 494, 440, 370, 440], root: 220, air: 1480, shape: "sine" as const },
  "tide-cavern": { notes: [262, 311, 392, 349, 311, 262, 233, 262], root: 131, air: 660, shape: "sine" as const },
  "firefly-marsh": { notes: [330, 392, 494, 587, 494, 392, 349, 330], root: 165, air: 1760, shape: "triangle" as const },
};
const clamp = (value: number): number => Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;

/** Optional presentation only. A gesture is the sole entry point that creates/resumes audio. */
export class GameAudio {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private channels: Record<Channel, GainNode> | null = null;
  private mix: AudioMix = { master: 0.6, music: 0.3, ambience: 0.45, effects: 0.7 };
  private enabled = false;
  private scene: AudioScene = { region: "clearing", battle: false, active: false };
  private gestureReady = false;
  private resuming = false;
  private epoch = 0;
  private timer: unknown = null;
  private beat = 0;
  private lastStep = -Infinity;
  private voices = new Set<Voice>();
  private closed = false;

  constructor(private readonly createContext: () => AudioContext = () => new AudioContext(), private readonly clock: AudioScheduler = scheduler) {}

  configure(enabled: boolean, mix: AudioMix): void {
    if (this.closed) return;
    const wasEnabled = this.enabled;
    this.enabled = enabled;
    this.mix = { master: clamp(mix.master), music: clamp(mix.music), ambience: clamp(mix.ambience), effects: clamp(mix.effects) };
    this.applyMix();
    if (!enabled) { if (wasEnabled || this.context) this.pause(); return; }
    if (!this.mix.master) this.stopVoices();
    else for (const channel of ["music", "ambience", "effects"] as const) if (!this.mix[channel]) this.stopVoices(channel);
    this.syncLoop();
  }

  unlock(): void {
    if (this.closed || !this.enabled || !this.scene.active) return;
    try {
      if (!this.context) {
        const context = this.createContext();
        this.context = context;
        this.master = context.createGain();
        this.channels = { music: context.createGain(), ambience: context.createGain(), effects: context.createGain() };
        for (const channel of Object.values(this.channels)) channel.connect(this.master);
        this.master.connect(context.destination);
        this.applyMix();
      }
      if (this.context.state === "closed") return;
      this.gestureReady = true;
      if (this.context.state === "running") { this.syncLoop(); return; }
      if (this.resuming) return;
      this.resuming = true;
      const epoch = this.epoch;
      void this.context.resume().then(() => {
        if (epoch !== this.epoch || this.closed) {
          if ((!this.enabled || !this.scene.active || this.closed) && this.context?.state === "running") {
            try { void this.context.suspend().catch(() => {}); } catch { /* A stale resume cannot revive a hidden scene. */ }
          }
          return;
        }
        this.resuming = false;
        this.syncLoop();
      }).catch(() => {
        if (epoch === this.epoch) { this.resuming = false; this.gestureReady = false; }
      });
    } catch { this.gestureReady = false; this.resuming = false; }
  }

  setScene(scene: AudioScene): void {
    if (this.closed) return;
    const changed = scene.region !== this.scene.region || scene.battle !== this.scene.battle;
    const wasActive = this.scene.active;
    this.scene = { ...scene };
    if (!scene.active) { if (wasActive || this.timer !== null || this.voices.size) this.pause(); return; }
    if (changed) { this.cancelLoop(); this.stopVoices("music"); this.stopVoices("ambience"); this.beat = 0; }
    this.syncLoop();
  }

  cue(name: AudioCue, variant = ""): void {
    if (!this.canPlay() || !this.mix.effects) return;
    if (name === "step") {
      const now = this.clock.now();
      if (now - this.lastStep < 140) return;
      this.lastStep = now;
    }
    for (const note of this.cueNotes(name, variant)) this.note("effects", note);
  }

  /** Retained for older callers while actions migrate to descriptive cues. */
  play(success = false): void { this.cue(success ? "capture" : "confirm"); }

  close(): void {
    if (this.closed) return;
    this.closed = true; this.epoch++; this.gestureReady = false; this.resuming = false;
    this.cancelLoop(); this.stopVoices();
    const context = this.context;
    this.context = null; this.channels = null; this.master = null;
    if (context && context.state !== "closed") {
      try { void context.close().catch(() => {}); } catch { /* No audio failure changes the game. */ }
    }
  }

  private applyMix(): void {
    const context = this.context;
    if (!context || !this.master || !this.channels || context.state === "closed") return;
    try {
      this.master.gain.setTargetAtTime(this.enabled ? this.mix.master : 0, context.currentTime, 0.025);
      for (const channel of ["music", "ambience", "effects"] as const) this.channels[channel].gain.setTargetAtTime(this.mix[channel], context.currentTime, 0.025);
    } catch { /* An unavailable audio device is harmless. */ }
  }

  private canPlay(): boolean {
    return !this.closed && this.enabled && this.scene.active && this.gestureReady && !!this.mix.master && this.context?.state === "running";
  }

  private pause(): void {
    this.epoch++; this.gestureReady = false; this.resuming = false;
    this.cancelLoop(); this.stopVoices(); this.lastStep = -Infinity;
    if (this.context?.state === "running") {
      try { void this.context.suspend().catch(() => {}); } catch { /* Keep presentation optional. */ }
    }
  }

  private cancelLoop(): void {
    if (this.timer !== null) { this.clock.clear(this.timer); this.timer = null; }
  }

  private syncLoop(): void {
    if (!this.canPlay() || !(this.mix.music || (!this.scene.battle && this.mix.ambience))) { this.cancelLoop(); return; }
    if (this.timer !== null) return;
    // Only one outstanding callback. A repeated scene update never restarts a motif.
    this.timer = this.clock.set(() => {
      this.timer = null;
      if (!this.canPlay()) return;
      this.loopBeat();
      this.syncLoop();
    }, this.scene.battle ? 650 : 900);
  }

  private loopBeat(): void {
    const palette = PALETTES[this.scene.region];
    if (!palette) return;
    if (this.mix.music) {
      if (this.scene.battle) {
        const melody = [palette.root * 2, palette.root * 2.5, palette.root * 3, palette.root * 2.25];
        this.note("music", {frequency: melody[this.beat % melody.length]!, duration: 0.37, shape: "triangle", volume: 0.028});
        if (this.beat % 4 === 0) this.note("music", {frequency: palette.root / 2, duration: 0.5, shape: "sine", volume: 0.022});
      } else if (this.beat % 2 === 0) {
        this.note("music", {frequency: palette.notes[(this.beat / 2) % palette.notes.length]!, duration: 0.85, shape: palette.shape, volume: 0.028});
      }
    }
    if (this.mix.ambience && !this.scene.battle && this.beat % 3 === 0) {
      const cavern = this.scene.region === "tide-cavern";
      this.note("ambience", {frequency: palette.air, end: cavern ? palette.air * 0.92 : palette.air * 1.18, duration: cavern ? 0.6 : 0.24, shape: "sine", volume: 0.014});
      if (this.scene.region === "canopy-trail") this.note("ambience", {frequency: palette.air * 0.75, duration: 0.17, delay: 0.22, volume: 0.01});
    }
    this.beat = (this.beat + 1) % 96;
  }

  private cueNotes(name: AudioCue, variant: string): Note[] {
    switch (name) {
      case "step": return [{frequency: variant === "water" ? 210 : variant === "grass" ? 150 : variant === "path" ? 110 : 130, end: 70, duration: 0.055, shape: "triangle", volume: 0.022}];
      case "attack": return [{frequency: 190, end: 80, duration: 0.12, shape: "triangle", volume: 0.045}];
      case "skill": {
        const voices: Record<string, Note> = {
          fire: {frequency: 220, end: 490, duration: 0.22, shape: "sawtooth", volume: 0.023},
          plant: {frequency: 392, end: 294, duration: 0.24, shape: "triangle", volume: 0.038},
          water: {frequency: 330, end: 660, duration: 0.3, volume: 0.04},
          electric: {frequency: 740, end: 220, duration: 0.16, shape: "square", volume: 0.018},
          earth: {frequency: 110, end: 55, duration: 0.28, shape: "triangle", volume: 0.045},
        };
        return [voices[variant] ?? {frequency: 440, end: 660, duration: 0.23, volume: 0.035}];
      }
      case "defend": return [{frequency: 196, end: 261, duration: 0.2, shape: "triangle", volume: 0.035}];
      case "capture": return [{frequency: 523, duration: 0.3, volume: 0.04}, {frequency: 784, duration: 0.4, delay: 0.1, volume: 0.032}];
      case "resist": return [{frequency: 262, end: 175, duration: 0.24, volume: 0.03}];
      case "collect": return [{frequency: 659, duration: 0.14, volume: 0.03}, {frequency: 880, duration: 0.18, delay: 0.08, volume: 0.024}];
      case "restore": return [{frequency: 392, duration: 0.5, volume: 0.035}, {frequency: 587, duration: 0.6, delay: 0.08, volume: 0.03}];
      case "portal": return [{frequency: 294, end: 587, duration: 0.42, volume: 0.033}, {frequency: 440, duration: 0.32, delay: 0.12, volume: 0.025}];
      case "level": return [{frequency: 523, duration: 0.35, volume: 0.035}, {frequency: 1046, duration: 0.5, delay: 0.12, volume: 0.025}];
      default: return [{frequency: 440, end: 554, duration: 0.13, volume: 0.025}];
    }
  }

  private note(channel: Channel, note: Note): void {
    const context = this.context, output = this.channels?.[channel];
    if (!context || !output || !this.canPlay() || !this.mix[channel] || this.voices.size >= 12) return;
    let voice: Voice | undefined;
    try {
      const oscillator = context.createOscillator(), gain = context.createGain();
      voice = {oscillator, gain, channel};
      const start = context.currentTime + (note.delay ?? 0), end = start + note.duration;
      oscillator.type = note.shape ?? "sine";
      oscillator.frequency.setValueAtTime(note.frequency, start);
      if (note.end) oscillator.frequency.exponentialRampToValueAtTime(note.end, end);
      gain.gain.setValueAtTime(0.0001, context.currentTime);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(note.volume ?? 0.03, start + Math.min(0.025, note.duration / 4));
      gain.gain.exponentialRampToValueAtTime(0.0001, end);
      oscillator.connect(gain); gain.connect(output);
      this.voices.add(voice);
      oscillator.onended = () => { if (voice) this.disposeVoice(voice); };
      oscillator.start(start); oscillator.stop(end + 0.02);
    } catch { if (voice) this.disposeVoice(voice); }
  }

  private disposeVoice(voice: Voice): void {
    this.voices.delete(voice);
    voice.oscillator.onended = null;
    try { voice.oscillator.disconnect(); voice.gain.disconnect(); } catch { /* Already disconnected. */ }
  }

  private stopVoices(channel?: Channel): void {
    for (const voice of this.voices) {
      if (channel && voice.channel !== channel) continue;
      try { voice.oscillator.stop(); } catch { /* Already ended. */ }
      this.disposeVoice(voice);
    }
  }
}
