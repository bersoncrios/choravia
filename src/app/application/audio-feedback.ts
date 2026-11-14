import { creatureLevel, same, species, type Command, type Game, type TurnFrame } from "../domain/game.js";
import { explorationTile } from "../domain/field-abilities.js";
import type { AudioCue } from "../domain/audio.js";

export interface SoundFeedback { cue: AudioCue; variant?: string }
export function levelIncreased(before: Game, after: Game): boolean {
  return before.collection.some(old => after.collection.some(next => next.id === old.id && creatureLevel(next) > creatureLevel(old)));
}
export function battleFrameSound(frame: TurnFrame, game: Game): SoundFeedback | null {
  if (frame.action === "capture") return {cue: game.battle?.result === "capture" ? "capture" : "resist"};
  if (frame.action === "skill") return {cue: "skill", variant: species(frame.actor === "player" ? frame.ally.speciesId : frame.enemy.speciesId).element};
  if (frame.action === "basic") return {cue: "attack"};
  if (frame.action === "defend") return {cue: "defend"};
  return null;
}
/** Accepted snapshots choose sounds; input attempts never play reward or attack feedback. */
export function commandSound(before: Game, after: Game, command: Command): SoundFeedback | null {
  if (before === after || before.revision === after.revision) return null;
  if (command.type === "walk") {
    if ((before.region ?? "clearing") !== (after.region ?? "clearing")) return {cue: "portal"};
    if (after.scene === "battle") return {cue: "confirm", variant: "encounter"};
    return !same(before.player, after.player) ? {cue: "step", variant: explorationTile(after, after.player.x, after.player.y)} : null;
  }
  if (command.type === "restoreEnvironment" || command.type === "interact" && (after.resonanceStep ?? 0) > (before.resonanceStep ?? 0)) return {cue: "restore"};
  if (levelIncreased(before, after)) return {cue: "level"};
  if (command.type === "capture") return {cue: after.battle?.result === "capture" ? "capture" : "resist"};
  if (command.type === "basic") return {cue: "attack"};
  if (command.type === "skill") return {cue: "skill", variant: species(before.collection.find(c => c.id === before.activeId)!.speciesId).element};
  if (command.type === "defend") return {cue: "defend"};
  if (command.type === "breakPot" || command.type === "applyDailyReward") return {cue: "collect"};
  if (["chooseStarter", "challengeNpc", "rematchNpc", "purchase", "customize", "heal"].includes(command.type)) return {cue: "confirm"};
  return null;
}
