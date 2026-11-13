import type { Game } from "./game.js";
import { isGame } from "./save-validation.js";
export interface CloudRecord {
  revision: number;
  writeId: string;
  snapshot: Game;
}
export interface CloudWrite {
  expectedRevision: number;
  writeId: string;
  snapshot: Game;
}
export class CloudConflict extends Error {
  readonly code = "cloud/conflict";
  constructor() {
    super("O progresso da conta mudou em outro dispositivo.");
  }
}
export const MAX_CLOUD_BYTES = 700000;
export function encodeSnapshot(game: Game): string {
  if (!isGame(game))
    throw new Error("O progresso pessoal possui um formato inválido.");
  const result = JSON.stringify(game);
  if (new TextEncoder().encode(result).byteLength > MAX_CLOUD_BYTES)
    throw new Error(
      "Este save excede o tamanho permitido na conta. Exporte um backup; o progresso local foi preservado.",
    );
  return result;
}
export function decodeCloudRecord(value: unknown): CloudRecord {
  if (!value || typeof value !== "object")
    throw new Error("Save da conta inválido.");
  const data = value as Record<string, unknown>;
  if (
    data["schemaVersion"] !== 1 ||
    !Number.isSafeInteger(data["revision"]) ||
    Number(data["revision"]) < 1 ||
    typeof data["writeId"] !== "string" ||
    !/^[A-Za-z0-9_-]{8,100}$/.test(data["writeId"]) ||
    typeof data["snapshot"] !== "string" ||
    new TextEncoder().encode(data["snapshot"]).byteLength > MAX_CLOUD_BYTES
  )
    throw new Error("Versão ou metadados do save da conta inválidos.");
  let snapshot: unknown;
  try {
    snapshot = JSON.parse(data["snapshot"]);
  } catch {
    throw new Error(
      "O save da conta está corrompido. O cache local foi preservado.",
    );
  }
  if (!isGame(snapshot))
    throw new Error(
      "O save da conta não passou na validação. O cache local foi preservado.",
    );
  return {
    revision: Number(data["revision"]),
    writeId: data["writeId"],
    snapshot,
  };
}
export function snapshotContent(game: Game): string {
  const { revision: _, ...progress } = game;
  return JSON.stringify(progress);
}
export function resolveCloudWrite(
  old: CloudRecord | null,
  input: CloudWrite,
): { record: CloudRecord; serialized: string; replay: boolean } {
  const serialized = encodeSnapshot(input.snapshot);
  if (
    !Number.isSafeInteger(input.expectedRevision) ||
    input.expectedRevision < 0 ||
    input.expectedRevision >= Number.MAX_SAFE_INTEGER ||
    !/^[A-Za-z0-9_-]{8,100}$/.test(input.writeId)
  )
    throw new Error("Pedido de salvamento inválido.");
  if (old?.writeId === input.writeId) {
    if (JSON.stringify(old.snapshot) !== serialized)
      throw new Error(
        "Identificador de salvamento reutilizado com outros dados.",
      );
    return { record: old, serialized, replay: true };
  }
  if ((old?.revision ?? 0) !== input.expectedRevision)
    throw new CloudConflict();
  return {
    record: {
      revision: input.expectedRevision + 1,
      writeId: input.writeId,
      snapshot: structuredClone(input.snapshot),
    },
    serialized,
    replay: false,
  };
}
