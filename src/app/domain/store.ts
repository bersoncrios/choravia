import { isCustomAccessoryId, type CustomAccessory, type CustomAccessoryId } from "./live-ops.js";
export type StoreItemId =
  | "forest-cloak"
  | "sun-scarf"
  | "moon-pin"
  | "eco-moss-glyph"
  | "trail-boots"
  | CustomAccessoryId;

export interface StoreItem {
  readonly id: StoreItemId;
  readonly name: string;
  readonly category: "Guardião" | "Eco" | "Exploração";
  readonly price: number;
  readonly description: string;
}

export const STORE_ITEMS: readonly StoreItem[] = [
  {
    id: "forest-cloak",
    name: "Capa de samambaia",
    category: "Guardião",
    price: 65,
    description: "Uma capa curta tecida com folhas da Clareira Antiga.",
  },
  {
    id: "sun-scarf",
    name: "Lenço do poente",
    category: "Guardião",
    price: 45,
    description: "Um lenço cor de brasa para seu Guardião.",
  },
  {
    id: "moon-pin",
    name: "Broche lunar",
    category: "Guardião",
    price: 40,
    description: "Um pequeno brilho prateado preso à roupa.",
  },
  {
    id: "eco-moss-glyph",
    name: "Marca de musgo",
    category: "Eco",
    price: 55,
    description: "Um selo luminoso para o Eco que caminha ao seu lado.",
  },
  {
    id: "trail-boots",
    name: "Botas de trilha",
    category: "Exploração",
    price: 80,
    description: "Reduzem o intervalo entre passos no mapa. Não alteram batalhas.",
  },
];

export function isStoreItemId(value: unknown): value is StoreItemId {
  return STORE_ITEMS.some((item) => item.id === value) || isCustomAccessoryId(value);
}

export function storeItem(id: StoreItemId, custom: readonly CustomAccessory[] = []): StoreItem {
  const item = STORE_ITEMS.find((entry) => entry.id === id) ?? custom.filter(entry => entry.id === id).map(entry => ({ ...entry, category: "Guardião" as const }))[0];
  if (!item) throw new Error("Item da loja inválido.");
  return item;
}
