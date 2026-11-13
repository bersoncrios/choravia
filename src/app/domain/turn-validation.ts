import { SPECIES, creatureMaxHp, type SpeciesId } from "./game.js";
const record = (x: unknown): x is Record<string, unknown> => !!x && typeof x === "object" && !Array.isArray(x);
const integer = (x: unknown, min: number, max: number) => Number.isInteger(x) && Number(x) >= min && Number(x) <= max;
export function validTurnData(b: Record<string, unknown>): boolean {
  if (b["mode"] !== undefined && b["mode"] !== "classic") return false;
  for (const key of ["allyCooldown", "enemyCooldown"]) if (b[key] !== undefined && !integer(b[key], 0, 1)) return false;
  const frames = b["turnFrames"];
  if (frames === undefined) return true;
  if (b["mode"] !== "classic" || !Array.isArray(frames) || frames.length < 1 || frames.length > 2) return false;
  return frames.every((frame, index) => {
    if (!record(frame) || (frame["action"] !== undefined && !["basic", "skill", "defend", "capture", "flee"].includes(String(frame["action"]))) || frame["actor"] !== (index === 0 ? "player" : "enemy") || typeof frame["message"] !== "string" || frame["message"].length > 240) return false;
    return ["ally", "enemy"].every(side => {
      const f = frame[side];
      if (!record(f) || !SPECIES.some(s => s.id === f["speciesId"]) || typeof f["guarding"] !== "boolean" || !record(f["pos"])) return false;
      const level = f["level"] ?? 1;
      const current = b[side];
      return record(current) && current["speciesId"] === f["speciesId"] && integer(level, 1, 30) && integer(f["hp"], 0, creatureMaxHp(f["speciesId"] as SpeciesId, Number(level))) && integer(f["pos"]["x"], 0, 4) && integer(f["pos"]["y"], 0, 4);
    });
  });
}
