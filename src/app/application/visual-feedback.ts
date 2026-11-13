import { activeCreature, creatureLevel, same, species, type Command, type Game, type Position } from "../domain/game.js";

/** Ephemeral presentation data. Never serialized into a save or used by game rules. */
export interface VisualFeedback {
  kind: "move" | "basic" | "skill" | "defend" | "capture" | "world";
  duration: number;
  allyLoss: number;
  enemyLoss: number;
  enemyActs: boolean;
  label: string;
  worldPosition: Position;
}
export function visualFeedback(before: Game, after: Game, command: Command): VisualFeedback | null {
  if (before === after || before.revision === after.revision && before.message === after.message && before.scene === after.scene && before.battle === after.battle) return null;
  const b = before.battle, a = after.battle;
  if (b && a && b.id === a.id && ["move", "basic", "skill", "defend", "capture"].includes(command.type)) {
    const changed = before.revision !== after.revision || b.round !== a.round || b.ally.hp !== a.ally.hp || b.enemy.hp !== a.enemy.hp || !same(b.ally.pos, a.ally.pos) || !same(b.enemy.pos, a.enemy.pos) || b.moved !== a.moved || b.failures !== a.failures || b.result !== a.result || b.ally.guarding !== a.ally.guarding || b.enemy.guarding !== a.enemy.guarding;
    if (!changed) return null;
    const kind = command.type as VisualFeedback["kind"];
    return {
      kind, duration: kind === "move" ? 170 : 620,
      allyLoss: Math.max(0, b.ally.hp - a.ally.hp),
      enemyLoss: Math.max(0, b.enemy.hp - a.enemy.hp),
      enemyActs: a.round > b.round || (!same(b.enemy.pos, a.enemy.pos)),
      label: kind === "capture" ? a.result === "capture" ? "Vínculo formado!" : "O Eco resistiu" : kind === "defend" ? "Defesa" : "",
      worldPosition: after.player,
    };
  }
  const old = activeCreature(before), current = after.collection.find(c => c.id === old.id);
  const leveled = current && creatureLevel(current) > creatureLevel(old);
  const xp = current && (current.experience ?? 0) > (old.experience ?? 0);
  const gain = (after.seeds ?? 120) - (before.seeds ?? 120);
  let label = leveled ? `Nível ${creatureLevel(current)}!` : xp ? "+XP" : "";
  if (command.type === "breakPot") label = gain > 0 ? `+${gain} ✦` : "";
  if (command.type === "heal") label = "Ecos recuperados";
  if (command.type === "interact" && (after.resonanceStep ?? 0) > (before.resonanceStep ?? 0)) label = "Selo desperto";
  if (command.type === "purchase") label = "Peça adquirida";
  if (command.type === "customize") label = "Visual salvo";
  if (command.type === "applyDailyReward") label = "Recompensa recebida";
  return label ? { kind: "world", duration: 900, allyLoss: 0, enemyLoss: 0, enemyActs: false, label, worldPosition: after.player } : null;
}

export function progressFeedback(before: Game, after: Game): string {
  const old = activeCreature(before), current = after.collection.find(c => c.id === old.id);
  if (current && creatureLevel(current) > creatureLevel(old)) return `${species(current.speciesId).name} · Nível ${creatureLevel(current)}!`;
  if (after.captured > before.captured) return "Novo vínculo formado!";
  if (current && (current.experience ?? 0) > (old.experience ?? 0)) return "Experiência recebida!";
  return "";
}
