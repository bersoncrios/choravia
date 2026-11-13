import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
const browser = await chromium.launch({ timeout: 20000, executablePath: process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
await context.route(/https:\/\/.*googleapis.com\//, route => route.abort());
const page = await context.newPage(), errors = [];
page.on("pageerror", e => errors.push(e.message));
const settled = () => page.waitForFunction(() => {
  const a = window.ng.getComponent(document.querySelector("ww-app"));
  return a.accountSynchronized() && !a.expeditionSyncing() && !a.dailyBusy() && !a.dailySending && !a.session.saving;
}, null, { timeout: 20000 }).catch(async error => { console.log(await page.evaluate(() => { const a = window.ng.getComponent(document.querySelector("ww-app")); return { synchronized: a.accountSynchronized(), syncing: a.expeditionSyncing(), error: a.expeditionError(), daily: a.dailyError(), sessionError: a.session.error, ready: a.session.ready, dailySending: a.dailySending, dailyBusy: a.dailyBusy(), saving: a.session.saving }; })); throw error; });
try {
  await mkdir("artifacts", { recursive: true });
  await page.goto(new URL("/jogar", process.env.BASE_URL ?? "http://127.0.0.1:5173").href);
  await page.waitForFunction(() => window.ng?.getComponent(document.querySelector("ww-app"))?.loaded(), null, { timeout: 20000 });
  await page.evaluate(() => {
    const a = window.ng.getComponent(document.querySelector("ww-app"));
    a.receiveAccount = () => {};
    a.profile.set({ uid: "account-test", name: "Guardião", email: "test@example.invalid", photoURL: null }); a.cloudStatus.set("saved");
  });
  await page.getByRole("button", { name: "Tranças", exact: true }).click();
  await page.getByRole("button", { name: "Começar a jornada" }).click();
  await page.getByRole("button", { name: /Gotril/ }).click();
  await page.getByRole("button", { name: "Começar com Gotril" }).click();
  await page.getByRole("dialog", { name: "Escolha seu Eco inicial" }).waitFor({ state: "hidden" });
  await page.evaluate(async () => {
    const a = window.ng.getComponent(document.querySelector("ww-app"));
    const { MemoryStore } = await import("/functions/src/memory-store.ts");
    const { GameService } = await import("/src/app/domain/online-engine/service.ts");
    const service = new GameService(new MemoryStore(), { now: () => Date.now() });
    await service.execute("account-test", "bootstrap", {});
    a.testService = service;
    a.cloud = { observe() {}, async flush() {}, async retry() {}, stop() {}, status: "saved" };
    a.accountAccess = { profile: a.profile(), cloud: async () => { throw new Error("Network disabled in fixture"); } };
    a.onlinePanel.ready.set(true);
    a.onlinePanel.busy.set(false);
    a.onlinePanel.synchronizeExpedition = async world => {
      const { mapping } = await service.execute("account-test", "syncExpedition", { creatures: world.collection });
      const inventory = await service.execute("account-test", "getState", {});
      return { mapping, creatures: inventory.creatures };
    };
    a.onlinePanel.recordExpeditionDaily = (cycleId, types) => service.execute("account-test", "recordExpeditionDaily", { cycleId, types });
    a.onlinePanel.loadDailyBoard = () => service.execute("account-test", "getDailyBoard", {});
    a.onlinePanel.acknowledgeDailyRewards = receiptIds => service.execute("account-test", "ackDailyRewards", { receiptIds });
    const game = structuredClone(a.game()); game.seeds = 300; game.region = "old-grove"; game.resonanceStep = 1;
    await a.session.replaceState(game);
    await a.synchronizeAccountExpedition();
  });
  await settled();
  const initial = await page.evaluate(() => window.ng.getComponent(document.querySelector("ww-app")).game());
  assert.equal(initial.collection.length, 1);
  assert.equal(initial.collection[0].speciesId, "WW003");
  assert.equal(initial.collection[0].provenance, "validated");
  assert.equal(initial.avatar.hair, "braids"); assert.equal(initial.seeds, 300);
  assert.equal(initial.region, "old-grove"); assert.equal(initial.resonanceStep, 1);
  assert.equal(await page.getByRole("button", { name: /Explorar online|Voltar ao jogo local|Jogar trilhas online|Jogar sem salvar/ }).count(), 0);
  assert.equal(await page.getByText(/coleção local continua separada|EXPEDIÇÃO PESSOAL/).count(), 0);
  // A slow inventory refresh must not lock exploration or discard a new capture.
  const background = await page.evaluate(async () => {
    const a = window.ng.getComponent(document.querySelector("ww-app"));
    const original = a.onlinePanel.synchronizeExpedition;
    let release;
    const waiting = new Promise(resolve => { release = resolve; });
    let entered;
    const started = new Promise(resolve => { entered = resolve; });
    a.onlinePanel.synchronizeExpedition = async world => {
      const response = await original(world);
      entered(); await waiting;
      return response;
    };
    const refresh = a.synchronizeAccountExpedition();
    await started;
    const busy = a.busy();
    const before = structuredClone(a.game());
    // Select a passable neighboring tile in the pure game rules.
    const { reduceGame } = await import("/src/app/domain/game.ts");
    const walk = [{ dx: 1, dy: 0 }, { dx: -1, dy: 0 }, { dx: 0, dy: 1 }, { dx: 0, dy: -1 }]
      .map(d => ({ type: "walk", ...d })).find(command => {
        const next = reduceGame(before, command);
        return next.scene === "exploration" && (next.player.x !== before.player.x || next.player.y !== before.player.y);
      });
    if (!walk) throw new Error("Fixture needs a passable neighboring tile");
    await a.send(walk);
    const moved = JSON.stringify(a.game().player) !== JSON.stringify(before.player);
    const current = structuredClone(a.session.state);
    current.collection.push({ ...current.collection[0], id: "background-new-capture", provenance: "local" });
    await a.session.replaceState(current);
    release(); await refresh;
    a.onlinePanel.synchronizeExpedition = original;
    const preserved = a.game().collection.some(c => c.id === "background-new-capture");
    const automaticRetry = !!a.expeditionRetryTimer;
    await a.synchronizeAccountExpedition();
    return { busy, moved, preserved, automaticRetry, error: a.expeditionError() };
  });
  assert.equal(background.busy, false, "background refresh must not disable controls");
  assert.equal(background.moved, true, "walking must continue during refresh");
  assert.equal(background.preserved, true, "an older response must preserve a new capture");
  assert.equal(background.automaticRetry, true, "changed collection must schedule automatic retry");
  assert.equal(background.error, "");
  assert.equal(await page.getByRole("button", { name: "Tentar sincronizar", exact: true }).count(), 0);
  await settled();
  const transient = await page.evaluate(async () => {
    const a = window.ng.getComponent(document.querySelector("ww-app"));
    const original = a.onlinePanel.synchronizeExpedition;
    a.onlinePanel.synchronizeExpedition = async () => { throw new Error("Temporary inventory outage"); };
    try {
      await a.synchronizeAccountExpedition();
      const failed = {
        synchronized: a.accountSynchronized(),
        busy: a.busy(),
        automaticRetry: !!a.expeditionRetryTimer,
      };
      a.onlinePanel.synchronizeExpedition = original;
      await a.synchronizeAccountExpedition();
      return { ...failed, recovered: a.accountSynchronized(), error: a.expeditionError() };
    } finally {
      a.onlinePanel.synchronizeExpedition = original;
    }
  });
  assert.equal(transient.synchronized, true, "a transient refresh failure must preserve the ready expedition");
  assert.equal(transient.busy, false, "a transient refresh failure must keep controls available");
  assert.equal(transient.automaticRetry, true, "a transient refresh failure must schedule automatic retry");
  assert.equal(transient.recovered, true);
  assert.equal(transient.error, "");
  await settled();
  await page.getByRole("button", { name: "Loja", exact: true }).click();
  await page.getByRole("dialog", { name: "Loja da Clareira" }).getByRole("button", { name: "65 ✦", exact: true }).click();
  await page.getByRole("button", { name: "Equipado: Capa de samambaia", exact: true }).waitFor();
  await page.keyboard.press("Escape");
  await page.evaluate(async () => {
    const a = window.ng.getComponent(document.querySelector("ww-app"));
    const { createBattle } = await import("/src/app/domain/game.ts");
    const g = structuredClone(a.game()); g.scene = "battle"; g.encountered++;
    g.battle = createBattle("local-unified", g.collection[0], "WW001", true, "wild", undefined, "classic");
    await a.session.replaceState(g);
  });
  for (const action of [/Defender/, /Jato d’água/, /Atacar/]) {
    await page.getByRole("button", { name: action }).click();
    await page.getByRole("button", { name: "Acelerar", exact: true }).click();
    await page.waitForFunction(() => window.ng.getComponent(document.querySelector("ww-app")).turnPhase() === "choice");
    await settled();
  }
  await page.getByRole("button", { name: /Vínculo 100%/ }).click();
  await page.getByRole("button", { name: "Acelerar", exact: true }).click();
  await page.getByRole("button", { name: /Continuar explorando/ }).waitFor();
  await settled();
  const completed = await page.evaluate(() => {
    const a = window.ng.getComponent(document.querySelector("ww-app"));
    return { game: a.game(), board: a.dailyBoard(), error: a.expeditionError() };
  });
  assert.equal(completed.error, ""); assert.equal(completed.game.collection.length, 3);
  assert.ok(completed.game.collection.every(c => c.provenance === "validated"));
  assert.ok(completed.board.contracts.every(c => c.completed), "single expedition actions must complete all selected daily tasks");
  assert.equal(completed.board.completionBonusEarned, true);
  assert.equal(completed.game.region, "old-grove"); assert.equal(completed.game.resonanceStep, 1);
  const balance = completed.game.seeds;
  await page.evaluate(async () => { const a = window.ng.getComponent(document.querySelector("ww-app")); await a.synchronizeAccountExpedition(); await a.refreshDailyBoard(); });
  await settled();
  assert.equal(await page.evaluate(() => window.ng.getComponent(document.querySelector("ww-app")).game().seeds), balance, "retries must not duplicate rewards");
  await page.getByRole("button", { name: /Continuar explorando/ }).click();
  await page.waitForFunction(() => window.ng.getComponent(document.querySelector("ww-app")).game().scene === "exploration");
  const position = await page.evaluate(() => window.ng.getComponent(document.querySelector("ww-app")).game().player);
  await page.evaluate(() => window.dispatchEvent(new Event("offline")));
  await page.getByText("Sem conexão — expedição pausada", { exact: true }).waitFor();
  await page.keyboard.press("w");
  assert.deepEqual(await page.evaluate(() => window.ng.getComponent(document.querySelector("ww-app")).game().player), position);
  await page.evaluate(() => { const a = window.ng.getComponent(document.querySelector("ww-app")); a.connectionAvailable.set(true); a.sync(); });
  await page.evaluate(async () => {
    const a = window.ng.getComponent(document.querySelector("ww-app"));
    const { createBattle, reduceGame } = await import("/src/app/domain/game.ts");
    const battle = structuredClone(a.session.state); battle.scene = "battle";
    battle.battle = createBattle("legacy-online-resume", battle.collection.find(c => c.id === battle.activeId), "WW002", false, "wild", undefined, "classic");
    a.onlineMode.set(true); a.accountSynchronized.set(false); a.game.set(battle); a.busy.set(false);
    a.onlinePanel.dispatch = async command => { a.receiveOnlineView(reduceGame(a.game(), command)); };
  });
  await page.getByRole("button", { name: /Atacar/ }).click();
  await page.getByRole("button", { name: "Acelerar", exact: true }).click();
  assert.equal(await page.evaluate(() => window.ng.getComponent(document.querySelector("ww-app")).game().battle.round), 2);
  await page.getByRole("button", { name: /Fugir/, exact: false }).click();
  await page.getByRole("button", { name: "Acelerar", exact: true }).click();
  await page.getByRole("button", { name: /Continuar explorando/ }).click();
  await settled();
  assert.equal(await page.evaluate(() => window.ng.getComponent(document.querySelector("ww-app")).onlineMode()), false);
  assert.equal(await page.evaluate(() => window.ng.getComponent(document.querySelector("ww-app")).game().region), "old-grove");
  for (const [width,height] of [[320,568],[390,844],[768,1024],[1360,900]]) {
    await page.setViewportSize({ width,height });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    const menu = page.getByRole("button", { name: "Abrir menu da expedição", exact: true });
    assert.equal(await page.getByRole("dialog", { name: "Menu da expedição", exact: true }).count(), 0);
    await menu.click();
    const drawer = page.getByRole("dialog", { name: "Menu da expedição", exact: true });
    const bounds = await drawer.boundingBox();
    assert.ok(bounds.x >= 0 && bounds.y >= 0 && bounds.x + bounds.width <= width + 1 && bounds.height <= height + 1);
    const position = await page.evaluate(() => window.ng.getComponent(document.querySelector("ww-app")).game().player);
    await page.keyboard.press("w");
    assert.deepEqual(await page.evaluate(() => window.ng.getComponent(document.querySelector("ww-app")).game().player), position, "drawer must block map shortcuts");
    await page.getByRole("button", { name: "Trilhas do dia", exact: true }).click();
    await page.getByRole("region", { name: "Desafios diários", exact: true }).waitFor();
    assert.ok(await page.locator(".daily-challenges").evaluate(el => el.getBoundingClientRect().width > el.parentElement.getBoundingClientRect().width * .9));
    await page.screenshot({ path: `artifacts/drawer-daily-${width}.png` });
    await page.getByRole("button", { name: "Conta e trocas", exact: true }).click();
    await page.getByRole("region", { name: "Conta e trocas", exact: true }).waitFor();
    await page.keyboard.press("Tab");
    assert.ok(await drawer.evaluate(el => el.contains(document.activeElement)), "focus stays inside drawer");
    await page.getByRole("button", { name: "Fechar menu da expedição", exact: true }).click();
    await page.waitForFunction(() => document.activeElement?.getAttribute("aria-label") === "Abrir menu da expedição");
    await page.screenshot({ path: `artifacts/account-expedition-${width}.png`, fullPage: true });
  }
  assert.deepEqual(errors, []);
  console.log("Single account expedition passed: Google gate, starter migration, world/appearance preservation, store, capture, unified daily rewards, idempotence, connection pause and responsive UI.");
} finally { await browser.close(); }
