import { isAccessoryVisual, type AccessoryVisual } from "./live-ops.js";
export const SKIN_TONES = ["sand", "copper", "umber"] as const;
export const HAIR_STYLES = ["short", "curls", "long", "braids"] as const;
export const HAIR_COLORS = ["dark", "chestnut", "copper", "silver"] as const;
export const OUTFITS = ["moss", "sunset", "river", "cloak"] as const;
export const ACCESSORIES = [
  "none",
  "scarf",
  "satchel",
  "sun-scarf",
  "moon-pin",
] as const;

export type SkinTone = (typeof SKIN_TONES)[number];
export type HairStyle = (typeof HAIR_STYLES)[number];
export type HairColor = (typeof HAIR_COLORS)[number];
export type Outfit = (typeof OUTFITS)[number];
export type Accessory = (typeof ACCESSORIES)[number];

export interface AvatarAppearance {
  skin: SkinTone;
  hair: HairStyle;
  hairColor: HairColor;
  outfit: Outfit;
  accessory: Accessory;
  customAccessory?: AccessoryVisual;
}

export const DEFAULT_AVATAR: AvatarAppearance = {
  skin: "sand",
  hair: "short",
  hairColor: "dark",
  outfit: "moss",
  accessory: "none",
};

export function isAvatarAppearance(value: unknown): value is AvatarAppearance {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return (
    SKIN_TONES.includes(record["skin"] as SkinTone) &&
    HAIR_STYLES.includes(record["hair"] as HairStyle) &&
    HAIR_COLORS.includes(record["hairColor"] as HairColor) &&
    OUTFITS.includes(record["outfit"] as Outfit) &&
    ACCESSORIES.includes(record["accessory"] as Accessory) &&
    (record["customAccessory"] === undefined || isAccessoryVisual(record["customAccessory"]))
  );
}
