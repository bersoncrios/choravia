import { creatureLevel, creatureMaxHp, mergeJournals, type Game, type Command } from "../domain/game.js";
import type { ValidatedCreature } from "../domain/online.js";
import type { DailyContractType } from "../domain/daily-challenges.js";
export interface CreatureMapping { sourceId: string; id: string | null }
/** Inventory is complete before calling this function. Never infer deletion from one page. */
export function reconcileExpedition(game: Game, inventory: ValidatedCreature[], mapping: CreatureMapping[]): Game {
  const ids = new Map(mapping.map(entry => [entry.sourceId, entry.id]));
  const byId = new Map(game.collection.map(c => [c.id, c]));
  for (const c of game.collection) if (ids.get(c.id)) byId.set(ids.get(c.id)!, c);
  const collection = inventory.map(c => {
    const old = byId.get(c.id);
    const higher = old && (creatureLevel(old) > c.level || creatureLevel(old) === c.level && (old.experience ?? 0) > c.experience);
    const level = higher ? creatureLevel(old) : c.level;
    return { ...old, id: c.id, speciesId: c.speciesId, level, experience: higher ? old.experience ?? 0 : c.experience, hp: old ? Math.min(creatureMaxHp(c.speciesId, level, game.balance), old.hp + Math.max(0, creatureMaxHp(c.speciesId, level, game.balance) - creatureMaxHp(old.speciesId, creatureLevel(old), game.balance))) : creatureMaxHp(c.speciesId, level, game.balance), provenance: "validated" as const };
  });
  if (!collection.length) throw new Error("Não há Ecos disponíveis para recuperar a expedição.");
  const desired = ids.get(game.activeId) ?? game.activeId;
  const activeMissing = !collection.some(c => c.id === desired);
  if (game.scene === "battle" && activeMissing) throw new Error("O Eco da batalha foi transferido. Sincronize antes de continuar; seu save foi preservado.");
  return { ...game, journal: mergeJournals(game, {...game, collection}), ...(game.scene === "result" && activeMissing ? { scene: "exploration" as const, battle: null, message: "O Eco foi transferido em outra sessão. Sua expedição foi sincronizada e a batalha encerrada." } : {}), collection, captured: Math.max(game.captured, collection.length - 1), activeId: collection.some(c => c.id === desired) ? desired : (collection.find(c => c.hp > 0) ?? collection[0]!).id };
}
export function dailyActionTypes(before: Game, after: Game, command: Command): DailyContractType[] {
  if (before === after || before.scene !== "battle" || !before.battle || !!before.battle.rematch) return [];
  const types: DailyContractType[] = [];
  if (command.type === "basic") types.push("basic-attack");
  if (command.type === "defend") types.push("defend-in-battle");
  if (command.type === "move" || command.type === "skill" && before.battle.mode === "classic") types.push("move-in-battle");
  if (after.scene === "result" && before.battle.result === null) types.push("resolve-encounter");
  return types;
}
export function dailyCycle(now = Date.now()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}
const TYPES = ["resolve-encounter", "move-in-battle", "defend-in-battle", "basic-attack"] as const;
export class DailyActionQueue {
  constructor(private storage: Pick<Storage, "getItem" | "setItem" | "removeItem">) {}
  private key(uid: string): string { return `choravia-daily-actions:${uid}`; }
  read(uid: string, cycleId = dailyCycle()): DailyContractType[] {
    try {
      const value = JSON.parse(this.storage.getItem(this.key(uid)) ?? "null");
      return value?.cycleId === cycleId && Array.isArray(value.types) ? TYPES.filter(type => value.types.includes(type)) : [];
    } catch { return []; }
  }
  add(uid: string, types: DailyContractType[], cycleId = dailyCycle()): void {
    this.storage.setItem(this.key(uid), JSON.stringify({ cycleId, types: [...new Set([...this.read(uid, cycleId), ...types])] }));
  }
  acknowledge(uid: string, sent: DailyContractType[], cycleId: string): void {
    try { if (JSON.parse(this.storage.getItem(this.key(uid)) ?? "null")?.cycleId !== cycleId) return; } catch { return; }
    const remaining = this.read(uid, cycleId).filter(type => !sent.includes(type));
    if (remaining.length) this.storage.setItem(this.key(uid), JSON.stringify({ cycleId, types: remaining }));
    else this.storage.removeItem(this.key(uid));
  }
}

/** Finish an encounter from the former online mode without replacing the saved world. */
export function mergePreviousEncounter(world: Game, online: Game, result: Game): Game {
  const collection = new Map(world.collection.map(c => [c.id, c]));
  for (const creature of online.collection) {
    const old = collection.get(creature.id);
    const hp = creature.id === result.activeId && result.battle ? result.battle.ally.hp : old?.hp ?? creature.hp;
    collection.set(creature.id, { ...old, ...creature, hp: Math.min(hp, creatureMaxHp(creature.speciesId, creatureLevel(creature), world.balance)) });
  }
  return { ...world, journal: mergeJournals(world, {...world, collection: [...collection.values()], battle: result.battle}), collection: [...collection.values()], captured: Math.max(world.captured, online.captured) };
}
