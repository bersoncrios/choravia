import test from "node:test";
import assert from "node:assert/strict";
import { MemoryStore } from "../functions/src/memory-store.js";
import { LiveOpsService } from "../src/app/domain/online-engine/live-ops-service.js";
import { ACCESSORY_MODELS, BADGE_SYMBOLS, parseLiveOpsRequest, type CustomAccessory, type BadgeDefinition, type LiveContent } from "../src/app/domain/live-ops.js";
import { applyLiveContent } from "../src/app/application/live-content.js";
import { initialGame, reduceGame, createBattle, damage, creatureMaxHp, canCapture } from "../src/app/domain/game.js";
import { isGame } from "../src/app/domain/save-validation.js";
import { DEFAULT_AVATAR } from "../src/app/domain/avatar.js";
const accessory: CustomAccessory = { id: "custom-festival", name: "Coroa da floresta", description: "Uma lembrança do festival da floresta.", color: "#55aa77", shape: "crown", price: 25, active: true, revision: 0 };
const badge: BadgeDefinition = { id: "badge-festival", name: "Primeiro festival", description: "Participou do encontro da comunidade.", color: "#ddaa55", symbol: "star", category: "event", active: true, revision: 0 };
const empty: LiveContent = { accessories: [], balance: [], badges: [] };
async function fixture() { const store = new MemoryStore(); await store.seed("users/gm", { role: "admin" }); await store.seed("users/player", { displayName: "Guardião" }); return { store, service: new LiveOpsService(store, () => 123456) }; }
test("live ops validates payloads and refuses non-admins before any content write", async () => {
 const f = await fixture();
 const req = { method: "saveAccessory" as const, value: accessory, requestId: "request-001", reason: "Festival anual" };
 await assert.rejects(f.service.execute("player", req), /Game Master/);
 assert.equal(f.store.all("shop_accessories/").length, 0);
 for (const value of [{ ...accessory, price: -1 }, { ...accessory, color: "url(javascript:x)" }, { ...accessory, id: "custom-../bad" }, { ...accessory, shape: "script" }, { ...accessory, role: "admin" }]) assert.throws(() => parseLiveOpsRequest({ ...req, value }));
 assert.throws(() => parseLiveOpsRequest({ ...req, extra: true }));
});
test("GM accessory models and badge symbols expose twenty valid visual choices",()=>{
 assert.equal(Object.keys(ACCESSORY_MODELS).length,20);
 assert.equal(Object.keys(BADGE_SYMBOLS).length,20);
 for(const shape of Object.keys(ACCESSORY_MODELS)) parseLiveOpsRequest({method:"saveAccessory",requestId:"visual-model-001",reason:"Validação visual",value:{...accessory,shape}});
 for(const symbol of Object.keys(BADGE_SYMBOLS)) parseLiveOpsRequest({method:"saveBadge",requestId:"visual-symbol-01",reason:"Validação visual",value:{...badge,symbol}});
});
test("catalog publication is audited, idempotent and detects conflicting GM edits", async () => {
 const f = await fixture(); const req = { method: "saveAccessory" as const, value: accessory, requestId: "request-002", reason: "Festival anual" };
 assert.equal((await f.service.execute("gm", req)).replay, false);
 assert.equal((await f.service.execute("gm", req)).replay, true);
 assert.equal(f.store.all("content_audit/").length, 1);
 assert.equal(f.store.dump<{ count: number }>("content_limits/shop_accessories")!.count, 1);
 assert.equal(f.store.dump<CustomAccessory>("shop_accessories/custom-festival")!.revision, 1);
 await assert.rejects(f.service.execute("gm", { ...req, value: { ...accessory, price: 90 } }), /outros dados/);
 await assert.rejects(f.service.execute("gm", { ...req, requestId: "request-003" }), /Outro GM/);
 await f.service.execute("gm", { ...req, requestId: "request-004", value: { ...accessory, revision: 1, active: false } });
 assert.equal(f.store.dump<CustomAccessory>("shop_accessories/custom-festival")!.active, false);
});
test("badges can be granted without a save, retries do not duplicate and inactive badges cannot be granted", async () => {
 const f = await fixture();
 await f.service.execute("gm", { method: "saveBadge", value: badge, requestId: "request-010", reason: "Evento inicial" });
 const req = { method: "grantBadge" as const, targetUid: "player", badgeId: badge.id, requestId: "request-011", reason: "Participou do evento inicial" };
 await f.service.execute("gm", req); assert.equal((await f.service.execute("gm", req)).replay, true);
 assert.equal(f.store.all("users/player/badges/").length, 1);
 await assert.rejects(f.service.execute("gm", { ...req, requestId: "request-012" }), /já possui/);
 await f.service.execute("gm", { method: "saveBadge", value: { ...badge, revision: 1, name: "Evento encerrado", active: false }, requestId: "request-013", reason: "Encerrar novas concessões" });
 assert.equal(f.store.dump<{ name: string }>("users/player/badges/badge-festival")!.name, badge.name);
 await f.store.seed("users/other", {});
 await assert.rejects(f.service.execute("gm", { ...req, targetUid: "other", requestId: "request-014" }), /ativa/);
 await assert.rejects(f.service.execute("player", { ...req, targetUid: "other", requestId: "request-015" }), /Game Master/);
});
test("accessories are purchased, persisted and equipped while retired items stay owned", () => {
 let game = initialGame(); game.avatar = { ...DEFAULT_AVATAR }; game.starterChosen = true;
 game = applyLiveContent(game, { ...empty, accessories: [{ ...accessory, revision: 1 }] });
 const purchased = reduceGame(game, { type: "purchase", itemId: accessory.id });
 assert.equal(purchased.seeds, 95); assert.equal(purchased.avatar!.customAccessory!.shape, "crown"); assert.ok(isGame(purchased));
 assert.equal(reduceGame(purchased, { type: "purchase", itemId: accessory.id }), purchased);
 assert.equal(reduceGame(purchased, { type: "customize", avatar: { ...purchased.avatar!, customAccessory: { id: accessory.id, shape: "pin", color: "#000000" } } }), purchased);
 const retired = applyLiveContent(purchased, { ...empty, accessories: [{ ...accessory, active: false, revision: 2 }] });
 assert.ok(retired.ownedItems!.includes(accessory.id)); assert.ok(isGame(retired));
 assert.equal(retired.avatar!.customAccessory!.id, accessory.id);
 const noOwner = applyLiveContent(game, { ...empty, accessories: [{ ...accessory, active: false, revision: 2 }] });
 assert.equal(reduceGame(noOwner, { type: "purchase", itemId: accessory.id }), noOwner);
 assert.equal(reduceGame(game, { type: "customize", avatar: { ...DEFAULT_AVATAR, customAccessory: { id: accessory.id, shape: "crown", color: "#55aa77" } } }), game);
});
test("balance snapshots alter combat and capture thresholds without changing an ongoing battle", () => {
 let game = initialGame(); game.avatar = { ...DEFAULT_AVATAR }; game.starterChosen = true;
 const content: LiveContent = { ...empty, balance: [{ id: "WW001", hp: 80, attack: 30, defense: 10, revision: 1 }, { id: "WW002", hp: 100, attack: 5, defense: 3, revision: 1 }] };
 game = applyLiveContent(game, content);
 assert.equal(creatureMaxHp("WW001", 1, game.balance), 80);
 assert.ok(damage("WW001", "WW002", 6, "neutral", false, 1, 1, game.balance) > damage("WW001", "WW002", 6, "neutral"));
 game.battle = createBattle("balanced-test", game.collection[0]!, "WW002", true, "wild", undefined, "classic", game.balance); game.scene = "battle";
 assert.equal(game.battle.enemy.hp, 100); game.battle.enemy.hp = 50; assert.equal(canCapture(game.battle), true); assert.ok(isGame(game));
 assert.equal(applyLiveContent(game, { ...empty, balance: [{ id: "WW001", hp: 20, attack: 1, defense: 1, revision: 2 }] }), game);
 const attacked = reduceGame(game, { type: "basic", target: { ...game.battle.enemy.pos } });
 assert.ok(isGame(attacked)); assert.deepEqual(attacked.battle!.balance, game.balance);
 game.scene = "exploration"; game.battle = null; game.collection[0]!.hp = 0;
 const updated = applyLiveContent(game, { ...empty, balance: [{ id: "WW001", hp: 20, attack: 1, defense: 1, revision: 2 }] });
 assert.equal(updated.collection[0]!.hp, 0); assert.equal(updated.collection[0]!.level, game.collection[0]!.level); assert.ok(isGame(updated));
});
test("catalog capacity and balance bounds prevent unusable configurations", async () => {
 const f = await fixture(); await f.store.seed("content_limits/shop_accessories", { count: 100 });
 await assert.rejects(f.service.execute("gm", { method: "saveAccessory", value: accessory, requestId: "request-020", reason: "Mais um acessório" }), /100 registros/);
 assert.equal(f.store.all("content_audit/").length, 0);
 assert.throws(() => parseLiveOpsRequest({ method: "saveBalance", value: { id: "WW001", hp: 999, attack: 1, defense: 1, revision: 0 }, requestId: "request-021", reason: "Ajuste inválido" }));
});
