/** Gathering ledger is independent of the user-editable expedition snapshot. */
export const FIELD_DAY_MS = 86_400_000;
export type FieldResource = "herb" | "fruit" | "sap" | "crystal";
export type FieldNode = FieldResource | "cache";
export type FieldItem = FieldResource | "lantern";
export interface FieldState {
 version: 1; revision: number;
 inventory: Record<FieldItem, number>;
 claims: Record<FieldNode, number>;
 treasure: boolean; restored: boolean;
}
export type FieldAction = { type: "gather"; node: FieldNode } | { type: "treasure" } | { type: "craft" } | { type: "restore" };
export interface FieldResult { state: FieldState; now: number }
export interface FieldGateway {
 load(): Promise<FieldResult>;
 /** Retain requestId after an uncertain failure; retrying it cannot craft twice. */
 execute(action: FieldAction, requestId?: string): Promise<FieldResult>;
}
export const FIELD_ITEMS: readonly { id: FieldItem; name: string; description: string; category: "resource" | "crafted"; origin: string; use: string }[] = [
 { id: "herb", name: "Erva luminosa", description: "Folhas que guardam um brilho suave.", category: "resource", origin: "Canteiro da clareira", use: "Preparar uma lanterna de seiva." },
 { id: "fruit", name: "Fruto do bosque", description: "Um fruto perfumado da floresta.", category: "resource", origin: "Arbusto da clareira", use: "Material de pesquisa; novas receitas em futuras expedições." },
 { id: "sap", name: "Seiva dourada", description: "Uma resina que conserva a luz das ervas.", category: "resource", origin: "Tronco da clareira", use: "Preparar uma lanterna de seiva." },
 { id: "crystal", name: "Cristal de memória", description: "Um fragmento translúcido de ressonância.", category: "resource", origin: "Afloramento ou tesouro da clareira", use: "Material de pesquisa; novas receitas em futuras expedições." },
 { id: "lantern", name: "Lanterna de seiva", description: "Luz preparada com duas ervas e duas porções de seiva.", category: "crafted", origin: "Oficina da mochila", use: "Restaurar a luz do marco da clareira." },
];
export function fieldCycle(now: number): number { return Math.floor(now / FIELD_DAY_MS); }
export function initialField(): FieldState { return { version: 1, revision: 0, inventory: { herb: 0, fruit: 0, sap: 0, crystal: 0, lantern: 0 }, claims: { herb: -1, fruit: -1, sap: -1, crystal: -1, cache: -1 }, treasure: false, restored: false }; }
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const keys = (v: Record<string, unknown>, names: string[]) => Object.keys(v).length === names.length && names.every(n => Object.hasOwn(v,n));
export function isFieldState(value: unknown): value is FieldState {
 if (!record(value) || !keys(value, ["version","revision","inventory","claims","treasure","restored"]) || value["version"] !== 1 || !Number.isSafeInteger(value["revision"]) || Number(value["revision"]) < 0 || typeof value["treasure"] !== "boolean" || typeof value["restored"] !== "boolean") return false;
 const inventory = value["inventory"], claims = value["claims"];
 return record(inventory) && keys(inventory,["herb","fruit","sap","crystal","lantern"]) && Object.values(inventory).every(n => Number.isSafeInteger(n) && Number(n)>=0 && Number(n)<=99)
  && record(claims) && keys(claims,["herb","fruit","sap","crystal","cache"]) && Object.values(claims).every(n => Number.isSafeInteger(n) && Number(n)>=-1 && Number(n)<=1_000_000);
}
/** Pure rules. An unchanged reference means no reward or ingredients were consumed. */
export function reduceField(state: FieldState, action: FieldAction, cycle: number): FieldState {
 if (!isFieldState(state) || !Number.isSafeInteger(cycle) || cycle < 0 || cycle > 1_000_000 || state.revision >= Number.MAX_SAFE_INTEGER) throw new Error("Dados da mochila inválidos.");
 const next = structuredClone(state), bag = next.inventory;
 switch(action.type) {
  case "gather": {
   if (!Object.hasOwn(next.claims, action.node) || state.claims[action.node] >= cycle) return state;
   if (action.node === "cache") { if (bag.herb >= 99 || bag.fruit >= 99) return state; bag.herb++; bag.fruit++; }
   else { if (bag[action.node] > 97) return state; bag[action.node] += 2; }
   next.claims[action.node] = cycle; break;
  }
  case "treasure": if (state.treasure || bag.crystal >= 99) return state; next.treasure = true; bag.crystal++; break;
  case "craft": if (bag.herb < 2 || bag.sap < 2 || bag.lantern >= 99) return state; bag.herb -= 2; bag.sap -= 2; bag.lantern++; break;
  case "restore": if (state.restored || bag.lantern < 1) return state; bag.lantern--; next.restored = true; break;
  default: throw new Error("Ação de campo inválida.");
 }
 next.revision++; return next;
}
