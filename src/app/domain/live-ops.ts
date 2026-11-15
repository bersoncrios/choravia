import type { SpeciesId } from "./game.js";
export type CustomAccessoryId = `custom-${string}`;
export type AccessoryShape = "pin" | "scarf" | "crown";
export interface AccessoryVisual { id: CustomAccessoryId; shape: AccessoryShape; color: string }
export interface CustomAccessory extends AccessoryVisual { name: string; description: string; price: number; active: boolean; revision: number }
export interface BalanceStats { hp: number; attack: number; defense: number }
export type BalanceConfig = Partial<Record<SpeciesId, BalanceStats>>;
export interface BalanceEntry extends BalanceStats { id: SpeciesId; revision: number }
export type BadgeSymbol = "star" | "leaf" | "flame" | "gem" | "crown";
export const BADGE_SYMBOLS: Record<BadgeSymbol, string> = { star: "★", leaf: "❧", flame: "♨", gem: "◆", crown: "♛" };
export interface BadgeDefinition { id: string; name: string; description: string; color: string; symbol: BadgeSymbol; category: "event" | "milestone" | "special"; active: boolean; revision: number }
export interface PlayerBadge { badgeId: string; name: string; description: string; color: string; symbol: BadgeSymbol; category: BadgeDefinition["category"]; reason: string; grantedBy: string; grantedAt: number }
export interface LiveContent { accessories: CustomAccessory[]; balance: BalanceEntry[]; badges: BadgeDefinition[] }
export const EMPTY_LIVE_CONTENT: LiveContent = { accessories: [], balance: [], badges: [] };
export type LiveOpsRequest =
 | { method: "saveAccessory"; requestId: string; reason: string; value: CustomAccessory }
 | { method: "saveBalance"; requestId: string; reason: string; value: BalanceEntry }
 | { method: "saveBadge"; requestId: string; reason: string; value: BadgeDefinition }
 | { method: "grantBadge"; requestId: string; reason: string; targetUid: string; badgeId: string };
export interface LiveOpsResult { replay: boolean }
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const text = (v: unknown, min: number, max: number): v is string => typeof v === "string" && v.trim().length >= min && v.length <= max;
const integer = (v: unknown, min: number, max: number): boolean => Number.isSafeInteger(v) && Number(v) >= min && Number(v) <= max;
export const isCustomAccessoryId = (v: unknown): v is CustomAccessoryId => typeof v === "string" && /^custom-[a-z0-9-]{3,54}$/.test(v);
export const validColor = (v: unknown): v is string => typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v);
export function isAccessoryVisual(v: unknown): v is AccessoryVisual { return record(v) && isCustomAccessoryId(v["id"]) && ["pin", "scarf", "crown"].includes(String(v["shape"])) && validColor(v["color"]); }
export function isCustomAccessory(v: unknown): v is CustomAccessory { return record(v) && isAccessoryVisual(v) && text(v["name"], 2, 60) && text(v["description"], 5, 240) && integer(v["price"], 0, 10000) && typeof v["active"] === "boolean" && integer(v["revision"], 0, 1000000); }
export function isBalanceStats(v: unknown): v is BalanceStats { return record(v) && integer(v["hp"], 20, 200) && integer(v["attack"], 1, 50) && integer(v["defense"], 1, 50); }
export function isBalanceConfig(v: unknown): v is BalanceConfig { return record(v) && Object.entries(v).length <= 6 && Object.entries(v).every(([id, stats]) => /^WW00[1-6]$/.test(id) && isBalanceStats(stats)); }
export function isBalanceEntry(v: unknown): v is BalanceEntry { return record(v) && /^WW00[1-6]$/.test(String(v["id"])) && isBalanceStats(v) && integer(v["revision"], 0, 1000000); }
export function isBadgeDefinition(v: unknown): v is BadgeDefinition { return record(v) && typeof v["id"] === "string" && /^badge-[a-z0-9-]{3,54}$/.test(v["id"]) && text(v["name"], 2, 60) && text(v["description"], 5, 240) && validColor(v["color"]) && Object.hasOwn(BADGE_SYMBOLS, String(v["symbol"])) && ["event", "milestone", "special"].includes(String(v["category"])) && typeof v["active"] === "boolean" && integer(v["revision"], 0, 1000000); }
export function parseLiveOpsRequest(raw: unknown): LiveOpsRequest {
 if (!record(raw) || !text(raw["requestId"], 8, 100) || !/^[a-zA-Z0-9_-]+$/.test(String(raw["requestId"])) || !text(raw["reason"], 5, 240)) throw new Error("Informe um motivo de 5 a 240 caracteres e uma operação válida.");
 const keys = Object.keys(raw).sort().join(",");
 if (raw["method"] === "grantBadge" && keys === "badgeId,method,reason,requestId,targetUid" && text(raw["targetUid"], 1, 128) && !raw["targetUid"].includes("/") && /^badge-[a-z0-9-]{3,54}$/.test(String(raw["badgeId"]))) return raw as unknown as LiveOpsRequest;
 if (keys !== "method,reason,requestId,value") throw new Error("Campos inválidos na operação.");
 const v = raw["value"];
 const exact = (fields: string[]) => record(v) && Object.keys(v).sort().join(",") === fields.sort().join(",");
 if (raw["method"] === "saveAccessory" && isCustomAccessory(v) && exact(["id","shape","color","name","description","price","active","revision"]) || raw["method"] === "saveBalance" && isBalanceEntry(v) && exact(["id","hp","attack","defense","revision"]) || raw["method"] === "saveBadge" && isBadgeDefinition(v) && exact(["id","name","description","color","symbol","category","active","revision"])) return raw as unknown as LiveOpsRequest;
 throw new Error("Dados inválidos: confira os limites e os campos do formulário.");
}

export interface ContentAuditEntry { id: string; actorUid: string; action: string; entityPath: string; reason: string; createdAt: number }
