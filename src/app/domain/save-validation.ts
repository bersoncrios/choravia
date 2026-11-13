import { isBalanceConfig, isCustomAccessory } from "./live-ops.js";
import { validTurnData } from "./turn-validation.js";
import {
  Game,
  SPECIES,
  mapTile,
  distance,
  same,
  potsIn,
  TRAIL_RIVAL,
  REGION_ORDER,
  layoutIn,
  creatureMaxHp,
  xpToNextLevel,
  MAX_CREATURE_LEVEL,
} from "./game.js";
import { isAvatarAppearance } from "./avatar.js";
import { isStoreItemId } from "./store.js";
const isRecord = (x: unknown): x is Record<string, unknown> =>
  !!x && typeof x === "object" && !Array.isArray(x);
const int = (
  x: unknown,
  min: number,
  max = Number.MAX_SAFE_INTEGER,
): x is number =>
  Number.isSafeInteger(x) && Number(x) >= min && Number(x) <= max;
const position = (x: unknown, maxX: number, maxY: number): boolean =>
  isRecord(x) && int(x["x"], 0, maxX) && int(x["y"], 0, maxY);
const validSpecies = (x: unknown): boolean => SPECIES.some((s) => s.id === x);
function validWorldLayouts(value: unknown): boolean {
  if (value === undefined) return true;
  if (!isRecord(value)) return false;
  for (const [key, raw] of Object.entries(value)) {
    if (!REGION_ORDER.includes(key as (typeof REGION_ORDER)[number]) || !isRecord(raw)) return false;
    const region = key as (typeof REGION_ORDER)[number];
    const pots = raw["pots"], npcs = raw["npcs"];
    if (!Array.isArray(pots) || pots.length > 5 || !Array.isArray(npcs) || npcs.length > 3) return false;
    const ids = new Set<string>(), occupied = new Set<string>();
    for (const item of [...pots, ...npcs]) {
      if (!isRecord(item) || typeof item["id"] !== "string" || ids.has(item["id"]) || !position(item, 19, 14)) return false;
      const x = Number(item["x"]), y = Number(item["y"]), tile = mapTile(x, y, region), pos = `${x}:${y}`;
      if (!["ground", "grass", "path"].includes(tile) || occupied.has(pos)) return false;
      ids.add(item["id"]); occupied.add(pos);
    }
    for (const npc of npcs) {
      if (typeof npc["name"] !== "string" || npc["name"].length > 24 || !validSpecies(npc["speciesId"]) || !int(npc["reward"], 1, 1000)) return false;
    }
  }
  return true;
}
/** Untrusted disk data is checked before it can become domain state. */
export function isGame(value: unknown): value is Game {
  if (
    !isRecord(value) ||
    value["schemaVersion"] !== 1 ||
    !int(value["revision"], 0) ||
    (value["balance"] !== undefined && !isBalanceConfig(value["balance"])) ||
    (value["shopCatalog"] !== undefined && (!Array.isArray(value["shopCatalog"]) || value["shopCatalog"].length > 200 || !value["shopCatalog"].every(isCustomAccessory) || new Set(value["shopCatalog"].map(v => v.id)).size !== value["shopCatalog"].length)) ||
    !int(value["rng"], 1, 4294967295) ||
    !position(value["player"], 19, 14) ||
    (value["region"] !== undefined &&
      !REGION_ORDER.includes(value["region"] as (typeof REGION_ORDER)[number])) ||
    !validWorldLayouts(value["worldLayouts"]) ||
    (value["ancientMarkerHeard"] !== undefined &&
      typeof value["ancientMarkerHeard"] !== "boolean") ||
    (value["resonanceStep"] !== undefined &&
      !int(value["resonanceStep"], 0, 3)) ||
    (value["avatar"] !== undefined &&
      !isAvatarAppearance(value["avatar"])) ||
    (value["ownedItems"] !== undefined &&
      (!Array.isArray(value["ownedItems"]) ||
        value["ownedItems"].length > 200 ||
        new Set(value["ownedItems"]).size !== value["ownedItems"].length ||
        !value["ownedItems"].every(isStoreItemId))) ||
    (value["dailyRewardReceipts"] !== undefined &&
      (!Array.isArray(value["dailyRewardReceipts"]) || value["dailyRewardReceipts"].length > 500 || new Set(value["dailyRewardReceipts"]).size !== value["dailyRewardReceipts"].length || !value["dailyRewardReceipts"].every((id: unknown) => typeof id === "string" && (/^daily:[0-9]{4}-[0-9]{2}-[0-9]{2}:[a-z-]+(?::bonus)?$|^weekly:[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(id))))) ||
    (value["starterChosen"] !== undefined &&
      typeof value["starterChosen"] !== "boolean") ||
    (value["seeds"] !== undefined && !int(value["seeds"], 0, 1000000)) ||
    (value["brokenPots"] !== undefined &&
      (!Array.isArray(value["brokenPots"]) ||
        value["brokenPots"].length > 100 ||
        new Set(value["brokenPots"]).size !== value["brokenPots"].length ||
        !value["brokenPots"].every(
          (id: unknown) =>
            typeof id === "string" &&
            [...REGION_ORDER.flatMap((region) => layoutIn(value as unknown as Game, region).pots), ...potsIn("clearing"), ...potsIn("old-grove")].some((pot) => pot.id === id),
        ))) ||
    (value["npcDuelWins"] !== undefined &&
      (!Array.isArray(value["npcDuelWins"]) ||
        value["npcDuelWins"].length > 20 ||
        new Set(value["npcDuelWins"]).size !== value["npcDuelWins"].length ||
        !value["npcDuelWins"].every((id: unknown) => typeof id === "string" && (id === TRAIL_RIVAL.id || REGION_ORDER.some((region) => layoutIn(value as unknown as Game, region).npcs.some((npc) => npc.id === id)))))) ||
    !int(value["steps"], 0, 7) ||
    typeof value["armed"] !== "boolean" ||
    !int(value["encountered"], 0) ||
    !int(value["captured"], 0) ||
    typeof value["message"] !== "string" ||
    !["exploration", "battle", "result"].includes(String(value["scene"]))
  )
    return false;
  const collection = value["collection"];
  if (
    !Array.isArray(collection) ||
    collection.length < 1 ||
    collection.length > 100000
  )
    return false;
  const ids = new Set<string>();
  for (const c of collection) {
    if (
      !isRecord(c) ||
      typeof c["id"] !== "string" ||
      ids.has(c["id"]) ||
      !validSpecies(c["speciesId"]) ||
      !["local", "validated"].includes(String(c["provenance"]))
    )
      return false;
    const s = SPECIES.find((s) => s.id === c["speciesId"]);
    const level = c["level"] === undefined ? 1 : c["level"];
    const experience = c["experience"] === undefined ? 0 : c["experience"];
    if (!s || !int(level, 1, MAX_CREATURE_LEVEL) || !int(experience, 0, Math.max(0, xpToNextLevel(Number(level)) - 1)) || !int(c["hp"], 0, creatureMaxHp(s.id, Number(level), (value as unknown as Game).balance))) return false;
    ids.add(c["id"]);
  }
  if (typeof value["activeId"] !== "string" || !ids.has(value["activeId"]))
    return false;
  const ownedItems = Array.isArray(value["ownedItems"])
    ? (value["ownedItems"] as string[])
    : [];
  const avatar = value["avatar"] as Game["avatar"];
  if (
    (avatar?.outfit === "cloak" && !ownedItems.includes("forest-cloak")) ||
    (avatar?.accessory === "sun-scarf" && !ownedItems.includes("sun-scarf")) ||
    (avatar?.accessory === "moon-pin" && !ownedItems.includes("moon-pin")) ||
    (!!avatar?.customAccessory && !ownedItems.includes(avatar.customAccessory.id))
  )
    return false;
  if (
    collection.some(
      (c: unknown) =>
        isRecord(c) &&
        c["cosmeticId"] !== undefined &&
        (c["cosmeticId"] !== "eco-moss-glyph" ||
          !ownedItems.includes("eco-moss-glyph")),
    )
  )
    return false;
  if (
    !Array.isArray(value["events"]) ||
    value["events"].length > 100 ||
    !value["events"].every(
      (e: unknown) =>
        isRecord(e) &&
        typeof e["id"] === "string" &&
        typeof e["encounterId"] === "string" &&
        [
          "encounter_started",
          "battle_finished",
          "first_capture",
          "capture",
        ].includes(String(e["type"])),
    )
  )
    return false;
  const p = value["player"] as { x: number; y: number };
  const region = REGION_ORDER.includes(value["region"] as (typeof REGION_ORDER)[number]) ? value["region"] as (typeof REGION_ORDER)[number] : "clearing";
  if (["wall", "water", "ruin"].includes(mapTile(p.x, p.y, region)))
    return false;
  if (
    layoutIn(value as unknown as Game, region).npcs.some((npc) => npc.x === p.x && npc.y === p.y)
  )
    return false;
  const b = value["battle"];
  if (value["scene"] === "exploration") return b === null;
  if (
    !isRecord(b) ||
    !validTurnData(b) ||
    typeof b["id"] !== "string" ||
    (b["kind"] !== undefined && !["wild", "npc"].includes(String(b["kind"]))) ||
    (b["challengeId"] !== undefined && typeof b["challengeId"] !== "string") ||
    !int(b["round"], 1, 40) ||
    !int(b["failures"], 0, 40) ||
    typeof b["guided"] !== "boolean" ||
    typeof b["moved"] !== "boolean"
  )
    return false;
  if (b["balance"] !== undefined && !isBalanceConfig(b["balance"])) return false;
  for (const key of ["ally", "enemy"]) {
    const f = b[key];
    if (
      !isRecord(f) ||
      !validSpecies(f["speciesId"]) ||
      !position(f["pos"], 4, 4) ||
      typeof f["guarding"] !== "boolean"
    )
      return false;
    const s = SPECIES.find((s) => s.id === f["speciesId"]);
    const level = f["level"] === undefined ? 1 : f["level"];
    if (!s || !int(level, 1, MAX_CREATURE_LEVEL) || !int(f["hp"], 0, creatureMaxHp(s.id, Number(level), (b as unknown as Game["battle"])?.balance))) return false;
  }
  const ally = b["ally"] as {
      pos: { x: number; y: number };
      speciesId: string;
      hp: number;
    },
    enemy = b["enemy"] as { pos: { x: number; y: number }; hp: number };
  if (same(ally.pos, enemy.pos)) return false;
  const active = collection.find(
    (c: unknown) => isRecord(c) && c["id"] === value["activeId"],
  );
  if (!isRecord(active) || active["speciesId"] !== ally.speciesId) return false;
  if (
    !Array.isArray(b["cells"]) ||
    b["cells"].length !== 25 ||
    !b["cells"].every(
      (c: unknown) =>
        isRecord(c) &&
        ["ground", "grass", "water", "fire"].includes(String(c["terrain"])) &&
        int(c["remaining"], 0, 4) &&
        (c["terrain"] === "fire"
          ? Number(c["remaining"]) > 0
          : c["remaining"] === 0),
    )
  )
    return false;
  const plan = b["plan"];
  if (
    !isRecord(plan) ||
    !position(plan["destination"], 4, 4) ||
    !position(plan["target"], 4, 4) ||
    !["basic", "skill", "defend"].includes(String(plan["action"]))
  )
    return false;
  if (distance(enemy.pos, plan["destination"] as { x: number; y: number }) > 1)
    return false;
  const result = b["result"];
  if (b["kind"] === "npc" && (typeof b["challengeId"] !== "string" || !REGION_ORDER.some((area) => layoutIn(value as unknown as Game, area).npcs.some((npc) => npc.id === b["challengeId"])))) return false;
  if (b["kind"] !== "npc" && b["challengeId"] !== undefined) return false;
  if (b["kind"] === "npc" && result === "capture") return false;
  if (value["scene"] === "battle")
    return result === null && ally.hp > 0 && enemy.hp > 0;
  return ["capture", "victory", "defeat", "fled", "escaped"].includes(
    String(result),
  );
}
