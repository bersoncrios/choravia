import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { GameService } from "../functions/src/service.js";
import { MemoryStore } from "../functions/src/memory-store.js";
import { GameError } from "../functions/src/model.js";
import type {
  CreatureDoc,
  EncounterDoc,
  TradeDoc,
  UserDoc,
} from "../functions/src/model.js";
import type {
  RemoteMethod,
  Requests,
  Responses,
  BattleCommand,
} from "../src/app/domain/online.js";

function fixture() {
  const store = new MemoryStore();
  let time = 1800000000000;
  const service = new GameService(store, { now: () => time });
  const call = async <K extends RemoteMethod>(
    uid: string,
    method: K,
    input: Requests[K],
  ): Promise<Responses[K]> =>
    (await service.execute(uid, method, input)) as Responses[K];
  return {
    store,
    service,
    call,
    advance: (ms: number) => {
      time += ms;
    },
  };
}
const request = () => randomUUID();
test("bootstrap keeps the account profile separate from online state", async () => {
  const f = fixture(),
    original = {
      displayName: "Perfil existente",
      email: "guardiao@example.test",
      photoURL: null,
      role: "admin",
    };
  await f.store.seed("users/alice", original);
  assert.deepEqual(await f.call("alice", "bootstrap", {}), { ready: true });
  assert.deepEqual(f.store.dump("users/alice"), original);
  assert.equal(f.store.dump<UserDoc>("users/alice/online/state")?.schemaVersion, 1);
  assert.equal(f.store.all("creatures/").length, 1);
});
const code =
  (expected: string) =>
  (error: unknown): boolean =>
    error instanceof GameError && error.code === expected;
async function accounts(f: ReturnType<typeof fixture>, ...uids: string[]) {
  const ids: Record<string, string> = {};
  for (const uid of uids) {
    await f.call(uid, "bootstrap", {});
    ids[uid] = (await f.call(uid, "getState", {})).creatures[0]!.id;
  }
  return ids;
}
async function offer(
  f: ReturnType<typeof fixture>,
  uid: string,
  creatureId: string,
) {
  return f.call(uid, "createTrade", {
    requestId: request(),
    creatureId,
    requestedSpeciesId: "WW001",
  });
}
async function firstCapture(
  f: ReturnType<typeof fixture>,
  uid: string,
  creatureId: string,
) {
  let e = await f.call(uid, "beginEncounter", {
    requestId: request(),
    creatureId,
  });
  const commands: BattleCommand[] = [
    { type: "basic", target: { x: 3, y: 1 } },
    { type: "basic", target: { x: 3, y: 1 } },
    { type: "basic", target: { x: 3, y: 1 } },
    { type: "capture" },
  ];
  for (const command of commands)
    e = await f.call(uid, "submitAction", {
      requestId: request(),
      encounterId: e.id,
      seq: e.seq,
      command,
    });
  assert.equal(e.battle.result, "capture");
  return e;
}
test("bootstrap concurrently grants one starter and cannot recreate a traded starter", async () => {
  const f = fixture();
  await Promise.all([
    f.call("alice", "bootstrap", {}),
    f.call("alice", "bootstrap", {}),
  ]);
  await accounts(f, "bob");
  const a = (await f.call("alice", "getState", {})).creatures[0]!,
    b = (await f.call("bob", "getState", {})).creatures[0]!;
  assert.equal(f.store.all("creatures/").length, 2);
  const t = await offer(f, "alice", a.id);
  await f.call("bob", "acceptTrade", {
    requestId: request(),
    tradeId: t.tradeId,
    token: t.token!,
    creatureId: b.id,
  });
  await f.call("alice", "bootstrap", {});
  assert.equal(f.store.dump<CreatureDoc>(`creatures/${a.id}`)!.ownerId, "bob");
  assert.equal(f.store.all("creatures/").length, 2);
});
test("authoritative first capture runs real commands without exposing private RNG", async () => {
  const f = fixture(),
    ids = await accounts(f, "alice");
  const e = await firstCapture(f, "alice", ids["alice"]!);
  const state = await f.call("alice", "getState", {});
  assert.equal(state.creatures.length, 2);
  assert.equal(
    state.creatures.find((c) => c.speciesId === "WW002")!.id,
    `capture-${e.id}`,
  );
  assert.equal(state.encounter, null);
  assert.equal(JSON.stringify(e).includes('"rng"'), false);
  assert.equal(
    f.store
      .all("domain_events/")
      .filter((e) => "type" in e && e.type === "first_capture").length,
    1,
  );
});
test("duplicate capture request grants only one creature and event", async () => {
  const f = fixture(),
    ids = await accounts(f, "alice");
  let e = await f.call("alice", "beginEncounter", {
    requestId: request(),
    creatureId: ids["alice"]!,
  });
  for (const command of [
    { type: "basic", target: { x: 3, y: 1 } },
    { type: "basic", target: { x: 3, y: 1 } },
    { type: "basic", target: { x: 3, y: 1 } },
  ] as BattleCommand[])
    e = await f.call("alice", "submitAction", {
      requestId: request(),
      encounterId: e.id,
      seq: e.seq,
      command,
    });
  const payload = {
    requestId: request(),
    encounterId: e.id,
    seq: e.seq,
    command: { type: "capture" } as const,
  };
  const [a, b] = await Promise.all([
    f.call("alice", "submitAction", payload),
    f.call("alice", "submitAction", payload),
  ]);
  assert.deepEqual(a, b);
  assert.equal(f.store.all("creatures/").length, 2);
  assert.equal(
    f.store
      .all("domain_events/")
      .filter((e) => "type" in e && e.type === "first_capture").length,
    1,
  );
});
test("invalid actions and wrong sequence do not alter battle state or RNG", async () => {
  const f = fixture(),
    ids = await accounts(f, "alice");
  const e = await f.call("alice", "beginEncounter", {
    requestId: request(),
    creatureId: ids["alice"]!,
  });
  const before = f.store.dump<EncounterDoc>(`encounters/${e.id}`)!;
  await assert.rejects(
    f.call("alice", "submitAction", {
      requestId: request(),
      encounterId: e.id,
      seq: 9,
      command: { type: "defend" },
    }),
    code("aborted"),
  );
  await assert.rejects(
    f.call("alice", "submitAction", {
      requestId: request(),
      encounterId: e.id,
      seq: 0,
      command: { type: "capture" },
    }),
    code("failed-precondition"),
  );
  assert.deepEqual(f.store.dump(`encounters/${e.id}`), before);
  assert.equal(f.store.all("creatures/").length, 1);
});
test("another account cannot control an encounter or offer someone else’s creature", async () => {
  const f = fixture(),
    ids = await accounts(f, "alice", "bob");
  const e = await f.call("alice", "beginEncounter", {
    requestId: request(),
    creatureId: ids["alice"]!,
  });
  await assert.rejects(
    f.call("bob", "submitAction", {
      requestId: request(),
      encounterId: e.id,
      seq: 0,
      command: { type: "defend" },
    }),
    code("permission-denied"),
  );
  await assert.rejects(
    offer(f, "bob", ids["alice"]!),
    code("permission-denied"),
  );
});
test("forged fields, path injection and unsupported commands are rejected", async () => {
  const f = fixture();
  await f.call("alice", "bootstrap", {});
  for (const [method, data] of [
    [
      "createTrade",
      {
        requestId: request(),
        creatureId: "../users/attacker",
        requestedSpeciesId: "WW001",
      },
    ],
    [
      "createTrade",
      {
        requestId: request(),
        creatureId: "starter-123",
        requestedSpeciesId: "WW001",
        ownerId: "alice",
      },
    ],
    [
      "submitAction",
      {
        requestId: request(),
        encounterId: request(),
        seq: 0,
        command: { type: "capture", chance: 1 },
      },
    ],
    [
      "submitAction",
      {
        requestId: request(),
        encounterId: request(),
        seq: 0,
        command: { type: "walk", dx: 1, dy: 0 },
      },
    ],
  ] as const)
    await assert.rejects(
      f.service.execute("alice", method, data),
      code("invalid-argument"),
    );
});
test("encounter cancellation releases its lock and respects the start cooldown", async () => {
  const f = fixture(),
    ids = await accounts(f, "alice");
  const e = await f.call("alice", "beginEncounter", {
    requestId: request(),
    creatureId: ids["alice"]!,
  });
  const cancel = { requestId: request(), encounterId: e.id };
  assert.deepEqual(
    await f.call("alice", "cancelEncounter", cancel),
    await f.call("alice", "cancelEncounter", cancel),
  );
  assert.equal(
    f.store.dump<CreatureDoc>(`creatures/${ids["alice"]}`)!.lock,
    null,
  );
  await assert.rejects(
    f.call("alice", "beginEncounter", {
      requestId: request(),
      creatureId: ids["alice"]!,
    }),
    code("resource-exhausted"),
  );
  f.advance(10000);
  assert.equal(
    (
      await f.call("alice", "beginEncounter", {
        requestId: request(),
        creatureId: ids["alice"]!,
      })
    ).seq,
    0,
  );
});
test("expired encounter is cleared on access without relying on TTL", async () => {
  const f = fixture(),
    ids = await accounts(f, "alice");
  const e = await f.call("alice", "beginEncounter", {
    requestId: request(),
    creatureId: ids["alice"]!,
  });
  f.advance(15 * 60000);
  await assert.rejects(
    f.call("alice", "submitAction", {
      requestId: request(),
      encounterId: e.id,
      seq: 0,
      command: { type: "defend" },
    }),
    code("failed-precondition"),
  );
  assert.equal(
    f.store.dump<CreatureDoc>(`creatures/${ids["alice"]}`)!.lock,
    null,
  );
  assert.equal(
    f.store.dump<EncounterDoc>(`encounters/${e.id}`)!.status,
    "expired",
  );
});
test("trade token is returned once and absent from stored operations and events", async () => {
  const f = fixture(),
    ids = await accounts(f, "alice");
  const payload = {
    requestId: request(),
    creatureId: ids["alice"]!,
    requestedSpeciesId: "WW001",
  } as const;
  const t = await f.call("alice", "createTrade", payload),
    retry = await f.call("alice", "createTrade", payload);
  assert.equal(t.token?.length, 43);
  assert.equal(retry.tradeId, t.tradeId);
  assert.equal(retry.token, undefined);
  assert.equal(JSON.stringify(f.store.all("")).includes(t.token!), false);
  assert.equal(
    f.store.dump<CreatureDoc>(`creatures/${ids["alice"]}`)!.lock!.id,
    t.tradeId,
  );
});
test("self trade, wrong token, wrong species and recipient lock cannot transfer property", async () => {
  const f = fixture(),
    ids = await accounts(f, "alice", "bob");
  const t = await offer(f, "alice", ids["alice"]!);
  await assert.rejects(
    f.call("alice", "acceptTrade", {
      requestId: request(),
      tradeId: t.tradeId,
      token: t.token!,
      creatureId: ids["alice"]!,
    }),
    code("failed-precondition"),
  );
  await assert.rejects(
    f.call("bob", "acceptTrade", {
      requestId: request(),
      tradeId: t.tradeId,
      token: "x".repeat(43),
      creatureId: ids["bob"]!,
    }),
    code("not-found"),
  );
  const b = f.store.dump<CreatureDoc>(`creatures/${ids["bob"]}`)!;
  await f.store.seed(`creatures/${ids["bob"]}`, { ...b, speciesId: "WW005" });
  await assert.rejects(
    f.call("bob", "acceptTrade", {
      requestId: request(),
      tradeId: t.tradeId,
      token: t.token!,
      creatureId: ids["bob"]!,
    }),
    code("failed-precondition"),
  );
  await f.store.seed(`creatures/${ids["bob"]}`, {
    ...b,
    lock: { kind: "encounter", id: request() },
  });
  await assert.rejects(
    f.call("bob", "acceptTrade", {
      requestId: request(),
      tradeId: t.tradeId,
      token: t.token!,
      creatureId: ids["bob"]!,
    }),
    code("failed-precondition"),
  );
  assert.equal(
    f.store.dump<CreatureDoc>(`creatures/${ids["alice"]}`)!.ownerId,
    "alice",
  );
});
test("two simultaneous accepts produce one winner and one completion event", async () => {
  const f = fixture(),
    ids = await accounts(f, "alice", "bob", "carol");
  const t = await offer(f, "alice", ids["alice"]!);
  const results = await Promise.allSettled(
    ["bob", "carol"].map((uid) =>
      f.call(uid, "acceptTrade", {
        requestId: request(),
        tradeId: t.tradeId,
        token: t.token!,
        creatureId: ids[uid]!,
      }),
    ),
  );
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal(f.store.all("creatures/").length, 3);
  assert.equal(
    f.store
      .all("domain_events/")
      .filter((e) => "type" in e && e.type === "trade_completed").length,
    1,
  );
  const winner = f.store.dump<CreatureDoc>(
    `creatures/${ids["alice"]}`,
  )!.ownerId;
  assert.ok(winner === "bob" || winner === "carol");
  assert.equal(
    f.store.dump<CreatureDoc>(`creatures/${ids[winner]}`)!.ownerId,
    "alice",
  );
});
test("accept racing cancellation leaves a complete transfer or a complete cancellation", async () => {
  const f = fixture(),
    ids = await accounts(f, "alice", "bob");
  const t = await offer(f, "alice", ids["alice"]!);
  const results = await Promise.allSettled([
    f.call("alice", "cancelTrade", {
      requestId: request(),
      tradeId: t.tradeId,
    }),
    f.call("bob", "acceptTrade", {
      requestId: request(),
      tradeId: t.tradeId,
      token: t.token!,
      creatureId: ids["bob"]!,
    }),
  ]);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  const status = f.store.dump<TradeDoc>(`trade_links/${t.tradeId}`)!.status,
    a = f.store.dump<CreatureDoc>(`creatures/${ids["alice"]}`)!,
    b = f.store.dump<CreatureDoc>(`creatures/${ids["bob"]}`)!;
  assert.equal(a.ownerId, status === "completed" ? "bob" : "alice");
  assert.equal(b.ownerId, status === "completed" ? "alice" : "bob");
  assert.equal(a.lock, null);
});
test("completed trade retry returns original result; changed payload cannot reuse request ID", async () => {
  const f = fixture(),
    ids = await accounts(f, "alice", "bob");
  const t = await offer(f, "alice", ids["alice"]!);
  const input = {
    requestId: request(),
    tradeId: t.tradeId,
    token: t.token!,
    creatureId: ids["bob"]!,
  };
  const result = await f.call("bob", "acceptTrade", input);
  assert.deepEqual(await f.call("bob", "acceptTrade", input), result);
  await assert.rejects(
    f.call("bob", "acceptTrade", { ...input, creatureId: ids["alice"]! }),
    code("already-exists"),
  );
  assert.equal(
    f.store
      .all("domain_events/")
      .filter((e) => "type" in e && e.type === "trade_completed").length,
    1,
  );
});
test("rotation invalidates old token and refuses stale or unauthorized changes", async () => {
  const f = fixture(),
    ids = await accounts(f, "alice", "bob");
  const t = await offer(f, "alice", ids["alice"]!);
  await assert.rejects(
    f.call("bob", "rotateTradeToken", { tradeId: t.tradeId, revision: 1 }),
    code("permission-denied"),
  );
  const rotated = await f.call("alice", "rotateTradeToken", {
    tradeId: t.tradeId,
    revision: 1,
  });
  assert.notEqual(rotated.token, t.token);
  await assert.rejects(
    f.call("bob", "previewTrade", { tradeId: t.tradeId, token: t.token! }),
    code("not-found"),
  );
  await assert.rejects(
    f.call("alice", "rotateTradeToken", { tradeId: t.tradeId, revision: 1 }),
    code("aborted"),
  );
  const preview = await f.call("bob", "previewTrade", {
    tradeId: t.tradeId,
    token: rotated.token,
  });
  assert.deepEqual(Object.keys(preview).sort(), [
    "expiresAt",
    "id",
    "offeredLevel",
    "offeredSpeciesId",
    "requestedSpeciesId",
    "status",
  ]);
});
test("expiration boundary rejects acceptance and releases original locks through housekeeping", async () => {
  const f = fixture(),
    ids = await accounts(f, "alice", "bob");
  const t = await offer(f, "alice", ids["alice"]!);
  f.advance(86400000);
  await assert.rejects(
    f.call("bob", "acceptTrade", {
      requestId: request(),
      tradeId: t.tradeId,
      token: t.token!,
      creatureId: ids["bob"]!,
    }),
    code("failed-precondition"),
  );
  assert.equal(
    (
      await f.call("bob", "previewTrade", {
        tradeId: t.tradeId,
        token: t.token!,
      })
    ).status,
    "expired",
  );
  assert.equal(
    f.store.dump<CreatureDoc>(`creatures/${ids["alice"]}`)!.lock,
    null,
  );
  assert.equal(f.store.dump<UserDoc>("users/alice/online/state")!.activeTradeId, null);
});
test("maintenance is repeatable and never releases a newer unrelated lock", async () => {
  const f = fixture(),
    ids = await accounts(f, "alice");
  const t = await offer(f, "alice", ids["alice"]!);
  const c = f.store.dump<CreatureDoc>(`creatures/${ids["alice"]}`)!;
  await f.store.seed(`creatures/${ids["alice"]}`, {
    ...c,
    lock: { kind: "trade", id: "new-lock-123" },
  });
  f.advance(86400000);
  await f.service.maintenance();
  await f.service.maintenance();
  assert.equal(
    f.store.dump<CreatureDoc>(`creatures/${ids["alice"]}`)!.lock!.id,
    "new-lock-123",
  );
  assert.equal(
    f.store.dump<TradeDoc>(`trade_links/${t.tradeId}`)!.status,
    "expired",
  );
});
test("aborted transaction discards every staged write", async () => {
  const db = new MemoryStore();
  await assert.rejects(
    db.transaction(async (tx) => {
      tx.set("creatures/test-unit", { ownerId: "alice" });
      throw new Error("injected");
    }),
  );
  assert.equal(db.dump("creatures/test-unit"), null);
});
test("memory adapter rejects reads after writes like Firestore", async () => {
  const db = new MemoryStore();
  await assert.rejects(
    db.transaction(async (tx) => {
      tx.set("one", { value: 1 });
      await tx.get("two");
    }),
    /reads before writes/,
  );
  assert.equal(db.dump("one"), null);
});
test("a user has one live offer and a reserved creature cannot enter battle", async () => {
  const f = fixture(),
    ids = await accounts(f, "alice");
  await offer(f, "alice", ids["alice"]!);
  await assert.rejects(
    offer(f, "alice", ids["alice"]!),
    code("failed-precondition"),
  );
  await assert.rejects(
    f.call("alice", "beginEncounter", {
      requestId: request(),
      creatureId: ids["alice"]!,
    }),
    code("failed-precondition"),
  );
});
test("local or originless creatures never become negotiable assets", async () => {
  const f = fixture(),
    ids = await accounts(f, "alice");
  await assert.rejects(offer(f, "alice", "capture-local-1"), code("not-found"));
  const c = f.store.dump<CreatureDoc>(`creatures/${ids["alice"]}`)!;
  await f.store.seed(`creatures/${ids["alice"]}`, {
    ...c,
    originEncounterId: "",
  });
  await assert.rejects(
    offer(f, "alice", ids["alice"]!),
    code("failed-precondition"),
  );
});
test("inventory pagination checks revisions and never includes other owners", async () => {
  const f = fixture();
  await accounts(f, "alice", "bob");
  for (let i = 0; i < 51; i++)
    await f.store.seed(`creatures/fixture-${String(i).padStart(3, "0")}`, {
      ownerId: "alice",
      speciesId: "WW001",
      createdAt: 0,
      originEncounterId: "fixture",
      revision: 1,
      lock: null,
    } satisfies CreatureDoc);
  const state = await f.call("alice", "getState", {});
  assert.equal(state.creatures.length, 50);
  assert.ok(state.nextCursor);
  const page = await f.call("alice", "listInventory", {
    cursor: state.nextCursor!,
    revision: state.inventoryRevision,
  });
  assert.equal(page.creatures.length, 2);
  assert.equal(page.nextCursor, null);
  await offer(f, "alice", state.creatures[0]!.id);
  await assert.rejects(
    f.call("alice", "listInventory", {
      cursor: state.nextCursor!,
      revision: state.inventoryRevision,
    }),
    code("aborted"),
  );
  assert.equal((await f.call("bob", "getState", {})).creatures.length, 1);
});
test("per-account quota resets after the minute window", async () => {
  const f = fixture();
  await f.call("alice", "bootstrap", {});
  for (let i = 0; i < 119; i++) await f.call("alice", "bootstrap", {});
  await assert.rejects(
    f.call("alice", "bootstrap", {}),
    code("resource-exhausted"),
  );
  f.advance(60000);
  assert.deepEqual(await f.call("alice", "bootstrap", {}), { ready: true });
});

test("classic skills satisfy the daily strategy contract without grid movement", async () => {
  const f = fixture();
  const ids = await accounts(f, "alice");
  let board = await f.call("alice", "getDailyBoard", {});
  for (let day = 0; !board.contracts.some(c => c.id === "move-in-battle") && day < 10; day++) {
    f.advance(86400000);
    board = await f.call("alice", "getDailyBoard", {});
  }
  assert.ok(board.contracts.some(c => c.id === "move-in-battle"));
  const encounter = await f.call("alice", "beginEncounter", { requestId: request(), creatureId: ids["alice"]! });
  assert.equal(encounter.battle.mode, "classic");
  await f.call("alice", "submitAction", { requestId: request(), encounterId: encounter.id, seq: encounter.seq, command: { type: "skill", target: encounter.battle.enemy.pos } });
  const updated = await f.call("alice", "getDailyBoard", {});
  assert.equal(updated.contracts.find(c => c.id === "move-in-battle")!.completed, true);
});
