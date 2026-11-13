import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { logger } from "firebase-functions";
import { GameError } from "./model.js";
import { object } from "./validation.js";
import { GameService } from "./service.js";
import { GameMasterService } from "./game-master.js";
import { FirestoreStore } from "./firestore-store.js";
import type { RemoteMethod } from "../../src/app/domain/online.js";
initializeApp();
const service = new GameService(new FirestoreStore(getFirestore()));
const gameMasterService = new GameMasterService(getFirestore());
const methods: readonly RemoteMethod[] = [
  "getDailyBoard",
  "ackDailyRewards",
  "bootstrap",
  "getState",
  "listInventory",
  "beginEncounter",
  "submitAction",
  "cancelEncounter",
  "createTrade",
  "rotateTradeToken",
  "previewTrade",
  "acceptTrade",
  "cancelTrade",
];
export const wildwoods = onCall(
  {
    region: "southamerica-east1",
    maxInstances: 3,
    timeoutSeconds: 30,
    enforceAppCheck: false,
  },
  async (request) => {
    if (!request.auth)
      throw new HttpsError("unauthenticated", "Entre para continuar.");
    try {
      if (JSON.stringify(request.data).length > 8192)
        throw new GameError("invalid-argument", "Pedido grande demais.");
      const data = object(request.data, ["method", "input"]);
      if (!methods.includes(data["method"] as RemoteMethod))
        throw new GameError("invalid-argument", "Operação desconhecida.");
      return await service.execute(
        request.auth.uid,
        data["method"] as RemoteMethod,
        data["input"],
      );
    } catch (error) {
      if (error instanceof GameError)
        throw new HttpsError(error.code, error.message);
      logger.error("wildwoods_internal_error");
      throw new HttpsError(
        "internal",
        "Não foi possível concluir. Atualize ou tente novamente com o mesmo pedido.",
      );
    }
  },
);
export const gameMaster = onCall(
  {
    region: "southamerica-east1",
    maxInstances: 2,
    timeoutSeconds: 30,
    cors: true,
    // Admin operations require Firebase Auth plus a server-checked Firestore role.
    enforceAppCheck: false,
  },
  async (request) => {
    if (!request.auth)
      throw new HttpsError("unauthenticated", "Entre para continuar.");
    try {
      if (JSON.stringify(request.data).length > 8192)
        throw new GameError("invalid-argument", "Pedido grande demais.");
      return await gameMasterService.execute(request.auth.uid, request.data);
    } catch (error) {
      if (error instanceof GameError)
        throw new HttpsError(error.code, error.message);
      logger.error("game_master_internal_error");
      throw new HttpsError("internal", "Não foi possível concluir a ação administrativa.");
    }
  },
);
export const expireReservations = onSchedule(
  {
    schedule: "every 60 minutes",
    region: "southamerica-east1",
    maxInstances: 1,
    timeZone: "UTC",
    timeoutSeconds: 120,
  },
  async () => {
    await service.maintenance(100);
  },
);
