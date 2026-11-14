import { ELEMENT_NAMES, REGION_NAMES, REGION_ORDER, layoutIn, type Game } from "../domain/game.js";
import { fieldMechanisms } from "../domain/field-abilities.js";

export interface ActivitiesView {
  restored: number;
  mechanisms: {id: string; name: string; region: string; element: string; complete: boolean; description: string}[];
  training: {id: string; name: string; region: string; wins: number; bestRound: number | null; skill: boolean; guard: boolean; unlocked: boolean}[];
}
const views = new WeakMap<Game, ActivitiesView>();
/** Snapshot-only projection. No rewards, clocks or account writes in the journal. */
export function activitiesView(game: Game): ActivitiesView {
  const cached = views.get(game); if (cached) return cached;
  const mechanisms = REGION_ORDER.flatMap(region => fieldMechanisms(region === (game.region ?? "clearing") ? game : {...game, region})).map(m => ({
    id: m.id, name: m.name, region: REGION_NAMES[m.region], element: ELEMENT_NAMES[m.element],
    complete: (game.fieldRestorations ?? []).includes(m.id), description: (game.fieldRestorations ?? []).includes(m.id) ? m.completedText : m.description,
  }));
  const training = REGION_ORDER.flatMap(region => layoutIn(game, region).npcs.map(npc => {
    const record = game.trainingRecords?.[npc.id];
    return {id: npc.id, name: npc.name, region: REGION_NAMES[region], wins: record?.wins ?? 0, bestRound: record?.bestRound ?? null,
      skill: record?.goals.includes("skill") ?? false, guard: record?.goals.includes("guard") ?? false, unlocked: (game.npcDuelWins ?? []).includes(npc.id)};
  }));
  const view = {mechanisms, training, restored: mechanisms.filter(m => m.complete).length};
  views.set(game, view); return view;
}
