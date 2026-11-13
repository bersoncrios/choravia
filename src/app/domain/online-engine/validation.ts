import { SPECIES } from "../game.js";
import type { SpeciesId } from "../game.js";
import type { BattleCommand } from "../online.js";
import { GameError } from "./model.js";
export function invalid(message = "Pedido inválido."): never {
  throw new GameError("invalid-argument", message);
}
export function object(
  value: unknown,
  keys: readonly string[],
): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    return invalid();
  const result = value as Record<string, unknown>;
  if (Object.keys(result).some((k) => !keys.includes(k)))
    return invalid("Campos inesperados.");
  return result;
}
export function id(value: unknown): string {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]{8,100}$/.test(value))
    return invalid("Identificador inválido.");
  return value;
}
export function speciesId(value: unknown): SpeciesId {
  if (!SPECIES.some((s) => s.id === value)) return invalid("Espécie inválida.");
  return value as SpeciesId;
}
export function integer(value: unknown, max = Number.MAX_SAFE_INTEGER): number {
  if (!Number.isSafeInteger(value) || Number(value) < 0 || Number(value) > max)
    return invalid("Número inválido.");
  return value as number;
}
export function token(value: unknown): string {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(value))
    return invalid("Convite inválido.");
  return value;
}
export function battleCommand(value: unknown): BattleCommand {
  const data = object(value, ["type", "position", "target"]);
  if (
    data["type"] === "move" ||
    data["type"] === "basic" ||
    data["type"] === "skill"
  ) {
    const key = data["type"] === "move" ? "position" : "target";
    object(value, ["type", key]);
    const p = object(data[key], ["x", "y"]);
    const position = { x: integer(p["x"], 4), y: integer(p["y"], 4) };
    return data["type"] === "move"
      ? { type: "move", position }
      : { type: data["type"], target: position };
  }
  if (
    data["type"] === "defend" ||
    data["type"] === "capture" ||
    data["type"] === "flee"
  ) {
    object(value, ["type"]);
    return { type: data["type"] };
  }
  return invalid("Ação não permitida.");
}
