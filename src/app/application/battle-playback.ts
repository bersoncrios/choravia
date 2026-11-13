import type { Battle, Game, TurnFrame } from "../domain/game.js";
export type BattlePhase = "choice" | "player" | "enemy";
export function frameGame(final: Game, frame: TurnFrame, round: number): Game {
  if (!final.battle) return final;
  return { ...final, scene: "battle", message: frame.message, battle: { ...final.battle, ally: frame.ally, enemy: frame.enemy, round, result: null } };
}
export function skillReady(battle: Battle): boolean { return battle.mode !== "classic" || (battle.allyCooldown ?? 0) === 0; }
