import { ELEMENT_NAMES, REGION_ENCOUNTERS, REGION_NAMES, REGION_ORDER, REGION_PORTALS, SKILL_NAMES, SPECIES, journalOf, type Game, type Region, type SpeciesId } from "../domain/game.js";

export interface RegionEntry {
  id: Region; name: string; subtitle: string; visited: boolean; current: boolean;
  nextName: string; habitats: string[]; activities: string[];
}
export interface EcoEntry {
  id: SpeciesId; name: string; element: string; glyph: string; color: string;
  seen: boolean; owned: boolean; skill: string; habitats: string[]; description: string;
}
export interface JournalView { regions: RegionEntry[]; ecos: EcoEntry[]; seenCount: number; ownedCount: number; visitedCount: number }
const views = new WeakMap<Game, JournalView>();
const REGIONS: Record<Region, {subtitle: string; activities: string[]}> = {
  clearing: {subtitle: "Riacho, ruínas e trilhas abertas sob o primeiro canto.", activities: ["Coletar materiais renováveis e procurar o esconderijo", "Preparar a lanterna de Iara e restaurar o marco", "Encontrar um tesouro único e desafiar duelistas"]},
  "old-grove": {subtitle: "Pedras de escuta entre raízes e memórias antigas.", activities: ["Ouvir a memória do marco", "Ativar os selos de Fogo, Elétrico e Terra", "Explorar e desafiar duelistas"]},
  "canopy-trail": {subtitle: "Folhagem densa, caminhos altos e poças de seiva.", activities: ["Explorar os caminhos entre as copas", "Encontrar vasos e duelistas", "Recuperar os Ecos no marco"]},
  "tide-cavern": {subtitle: "Canais frios e cristais nas sombras da gruta.", activities: ["Explorar os caminhos entre os canais", "Encontrar vasos e duelistas", "Retornar à primeira clareira pelo portal"]},
};
const MEMORIES: Record<SpeciesId, string> = {
  WW001: "Aquece ninhos abandonados e guarda a memória das fogueiras de viajantes.",
  WW002: "Esconde sementes para quem ainda vai chegar; os brotos do casco acompanham seu caminho.",
  WW003: "Guarda o som da primeira chuva nos bigodes que lembram gotas d’água.",
  WW004: "Corre antes do trovão e às vezes se assusta com o próprio espirro.",
  WW005: "Descansa nas antigas encruzilhadas e conserva a lembrança dos passos esquecidos.",
};
/** Read-only guide: habitat lists come from the same catalog that generates encounters. */
export function journalView(game: Game): JournalView {
  const cached = views.get(game);
  if (cached) return cached;
  const journal = journalOf(game);
  const owned = new Set(game.starterChosen !== false || game.battle || game.collection.length > 1 ? game.collection.map(c => c.speciesId) : []);
  const ecos = SPECIES.map(s => ({
    id: s.id, name: s.name, element: ELEMENT_NAMES[s.element], glyph: s.glyph, color: s.color,
    seen: journal.species.includes(s.id), owned: owned.has(s.id), skill: SKILL_NAMES[s.id],
    habitats: REGION_ORDER.filter(region => REGION_ENCOUNTERS[region].includes(s.id)).map(region => REGION_NAMES[region]),
    description: MEMORIES[s.id],
  }));
  const regions = REGION_ORDER.map(id => ({
    id, name: REGION_NAMES[id], ...REGIONS[id], visited: journal.regions.includes(id), current: (game.region ?? "clearing") === id,
    nextName: REGION_NAMES[REGION_PORTALS[id].target],
    habitats: REGION_ENCOUNTERS[id].map(speciesId => ecos.find(eco => eco.id === speciesId)!).map(eco => eco.seen ? eco.name : "Eco ainda não observado"),
  }));
  const view = {regions, ecos, seenCount: journal.species.length, ownedCount: owned.size, visitedCount: journal.regions.length};
  views.set(game, view);
  return view;
}
