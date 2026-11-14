import { activeCreature, distance, layoutIn, mapTile, REGION_ORDER, REGION_PORTALS, species, type Element, type Game, type Position, type Region } from "./game.js";

export const FIELD_MECHANISM_IDS = ["clearing-lantern", "old-grove-garden", "tide-waterwheel", "canopy-beacon", "tide-bridge"] as const;
export type FieldMechanismId = (typeof FIELD_MECHANISM_IDS)[number];
export interface FieldMechanism extends Position {
  id: FieldMechanismId; name: string; element: Element; region: Region;
  description: string; completedText: string; manualLabel: string; ecoLabel: string;
}
type Definition = Omit<FieldMechanism, "x" | "y"> & { anchor: Position };
const DEFINITIONS: readonly Definition[] = [
  { id: "clearing-lantern", name: "Lanterna dos viajantes", element: "fire", region: "clearing", anchor: {x: 6,y: 2}, description: "Uma antiga lanterna guarda a lembrança das primeiras fogueiras.", completedText: "A lanterna voltou a aquecer a memória dos viajantes.", manualLabel: "Alinhar os refletores à mão", ecoLabel: "Acender com Fogo" },
  { id: "old-grove-garden", name: "Trilha das raízes", element: "plant", region: "old-grove", anchor: {x: 4,y: 7}, description: "Brotos adormecidos podem voltar a marcar o caminho até o portal.", completedText: "As flores voltaram a apontar o caminho da floresta.", manualLabel: "Cuidar dos brotos à mão", ecoLabel: "Despertar com Planta" },
  { id: "tide-waterwheel", name: "Roda da primeira chuva", element: "water", region: "tide-cavern", anchor: {x: 11,y: 6}, description: "O canal antigo espera um impulso para voltar a movimentar sua roda.", completedText: "A roda voltou a cantar com a água da gruta.", manualLabel: "Desobstruir o canal à mão", ecoLabel: "Movimentar com Água" },
  { id: "canopy-beacon", name: "Farol das copas", element: "electric", region: "canopy-trail", anchor: {x: 15,y: 5}, description: "Um farol apagado pode voltar a orientar quem atravessa as copas.", completedText: "O farol das copas voltou a iluminar a travessia.", manualLabel: "Ajustar o refletor à mão", ecoLabel: "Energizar com Elétrico" },
  { id: "tide-bridge", name: "Ponte dos passos", element: "earth", region: "tide-cavern", anchor: {x: 7,y: 8}, description: "Pedras soltas guardam uma travessia opcional sobre o canal oeste.", completedText: "As pedras se firmaram: uma ponte agora atravessa o canal oeste.", manualLabel: "Encaixar as pedras à mão", ecoLabel: "Reconstruir com Terra" },
];
const cache = new WeakMap<Game, FieldMechanism[]>();
const walkable = (x: number,y: number,region: Region) => ["ground","grass","path","healer","gate"].includes(mapTile(x,y,region));

/** Positions depend only on the existing immutable layout, never on game RNG or player location. */
export function fieldMechanisms(game: Game): FieldMechanism[] {
  const cached = cache.get(game); if (cached) return cached;
  const region = game.region ?? "clearing", layout = layoutIn(game,region), occupied = [...layout.pots,...layout.npcs];
  const previous = REGION_ORDER[(REGION_ORDER.indexOf(region)+REGION_ORDER.length-1)%REGION_ORDER.length]!;
  const entrance = REGION_PORTALS[previous].arrival;
  const queue: Position[] = [entrance], reached = new Set<string>();
  for(let i=0;i<queue.length;i++) {
    const p=queue[i]!, key=`${p.x}:${p.y}`;
    if(reached.has(key)||!walkable(p.x,p.y,region)||occupied.some(o=>distance(o,p)===0)) continue;
    reached.add(key);
    for(const d of [{x:1,y:0},{x:-1,y:0},{x:0,y:1},{x:0,y:-1}]) queue.push({x:p.x+d.x,y:p.y+d.y});
  }
  const candidates: Position[]=[];
  for(let y=2;y<=12;y++) for(let x=2;x<=17;x++) {
    const p={x,y};
    if(!reached.has(`${x}:${y}`)||!["ground","path"].includes(mapTile(x,y,region))||distance(p,REGION_PORTALS[region].position)<=1||distance(p,entrance)<=1) continue;
    if(region==="clearing" && (x>=5&&y>=8 || distance(p,{x:14,y:4})<=2 || distance(p,{x:7,y:10})<=2)) continue;
    if(region==="old-grove" && (distance(p,{x:8,y:4})<=2||distance(p,{x:10,y:6})<=2||distance(p,{x:10,y:10})<=2)) continue;
    if((region==="canopy-trail"&&distance(p,{x:7,y:10})<=2)||(region==="tide-cavern"&&distance(p,{x:10,y:10})<=2)) continue;
    candidates.push(p);
  }
  const result: FieldMechanism[]=[];
  for(const {anchor,...definition} of DEFINITIONS.filter(d=>d.region===region)) {
    const choices=candidates.filter(p=>!result.some(other=>distance(other,p)<=1));
    choices.sort((a,b)=>distance(a,anchor)-distance(b,anchor)||a.y-b.y||a.x-b.x);
    if(choices[0]) result.push({...definition,...choices[0]});
  }
  cache.set(game,result); return result;
}
export function fieldMechanismReady(game: Game, mechanism: FieldMechanism): boolean {
  const creature=activeCreature(game);
  return creature.hp>0 && species(creature.speciesId).element===mechanism.element;
}
export function explorationTile(game: Game,x: number,y: number): ReturnType<typeof mapTile> {
  if(game.region==="tide-cavern"&&game.fieldRestorations?.includes("tide-bridge")&&y===8&&x>=4&&x<=6) return "path";
  return mapTile(x,y,game.region??"clearing");
}
