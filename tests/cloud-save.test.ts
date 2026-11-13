import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { initialGame, reduceGame } from "../src/app/domain/game.js";
import type { Game } from "../src/app/domain/game.js";
import { CloudSaveSession } from "../src/app/application/cloud-save.js";
import type {
  CloudBinding,
  CloudBindingStore,
  CloudRecord,
  CloudSaveGateway,
  CloudWrite,
} from "../src/app/application/cloud-save.js";
import {
  CloudConflict,
  resolveCloudWrite,
  encodeSnapshot,
  decodeCloudRecord,
  snapshotContent,
} from "../src/app/domain/cloud-snapshot.js";
import {
  userProfile,
  profileInitials,
} from "../src/app/application/profile.js";
import { MemoryStore } from "../functions/src/memory-store.js";
import { Session, MemorySave } from "../src/app/application/session.js";

class Gateway implements CloudSaveGateway {
  loseResponse = false;
  writes = 0;
  loadError: Error | null = null;
  constructor(
    readonly uid: string,
    readonly db: MemoryStore,
  ) {}
  async load(): Promise<CloudRecord | null> {
    if (this.loadError) throw this.loadError;
    return this.db.transaction((tx) =>
      tx.get<CloudRecord>(`cloud/${this.uid}`),
    );
  }
  async write(input: CloudWrite): Promise<CloudRecord> {
    this.writes++;
    const result = await this.db.transaction(async (tx) => {
      const old = await tx.get<CloudRecord>(`cloud/${this.uid}`),
        decision = resolveCloudWrite(old, input);
      if (!decision.replay) tx.set(`cloud/${this.uid}`, decision.record);
      return decision.record;
    });
    if (this.loseResponse) {
      this.loseResponse = false;
      throw new Error("Resposta perdida depois do commit.");
    }
    return result;
  }
}
class Bindings implements CloudBindingStore {
  value: unknown = null;
  async load(): Promise<unknown> {
    return structuredClone(this.value);
  }
  async save(binding: CloudBinding): Promise<void> {
    this.value = structuredClone(binding);
  }
}
const active = new Set<CloudSaveSession>();
afterEach(() => {
  for (const cloud of active) cloud.stop();
  active.clear();
});
function fixture(
  db = new MemoryStore(),
  uid = "alice",
  cached = false,
  initial = initialGame(),
  store = new Bindings(),
) {
  const local = { game: structuredClone(initial), backups: [] as Game[] };
  const gateway = new Gateway(uid, db);
  const cloud = new CloudSaveSession(
    uid,
    gateway,
    {
      current: () => local.game,
      restore: async (snapshot, revision) => {
        if (local.game.revision !== revision)
          throw Object.assign(new Error("local changed"), {
            code: "local/conflict",
          });
        local.backups.push(local.game);
        local.game = {
          ...structuredClone(snapshot),
          revision: Math.max(snapshot.revision, local.game.revision) + 1,
        };
      },
    },
    store,
    async (game) =>
      createHash("sha256").update(snapshotContent(game)).digest("hex"),
    randomUUID,
    () => {},
    cached,
  );
  active.add(cloud);
  return { local, gateway, cloud, store, db };
}
test("first Google-account save creates one cloud revision and persists its acknowledgement", async () => {
  const f = fixture();
  await f.cloud.start();
  assert.equal(f.cloud.status, "saved");
  assert.equal((await f.gateway.load())!.revision, 1);
  assert.equal((f.store.value as CloudBinding).pending, null);
  f.local.game = reduceGame(f.local.game, { type: "walk", dx: 0, dy: -1 });
  f.cloud.observe();
  assert.equal(f.cloud.status, "local");
  await f.cloud.flush();
  assert.equal((await f.gateway.load())!.revision, 2);
  assert.equal((await f.gateway.load())!.snapshot.player.y, 10);
});
test("another device restores the account snapshot and keeps its former local snapshot as backup", async () => {
  const first = fixture();
  first.local.game = reduceGame(first.local.game, {
    type: "walk",
    dx: 0,
    dy: -1,
  });
  await first.cloud.start();
  const second = fixture(first.db, "alice", false);
  await second.cloud.start();
  assert.equal(second.local.game.player.y, 10);
  assert.equal(second.local.backups.length, 1);
  assert.equal(second.cloud.status, "saved");
  assert.equal(second.gateway.writes, 0);
});
test("lost response after commit retries the same writeId without incrementing twice", async () => {
  const f = fixture();
  f.gateway.loseResponse = true;
  await f.cloud.start();
  assert.equal(f.cloud.status, "pending");
  const pending = (f.store.value as CloudBinding).pending!;
  assert.ok(pending);
  assert.equal((await f.gateway.load())!.revision, 1);
  await f.cloud.retry();
  assert.equal(f.cloud.status, "saved");
  assert.equal((await f.gateway.load())!.revision, 1);
  assert.equal((await f.gateway.load())!.writeId, pending.writeId);
});
test("reload recovers a persisted write whose acknowledgement was lost", async () => {
  const first = fixture();
  first.gateway.loseResponse = true;
  await first.cloud.start();
  first.cloud.stop();
  const next = fixture(first.db, "alice", true, first.local.game, first.store);
  await next.cloud.start();
  assert.equal(next.cloud.status, "saved");
  assert.equal((await next.gateway.load())!.revision, 1);
  assert.equal((next.store.value as CloudBinding).pending, null);
});
test("two devices changing the same revision produce a conflict instead of silent overwrite", async () => {
  const a = fixture();
  await a.cloud.start();
  const b = fixture(a.db);
  await b.cloud.start();
  a.local.game = reduceGame(a.local.game, { type: "walk", dx: 0, dy: -1 });
  b.local.game = reduceGame(b.local.game, { type: "walk", dx: 1, dy: 0 });
  await Promise.all([a.cloud.flush(), b.cloud.flush()]);
  assert.deepEqual([a.cloud.status, b.cloud.status].sort(), [
    "conflict",
    "saved",
  ]);
  assert.equal((await a.gateway.load())!.revision, 2);
  const loser = a.cloud.status === "conflict" ? a : b;
  const own = structuredClone(loser.local.game);
  await loser.cloud.useLocal();
  assert.equal(loser.cloud.status, "saved");
  assert.equal((await loser.gateway.load())!.revision, 3);
  assert.deepEqual((await loser.gateway.load())!.snapshot.player, own.player);
});
test("choosing cloud after conflict preserves the displaced local progress in backup", async () => {
  const a = fixture();
  await a.cloud.start();
  const b = fixture(a.db);
  await b.cloud.start();
  a.local.game = reduceGame(a.local.game, { type: "walk", dx: 0, dy: -1 });
  b.local.game = reduceGame(b.local.game, { type: "walk", dx: 1, dy: 0 });
  await a.cloud.flush();
  await b.cloud.flush();
  assert.equal(b.cloud.status, "conflict");
  const local = structuredClone(b.local.game);
  await b.cloud.useCloud();
  assert.deepEqual(b.local.backups.at(-1)!.player, local.player);
  assert.deepEqual(b.local.game.player, a.local.game.player);
  assert.equal(b.cloud.status, "saved");
});
test("a clean cached account automatically receives a newer remote save", async () => {
  const a = fixture();
  await a.cloud.start();
  const b = fixture(a.db);
  await b.cloud.start();
  a.local.game = reduceGame(a.local.game, { type: "walk", dx: 0, dy: -1 });
  await a.cloud.flush();
  await b.cloud.retry();
  assert.equal(b.cloud.status, "saved");
  assert.deepEqual(b.local.game.player, a.local.game.player);
});
test("an unbound existing local cache and a different remote save require a choice", async () => {
  const remote = fixture();
  await remote.cloud.start();
  const local = reduceGame(initialGame(), { type: "walk", dx: 1, dy: 0 });
  const next = fixture(remote.db, "alice", true, local);
  await next.cloud.start();
  assert.equal(next.cloud.status, "conflict");
  assert.deepEqual(next.local.game.player, local.player);
  assert.equal(next.gateway.writes, 0);
});
test("server deletion never causes an old linked device to recreate the save silently", async () => {
  const f = fixture();
  await f.cloud.start();
  const revision = (f.store.value as CloudBinding).revision;
  const gateway: CloudSaveGateway = {
    uid: "alice",
    load: async () => null,
    write: async () => {
      throw new Error("Must not recreate");
    },
  };
  const cloud = new CloudSaveSession(
    "alice",
    gateway,
    { current: () => f.local.game, restore: async () => {} },
    f.store,
    async (game) =>
      createHash("sha256").update(snapshotContent(game)).digest("hex"),
    randomUUID,
    () => {},
    true,
  );
  active.add(cloud);
  await cloud.start();
  assert.equal(cloud.status, "conflict");
  assert.equal((f.store.value as CloudBinding).revision, revision);
});
test("permission errors preserve the local snapshot and never claim cloud success", async () => {
  const f = fixture();
  const before = structuredClone(f.local.game);
  f.gateway.loadError = Object.assign(new Error("Denied"), {
    code: "permission-denied",
  });
  await f.cloud.start();
  assert.equal(f.cloud.status, "pending");
  assert.equal(f.cloud.errorCode, "permission-denied");
  assert.deepEqual(f.local.game, before);
  assert.equal(f.gateway.writes, 0);
});
test("another account cannot inherit a pending cloud write from the previous identity", async () => {
  const a = fixture();
  a.gateway.loseResponse = true;
  await a.cloud.start();
  const b = fixture(a.db, "bob", false, initialGame(), a.store);
  await b.cloud.start();
  const alice = await a.gateway.load(),
    bob = await b.gateway.load();
  assert.equal(alice!.revision, 1);
  assert.equal(bob!.revision, 1);
  assert.notEqual(alice!.writeId, bob!.writeId);
});
test("a stopped account session performs no further writes", async () => {
  const f = fixture();
  await f.cloud.start();
  const count = f.gateway.writes;
  f.cloud.stop();
  f.local.game = reduceGame(f.local.game, { type: "walk", dx: 1, dy: 0 });
  f.cloud.observe(true);
  await f.cloud.flush();
  assert.equal(f.gateway.writes, count);
});
test("cloud protocol rejects stale revisions and mismatched retries, and supports the unified collection", () => {
  const game = initialGame(),
    input = { expectedRevision: 0, writeId: randomUUID(), snapshot: game };
  const first = resolveCloudWrite(null, input);
  assert.equal(first.record.revision, 1);
  assert.equal(resolveCloudWrite(first.record, input).replay, true);
  assert.throws(
    () => resolveCloudWrite(first.record, { ...input, writeId: randomUUID() }),
    CloudConflict,
  );
  assert.throws(
    () =>
      resolveCloudWrite(first.record, {
        ...input,
        snapshot: reduceGame(game, { type: "walk", dx: 1, dy: 0 }),
      }),
    /reutilizado/,
  );
  const promoted = structuredClone(game);
  promoted.collection[0]!.provenance = "validated";
  assert.equal(JSON.parse(encodeSnapshot(promoted)).collection[0].provenance, "validated");
});
test("cloud codec rejects malformed data and enforces the UTF-8 document budget", () => {
  const game = initialGame(),
    writeId = randomUUID();
  assert.deepEqual(
    decodeCloudRecord({
      schemaVersion: 1,
      revision: 1,
      writeId,
      snapshot: encodeSnapshot(game),
    }).snapshot,
    game,
  );
  assert.throws(() =>
    decodeCloudRecord({
      schemaVersion: 1,
      revision: 1,
      writeId,
      snapshot: "{",
    }),
  );
  assert.throws(() =>
    decodeCloudRecord({
      schemaVersion: 2,
      revision: 1,
      writeId,
      snapshot: "{}",
    }),
  );
  game.message = "🌳".repeat(200000);
  assert.throws(() => encodeSnapshot(game), /tamanho/);
});
test("local revision counters do not create false cloud conflicts after restoring a snapshot", () => {
  const a = initialGame(),
    b = { ...structuredClone(a), revision: 400 };
  assert.equal(snapshotContent(a), snapshotContent(b));
});
test("profile shows the authenticated person and rejects unsafe avatar URLs", () => {
  const user = {
    uid: "google-user",
    isAnonymous: false,
    displayName: "  Ana Silva ",
    email: "ana@example.com",
    photoURL: "https://lh3.googleusercontent.com/avatar",
  };
  assert.equal(userProfile(user)!.name, "Ana Silva");
  assert.equal(userProfile(user)!.email, "ana@example.com");
  assert.equal(profileInitials(userProfile(user)!.name), "AS");
  assert.equal(userProfile({ ...user, isAnonymous: true }), null);
  assert.equal(userProfile({ ...user, displayName: null })!.name, user.email);
  assert.equal(
    userProfile({ ...user, photoURL: "javascript:alert(1)" })!.photoURL,
    null,
  );
  assert.equal(profileInitials(""), "G");
});
test("restoring account progress refuses to overwrite local actions made during recovery", async () => {
  const session = new Session(new MemorySave(), () => {});
  await session.load();
  const expected = session.state.revision;
  await session.dispatch({ type: "walk", dx: 1, dy: 0 });
  await assert.rejects(session.replaceState(initialGame(), expected), /mudou/);
  assert.equal(session.state.player.x, 10);
});

test("cloud restore waits for a choice when gameplay changes during a remote read", async () => {
  const first = fixture();
  await first.cloud.start();
  const next = fixture(first.db, "alice", false);
  const load = next.gateway.load.bind(next.gateway);
  let release: () => void = () => {},
    entered: () => void = () => {};
  const waiting = new Promise<void>((resolve) => {
      release = resolve;
    }),
    started = new Promise<void>((resolve) => {
      entered = resolve;
    });
  next.gateway.load = async () => {
    entered();
    await waiting;
    return load();
  };
  const pending = next.cloud.start();
  await started;
  next.local.game = reduceGame(next.local.game, { type: "walk", dx: 1, dy: 0 });
  release();
  await pending;
  assert.equal(next.cloud.status, "conflict");
  assert.equal(next.local.game.player.x, 10);
  assert.equal(next.local.backups.length, 0);
});

test("progress made while a write is in flight remains pending for another confirmed write", async () => {
  const f = fixture();
  const write = f.gateway.write.bind(f.gateway);
  let release: () => void = () => {},
    entered: () => void = () => {};
  const waiting = new Promise<void>((resolve) => {
      release = resolve;
    }),
    started = new Promise<void>((resolve) => {
      entered = resolve;
    });
  f.gateway.write = async (input) => {
    entered();
    await waiting;
    return write(input);
  };
  const pending = f.cloud.start();
  await started;
  f.local.game = reduceGame(f.local.game, { type: "walk", dx: 1, dy: 0 });
  f.cloud.observe();
  release();
  await pending;
  assert.equal(f.cloud.status, "local");
  assert.equal((await f.gateway.load())!.snapshot.player.x, 9);
  f.gateway.write = write;
  await f.cloud.flush();
  assert.equal(f.cloud.status, "saved");
  assert.equal((await f.gateway.load())!.snapshot.player.x, 10);
  assert.equal((await f.gateway.load())!.revision, 2);
});

test("failure to persist the outbox prevents network writes including retries", async () => {
  const f = fixture();
  f.store.save = async () => {
    throw new Error("metadata quota");
  };
  await f.cloud.start();
  assert.equal(f.cloud.status, "pending");
  assert.equal(f.gateway.writes, 0);
  await f.cloud.retry();
  assert.equal(f.cloud.status, "pending");
  assert.equal(f.gateway.writes, 0);
});

test("pending cloud saves retry automatically with backoff and retain new local progress", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const f = fixture();
  let loads = 0;
  const load = f.gateway.load.bind(f.gateway);
  f.gateway.load = async () => { loads++; return load(); };
  f.gateway.loadError = new Error("Network unavailable");
  await f.cloud.start();
  assert.equal(loads, 1);
  t.mock.timers.tick(999);
  assert.equal(loads, 1);
  t.mock.timers.tick(1);
  await new Promise<void>(resolve => setImmediate(resolve));
  assert.equal(loads, 2);
  t.mock.timers.tick(1999);
  assert.equal(loads, 2);
  f.local.game = reduceGame(f.local.game, { type: "walk", dx: 1, dy: 0 });
  f.gateway.loadError = null;
  t.mock.timers.tick(1);
  await new Promise<void>(resolve => setImmediate(resolve));
  assert.equal(loads, 3);
  assert.equal(f.cloud.status, "saved");
  assert.equal((await load())!.snapshot.player.x, 10);
});

test("stopping a pending cloud session cancels background retries", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const f = fixture();
  let loads = 0;
  f.gateway.load = async () => { loads++; throw new Error("Offline"); };
  await f.cloud.start();
  f.cloud.stop();
  t.mock.timers.tick(120000);
  await new Promise<void>(resolve => setImmediate(resolve));
  assert.equal(loads, 1);
});

test("permanent access errors and cloud conflicts do not retry in the background", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const denied = fixture();
  let loads = 0;
  denied.gateway.load = async () => { loads++; throw Object.assign(new Error("Denied"), { code: "permission-denied" }); };
  await denied.cloud.start();
  const first = fixture();
  await first.cloud.start();
  const second = fixture(first.db, "alice", true, reduceGame(initialGame(), { type: "walk", dx: 1, dy: 0 }));
  await second.cloud.start();
  assert.equal(second.cloud.status, "conflict");
  const before = second.gateway.writes;
  t.mock.timers.tick(120000);
  await new Promise<void>(resolve => setImmediate(resolve));
  assert.equal(loads, 1);
  assert.equal(second.gateway.writes, before);
  assert.equal(second.cloud.status, "conflict");
});
