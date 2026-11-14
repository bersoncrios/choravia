import { isCustomAccessoryId, type BalanceConfig, type CustomAccessory } from "./live-ops.js";
import type { AvatarAppearance } from "./avatar.js";
import { isAvatarAppearance } from "./avatar.js";
import { isStoreItemId, storeItem } from "./store.js";
import type { StoreItemId } from "./store.js";
import { explorationTile, fieldMechanisms, fieldMechanismReady } from "./field-abilities.js";

export type Element = "fire" | "plant" | "water" | "electric" | "earth";
export type SpeciesId = "WW001" | "WW002" | "WW003" | "WW004" | "WW005";
export interface Species {
  readonly id: SpeciesId;
  readonly name: string;
  readonly element: Element;
  readonly hp: number;
  readonly attack: number;
  readonly defense: number;
  readonly color: string;
  readonly glyph: string;
}
export const SPECIES: readonly Species[] = [
  {
    id: "WW001",
    name: "Braseco",
    element: "fire",
    hp: 36,
    attack: 10,
    defense: 7,
    color: "#f28c64",
    glyph: "♨",
  },
  {
    id: "WW002",
    name: "Brotatu",
    element: "plant",
    hp: 40,
    attack: 8,
    defense: 9,
    color: "#93c77e",
    glyph: "❧",
  },
  {
    id: "WW003",
    name: "Gotril",
    element: "water",
    hp: 38,
    attack: 9,
    defense: 8,
    color: "#69b9d0",
    glyph: "≈",
  },
  {
    id: "WW004",
    name: "Zunisco",
    element: "electric",
    hp: 34,
    attack: 11,
    defense: 6,
    color: "#e8d66b",
    glyph: "ϟ",
  },
  {
    id: "WW005",
    name: "Terruco",
    element: "earth",
    hp: 42,
    attack: 8,
    defense: 10,
    color: "#c39c75",
    glyph: "◆",
  },
];
export const ELEMENT_NAMES: Record<Element, string> = {
  fire: "Fogo",
  plant: "Planta",
  water: "Água",
  electric: "Elétrico",
  earth: "Terra",
};
export function species(id: SpeciesId): Species {
  const found = SPECIES.find((s) => s.id === id);
  if (!found) throw new Error("Espécie inválida");
  return found;
}
export const MAX_CREATURE_LEVEL = 30;
export function creatureLevel(creature: { level?: number }): number {
  return Math.max(1, Math.min(MAX_CREATURE_LEVEL, Math.floor(creature.level ?? 1)));
}
export function xpToNextLevel(level: number): number {
  return level >= MAX_CREATURE_LEVEL ? 0 : 30 + 12 * Math.max(1, Math.floor(level));
}
export function creatureStats(id: SpeciesId, level = 1, balance?: BalanceConfig): Pick<Species, "hp" | "attack" | "defense"> {
  const base = balance?.[id] ?? species(id), safeLevel = Math.max(1, Math.min(MAX_CREATURE_LEVEL, Math.floor(level)));
  return {
    hp: base.hp + Math.max(1, Math.floor(base.hp / 30)) * (safeLevel - 1),
    attack: base.attack + Math.floor(base.attack * (safeLevel - 1) / 25),
    defense: base.defense + Math.floor(base.defense * (safeLevel - 1) / 25),
  };
}
export function creatureMaxHp(id: SpeciesId, level = 1, balance?: BalanceConfig): number {
  return creatureStats(id, level, balance).hp;
}
export interface Position {
  x: number;
  y: number;
}
export interface Creature {
  id: string;
  speciesId: SpeciesId;
  hp: number;
  /** Missing values in older saves are treated as level 1 and 0 XP. */
  level?: number;
  experience?: number;
  provenance: "local" | "validated";
  cosmeticId?: "eco-moss-glyph";
}
export type Terrain = "ground" | "grass" | "water" | "fire";
export type Region = "clearing" | "old-grove" | "canopy-trail" | "tide-cavern";
export const REGION_ORDER: readonly Region[] = ["clearing", "old-grove", "canopy-trail", "tide-cavern"];
/** Normal wild encounters. The first guided encounter separately introduces Brotatu. */
export const REGION_ENCOUNTERS: Readonly<Record<Region, readonly SpeciesId[]>> = {
  clearing: ["WW001", "WW002", "WW004"],
  "old-grove": ["WW002", "WW003", "WW005"],
  "canopy-trail": ["WW001", "WW002", "WW004"],
  "tide-cavern": ["WW002", "WW003", "WW005"],
};
export interface ExplorationJournal { regions: Region[]; species: SpeciesId[] }
export const REGION_NAMES: Readonly<Record<Region, string>> = {
  clearing: "Clareira do Primeiro Canto",
  "old-grove": "Clareira Antiga",
  "canopy-trail": "Trilha das Copas",
  "tide-cavern": "Gruta das Marés",
};
export interface RegionPortal { readonly position: Position; readonly arrival: Position; readonly target: Region; readonly title: string; }
export const REGION_PORTALS: Readonly<Record<Region, RegionPortal>> = {
  clearing: { position: { x: 17, y: 10 }, arrival: { x: 16, y: 10 }, target: "old-grove", title: "Portal das Raízes" },
  "old-grove": { position: { x: 2, y: 10 }, arrival: { x: 3, y: 10 }, target: "canopy-trail", title: "Passagem das Copas" },
  "canopy-trail": { position: { x: 17, y: 10 }, arrival: { x: 16, y: 10 }, target: "tide-cavern", title: "Elevador de Seiva" },
  "tide-cavern": { position: { x: 2, y: 10 }, arrival: { x: 5, y: 10 }, target: "clearing", title: "Arco das Marés" },
};
export interface Cell {
  terrain: Terrain;
  remaining: number;
}
export interface Fighter {
  speciesId: SpeciesId;
  hp: number;
  level?: number;
  pos: Position;
  guarding: boolean;
}
export interface EnemyPlan {
  destination: Position;
  target: Position;
  action: "basic" | "skill" | "defend";
}
export function classicAttackPower(action: "basic" | "skill", level: number): number { return (action === "skill" ? 7 : 6) + Math.floor((Math.max(1, Math.min(30, level)) - 1) / 6); }
export const SKILL_NAMES: Record<SpeciesId, string> = { WW001: "Faísca", WW002: "Chicote de folha", WW003: "Jato d’água", WW004: "Estalo", WW005: "Impacto de pedra" };
export interface TurnFrame { action?: "basic" | "skill" | "defend" | "capture" | "flee"; actor: "player" | "enemy"; ally: Fighter; enemy: Fighter; message: string }
export interface Battle {
  /** Repeatable practice never grants Sementes, XP, captures or daily rewards. */
  rematch?: { goal: "skill" | "guard"; usedSkill: boolean; usedGuard: boolean };
  balance?: BalanceConfig;
  mode?: "classic";
  allyCooldown?: number;
  enemyCooldown?: number;
  turnFrames?: TurnFrame[];
  id: string;
  kind?: "wild" | "npc";
  challengeId?: string;
  ally: Fighter;
  enemy: Fighter;
  cells: Cell[];
  round: number;
  moved: boolean;
  failures: number;
  guided: boolean;
  plan: EnemyPlan;
  result: "capture" | "victory" | "defeat" | "fled" | "escaped" | null;
}
export interface GameEvent {
  id: string;
  type: "encounter_started" | "battle_finished" | "first_capture" | "capture";
  encounterId: string;
  result?: string;
  speciesId?: SpeciesId;
}
export interface Game {
  schemaVersion: 1;
  revision: number;
  rng: number;
  player: Position;
  /** Missing on pre-expansion saves; those remain in the first clearing. */
  region?: Region;
  /** Additive discovery history; old saves infer only facts still present in their snapshot. */
  journal?: ExplorationJournal;
  /** Story state; missing on older saves means the marker is untouched. */
  ancientMarkerHeard?: boolean;
  resonanceStep?: number;
  avatar?: AvatarAppearance;
  starterChosen?: boolean;
  seeds?: number;
  brokenPots?: string[];
  npcDuelWins?: string[];
  fieldRestorations?: string[];
  trainingRecords?: Record<string, { wins: number; bestRound: number; goals: ("skill" | "guard")[] }>;
  worldLayouts?: Partial<Record<Region, RegionLayout>>;
  ownedItems?: StoreItemId[];
  balance?: BalanceConfig;
  shopCatalog?: CustomAccessory[];
  dailyRewardReceipts?: string[];
  steps: number;
  armed: boolean;
  collection: Creature[];
  activeId: string;
  battle: Battle | null;
  encountered: number;
  captured: number;
  message: string;
  events: GameEvent[];
  scene: "exploration" | "battle" | "result";
}
export function journalOf(game: Game): ExplorationJournal {
  const known = new Set(game.journal?.species ?? []);
  // Before onboarding, the default starter is only a placeholder, not a discovery.
  if (game.starterChosen !== false || game.battle || game.collection.length > 1)
    for (const creature of game.collection) known.add(creature.speciesId);
  if (game.battle) { known.add(game.battle.ally.speciesId); known.add(game.battle.enemy.speciesId); }
  const regions = new Set([...(game.journal?.regions ?? []), game.region ?? "clearing"]);
  return { regions: REGION_ORDER.filter(id => regions.has(id)), species: SPECIES.filter(s => known.has(s.id)).map(s => s.id) };
}
export function mergeJournals(...games: Game[]): ExplorationJournal {
  const entries = games.map(journalOf);
  return {
    regions: REGION_ORDER.filter(id => entries.some(entry => entry.regions.includes(id))),
    species: SPECIES.filter(s => entries.some(entry => entry.species.includes(s.id))).map(s => s.id),
  };
}
export type Command =
  | { type: "applyDailyReward"; receiptId: string; seeds: number; itemId?: StoreItemId; fallbackSeeds?: number }
  | { type: "walk"; dx: number; dy: number }
  | { type: "move"; position: Position }
  | { type: "basic"; target: Position }
  | { type: "skill"; target: Position }
  | { type: "defend" }
  | { type: "capture" }
  | { type: "flee" }
  | { type: "return" }
  | { type: "heal" }
  | { type: "interact" }
  | { type: "customize"; avatar: AvatarAppearance }
  | { type: "chooseStarter"; speciesId: SpeciesId }
  | { type: "breakPot" }
  | { type: "challengeNpc"; npcId?: string }
  | { type: "rematchNpc"; npcId?: string }
  | { type: "restoreEnvironment"; id: string; method: "eco" | "manual" }
  | { type: "purchase"; itemId: StoreItemId }
  | { type: "activate"; id: string };
export const same = (a: Position, b: Position): boolean =>
  a.x === b.x && a.y === b.y;
export const distance = (a: Position, b: Position): number =>
  Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
export const inArena = (p: Position): boolean =>
  Number.isInteger(p.x) &&
  Number.isInteger(p.y) &&
  p.x >= 0 &&
  p.x < 5 &&
  p.y >= 0 &&
  p.y < 5;
export const cellIndex = (p: Position): number => p.y * 5 + p.x;
export function nextRandom(seed: number): { seed: number; value: number } {
  let x = seed >>> 0;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  x >>>= 0;
  return { seed: x, value: x / 4294967296 };
}
export function initialGame(seed = ((Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0)): Game {
  const normalizedSeed = seed >>> 0 || 827361;
  const game: Game = {
    schemaVersion: 1,
    revision: 0,
    rng: normalizedSeed,
    player: { x: 9, y: 11 },
    region: "clearing",
    ancientMarkerHeard: false,
    starterChosen: false,
    seeds: 120,
    brokenPots: [],
    npcDuelWins: [],
    worldLayouts: {},
    ownedItems: [],
    steps: 0,
    armed: true,
    collection: [
      { id: "starter", speciesId: "WW001", hp: creatureMaxHp("WW001", 1), level: 1, experience: 0, provenance: "local" },
    ],
    activeId: "starter",
    battle: null,
    encountered: 0,
    captured: 0,
    message: "A mata já te ouviu. Explore a grama clara ao norte.",
    events: [],
    scene: "exploration",
  };
  let worldSeed = normalizedSeed;
  for (const region of REGION_ORDER) {
    const next = nextRandom(worldSeed);
    worldSeed = next.seed;
    game.worldLayouts![region] = generateRegionLayout(region, worldSeed, region === "clearing" ? [game.player] : []);
  }
  return game;
}
export function mapTile(
  x: number,
  y: number,
  region: Region = "clearing",
): "wall" | "grass" | "water" | "path" | "ground" | "healer" | "ruin" | "gate" {
  if (x <= 0 || y <= 0 || x >= 19 || y >= 14) return "wall";
  const portal = REGION_PORTALS[region];
  if (x === portal.position.x && y === portal.position.y) return "gate";
  if (region === "clearing") {
    if (x === 7 && y === 10) return "healer";
    if (x >= 13 && x <= 15 && y >= 3 && y <= 4) return "ruin";
    if (x >= 2 && x <= 4 && y >= 8 && y <= 11) return "water";
    if (x >= 6 && x <= 12 && y >= 3 && y <= 7) return "grass";
    if (x === 9 || y === 10) return "path";
    if ((x * 7 + y * 13) % 23 === 0) return "wall";
    return "ground";
  }
  if (region === "old-grove") {
    if (x === 10 && y === 10) return "healer";
    if (x >= 7 && x <= 10 && y >= 3 && y <= 5) return "ruin";
    if (x >= 6 && x <= 13 && y >= 3 && y <= 8) return "grass";
    if (x === 10 || y === 10) return "path";
    if ((x * 11 + y * 5) % 17 === 0) return "wall";
    return "ground";
  }
  if (region === "canopy-trail") {
    if (x === 7 && y === 10) return "healer";
    if (x >= 9 && x <= 11 && y >= 6 && y <= 8) return "water";
    if ((x >= 3 && x <= 7 && y >= 3 && y <= 6) || (x >= 12 && x <= 16 && y >= 7 && y <= 11)) return "grass";
    if (x === 10 || y === 10 || x === 5 && y >= 6 && y <= 10 || x === 14 && y >= 4 && y <= 10) return "path";
    if ((x * 7 + y * 13) % 13 === 0) return "wall";
    return "ground";
  }
  if (region === "tide-cavern") {
    if (x === 10 && y === 10) return "healer";
    if ((x >= 4 && x <= 6 && y >= 4 && y <= 10) || (x >= 12 && x <= 15 && y >= 7 && y <= 9)) return "water";
    if (x >= 8 && x <= 11 && y >= 3 && y <= 5) return "ruin";
    if (x === 10 || y === 10 || x === 7 || x === 11) return "path";
    if ((x * 11 + y * 5) % 15 === 0) return "wall";
    return "ground";
  }
  return "wall";
}
export interface Pot {
  readonly id: string;
  readonly x: number;
  readonly y: number;
}
const POT_LOCATIONS: Readonly<Record<Region, readonly Position[]>> = {
  clearing: [
    { x: 4, y: 7 },
    { x: 16, y: 7 },
    { x: 13, y: 9 },
  ],
  "old-grove": [
    { x: 5, y: 8 },
    { x: 14, y: 10 },
    { x: 15, y: 4 },
  ],
  "canopy-trail": [],
  "tide-cavern": [],
};
export interface MapNpc { readonly id: string; readonly name: string; readonly x: number; readonly y: number; readonly speciesId: SpeciesId; readonly reward: number; }
export interface RegionLayout { readonly pots: readonly Pot[]; readonly npcs: readonly MapNpc[]; }
const NPC_TEMPLATES = [
  { name: "Davi", speciesId: "WW003" as SpeciesId, reward: 24 },
  { name: "Luma", speciesId: "WW004" as SpeciesId, reward: 28 },
  { name: "Nilo", speciesId: "WW005" as SpeciesId, reward: 32 },
  { name: "Bia", speciesId: "WW002" as SpeciesId, reward: 24 },
  { name: "Téo", speciesId: "WW001" as SpeciesId, reward: 30 },
] as const;
export function generateRegionLayout(region: Region, seed: number, reserved: readonly Position[] = []): RegionLayout {
  let rng = seed >>> 0 || 1;
  const random = (): number => { const result = nextRandom(rng); rng = result.seed; return result.value; };
  const candidates: Position[] = [];
  for (let y = 2; y < 13; y++) for (let x = 2; x < 18; x++) {
    if (!["ground", "grass", "path"].includes(mapTile(x, y, region))) continue;
    if (reserved.some((position) => position.x === x && position.y === y)) continue;
    const previousRegion = REGION_ORDER[(REGION_ORDER.indexOf(region) + REGION_ORDER.length - 1) % REGION_ORDER.length]!;
    const entrance = REGION_PORTALS[previousRegion].arrival;
    if (distance({ x, y }, { x: 10, y: 10 }) <= 2 || distance({ x, y }, REGION_PORTALS[region].position) <= 1 || distance({ x, y }, entrance) <= 1) continue;
    if (region === "clearing" && distance({ x, y }, { x: 14, y: 4 }) <= 2) continue;
    if (region === "old-grove" && (distance({ x, y }, { x: 8, y: 4 }) <= 2 || distance({ x, y }, { x: 10, y: 6 }) <= 2)) continue;
    candidates.push({ x, y });
  }
  for (let i = candidates.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [candidates[i], candidates[j]] = [candidates[j]!, candidates[i]!]; }
  const pots: Pot[] = [];
  const npcs: MapNpc[] = [];
  const potCount = 2 + Math.floor(random() * 4);
  const npcCount = 1 + Math.floor(random() * 3);
  let index = 0;
  const take = (): Position | undefined => candidates[index++];
  for (let i = 0; i < potCount; i++) { const p = take(); if (p) pots.push({ id: `${region}:pot:${i}`, ...p }); }
  for (let i = 0; i < npcCount; i++) { const p = take(); const template = NPC_TEMPLATES[Math.floor(random() * NPC_TEMPLATES.length)]!; if (p) npcs.push({ id: `${region}:npc:${i}`, ...p, ...template }); }
  // Preserve the original named trainer position and ID so existing duel saves remain compatible.
  if (region === "clearing") {
    const index = npcs.findIndex((npc) => npc.name === "Davi");
    const davi = { id: "davi", name: "Davi", speciesId: "WW003" as SpeciesId, reward: 24 };
    const daviPosition = index >= 0 ? npcs[index]! : npcs[npcs.length - 1]!;
    npcs[index >= 0 ? index : npcs.length - 1] = { ...davi, x: daviPosition.x, y: daviPosition.y };
  }
  return { pots, npcs };
}
export function layoutIn(game: Game, region: Region): RegionLayout {
  const existing = game.worldLayouts?.[region];
  if (existing) return existing;
  return generateRegionLayout(region, (game.rng ^ REGION_ORDER.indexOf(region) * 0x9e3779b9) >>> 0, region === (game.region ?? "clearing") ? [game.player] : []);
}
export function npcsIn(game: Game, region: Region): readonly MapNpc[] {
  return layoutIn(game, region).npcs;
}
function portalLanding(game: Game, region: Region): Position {
  const preferred = REGION_PORTALS[region].arrival;
  const layout = layoutIn(game, region);
  const broken = new Set(game.brokenPots ?? []);
  const options: Position[] = [];
  for (let y = preferred.y - 3; y <= preferred.y + 3; y++) for (let x = preferred.x - 3; x <= preferred.x + 3; x++) {
    const candidate = { x, y };
    if (distance(candidate, preferred) > 3 || !["ground", "grass", "path"].includes(mapTile(x, y, region))) continue;
    if (layout.npcs.some((npc) => same(npc, candidate)) || layout.pots.some((pot) => !broken.has(pot.id) && same(pot, candidate))) continue;
    options.push(candidate);
  }
  options.sort((a, b) => distance(a, preferred) - distance(b, preferred) || a.y - b.y || a.x - b.x);
  return options[0] ?? preferred;
}
export function potsIn(region: Region): readonly Pot[] {
  return POT_LOCATIONS[region].map(({ x, y }, index) => ({
    id: `${region}:${x}:${y}`,
    x,
    y,
  }));
}
export const TRAIL_RIVAL = {
  id: "davi" as const,
  name: "Davi",
  x: 15,
  y: 8,
  speciesId: "WW003" as SpeciesId,
  reward: 24,
};
export const RESONANCE_SEALS = [
  { x: 8, y: 4, element: "fire" as Element },
  { x: 10, y: 4, element: "electric" as Element },
  { x: 8, y: 6, element: "earth" as Element },
] as const;
export function activeCreature(g: Game): Creature {
  const c = g.collection.find((c) => c.id === g.activeId);
  if (!c) throw new Error("Criatura ativa ausente");
  return c;
}
export function elementalMultiplier(
  a: Element | "neutral",
  d: Element,
): number {
  if (a === "neutral") return 1;
  const wins: Record<Element, Element> = {
    fire: "plant",
    plant: "earth",
    earth: "electric",
    electric: "water",
    water: "fire",
  };
  if (wins[a] === d) return 1.5;
  if (wins[d] === a) return 0.75;
  return 1;
}
export function damage(
  attacker: SpeciesId,
  defender: SpeciesId,
  power: number,
  element: Element | "neutral",
  guard = false,
  attackerLevel = 1,
  defenderLevel = 1,
  balance?: BalanceConfig,
): number {
  const a = creatureStats(attacker, attackerLevel, balance),
    d = creatureStats(defender, defenderLevel, balance),
    defenderElement = species(defender).element;
  return Math.max(
    1,
    Math.floor(
      (power + a.attack / 2 - d.defense / 3) *
        elementalMultiplier(element, defenderElement) *
        (guard ? 0.5 : 1),
    ),
  );
}
export function captureChance(
  hp: number,
  max: number,
  failures: number,
): number {
  return Math.min(
    0.95,
    0.35 + 0.6 * (1 - hp / max) + 0.1 * Math.min(failures, 2),
  );
}
export function canCapture(b: Battle): boolean {
  return (
    !b.result &&
    b.kind !== "npc" &&
    b.enemy.hp > 0 &&
    b.enemy.hp <= creatureMaxHp(b.enemy.speciesId, creatureLevel(b.enemy), b.balance) / 2 &&
    (b.mode === "classic" || distance(b.ally.pos, b.enemy.pos) <= 2)
  );
}
export function waterComponent(
  cells: readonly Cell[],
  start: Position,
): Position[] {
  if (cells[cellIndex(start)]?.terrain !== "water") return [start];
  const seen = new Set<number>(),
    queue: Position[] = [start];
  for (let i = 0; i < queue.length; i++) {
    const p = queue[i];
    if (!p) continue;
    seen.add(cellIndex(p));
    for (const d of [
      { x: 1, y: 0 },
      { x: -1, y: 0 },
      { x: 0, y: 1 },
      { x: 0, y: -1 },
    ]) {
      const n = { x: p.x + d.x, y: p.y + d.y },
        id = cellIndex(n);
      if (
        inArena(n) &&
        !seen.has(id) &&
        !queue.some((q) => same(q, n)) &&
        cells[id]?.terrain === "water"
      )
        queue.push(n);
    }
  }
  return queue;
}
export function affectedCells(
  b: Battle,
  actor: Fighter,
  action: "basic" | "skill" | "defend",
  target: Position,
): Position[] {
  if (action === "defend") return [];
  if (b.mode === "classic") return [target];
  if (action === "skill" && actor.speciesId === "WW004")
    return waterComponent(b.cells, target);
  return [target];
}
export function enemyPlan(b: Battle): EnemyPlan {
  const e = b.enemy;
  if (b.mode === "classic") {
    const basic = damage(e.speciesId, b.ally.speciesId, classicAttackPower("basic", creatureLevel(e)), "neutral", false, creatureLevel(e), creatureLevel(b.ally), b.balance);
    const skill = damage(e.speciesId, b.ally.speciesId, classicAttackPower("skill", creatureLevel(e)), species(e.speciesId).element, false, creatureLevel(e), creatureLevel(b.ally), b.balance);
    return { destination: { ...e.pos }, target: { ...b.ally.pos }, action: (b.enemyCooldown ?? 0) === 0 && skill > basic ? "skill" : "basic" };
  }
  const candidates = [
    e.pos,
    ...[
      { x: 0, y: -1 },
      { x: -1, y: 0 },
      { x: 1, y: 0 },
      { x: 0, y: 1 },
    ].map((d) => ({ x: e.pos.x + d.x, y: e.pos.y + d.y })),
  ].filter((p) => inArena(p) && !same(p, b.ally.pos));
  candidates.sort(
    (a, c) =>
      distance(a, b.ally.pos) - distance(c, b.ally.pos) ||
      a.y - c.y ||
      a.x - c.x,
  );
  const dest =
    distance(e.pos, b.ally.pos) === 1 ? e.pos : (candidates[0] ?? e.pos);
  const projected = { ...e, pos: dest };
  const target = { ...b.ally.pos };
  let action: EnemyPlan["action"] = "defend";
  if (distance(dest, target) === 1) {
    action = "basic";
    if (e.speciesId === "WW001" || e.speciesId === "WW004") {
      const hit = affectedCells(b, projected, "skill", target);
      if (!hit.some((p) => same(p, dest))) action = "skill";
    }
  }
  return { destination: { ...dest }, target, action };
}
export function createBattle(
  id: string,
  ally: Creature,
  enemy: SpeciesId,
  guided: boolean,
  kind: Battle["kind"] = "wild",
  challengeId?: Battle["challengeId"],
  mode?: Battle["mode"],
  balance?: BalanceConfig,
): Battle {
  const cells: Cell[] = Array.from({ length: 25 }, () => ({
    terrain: "ground",
    remaining: 0,
  }));
  for (const p of [
    { x: 1, y: 1 },
    { x: 2, y: 1 },
    { x: 1, y: 2 },
  ])
    cells[cellIndex(p)] = { terrain: "grass", remaining: 0 };
  for (const p of [
    { x: 3, y: 2 },
    { x: 4, y: 2 },
    { x: 4, y: 3 },
  ])
    cells[cellIndex(p)] = { terrain: "water", remaining: 0 };
  const b: Battle = {
    ...(balance ? { balance: structuredClone(balance) } : {}),
    ...(mode ? { mode, allyCooldown: 0, enemyCooldown: 0 } : {}),
    id,
    kind,
    ...(challengeId ? { challengeId } : {}),
    ally: {
      speciesId: ally.speciesId,
      hp: ally.hp,
      level: creatureLevel(ally),
      pos: { x: 1, y: 3 },
      guarding: false,
    },
    enemy: {
      speciesId: enemy,
      hp: creatureMaxHp(enemy, creatureLevel(ally), balance),
      level: creatureLevel(ally),
      pos: { x: 3, y: 1 },
      guarding: false,
    },
    cells,
    round: 1,
    moved: false,
    failures: 0,
    guided,
    plan: {
      destination: { x: 3, y: 1 },
      target: { x: 1, y: 3 },
      action: "defend",
    },
    result: null,
  };
  b.plan = enemyPlan(b);
  return b;
}
function checkEnd(b: Battle): boolean {
  if (b.ally.hp <= 0) b.result = "defeat";
  else if (b.enemy.hp <= 0) b.result = "victory";
  return b.result !== null;
}
function resolveAttack(
  b: Battle,
  who: "ally" | "enemy",
  action: "basic" | "skill",
  target: Position,
): void {
  const a = b[who];
  const skill = action === "skill";
  const affected = affectedCells(b, a, action, target);
  const hits = ([b.ally, b.enemy] as Fighter[]).filter((f) =>
    affected.some((p) => same(p, f.pos)),
  );
  const results = hits.map((f) => ({
    f,
    n: damage(
      a.speciesId,
      f.speciesId,
      b.mode === "classic" ? classicAttackPower(skill ? "skill" : "basic", creatureLevel(a)) : (skill ? 6 : 8),
      skill ? species(a.speciesId).element : "neutral",
      f.guarding,
      creatureLevel(a),
      creatureLevel(f),
      b.balance,
    ),
  }));
  for (const { f, n } of results) f.hp = Math.max(0, f.hp - n);
  if (
    b.mode !== "classic" &&
    skill &&
    a.speciesId === "WW001" &&
    b.cells[cellIndex(target)]?.terrain === "grass"
  )
    b.cells[cellIndex(target)] = { terrain: "fire", remaining: 4 };
}
function endTurn(b: Battle, actor: Fighter): boolean {
  if (checkEnd(b)) return true;
  if (b.cells[cellIndex(actor.pos)]?.terrain === "fire")
    actor.hp = Math.max(0, actor.hp - 3);
  const ended = checkEnd(b);
  for (const c of b.cells)
    if (c.terrain === "fire") {
      c.remaining--;
      if (c.remaining === 0) c.terrain = "ground";
    }
  return ended;
}
function enemyTurn(b: Battle): void {
  b.enemy.guarding = false;
  const p = b.plan;
  if (!same(p.destination, b.ally.pos)) b.enemy.pos = { ...p.destination };
  if (p.action !== "defend" && distance(b.enemy.pos, p.target) === 1)
    resolveAttack(b, "enemy", p.action, p.target);
  else b.enemy.guarding = true;
  if (endTurn(b, b.enemy)) return;
  if (b.round === 40) {
    b.result = "escaped";
    return;
  }
  b.round++;
  b.moved = false;
  b.ally.guarding = false;
  b.plan = enemyPlan(b);
}
function finish(g: Game): void {
  const b = g.battle;
  if (!b?.result) return;
  const ally = activeCreature(g), oldLevel = creatureLevel(ally), oldStats = creatureStats(ally.speciesId, oldLevel, g.balance);
  let level = oldLevel;
  let experience = ally.experience ?? 0;
  ally.level = level;
  ally.hp = b.ally.hp;
  const xp = b.rematch ? 0 : b.result === "capture"
    ? 18 + 3 * creatureLevel(b.enemy)
    : b.result === "victory"
      ? (b.kind === "npc" ? 45 : 30) + 5 * creatureLevel(b.enemy)
      : 0;
  experience = Math.max(0, experience) + xp;
  while (level < MAX_CREATURE_LEVEL && experience >= xpToNextLevel(level)) {
    experience -= xpToNextLevel(level);
    level++;
  }
  if (level >= MAX_CREATURE_LEVEL) experience = 0;
  ally.level = level;
  ally.experience = experience;
  const newStats = creatureStats(ally.speciesId, level, g.balance);
  ally.hp = Math.min(newStats.hp, ally.hp + newStats.hp - oldStats.hp);
  b.ally.level = level;
  b.ally.hp = ally.hp;
  g.scene = "result";
  if (b.rematch) {
    if (b.result === "victory" && b.challengeId) {
      const old = g.trainingRecords?.[b.challengeId];
      const goalMet = b.rematch.goal === "skill" ? b.rematch.usedSkill : b.rematch.usedGuard;
      const goals = new Set(old?.goals ?? []);
      if (goalMet) goals.add(b.rematch.goal);
      g.trainingRecords = { ...g.trainingRecords, [b.challengeId]: {
        wins: Math.min(9999,(old?.wins ?? 0)+1),
        bestRound: Math.min(old?.bestRound ?? 40,b.round),
        goals: (["skill","guard"] as const).filter(goal=>goals.has(goal)),
      }};
      g.message = `Treino concluído em ${b.round} rodadas.${goalMet ? " Objetivo de prática registrado!" : " Vença usando a ação indicada para registrar o objetivo."} Sem Sementes ou XP.`;
    } else g.message = "Treino encerrado. Você pode tentar novamente; sem Sementes ou XP.";
  } else if (b.result === "capture") {
    const id = `capture-${b.id}`;
    if (!g.collection.some((c) => c.id === id)) {
      g.collection.push({
        id,
        speciesId: b.enemy.speciesId,
        hp: creatureMaxHp(b.enemy.speciesId, creatureLevel(b.enemy), b.balance),
        level: creatureLevel(b.enemy),
        experience: 0,
        provenance: "local",
      });
      g.captured++;
      g.events.push({
        id: `capture:${b.id}`,
        type: g.captured === 1 ? "first_capture" : "capture",
        encounterId: b.id,
        speciesId: b.enemy.speciesId,
      });
    }
    g.message = `${species(b.enemy.speciesId).name} aceitou caminhar com você.`;
  } else if (b.kind === "npc" && b.challengeId && b.result === "victory") {
    const npc = REGION_ORDER.flatMap((region) => npcsIn(g, region)).find((entry) => entry.id === b.challengeId);
    if (npc && !(g.npcDuelWins ?? []).includes(npc.id)) {
      g.npcDuelWins = [...(g.npcDuelWins ?? []), npc.id];
      g.seeds = (g.seeds ?? 120) + npc.reward;
      g.message = `${npc.name}: “Boa luta! Você ganhou ${npc.reward} Sementes.”`;
    } else g.message = "O duelo terminou.";
  } else
    g.message = (
      {
        victory:
          "O Eco descansou. Enfraqueça sem zerar a vida para criar um vínculo.",
        defeat: "Iara vai cuidar dos seus Ecos. O canto continua.",
        fled: "Você retornou à trilha em segurança.",
        escaped: "O Eco voltou à floresta após 40 rodadas.",
      } as const
    )[b.result];
  g.events.push({
    id: `finished:${b.id}`,
    type: "battle_finished",
    encounterId: b.id,
    result: b.result,
  });
  if (level > oldLevel)
    g.message += ` ${species(ally.speciesId).name} subiu ao nível ${level}! PV +${newStats.hp - oldStats.hp}, ATQ +${newStats.attack - oldStats.attack}, DEF +${newStats.defense - oldStats.defense}.`;
  g.events = g.events.slice(-100);
}
/** A rejected command returns exactly the previous state, including RNG and revision. */
export function reduceGame(previous: Game, command: Command): Game {
  const g: Game = structuredClone(previous);
  for (const creature of g.collection) {
    creature.level = creatureLevel(creature);
    creature.experience ??= 0;
  }
  if (g.battle) {
    g.battle.ally.level = creatureLevel(g.battle.ally);
    g.battle.enemy.level = creatureLevel(g.battle.enemy);
  }
  g.worldLayouts ??= {};
  for (const region of REGION_ORDER) {
    if (!g.worldLayouts[region]) {
      const seed = (g.rng ^ Math.imul(REGION_ORDER.indexOf(region) + 1, 0x9e3779b9)) >>> 0;
      g.worldLayouts[region] = generateRegionLayout(region, seed, region === (g.region ?? "clearing") ? [g.player] : []);
    }
  }
  const reject = (): Game => previous;
  const commit = (): Game => {
    g.journal = mergeJournals(previous, g);
    g.revision++;
    g.events = g.events.slice(-100);
    return g;
  };
  if (command.type === "applyDailyReward") {
    const receipts = g.dailyRewardReceipts ?? [];
    if (!/^daily:[0-9]{4}-[0-9]{2}-[0-9]{2}:[a-z-]+(?::bonus)?$|^weekly:[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(command.receiptId) || receipts.includes(command.receiptId) || !Number.isSafeInteger(command.seeds) || command.seeds < 0 || command.seeds > 1000 || (command.fallbackSeeds !== undefined && (!Number.isSafeInteger(command.fallbackSeeds) || command.fallbackSeeds < 0 || command.fallbackSeeds > 1000))) return reject();
    g.dailyRewardReceipts = [...receipts, command.receiptId].slice(-500);
    g.seeds = (g.seeds ?? 0) + command.seeds;
    if (command.itemId) {
      g.ownedItems ??= [];
      if (g.ownedItems.includes(command.itemId)) g.seeds += command.fallbackSeeds ?? 0;
      else g.ownedItems.push(command.itemId);
    }
    g.message = command.itemId && !(previous.ownedItems ?? []).includes(command.itemId) ? "Recompensa cosmética recebida!" : `Você recebeu ${command.seeds + (command.itemId && (previous.ownedItems ?? []).includes(command.itemId) ? command.fallbackSeeds ?? 0 : 0)} Sementes.`;
    return commit();
  }
  if (command.type === "chooseStarter") {
    const first = g.collection[0];
    if (
      g.scene !== "exploration" ||
      g.starterChosen === true ||
      !first ||
      !SPECIES.some((s) => s.id === command.speciesId)
    )
      return reject();
    first.speciesId = command.speciesId;
    first.level ??= 1;
    first.experience ??= 0;
    first.hp = creatureMaxHp(command.speciesId, first.level, g.balance);
    g.activeId = first.id;
    g.starterChosen = true;
    g.message = `${species(command.speciesId).name} escolheu caminhar com você.`;
    return commit();
  }
  if (command.type === "customize") {
    if (!isAvatarAppearance(command.avatar)) return reject();
    const owned = g.ownedItems ?? [];
    if (
      (command.avatar.outfit === "cloak" && !owned.includes("forest-cloak")) ||
      (command.avatar.accessory === "sun-scarf" && !owned.includes("sun-scarf")) ||
      (command.avatar.accessory === "moon-pin" && !owned.includes("moon-pin")) ||
      (!!command.avatar.customAccessory && !owned.includes(command.avatar.customAccessory.id))
    )
      return reject();
    if (command.avatar.customAccessory && !g.shopCatalog?.some(item => item.id === command.avatar.customAccessory!.id && item.shape === command.avatar.customAccessory!.shape && item.color === command.avatar.customAccessory!.color)) return reject();
    g.avatar = structuredClone(command.avatar);
    g.message = previous.avatar ? "Aparência atualizada. Sua jornada continua de onde parou." : "Seu Guardião está pronto para seguir a trilha.";
    return commit();
  }
  if (command.type === "return") {
    if (g.scene !== "result") return reject();
    g.battle = null;
    g.scene = "exploration";
    g.armed = false;
    if (activeCreature(g).hp <= 0) {
      const healthy = g.collection.find((c) => c.hp > 0);
      if (healthy) g.activeId = healthy.id;
      else {
        for (const c of g.collection) c.hp = creatureMaxHp(c.speciesId, creatureLevel(c), g.balance);
        g.player = { x: 8, y: 10 };
      }
    }
    return commit();
  }
  if (g.scene === "exploration") {
    if (command.type === "restoreEnvironment") {
      const mechanism = fieldMechanisms(g).find(m=>m.id===command.id);
      if (!mechanism || distance(g.player,mechanism)>1 || (g.fieldRestorations ?? []).includes(mechanism.id)
        || !["eco","manual"].includes(command.method) || command.method === "eco" && !fieldMechanismReady(g,mechanism)) return reject();
      g.fieldRestorations = [...(g.fieldRestorations ?? []),mechanism.id];
      g.message = mechanism.completedText;
      return commit();
    }
    if (command.type === "rematchNpc") {
      const npc = layoutIn(g,g.region??"clearing").npcs.find(entry=>(command.npcId ? entry.id===command.npcId : true)
        && distance(g.player,entry)<=1 && (g.npcDuelWins ?? []).includes(entry.id));
      if (!npc || activeCreature(g).hp<=0) return reject();
      const goal = ((g.trainingRecords?.[npc.id]?.wins ?? 0)%2===0 ? "skill" : "guard") as "skill" | "guard";
      g.battle = createBattle(`rematch-${npc.id}-${g.revision}`,activeCreature(g),npc.speciesId,false,"npc",npc.id,"classic",g.balance);
      g.battle.rematch = {goal,usedSkill:false,usedGuard:false};
      g.scene = "battle";
      g.message = `${npc.name} propôs uma revanche de treino. Vença usando ${goal==="skill" ? "a habilidade elemental" : "Defender"}. Sem captura, Sementes ou XP.`;
      return commit();
    }
    if (command.type === "breakPot") {
      const region = g.region ?? "clearing";
      const pot = layoutIn(g, region).pots.find(
        (entry) => distance(g.player, entry) <= 1 && !(g.brokenPots ?? []).includes(entry.id),
      );
      if (!pot) return reject();
      g.brokenPots = [...(g.brokenPots ?? []), pot.id];
      g.seeds = (g.seeds ?? 120) + 8;
      g.message = "O vaso guardava 8 Sementes para a próxima trilha.";
      return commit();
    }
    if (command.type === "challengeNpc") {
      const region = g.region ?? "clearing";
      const npc = layoutIn(g, region).npcs.find((entry) =>
        (command.npcId ? entry.id === command.npcId : distance(g.player, entry) <= 1) && distance(g.player, entry) <= 1 && !(g.npcDuelWins ?? []).includes(entry.id));
      if (!npc || activeCreature(g).hp <= 0) return reject();
      g.battle = createBattle(
        `duel-${npc.id}`,
        activeCreature(g),
        npc.speciesId,
        false,
        "npc",
        npc.id,
        "classic",
        g.balance,
      );
      g.scene = "battle";
      g.message = `${npc.name} propôs um duelo amistoso. Vencer rende ${npc.reward} Sementes; não é possível capturar o Eco dele.`;
      return commit();
    }
    if (command.type === "purchase") {
      if (!isStoreItemId(command.itemId) || !g.avatar) return reject();
      const owned = g.ownedItems ?? [];
      if (owned.includes(command.itemId)) return reject();
      if (isCustomAccessoryId(command.itemId) && !g.shopCatalog?.some(item => item.id === command.itemId && item.active)) return reject();
      const item = storeItem(command.itemId, g.shopCatalog), balance = g.seeds ?? 120;
      if (balance < item.price) return reject();
      g.seeds = balance - item.price;
      g.ownedItems = [...owned, item.id];
      if (item.id === "forest-cloak")
        g.avatar = { ...g.avatar, outfit: "cloak" };
      else if (item.id === "sun-scarf")
        g.avatar = { ...g.avatar, accessory: "sun-scarf" };
      else if (item.id === "moon-pin")
        g.avatar = { ...g.avatar, accessory: "moon-pin" };
      else if (item.id === "eco-moss-glyph")
        activeCreature(g).cosmeticId = "eco-moss-glyph";
      if (item.id === "sun-scarf" || item.id === "moon-pin") delete g.avatar.customAccessory;
      if (isCustomAccessoryId(item.id)) {
        const custom = g.shopCatalog!.find(entry => entry.id === item.id)!;
        g.avatar = { ...g.avatar, accessory: "none", customAccessory: { id: custom.id, shape: custom.shape, color: custom.color } };
      }
      g.message = `Você comprou ${item.name} por ${item.price} Sementes.`;
      return commit();
    }
    if (command.type === "interact") {
      const step = g.resonanceStep ?? 0;
      const seal = RESONANCE_SEALS[step];
      if (
        g.region !== "old-grove" ||
        g.ancientMarkerHeard ||
        !seal ||
        distance(g.player, seal) > 2
      )
        return reject();
      const element = species(activeCreature(g).speciesId).element;
      if (element !== seal.element) {
        g.message = `Este selo responde a ${ELEMENT_NAMES[seal.element]}. Ative um Eco desse elemento e tente novamente.`;
      } else {
        g.resonanceStep = step + 1;
        if (g.resonanceStep === RESONANCE_SEALS.length) {
          g.ancientMarkerHeard = true;
          g.seeds = (g.seeds ?? 120) + 40;
          g.message = "Os três selos cantam juntos. A pedra se ilumina e a floresta entrega 40 Sementes.";
        } else {
          const next = RESONANCE_SEALS[g.resonanceStep]!;
          g.message = `O selo ressoa. Procure o próximo marco que responde a ${ELEMENT_NAMES[next.element]}.`;
        }
      }
      return commit();
    }
    if (command.type === "walk") {
      if (
        !Number.isInteger(command.dx) ||
        !Number.isInteger(command.dy) ||
        Math.abs(command.dx) + Math.abs(command.dy) !== 1
      )
        return reject();
      const p = { x: g.player.x + command.dx, y: g.player.y + command.dy };
      const region = g.region ?? "clearing";
      const tile = explorationTile(g,p.x,p.y);
      if (tile === "wall" || tile === "water" || tile === "ruin")
        return reject();
      if (
        layoutIn(g, region).pots.some(
          (pot) => pot.x === p.x && pot.y === p.y && !(g.brokenPots ?? []).includes(pot.id),
        )
      )
        return reject();
      if (npcsIn(g, region).some((npc) => p.x === npc.x && p.y === npc.y))
        return reject();
      g.player = p;
      if (tile === "gate") {
        const portal = REGION_PORTALS[region];
        const nextRegion = portal.target;
        g.region = nextRegion;
        g.player = portalLanding(g, nextRegion);
        g.message = `${portal.title}: você chegou à ${REGION_NAMES[nextRegion]}.`;
        g.armed = true;
        g.steps = 0;
        return commit();
      }
      if (tile !== "grass") g.armed = true;
      if (tile === "healer")
        g.message =
          "Iara: “Um Orbe é uma promessa.” Use Recuperar para cuidar dos seus Ecos.";
      else if (region === "clearing" && distance(p, { x: 14, y: 4 }) <= 2)
        g.message = "Ruína: “Prendemos as vozes. Perdemos o canto.”";
      else if (region === "old-grove" && distance(p, { x: 8, y: 4 }) <= 2)
        g.message = "Pedra antiga: “A raiz conhece os dois lados do caminho.”";
      else if (distance(p, REGION_PORTALS[region].position) <= 1)
        g.message = `${REGION_PORTALS[region].title}: passagem de mão única para ${REGION_NAMES[REGION_PORTALS[region].target]}.`;
      if (tile === "grass" && g.armed) {
        g.steps++;
        if (g.steps >= 8) {
          g.steps = 0;
          g.encountered++;
          const guided = g.captured === 0;
          let enemy: SpeciesId = "WW002";
          if (!guided) {
            const r = nextRandom(g.rng);
            g.rng = r.seed;
            const choices = REGION_ENCOUNTERS[g.region ?? "clearing"];
            enemy = choices[Math.floor(r.value * choices.length)] ?? "WW002";
          }
          g.battle = createBattle(
            `local-${g.encountered}`,
            activeCreature(g),
            enemy,
            guided,
            "wild",
            undefined,
            "classic",
            g.balance,
          );
          g.scene = "battle";
          g.message = `Um ${species(enemy).name} surgiu. Escolha uma ação. Você começa e o adversário responde em seguida.`;
          g.events.push({
            id: `start:${g.battle.id}`,
            type: "encounter_started",
            encounterId: g.battle.id,
            speciesId: enemy,
          });
        }
      }
      return commit();
    }
    if (command.type === "heal") {
      const healer =
        g.region === "old-grove" ? { x: 10, y: 10 } : { x: 7, y: 10 };
      if (distance(g.player, healer) > 2) return reject();
      for (const c of g.collection) c.hp = creatureMaxHp(c.speciesId, creatureLevel(c), g.balance);
      g.message =
        "Iara: “Prontos para um novo caminho.” Todos os Ecos foram recuperados.";
      return commit();
    }
    if (command.type === "activate") {
      const c = g.collection.find((c) => c.id === command.id && c.hp > 0);
      if (!c) return reject();
      g.activeId = c.id;
      g.message = `${species(c.speciesId).name} agora caminha ao seu lado.`;
      return commit();
    }
    return reject();
  }
  if (g.scene !== "battle" || !g.battle || g.battle.result) return reject();
  const b = g.battle;
  if (b.mode === "classic") {
    if (!["basic", "skill", "defend", "capture", "flee"].includes(command.type)) return reject();
    if ((command.type === "basic" || command.type === "skill") && !same(command.target, b.enemy.pos)) return reject();
    if (command.type === "skill" && (b.allyCooldown ?? 0) > 0) return reject();
    if (command.type === "capture" && !canCapture(b)) return reject();
    if (b.rematch && command.type === "skill") b.rematch.usedSkill = true;
    if (b.rematch && command.type === "defend") b.rematch.usedGuard = true;
    b.turnFrames = [];
    b.ally.guarding = false;
    const frame = (actor: TurnFrame["actor"], message: string, action: TurnFrame["action"]): void => {
      b.turnFrames!.push({ actor, action, ally: structuredClone(b.ally), enemy: structuredClone(b.enemy), message });
      g.message = message;
    };
    const attackText = (who: "ally" | "enemy", action: "basic" | "skill", oldHp: number): string => {
      const actor = b[who], target = b[who === "ally" ? "enemy" : "ally"];
      const multiplier = action === "skill" ? elementalMultiplier(species(actor.speciesId).element, species(target.speciesId).element) : 1;
      return `${species(actor.speciesId).name} usou ${action === "skill" ? SKILL_NAMES[actor.speciesId] : "Ataque"}: −${oldHp - target.hp} PV.${multiplier > 1 ? " Super eficaz!" : multiplier < 1 ? " Pouco eficaz." : ""}`;
    };
    let playerText = "";
    if (command.type === "basic" || command.type === "skill") {
      const hp = b.enemy.hp;
      resolveAttack(b, "ally", command.type, b.enemy.pos);
      playerText = attackText("ally", command.type, hp);
    } else if (command.type === "defend") {
      b.ally.guarding = true;
      playerText = `${species(b.ally.speciesId).name} se protegeu. O próximo ataque causará metade do dano.`;
    } else if (command.type === "flee") {
      b.result = "fled";
      playerText = "Você se retirou em segurança.";
    } else if (command.type === "capture") {
      let success = b.guided;
      if (!success) {
        const r = nextRandom(g.rng); g.rng = r.seed;
        success = r.value < captureChance(b.enemy.hp, creatureMaxHp(b.enemy.speciesId, creatureLevel(b.enemy), b.balance), b.failures);
      }
      if (success) { b.result = "capture"; playerText = `${species(b.enemy.speciesId).name} aceitou o vínculo!`; }
      else { b.failures++; playerText = "O vínculo falhou. Agora o adversário responde."; }
    }
    b.allyCooldown = command.type === "skill" ? 1 : Math.max(0, (b.allyCooldown ?? 0) - 1);
    checkEnd(b);
    frame("player", playerText, command.type as TurnFrame["action"]);
    if (!b.result) {
      b.enemy.guarding = false;
      b.plan = enemyPlan(b);
      const action = b.plan.action === "skill" ? "skill" : "basic";
      const hp = b.ally.hp;
      resolveAttack(b, "enemy", action, b.ally.pos);
      b.enemyCooldown = action === "skill" ? 1 : Math.max(0, (b.enemyCooldown ?? 0) - 1);
      frame("enemy", attackText("enemy", action, hp), action);
      checkEnd(b);
      if (!b.result && b.round === 40) b.result = "escaped";
      if (!b.result) b.round++;
    }
    b.plan = enemyPlan(b);
    finish(g);
    return commit();
  }
  if (command.type === "move") {
    if (
      b.moved ||
      !inArena(command.position) ||
      distance(b.ally.pos, command.position) !== 1 ||
      same(b.enemy.pos, command.position)
    )
      return reject();
    b.ally.pos = { ...command.position };
    b.moved = true;
    g.message = "Agora escolha uma ação.";
    return commit();
  }
  if (command.type === "basic" || command.type === "skill") {
    if (!inArena(command.target) || distance(b.ally.pos, command.target) !== 1)
      return reject();
    if (command.type === "basic" && !same(command.target, b.enemy.pos))
      return reject();
    if (
      command.type === "skill" &&
      !["WW001", "WW004"].includes(b.ally.speciesId)
    )
      return reject();
    resolveAttack(b, "ally", command.type, command.target);
    g.message =
      command.type === "basic"
        ? "Seu Eco atacou."
        : "A energia ecoou pelo terreno.";
  } else if (command.type === "defend") {
    b.ally.guarding = true;
    g.message = "Seu Eco se protegeu.";
  } else if (command.type === "flee") {
    b.result = "fled";
    finish(g);
    return commit();
  } else if (command.type === "capture") {
    if (!canCapture(b)) return reject();
    let success = b.guided;
    if (!success) {
      const r = nextRandom(g.rng);
      g.rng = r.seed;
      success =
        r.value <
        captureChance(b.enemy.hp, creatureMaxHp(b.enemy.speciesId, creatureLevel(b.enemy), b.balance), b.failures);
    }
    if (success) {
      b.result = "capture";
      finish(g);
      return commit();
    }
    b.failures++;
    g.message =
      "O vínculo ainda não se formou. A próxima tentativa será mais forte.";
  } else return reject();
  if (!endTurn(b, b.ally)) enemyTurn(b);
  finish(g);
  return commit();
}
