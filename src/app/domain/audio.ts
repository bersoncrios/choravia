import type { Region } from "./game.js";

export interface AudioMix { master: number; music: number; ambience: number; effects: number }
export type AudioChannel = keyof AudioMix;
export type AudioCue = "step" | "attack" | "skill" | "defend" | "capture" | "resist" | "collect" | "restore" | "portal" | "level" | "confirm";
export interface AudioScene { region: Region; battle: boolean; active: boolean }
export const DEFAULT_AUDIO_MIX: Readonly<AudioMix> = {master: 0.6, music: 0.3, ambience: 0.45, effects: 0.7};
export function normalizeAudioMix(value: unknown): AudioMix {
  const raw = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const channel = (id: AudioChannel): number => typeof raw[id] === "number" && Number.isFinite(raw[id]) ? Math.min(1, Math.max(0, raw[id] as number)) : DEFAULT_AUDIO_MIX[id];
  return {master: channel("master"), music: channel("music"), ambience: channel("ambience"), effects: channel("effects")};
}
