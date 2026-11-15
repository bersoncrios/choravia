import { FirestoreLiveOps } from "../../.aot/app/adapters/firestore-live-ops.js";
import test, { after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import { initializeApp, deleteApp } from "firebase/app";
import { getAuth, connectAuthEmulator, signInAnonymously } from "firebase/auth";
import { GameService } from "../../.aot/app/domain/online-engine/service.js";
import { BrowserFirestoreStore } from "../../.aot/app/adapters/firestore-online.js";
import { FirestoreCloudSave, firestore } from "../../.aot/app/adapters/cloud-save.js";
import { initialGame, createBattle } from "../../.aot/app/domain/game.js";
import { FirestoreGameMaster } from "../../.aot/app/adapters/firestore-game-master.js";
import {
  getFirestore,
  connectFirestoreEmulator,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  terminate,
  serverTimestamp,
  deleteDoc,
} from "firebase/firestore";
import {
  initializeApp as adminApp,
  deleteApp as deleteAdminApp,
} from "firebase-admin/app";
import { getFirestore as adminFirestore } from "firebase-admin/firestore";

// Refuse to run against a real project or an external host, even if credentials are available.
const project = "demo-wildwoods";
assert.equal(
  process.env.GCLOUD_PROJECT ?? project,
  project,
  "Use only demo-wildwoods for emulator tests.",
);
const endpoint = (value, name) => {
  assert.ok(value, `${name} is required. Run with firebase emulators:exec.`);
  const match = /^(127\.0\.0\.1|localhost):(\d+)$/.exec(value);
  assert.ok(match, `${name} must be a loopback address.`);
  return { host: match[1], port: Number(match[2]) };
};
const authEndpoint = endpoint(
  process.env.FIREBASE_AUTH_EMULATOR_HOST,
  "FIREBASE_AUTH_EMULATOR_HOST",
);
const firestoreEndpoint = endpoint(
  process.env.FIRESTORE_EMULATOR_HOST,
  "FIRESTORE_EMULATOR_HOST",
);
const apps = [];
const admin = adminApp({ projectId: project }, `emulator-${randomUUID()}`),
  dbAdmin = adminFirestore(admin);
after(async () => {
  for (const c of apps) {
    await terminate(c.db);
    await deleteApp(c.app);
  }
  await dbAdmin.terminate();
  await deleteAdminApp(admin);
});
async function client() {
  const app = initializeApp(
    {
      apiKey: "demo-key",
      projectId: project,
      authDomain: `${project}.firebaseapp.com`,
    },
    randomUUID(),
  );
  const auth = getAuth(app);
  connectAuthEmulator(
    auth,
    `http://${authEndpoint.host}:${authEndpoint.port}`,
    { disableWarnings: true },
  );
  const db = firestore(app, true);
  const service = new GameService(new BrowserFirestoreStore(db, () => auth.currentUser?.uid ?? ""));
  const call = (method, input) => service.execute(auth.currentUser.uid, method, input);
  const gm = new FirestoreGameMaster(db, () => auth.currentUser?.uid ?? "");
  const result = { app, auth, db, call, gm };
  apps.push(result);
  await signInAnonymously(auth);
  await call("bootstrap", {});
  return { ...result, uid: auth.currentUser.uid };
}
const denied = (error) => error?.code === "permission-denied";
test("personal cloud saves are private, versioned and cannot write inventory or extra fields", async () => {
  const a = await client(),
    b = await client();
  const ref = doc(a.db, "users", a.uid, "saves", "solo");
  assert.equal((await getDoc(ref)).exists(), false);
  const record = {
    schemaVersion: 1,
    revision: 1,
    writeId: randomUUID(),
    snapshot: '{"private":"solo progress"}',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  await setDoc(ref, record);
  assert.equal((await getDoc(ref)).get("revision"), 1);
  await assert.rejects(
    getDoc(doc(b.db, "users", a.uid, "saves", "solo")),
    denied,
  );
  await assert.rejects(
    setDoc(doc(b.db, "users", a.uid, "saves", "solo"), record),
    denied,
  );
  await assert.rejects(
    getDocs(collection(a.db, "users", a.uid, "saves")),
    denied,
  );
  await assert.rejects(
    updateDoc(ref, {
      revision: 3,
      writeId: randomUUID(),
      updatedAt: serverTimestamp(),
    }),
    denied,
  );
  await assert.rejects(
    updateDoc(ref, {
      revision: 2,
      writeId: record.writeId,
      updatedAt: serverTimestamp(),
    }),
    denied,
  );
  await assert.rejects(
    updateDoc(ref, {
      revision: 2,
      writeId: randomUUID(),
      ownerId: a.uid,
      updatedAt: serverTimestamp(),
    }),
    denied,
  );
  await assert.rejects(
    updateDoc(ref, {
      revision: 2,
      writeId: randomUUID(),
      snapshot: "x".repeat(700001),
      updatedAt: serverTimestamp(),
    }),
    denied,
  );
  await updateDoc(ref, {
    revision: 2,
    writeId: randomUUID(),
    snapshot: '{"updated":true}',
    updatedAt: serverTimestamp(),
  });
  assert.equal((await getDoc(ref)).get("revision"), 2);
  await assert.rejects(deleteDoc(ref), denied);
  const eco = (await a.call("getState", {})).creatures[0];
  await assert.rejects(
    updateDoc(doc(a.db, "creatures", eco.id), { revision: 999 }),
    denied,
  );
});
test("real Rules enforce ownership, deny client asset writes, and validate preferences", async () => {
  const a = await client(),
    b = await client();
  const state = await a.call("getState", {}),
    creature = state.creatures[0];
  assert.equal(
    (await dbAdmin.doc(`users/${a.uid}/online/state`).get()).exists,
    true,
  );
  assert.equal((await getDoc(doc(a.db, "users", a.uid))).exists(), false);
  await assert.rejects(getDoc(doc(b.db, "users", a.uid)), denied);
  await assert.rejects(getDocs(collection(a.db, "users")), denied);
  assert.equal(
    (await getDoc(doc(a.db, "creatures", creature.id))).exists(),
    true,
  );
  await assert.rejects(getDoc(doc(b.db, "creatures", creature.id)), denied);
  assert.equal(
    (
      await getDocs(
        query(collection(a.db, "creatures"), where("ownerId", "==", a.uid)),
      )
    ).size,
    1,
  );
  await assert.rejects(getDocs(collection(a.db, "creatures")), denied);
  await assert.rejects(
    updateDoc(doc(a.db, "creatures", creature.id), { ownerId: b.uid }),
    denied,
  );
  await assert.rejects(
    setDoc(doc(a.db, "creatures", randomUUID()), {
      ownerId: a.uid,
      speciesId: "WW005",
    }),
    denied,
  );
  await assert.rejects(
    setDoc(doc(a.db, "users", a.uid), { role: "admin" }),
    denied,
  );
  const preferences = {
    schemaVersion: 1,
    soundEnabled: false,
    reducedMotion: true,
    captureMode: "accessible",
  };
  await setDoc(doc(a.db, "users", a.uid, "preferences", "main"), preferences);
  await assert.rejects(
    setDoc(doc(a.db, "users", a.uid, "preferences", "main"), {
      ...preferences,
      ownerId: a.uid,
    }),
    denied,
  );
  await assert.rejects(
    setDoc(doc(a.db, "users", a.uid, "preferences", "main"), {
      ...preferences,
      soundEnabled: "yes",
    }),
    denied,
  );
  await assert.rejects(
    setDoc(doc(b.db, "users", a.uid, "preferences", "main"), preferences),
    denied,
  );
  await assert.rejects(getDocs(collection(a.db, "trade_links")), denied);
  await assert.rejects(getDocs(collection(a.db, "encounters")), denied);
  await assert.rejects(getDocs(collection(a.db, "battle_rooms")), denied);
});
test("direct Firestore encounter grants one capture and replays the final action", async () => {
  const c = await client(),
    state = await c.call("getState", {});
  let encounter = await c.call("beginEncounter", {
    requestId: randomUUID(),
    creatureId: state.creatures[0].id,
  });
  for (const command of [
    { type: "basic", target: { x: 3, y: 1 } },
    { type: "basic", target: { x: 3, y: 1 } },
    { type: "basic", target: { x: 3, y: 1 } },
  ])
    encounter = await c.call("submitAction", {
      requestId: randomUUID(),
      encounterId: encounter.id,
      seq: encounter.seq,
      command,
    });
  const input = {
    requestId: randomUUID(),
    encounterId: encounter.id,
    seq: encounter.seq,
    command: { type: "capture" },
  };
  const [one, two] = await Promise.all([
    c.call("submitAction", input),
    c.call("submitAction", input),
  ]);
  assert.deepEqual(one, two);
  assert.equal(one.battle.result, "capture");
  assert.equal("rng" in one, false);
  assert.equal((await c.call("getState", {})).creatures.length, 2);
  const event = await dbAdmin
    .doc(`domain_events/${encounter.id}-capture`)
    .get();
  assert.equal(event.get("type"), "first_capture");
});
test("real Firestore serializes two recipients and does not need the sender online", async () => {
  const sender = await client(),
    b = await client(),
    c = await client();
  const own = (await sender.call("getState", {})).creatures[0];
  const offer = await sender.call("createTrade", {
    requestId: randomUUID(),
    creatureId: own.id,
    requestedSpeciesId: "WW001",
  });
  const stored = await dbAdmin.doc(`trade_links/${offer.tradeId}`).get();
  assert.equal(
    stored.get("tokenHash"),
    createHash("sha256").update(offer.token).digest("hex"),
  );
  assert.equal(stored.get("token"), undefined);
  const inputs = await Promise.all(
    [b, c].map(async (target) => ({
      requestId: randomUUID(),
      tradeId: offer.tradeId,
      token: offer.token,
      creatureId: (await target.call("getState", {})).creatures[0].id,
    })),
  );
  const results = await Promise.allSettled([
    b.call("acceptTrade", inputs[0]),
    c.call("acceptTrade", inputs[1]),
  ]);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  const winner = results[0].status === "fulfilled" ? b : c,
    winnerInput = results[0].status === "fulfilled" ? inputs[0] : inputs[1];
  assert.deepEqual(
    await winner.call("acceptTrade", winnerInput),
    results.find((r) => r.status === "fulfilled").value,
  );
  assert.equal(
    (await dbAdmin.doc(`creatures/${own.id}`).get()).get("ownerId"),
    winner.uid,
  );
  assert.equal(
    (await dbAdmin.doc(`creatures/${winnerInput.creatureId}`).get()).get(
      "ownerId",
    ),
    sender.uid,
  );
  assert.equal(
    (await dbAdmin.doc(`domain_events/${offer.tradeId}-completed`).get()).get(
      "type",
    ),
    "trade_completed",
  );
  await assert.rejects(getDoc(doc(sender.db, "creatures", own.id)), denied);
});
test("real expiry rejects acceptance before cleanup, then frees its exact lock", async () => {
  const sender = await client(),
    recipient = await client(),
    own = (await sender.call("getState", {})).creatures[0],
    other = (await recipient.call("getState", {})).creatures[0];
  const offer = await sender.call("createTrade", {
    requestId: randomUUID(),
    creatureId: own.id,
    requestedSpeciesId: "WW001",
  });
  await dbAdmin
    .doc(`trade_links/${offer.tradeId}`)
    .update({ expiresAt: Date.now() - 1 });
  await assert.rejects(
    recipient.call("acceptTrade", {
      requestId: randomUUID(),
      tradeId: offer.tradeId,
      token: offer.token,
      creatureId: other.id,
    }),
    (e) => e?.code === "failed-precondition",
  );
  assert.equal(
    (await sender.call("getState", {})).creatures.find((c) => c.id === own.id)
      .lock,
    null,
  );
  assert.equal(
    (await dbAdmin.doc(`trade_links/${offer.tradeId}`).get()).get("status"),
    "expired",
  );
});

test("direct Firestore daily rewards survive reload and cannot be acknowledged twice", async () => {
  const a = await client();
  const board = await a.call("getDailyBoard", {});
  assert.equal(board.contracts.length, 3);
  const state = await a.call("getState", {});
  const encounter = await a.call("beginEncounter", { requestId: randomUUID(), creatureId: state.creatures[0].id });
  const action = { requestId: randomUUID(), encounterId: encounter.id, seq: 0, command: { type: "defend" } };
  await a.call("submitAction", action);
  await a.call("submitAction", action);
  const after = await a.call("getDailyBoard", {});
  const receipts = after.pendingRewards.map((entry) => entry.receiptId);
  assert.equal(new Set(receipts).size, receipts.length);
  await a.call("ackDailyRewards", { receiptIds: receipts });
  await a.call("ackDailyRewards", { receiptIds: receipts });
  assert.equal((await a.call("getDailyBoard", {})).pendingRewards.length, 0);
});

test("Rules reject unilateral transfers, forged trade completion and premature unlock", async () => {
  const a = await client(), b = await client();
  const own = (await a.call("getState", {})).creatures[0];
  const other = (await b.call("getState", {})).creatures[0];
  const offer = await a.call("createTrade", { requestId: randomUUID(), creatureId: own.id, requestedSpeciesId: "WW001" });
  await assert.rejects(updateDoc(doc(a.db, "creatures", own.id), { lock: null, revision: 3 }), denied);
  await assert.rejects(updateDoc(doc(b.db, "creatures", own.id), { ownerId: b.uid, lock: null, revision: 3, transferTradeId: offer.tradeId }), denied);
  await assert.rejects(updateDoc(doc(b.db, "trade_links", offer.tradeId), {
    status: "completed", revision: 2, acceptedBy: b.uid, receivedCreatureId: other.id,
    completedAt: Date.now(), tokenProof: "x".repeat(43),
  }), denied);
  const rotated = await a.call("rotateTradeToken", { tradeId: offer.tradeId, revision: 1 });
  await assert.rejects(b.call("previewTrade", { tradeId: offer.tradeId, token: offer.token }));
  await b.call("acceptTrade", { requestId: randomUUID(), tradeId: offer.tradeId, token: rotated.token, creatureId: other.id });
  assert.equal((await a.call("getState", {})).offer, null);
});

test("Game Master uses Firestore roles and leaves an immutable audit receipt", async () => {
  const actor = await client(), player = await client();
  await assert.rejects(actor.gm.execute({ method: "lookup", targetUid: player.uid }), (e) => e.code === "permission-denied");
  await dbAdmin.doc(`users/${actor.uid}`).set({ role: "admin" });
  await dbAdmin.doc(`users/${player.uid}`).set({ displayName: "Jogador de teste", displayNameSearch: "jogador de teste" });
  const { initialGame } = await import("../../.aot/app/domain/game.js");
  await setDoc(doc(player.db, "users", player.uid, "saves", "solo"), {
    schemaVersion: 1, revision: 1, writeId: randomUUID(), snapshot: JSON.stringify(initialGame()),
    createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  });
  const request = { method: "grantSeeds", targetUid: player.uid, requestId: randomUUID(), amount: 50, reason: "Teste de suporte" };
  const first = await actor.gm.execute(request);
  const repeat = await actor.gm.execute(request);
  assert.equal(repeat.replay, true);
  assert.equal(first.player.seeds, repeat.player.seeds);
  assert.equal((await actor.gm.execute({ method: "search", query: "jogador" })).players[0].uid, player.uid);
  const audit = await actor.gm.execute({ method: "listAudit" });
  assert.ok(audit.entries.some((entry) => entry.targetUid === player.uid));
  await assert.rejects(getDocs(collection(player.db, "game_master_audit")), denied);
  await assert.rejects(updateDoc(doc(player.db, "users", player.uid), { role: "admin" }), denied);
});

test("a completed trade cannot be reused after the creatures have traded back", async () => {
  const a = await client(), b = await client();
  const own = (await a.call("getState", {})).creatures[0];
  const other = (await b.call("getState", {})).creatures[0];
  const first = await a.call("createTrade", { requestId: randomUUID(), creatureId: own.id, requestedSpeciesId: "WW001" });
  await b.call("acceptTrade", { requestId: randomUUID(), tradeId: first.tradeId, token: first.token, creatureId: other.id });
  const back = await b.call("createTrade", { requestId: randomUUID(), creatureId: own.id, requestedSpeciesId: "WW001" });
  await a.call("acceptTrade", { requestId: randomUUID(), tradeId: back.tradeId, token: back.token, creatureId: other.id });
  const before = await dbAdmin.doc(`creatures/${own.id}`).get();
  await assert.rejects(updateDoc(doc(b.db, "creatures", own.id), {
    ownerId: b.uid, lock: null, revision: before.get("revision") + 1, transferTradeId: first.tradeId,
  }), denied);
  assert.equal((await dbAdmin.doc(`creatures/${own.id}`).get()).get("ownerId"), a.uid);
});

test("single expedition migration works under real Rules without duplicate starters or imported captures", async () => {
  const a = await client();
  const local = { id: "starter", speciesId: "WW003", hp: 16, level: 4, experience: 10, provenance: "local" };
  const before = await a.call("getState", {});
  const first = await a.call("syncExpedition", { creatures: [local] });
  assert.equal(first.mapping[0].id, before.creatures[0].id);
  assert.deepEqual(await a.call("syncExpedition", { creatures: [local] }), first);
  const imported = { ...local, id: "capture-local-1", speciesId: "WW002" };
  const capture = await a.call("syncExpedition", { creatures: [imported] });
  assert.deepEqual(await a.call("syncExpedition", { creatures: [imported] }), capture);
  const state = await a.call("getState", {});
  assert.equal(state.creatures.length, 2);
  assert.equal(state.creatures.find(c => c.id === first.mapping[0].id).speciesId, "WW003");
  const board = await a.call("getDailyBoard", {});
  const input = { cycleId: board.cycleId, types: ["resolve-encounter", "move-in-battle", "defend-in-battle", "basic-attack", "visit-region"] };
  await a.call("recordExpeditionDaily", input);
  const completed = await a.call("getDailyBoard", {});
  await a.call("recordExpeditionDaily", input);
  assert.deepEqual(await a.call("getDailyBoard", {}), completed);
  assert.ok(completed.contracts.every(c => c.completed));
  const b = await client();
  const recipient = (await b.call("getState", {})).creatures[0];
  const offer = await a.call("createTrade", { requestId: randomUUID(), creatureId: capture.mapping[0].id, requestedSpeciesId: "WW001" });
  await b.call("acceptTrade", { requestId: randomUUID(), tradeId: offer.tradeId, token: offer.token, creatureId: recipient.id });
  assert.equal((await a.call("syncExpedition", { creatures: [imported] })).mapping[0].id, null);
  assert.equal((await a.call("syncExpedition", { creatures: [{ ...imported, id: capture.mapping[0].id, provenance: "validated" }] })).mapping[0].id, null);
});

test("the account save protects its active battle Eco from trades on another device", async () => {
  const a = await client();
  const state = await a.call("getState", {}), eco = state.creatures[0];
  const world = initialGame(827361);
  world.collection[0] = { id: eco.id, speciesId: eco.speciesId, hp: 36, level: 1, experience: 0, provenance: "validated" };
  world.activeId = eco.id; world.scene = "battle";
  world.battle = createBattle("local-save-protection", world.collection[0], "WW002", false);
  const save = new FirestoreCloudSave(a.app, a.uid, () => a.uid, true);
  await save.write({ expectedRevision: 0, writeId: randomUUID(), snapshot: world });
  const status = await getDoc(doc(a.db, "users", a.uid, "expedition", "status"));
  assert.equal(status.get("activeCreatureId"), eco.id);
  await assert.rejects(a.call("createTrade", { requestId: randomUUID(), creatureId: eco.id, requestedSpeciesId: "WW002" }));
  world.scene = "exploration"; world.battle = null;
  await save.write({ expectedRevision: 1, writeId: randomUUID(), snapshot: world });
  const trade = await a.call("createTrade", { requestId: randomUUID(), creatureId: eco.id, requestedSpeciesId: "WW002" });
  assert.ok(trade.tradeId);
});


test("live operations enforce roles, atomic audits, revisions and private idempotent badges", async () => {
  const actor = await client(), player = await client(), other = await client();
  await dbAdmin.doc(`users/${actor.uid}`).set({ role: "admin" }, { merge: true });
  const ops = new FirestoreLiveOps(actor.db, () => actor.uid);
  const ordinary = new FirestoreLiveOps(player.db, () => player.uid);
  const accessory = { id: `custom-${randomUUID()}`, name: "Coroa do evento", description: "Peça criada para o evento de teste.", shape: "crown", color: "#aaccee", price: 75, active: true, revision: 0 };
  const req = { method: "saveAccessory", requestId: randomUUID(), value: accessory, reason: "Evento de integração" };
  await assert.rejects(ordinary.execute(req), denied);
  assert.equal((await ops.execute(req)).replay, false);
  assert.equal((await ops.execute(req)).replay, true);
  const published = await getDoc(doc(player.db, "shop_accessories", accessory.id));
  assert.equal(published.get("revision"), 1);
  assert.equal(published.get("price"), 75);
  await assert.rejects(setDoc(doc(player.db, "shop_accessories", accessory.id), published.data()), denied);
  await assert.rejects(updateDoc(doc(actor.db, "shop_accessories", accessory.id), { price: 5, revision: 2, updatedAt: serverTimestamp() }), denied);
  await assert.rejects(ops.execute({ ...req, requestId: randomUUID() }), /Outro GM/);
  await ops.execute({ ...req, requestId: randomUUID(), value: { ...accessory, revision: 1, active: false } });
  const balance = { id: "WW001", hp: 80, attack: 15, defense: 8, revision: 0 };
  const existingBalance = await getDoc(doc(actor.db, "eco_balance", balance.id));
  balance.revision = existingBalance.exists() ? existingBalance.get("revision") : 0;
  await ops.execute({ method: "saveBalance", requestId: randomUUID(), value: balance, reason: "Ajuste de integração" });
  assert.equal((await getDoc(doc(player.db, "eco_balance", "WW001"))).get("hp"), 80);
  const badge = { id: `badge-${randomUUID()}`, name: "Evento inaugural", description: "Participante do evento de integração.", color: "#ddaa55", symbol: "star", category: "event", active: true, revision: 0 };
  await ops.execute({ method: "saveBadge", requestId: randomUUID(), value: badge, reason: "Reconhecimento de evento" });
  const grant = { method: "grantBadge", requestId: randomUUID(), targetUid: player.uid, badgeId: badge.id, reason: "Participação confirmada no evento" };
  await ops.execute(grant); assert.equal((await ops.execute(grant)).replay, true);
  const earned = doc(player.db, "users", player.uid, "badges", badge.id);
  assert.equal((await getDoc(earned)).get("name"), badge.name);
  await assert.rejects(getDoc(doc(other.db, "users", player.uid, "badges", badge.id)), denied);
  await assert.rejects(setDoc(doc(player.db, "users", player.uid, "badges", "badge-forged"), { badgeId: "badge-forged" }), denied);
  await assert.rejects(ops.execute({ ...grant, requestId: randomUUID() }), /já possui/);
  const auditId = (await getDoc(earned)).get("auditId");
  await assert.rejects(updateDoc(doc(actor.db, "content_audit", auditId), { reason: "Alterar o histórico" }), denied);
  await assert.rejects(deleteDoc(doc(actor.db, "users", player.uid, "badges", badge.id)), denied);
  await ops.execute({ method: "saveBadge", requestId: randomUUID(), value: { ...badge, revision: 1, active: false }, reason: "Encerrar evento de teste" });
  await assert.rejects(ops.execute({ ...grant, targetUid: other.uid, requestId: randomUUID() }), /ativa/);
  const history = await ops.audit(); assert.ok(history.some(v => v.id === auditId));
  let stop = () => {};
  let timer;
  try {
    const watched = await new Promise((resolve, reject) => {
      let catalog = null, badges = null;
      const ready = () => { if (catalog?.accessories.some(v => v.id === accessory.id) && badges?.some(v => v.badgeId === badge.id)) resolve({ catalog, badges }); };
      timer = setTimeout(() => reject(new Error("Live catalog subscription timed out")), 10000);
      stop = ordinary.watch(player.uid, value => { catalog = value; ready(); }, value => { badges = value; ready(); }, reject);
    });
    const item = watched.catalog.accessories.find(v => v.id === accessory.id);
    assert.equal(item.revision, 2);
    assert.equal(item.active, false);
    assert.equal(Object.hasOwn(item, "updatedAt"), false, "editor payloads must exclude Firestore metadata");
    assert.equal(typeof watched.badges.find(v => v.badgeId === badge.id).grantedAt, "number");
  } finally { clearTimeout(timer); stop(); }

});
