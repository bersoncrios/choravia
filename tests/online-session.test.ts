import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { MemoryStore } from "../functions/src/memory-store.js";
import { GameService } from "../functions/src/service.js";
import { GameError } from "../functions/src/model.js";
import {
  OnlineSession,
  parseInvite,
  inviteLink,
} from "../src/app/application/online-session.js";
import type {
  PendingRequest,
  PendingStore,
} from "../src/app/application/online-session.js";
import type {
  OnlineGateway,
  RemoteMethod,
  Requests,
  Responses,
} from "../src/app/domain/online.js";
import { validateResponse } from "../src/app/domain/online-validation.js";
import { activeCreature, initialGame } from "../src/app/domain/game.js";

class Gateway implements OnlineGateway {
  loseAfter: RemoteMethod | null = null;
  constructor(
    readonly service: GameService,
    public uid: string,
  ) {}
  async call<K extends RemoteMethod>(
    method: K,
    input: Requests[K],
  ): Promise<Responses[K]> {
    let response: unknown;
    try {
      response = await this.service.execute(this.uid, method, input);
    } catch (error) {
      if (error instanceof GameError)
        throw Object.assign(new Error(error.message), {
          code: `functions/${error.code}`,
        });
      throw error;
    }
    if (this.loseAfter === method) {
      this.loseAfter = null;
      throw Object.assign(new Error("Resposta perdida após commit"), {
        code: "functions/unavailable",
      });
    }
    return validateResponse(method, response);
  }
}
class PendingMemory implements PendingStore {
  values = new Map<string, unknown>();
  load(uid: string): unknown {
    return this.values.get(uid) ?? null;
  }
  save(uid: string, pending: PendingRequest | null): void {
    if (pending) this.values.set(uid, structuredClone(pending));
    else this.values.delete(uid);
  }
}
function fixture() {
  const store = new MemoryStore(),
    service = new GameService(store, { now: () => 1800000000000 }),
    gateway = new Gateway(service, "alice"),
    pending = new PendingMemory(),
    session = new OnlineSession(gateway, () => {}, randomUUID, pending);
  // Keep the scripted walk independent of randomly placed pots and NPCs.
  session.view = initialGame(827361);
  return { store, service, gateway, pending, session };
}
async function walkToEncounter(session: OnlineSession) {
  for (let i = 0; i < 4; i++)
    await session.dispatch({ type: "walk", dx: 0, dy: -1 });
  for (let i = 0; i < 7; i++)
    await session.dispatch({ type: "walk", dx: i % 2 === 0 ? -1 : 1, dy: 0 });
  assert.equal(session.view.scene, "battle");
}
test("online session uses server inventory and never promotes a local creature", async () => {
  const f = fixture();
  await f.session.load();
  assert.equal(f.session.ready, true);
  assert.ok(
    f.session.view.collection.every((c) => c.provenance === "validated"),
  );
  assert.equal(
    f.session.view.collection.some((c) => c.id === "starter"),
    false,
  );
  assert.equal(f.pending.values.size, 0);
});
test("map encounter uses server commands and result, with a valid shared response contract", async () => {
  const f = fixture();
  await f.session.load();
  await walkToEncounter(f.session);
  for (let i = 0; i < 3; i++)
    await f.session.dispatch({ type: "basic", target: { ...f.session.view.battle!.enemy.pos } });
  await f.session.dispatch({ type: "capture" });
  assert.equal(f.session.view.scene, "result");
  assert.equal(f.session.view.battle!.result, "capture");
  assert.equal(f.session.view.collection.length, 2);
  assert.ok(
    f.session.view.collection.every((c) => c.provenance === "validated"),
  );
  await f.session.dispatch({ type: "return" });
  assert.equal(f.session.view.scene, "exploration");
  assert.equal(f.session.state!.encounter, null);
});
test("a lost action response blocks further input and retries the same committed action once", async () => {
  const f = fixture();
  await f.session.load();
  await walkToEncounter(f.session);
  const before = f.session.state!.encounter!.seq;
  f.gateway.loseAfter = "submitAction";
  await f.session.dispatch({ type: "defend" });
  assert.equal(f.session.ready, false);
  assert.ok(f.session.pending);
  const old = f.session.view;
  await f.session.dispatch({ type: "defend" });
  assert.equal(f.session.view, old);
  await f.session.retry();
  assert.equal(f.session.ready, true);
  assert.equal(f.session.state!.encounter!.seq, before + 1);
  assert.equal(f.pending.values.size, 0);
});
test("reload recovers pending action without advancing the sequence a second time", async () => {
  const f = fixture();
  await f.session.load();
  await walkToEncounter(f.session);
  f.gateway.loseAfter = "submitAction";
  await f.session.dispatch({ type: "defend" });
  const restored = new OnlineSession(
    f.gateway,
    () => {},
    randomUUID,
    f.pending,
  );
  await restored.load();
  assert.equal(restored.ready, true);
  assert.equal(restored.state!.encounter!.seq, 1);
  assert.equal(restored.view.battle!.round, 2);
});
test("lost create response keeps the existing offer and recovers through explicit token rotation", async () => {
  const f = fixture();
  await f.session.load();
  f.gateway.loseAfter = "createTrade";
  await f.session.createOffer(f.session.view.activeId, "WW001");
  assert.ok(f.session.pending);
  await f.session.retry();
  assert.equal(f.session.ready, true);
  assert.ok(f.session.state!.offer);
  assert.equal(f.session.outgoing, null);
  await f.session.rotate();
  assert.equal(f.session.outgoing!.token.length, 43);
  assert.equal(
    JSON.stringify([...f.pending.values]).includes(f.session.outgoing!.token),
    false,
  );
});
test("inventory reconciliation after a completed trade cannot resurrect the old owner", async () => {
  const f = fixture();
  await f.session.load();
  const aliceId = f.session.view.activeId;
  await f.session.createOffer(aliceId, "WW001");
  const invite = f.session.outgoing!;
  const bob = new Gateway(f.service, "bob");
  await bob.call("bootstrap", {});
  const bobId = (await bob.call("getState", {})).creatures[0]!.id;
  await bob.call("acceptTrade", {
    requestId: randomUUID(),
    ...invite,
    creatureId: bobId,
  });
  await f.session.refresh();
  assert.equal(
    f.session.view.collection.some((c) => c.id === aliceId),
    false,
  );
  assert.equal(
    f.session.view.collection.some((c) => c.id === bobId),
    true,
  );
  assert.equal(f.session.outgoing, null);
  assert.doesNotThrow(() => activeCreature(f.session.view));
});
test("a transferred active creature dismisses a historic result instead of leaving an invalid activeId", async () => {
  const f = fixture();
  await f.session.load();
  await walkToEncounter(f.session);
  await f.session.dispatch({ type: "flee" });
  assert.equal(f.session.view.scene, "result");
  const aliceId = f.session.view.activeId;
  await f.session.createOffer(aliceId, "WW001");
  const bob = new Gateway(f.service, "bob");
  await bob.call("bootstrap", {});
  const bobId = (await bob.call("getState", {})).creatures[0]!.id;
  await bob.call("acceptTrade", {
    requestId: randomUUID(),
    ...f.session.outgoing!,
    creatureId: bobId,
  });
  await f.session.refresh();
  assert.equal(f.session.view.scene, "exploration");
  assert.doesNotThrow(() => activeCreature(f.session.view));
});
test("another device rotating a token removes the outdated link on refresh", async () => {
  const f = fixture();
  await f.session.load();
  await f.session.createOffer(f.session.view.activeId, "WW001");
  const own = f.session.state!.offer!;
  await f.gateway.call("rotateTradeToken", {
    tradeId: own.id,
    revision: own.revision,
  });
  await f.session.refresh();
  assert.equal(f.session.outgoing, null);
});
test("acceptance retries retain the token only in memory and confirm completion only after response", async () => {
  const f = fixture();
  await f.session.load();
  const bob = new Gateway(f.service, "bob");
  await bob.call("bootstrap", {});
  const bobId = (await bob.call("getState", {})).creatures[0]!.id;
  const created = await bob.call("createTrade", {
      requestId: randomUUID(),
      creatureId: bobId,
      requestedSpeciesId: "WW001",
    }),
    invite = { tradeId: created.tradeId, token: created.token! };
  await f.session.inspect(invite);
  f.gateway.loseAfter = "acceptTrade";
  await f.session.accept(invite, f.session.view.activeId);
  assert.equal(f.session.preview!.status, "open");
  assert.equal(f.session.pending!.method, "acceptTrade");
  assert.equal(f.pending.values.size, 0);
  await f.session.retry();
  assert.equal(f.session.preview!.status, "completed");
  assert.equal(f.session.view.collection[0]!.id, bobId);
});
test("account switching refuses to send an old session command under a new identity", async () => {
  const f = fixture();
  await f.session.load();
  f.gateway.uid = "bob";
  await f.session.refresh();
  assert.equal(f.session.ready, false);
  assert.match(f.session.error, /conta mudou/);
});
test("malformed cached pending command containing a secret is not replayed", async () => {
  const f = fixture();
  f.pending.values.set("alice", {
    method: "acceptTrade",
    input: { requestId: randomUUID(), token: "x".repeat(43) },
  });
  const session = new OnlineSession(f.gateway, () => {}, randomUUID, f.pending);
  await session.load();
  assert.equal(session.pending, null);
  assert.equal(session.ready, true);
});
test("links carry secrets only in a fragment and parser enforces same origin and shape", () => {
  const origin = "https://choravia.example",
    invite = { tradeId: randomUUID(), token: "x".repeat(43) },
    link = inviteLink(invite, origin);
  assert.equal(new URL(link).search, "");
  assert.deepEqual(parseInvite(link, origin), invite);
  assert.equal(parseInvite(link, "https://another.example"), null);
  assert.equal(
    parseInvite(`${origin}/troca/../users#t=${invite.token}`, origin),
    null,
  );
  assert.equal(parseInvite(link.replace("#t=", "?t="), origin), null);
});
test("response validation rejects malformed inventory, unknown species and invalid battle coordinates", async () => {
  const f = fixture();
  await f.session.load();
  const state = await f.gateway.call("getState", {});
  assert.throws(() =>
    validateResponse("getState", {
      ...state,
      creatures: [{ id: "x", speciesId: "fake" }],
    }),
  );
  await walkToEncounter(f.session);
  const encounter = structuredClone(f.session.state!.encounter!);
  encounter.battle.enemy.pos = { x: 10, y: 0 };
  assert.throws(() => validateResponse("submitAction", encounter));
});
