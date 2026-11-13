import { validTurnData } from "./turn-validation.js";
import { SPECIES, distance, same, creatureMaxHp, MAX_CREATURE_LEVEL, xpToNextLevel } from "./game.js";
import type { RemoteMethod, Responses } from "./online.js";
const record = (x: unknown): x is Record<string, unknown> =>
  !!x && typeof x === "object" && !Array.isArray(x);
const num = (x: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): boolean =>
  Number.isSafeInteger(x) && Number(x) >= min && Number(x) <= max;
const id = (x: unknown): boolean =>
  typeof x === "string" && /^[A-Za-z0-9_-]{8,100}$/.test(x);
const spec = (x: unknown): boolean => SPECIES.some((s) => s.id === x);
const pos = (x: unknown): x is { x: number; y: number } =>
  record(x) && num(x["x"], 0, 4) && num(x["y"], 0, 4);
const lock = (x: unknown): boolean =>
  x === null ||
  (record(x) &&
    ["trade", "encounter"].includes(String(x["kind"])) &&
    id(x["id"]));
const creature = (x: unknown): boolean =>
  record(x) &&
  id(x["id"]) &&
  spec(x["speciesId"]) &&
  num(x["level"], 1, MAX_CREATURE_LEVEL) &&
  num(x["experience"], 0, Math.max(0, xpToNextLevel(Number(x["level"])) - 1)) &&
  num(x["revision"], 1) &&
  lock(x["lock"]);
function fighter(x: unknown): x is { hp: number; speciesId: string; pos: { x: number; y: number }; guarding: boolean; level?: number } {
  if (
    !record(x) ||
    !spec(x["speciesId"]) ||
    !pos(x["pos"]) ||
    typeof x["guarding"] !== "boolean"
  )
    return false;
  const level = x["level"] === undefined ? 1 : Number(x["level"]);
  return num(level, 1, MAX_CREATURE_LEVEL) && num(x["hp"], 0, creatureMaxHp(x["speciesId"] as import("./game.js").SpeciesId, level));
}
function encounter(x: unknown): boolean {
  if (
    !record(x) ||
    !id(x["id"]) ||
    !id(x["activeCreatureId"]) ||
    !num(x["seq"], 0, 300) ||
    !["open", "resolved", "expired"].includes(String(x["status"])) ||
    typeof x["message"] !== "string"
  )
    return false;
  const b = x["battle"];
  if (
    !record(b) ||
    !validTurnData(b) ||
    b["id"] !== x["id"] ||
    !fighter(b["ally"]) ||
    !fighter(b["enemy"]) ||
    !num(b["round"], 1, 40) ||
    !num(b["failures"], 0, 40) ||
    typeof b["guided"] !== "boolean" ||
    typeof b["moved"] !== "boolean"
  )
    return false;
  const ally = b["ally"] as { hp: number; pos: { x: number; y: number } };
  const enemy = b["enemy"] as { hp: number; pos: { x: number; y: number } };
  if (same(ally.pos, enemy.pos)) return false;
  if (
    !Array.isArray(b["cells"]) ||
    b["cells"].length !== 25 ||
    !b["cells"].every(
      (c) =>
        record(c) &&
        ["ground", "grass", "water", "fire"].includes(String(c["terrain"])) &&
        num(c["remaining"], 0, 4) &&
        (c["terrain"] === "fire"
          ? Number(c["remaining"]) > 0
          : c["remaining"] === 0),
    )
  )
    return false;
  const p = b["plan"];
  if (
    !record(p) ||
    !pos(p["destination"]) ||
    !pos(p["target"]) ||
    distance(p["destination"], enemy.pos) > 1 ||
    !["basic", "skill", "defend"].includes(String(p["action"]))
  )
    return false;
  if (x["status"] === "open")
    return b["result"] === null && ally.hp > 0 && enemy.hp > 0;
  return (
    b["result"] === null ||
    ["capture", "victory", "defeat", "fled", "escaped"].includes(
      String(b["result"]),
    )
  );
}
const offer = (x: unknown): boolean =>
  record(x) &&
  id(x["id"]) &&
  id(x["offeredCreatureId"]) &&
  spec(x["offeredSpeciesId"]) &&
  num(x["offeredLevel"], 1, MAX_CREATURE_LEVEL) &&
  spec(x["requestedSpeciesId"]) &&
  num(x["expiresAt"], 1) &&
  num(x["revision"], 1);
const page = (x: Record<string, unknown>): boolean =>
  Array.isArray(x["creatures"]) &&
  x["creatures"].length <= 50 &&
  x["creatures"].every(creature) &&
  (x["nextCursor"] === null || id(x["nextCursor"])) &&
  num(x["inventoryRevision"], 1);
export function validateResponse<K extends RemoteMethod>(
  method: K,
  value: unknown,
): Responses[K] {
  if (!record(value)) throw new Error("Resposta online inválida.");
  let valid = false;
  switch (method) {
    case "ackDailyRewards":
      valid = value["acknowledged"] === true;
      break;
    case "syncExpedition":
      valid = Array.isArray(value["mapping"]) && value["mapping"].length <= 100 && value["mapping"].every(entry => record(entry) && typeof entry["sourceId"] === "string" && /^[A-Za-z0-9_-]{1,100}$/.test(entry["sourceId"]) && (entry["id"] === null || id(entry["id"])));
      break;
    case "recordExpeditionDaily":
      valid = value["recorded"] === true;
      break;
    case "getDailyBoard": {
      const board = value as Record<string, unknown>;
      const contracts = board["contracts"];
      const weekly = board["weekly"] as Record<string, unknown> | undefined;
      const rewards = board["pendingRewards"];
      valid = typeof board["cycleId"] === "string" && /^\d{4}-\d{2}-\d{2}$/.test(board["cycleId"]) && num(board["resetAt"], 1) && Array.isArray(contracts) && contracts.length === 3 && contracts.every((c) => record(c) && typeof c["id"] === "string" && typeof c["title"] === "string" && typeof c["description"] === "string" && num(c["rewardSeeds"]) && num(c["progress"]) && c["target"] === 1 && typeof c["completed"] === "boolean") && num(board["completionBonusSeeds"]) && typeof board["completionBonusEarned"] === "boolean" && !!weekly && num(weekly["qualifiedDays"]) && weekly["requiredDays"] === 4 && typeof weekly["completed"] === "boolean" && (weekly["rewardItemId"] === null || ["forest-cloak", "sun-scarf", "moon-pin"].includes(String(weekly["rewardItemId"]))) && Array.isArray(rewards) && rewards.length <= 20 && rewards.every((r) => record(r) && typeof r["receiptId"] === "string" && num(r["seeds"]) && (r["itemId"] === undefined || ["forest-cloak", "sun-scarf", "moon-pin"].includes(String(r["itemId"]))) && (r["fallbackSeeds"] === undefined || num(r["fallbackSeeds"])));
      break;
    }
    case "bootstrap":
      valid = value["ready"] === true;
      break;
    case "getState":
      valid =
        page(value) &&
        (value["encounter"] === null || encounter(value["encounter"])) &&
        (value["offer"] === null || offer(value["offer"]));
      break;
    case "listInventory":
      valid = page(value);
      break;
    case "beginEncounter":
    case "submitAction":
      valid = encounter(value);
      break;
    case "cancelEncounter":
    case "cancelTrade":
      valid = value["cancelled"] === true;
      break;
    case "createTrade":
      valid =
        id(value["tradeId"]) &&
        num(value["expiresAt"], 1) &&
        (value["token"] === undefined ||
          (typeof value["token"] === "string" &&
            /^[A-Za-z0-9_-]{43}$/.test(value["token"])));
      break;
    case "rotateTradeToken":
      valid =
        id(value["tradeId"]) &&
        num(value["revision"], 1) &&
        typeof value["token"] === "string" &&
        /^[A-Za-z0-9_-]{43}$/.test(value["token"]);
      break;
    case "previewTrade":
      valid =
        id(value["id"]) &&
        spec(value["offeredSpeciesId"]) &&
        num(value["offeredLevel"], 1, MAX_CREATURE_LEVEL) &&
        spec(value["requestedSpeciesId"]) &&
        num(value["expiresAt"], 1) &&
        ["open", "completed", "cancelled", "expired"].includes(
          String(value["status"]),
        );
      break;
    case "acceptTrade":
      valid = id(value["tradeId"]) && id(value["receivedCreatureId"]);
      break;
  }
  if (!valid)
    throw new Error(
      "A resposta online não corresponde ao protocolo do jogo. Atualize a página.",
    );
  return value as unknown as Responses[K];
}
