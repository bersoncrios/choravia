import { distance, layoutIn, mapTile, same, type Game, type Position } from "./game.js";
import type { FieldState } from "./field.js";

export type FieldPointId = "herb" | "fruit" | "sap" | "crystal" | "cache" | "treasure";
export interface FieldPoint extends Position { id: FieldPointId; name: string; symbol: string }
const DEFINITIONS: ReadonlyArray<Omit<FieldPoint, "x" | "y">> = [
  { id: "herb", name: "Erva luminosa", symbol: "❧" },
  { id: "fruit", name: "Fruto do bosque", symbol: "●" },
  { id: "sap", name: "Seiva dourada", symbol: "♧" },
  { id: "crystal", name: "Cristal de memória", symbol: "◇" },
  { id: "treasure", name: "Baú de Iara", symbol: "▣" },
  { id: "cache", name: "Esconderijo entre folhas", symbol: "✧" },
];
const pointCache = new WeakMap<Game, { cycle: number; points: FieldPoint[] }>();

/** Uses the existing, immutable layout; never moves legacy objects or advances game RNG. */
export function fieldPoints(game: Game, cycle: number): FieldPoint[] {
  if ((game.region ?? "clearing") !== "clearing") return [];
  const cached = pointCache.get(game);
  if (cached?.cycle === cycle) return cached.points;
  const layout = layoutIn(game, "clearing");
  const occupied = [...layout.pots, ...layout.npcs];
  const reachable = new Set<string>(), queue: Position[] = [{ x: 9, y: 10 }];
  for (let i = 0; i < queue.length; i++) {
    const p = queue[i]!, key = `${p.x}:${p.y}`;
    if (reachable.has(key) || !["path", "ground", "grass", "healer"].includes(mapTile(p.x, p.y)) || occupied.some(o => same(o, p))) continue;
    reachable.add(key);
    for (const d of [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }]) queue.push({ x: p.x + d.x, y: p.y + d.y });
  }
  const candidates: Position[] = [];
  for (let y = 8; y <= 12; y++) for (let x = 5; x <= 17; x++) {
    const p = { x, y };
    if (reachable.has(`${x}:${y}`) && ["ground", "path"].includes(mapTile(x, y)) && distance(p, { x: 7, y: 10 }) > 1 && distance(p, { x: 9, y: 11 }) > 1) candidates.push(p);
  }
  // Fixed ordering for resources and treasure. Only the final cache changes by cycle.
  candidates.sort((a, b) => ((a.x * 37 + a.y * 19) % 83) - ((b.x * 37 + b.y * 19) % 83) || a.y - b.y || a.x - b.x);
  const points: FieldPoint[] = [];
  for (const definition of DEFINITIONS) {
    if (!candidates.length) break;
    const index = definition.id === "cache" ? Math.abs(cycle) % candidates.length : 0;
    points.push({ ...definition, ...candidates.splice(index, 1)[0]! });
  }
  pointCache.set(game, { cycle, points });
  return points;
}
export function fieldAvailable(state: FieldState, id: FieldPointId, cycle: number): boolean {
  return id === "treasure" ? !state.treasure : state.claims[id] < cycle;
}
