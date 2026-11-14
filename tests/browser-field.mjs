import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";

// All account and field responses are synthetic; this suite never writes Firebase.
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
await context.route(/https:\/\/.*googleapis.com\//, route => route.abort());
const page = await context.newPage(), errors = [];
page.on("pageerror", error => errors.push(error.message));
const state = () => page.evaluate(() => window.ng.getComponent(document.querySelector("ww-app")).fieldState());
async function position(x, y) {
  await page.evaluate(({ x, y }) => {
    const a = window.ng.getComponent(document.querySelector("ww-app"));
    const next = { ...a.game(), region: "clearing", player: { x, y } };
    a.session.state = next; a.game.set(next);
  }, { x, y });
}
async function approach(id) {
  const point = await page.evaluate(async id => {
    const a = window.ng.getComponent(document.querySelector("ww-app"));
    const { fieldPoints } = await import("/src/app/domain/field-world.ts");
    const { fieldCycle } = await import("/src/app/domain/field.ts");
    const { mapTile, distance, layoutIn } = await import("/src/app/domain/game.ts");
    const points = fieldPoints(a.game(), fieldCycle(a.fieldNow())), target = points.find(p => p.id === id);
    if (!target) throw new Error(`Missing field point ${id}`);
    const occupied = [...layoutIn(a.game(), "clearing").npcs, ...layoutIn(a.game(), "clearing").pots];
    for (const p of [target, { x: target.x + 1, y: target.y }, { x: target.x - 1, y: target.y }, { x: target.x, y: target.y + 1 }, { x: target.x, y: target.y - 1 }]) {
      if (!["ground", "path", "grass", "healer"].includes(mapTile(p.x, p.y)) || occupied.some(o => o.x === p.x && o.y === p.y)) continue;
      if (points.filter(other => distance(other, p) <= 1).sort((a, b) => distance(a, p) - distance(b, p))[0]?.id === id) return p;
    }
    throw new Error(`No unambiguous interaction position for ${id}`);
  }, id);
  await position(point.x, point.y);
  await page.waitForFunction(id => window.ng.getComponent(document.querySelector("ww-app")).nearFieldPoint()?.id === id, id);
}
async function collect(id) {
  await approach(id);
  const revision = (await state()).revision;
  if (id === "herb") await page.keyboard.press("e");
  else await page.locator(".context-actions button").filter({ hasText: id === "treasure" ? "Abrir · +1 cristal" : id === "cache" ? "Buscar · +1 erva" : "Coletar · +2" }).click();
  await page.waitForFunction(revision => window.ng.getComponent(document.querySelector("ww-app")).fieldState().revision > revision, revision);
}
async function openBackpack() {
  await page.getByRole("button", { name: "Abrir menu da expedição", exact: true }).click();
  await page.getByRole("navigation", { name: "Painéis da expedição", exact: true }).getByRole("button", { name: "Mochila e missão", exact: true }).click();
  await page.getByRole("heading", { name: "Mochila de campo", exact: true }).waitFor();
}
const panel = page.locator("ww-field-panel");
try {
  await mkdir("artifacts", { recursive: true });
  await page.goto(new URL("/jogar", process.env.BASE_URL ?? "http://127.0.0.1:5173").href);
  await page.waitForFunction(() => window.ng?.getComponent(document.querySelector("ww-app"))?.loaded());
  await page.evaluate(() => {
    const a = window.ng.getComponent(document.querySelector("ww-app"));
    a.receiveAccount = () => {};
    a.profile.set({ uid: "field-test", name: "Guardiã de teste", email: "field@example.invalid", photoURL: null });
    a.cloudStatus.set("saved");
  });
  await page.getByRole("button", { name: "Começar a jornada", exact: false }).click();
  await page.getByRole("button", { name: /Começar com/ }).click();
  await page.getByRole("dialog", { name: "Escolha seu Eco inicial" }).waitFor({ state: "hidden" });
  await page.evaluate(async () => {
    const a = window.ng.getComponent(document.querySelector("ww-app"));
    const { initialField, reduceField, fieldCycle } = await import("/src/app/domain/field.ts");
    const mock = { state: initialField(), now: Date.UTC(2026, 10, 14, 12), failLoad: false, failAfterCommit: false, receipts: new Map() };
    const gateway = {
      async load() {
        if (mock.failLoad) { mock.failLoad = false; throw new Error("Falha de rede simulada"); }
        return { state: structuredClone(mock.state), now: mock.now };
      },
      async execute(action, requestId) {
        if (mock.receipts.has(requestId)) return structuredClone(mock.receipts.get(requestId));
        mock.state = reduceField(mock.state, action, fieldCycle(mock.now));
        const result = { state: structuredClone(mock.state), now: mock.now };
        mock.receipts.set(requestId, result);
        if (mock.failAfterCommit) { mock.failAfterCommit = false; throw new Error("Resposta perdida após confirmação simulada"); }
        return result;
      },
    };
    window.__fieldMock = mock;
    a.field.bind("field-test", gateway); a.fieldUid = "field-test";
    await a.field.refresh();
  });

  await openBackpack();
  assert.equal(await panel.locator(".field-panel").evaluate(el => getComputedStyle(el).display), "grid");
  assert.equal(await panel.locator(".field-quest").evaluate(el => getComputedStyle(el).backgroundColor), "rgb(245, 244, 232)");
  assert.deepEqual((await state()).inventory, { herb: 0, fruit: 0, sap: 0, crystal: 0, lantern: 0 });
  await panel.locator("button:disabled").filter({ hasText: "Fabricar lanterna" }).waitFor();
  assert.equal(await panel.locator(".field-item").count(), 5);
  await panel.getByRole("button", { name: "Ferramentas", exact: true }).click();
  await page.waitForFunction(() => document.querySelectorAll("ww-field-panel .field-item").length === 1);
  await panel.getByRole("button", { name: "Recursos", exact: true }).click();
  await page.waitForFunction(() => document.querySelectorAll("ww-field-panel .field-item").length === 4);
  await panel.getByRole("button", { name: "Todos", exact: true }).click();
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => document.activeElement?.getAttribute("aria-label") === "Abrir menu da expedição");
  await position(8, 10);
  await page.locator("canvas").scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  await page.screenshot({ path: "artifacts/field-before-390.png", fullPage: true });

  await collect("herb");
  assert.equal((await state()).inventory.herb, 2);
  assert.equal(await page.locator(".context-actions button").filter({ hasText: "Recolhido · renova" }).isDisabled(), true);
  await page.evaluate(async () => { const a = window.ng.getComponent(document.querySelector("ww-app")); await a.collectField(); });
  assert.equal((await state()).inventory.herb, 2);
  await collect("sap");
  await openBackpack();
  await panel.getByRole("button", { name: "Fabricar lanterna", exact: true }).click();
  await page.waitForFunction(() => window.ng.getComponent(document.querySelector("ww-app")).fieldState().inventory.lantern === 1);
  assert.equal((await state()).inventory.herb, 0);
  assert.equal((await state()).inventory.sap, 0);
  await panel.locator("button:disabled").filter({ hasText: "Fabricar lanterna" }).waitFor();
  await page.keyboard.press("Escape");
  await position(8, 10);
  await openBackpack();
  await panel.getByRole("button", { name: "Entregar lanterna e restaurar marco", exact: true }).click();
  await page.waitForFunction(() => window.ng.getComponent(document.querySelector("ww-app")).fieldState().restored);
  assert.equal((await state()).inventory.lantern, 0);
  await panel.getByText(/Missão concluída!/).waitFor();
  await page.keyboard.press("Escape");
  await position(8, 10);
  await page.locator("canvas").scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  await page.screenshot({ path: "artifacts/field-after-390.png", fullPage: true });

  await collect("treasure");
  assert.equal((await state()).inventory.crystal, 1);
  assert.equal(await page.locator(".context-actions button").filter({ hasText: "Baú aberto" }).isDisabled(), true);
  await page.evaluate(async () => { const a = window.ng.getComponent(document.querySelector("ww-app")); await a.collectField(); });
  assert.equal((await state()).inventory.crystal, 1);
  await collect("cache");
  const previousCache = await page.evaluate(() => ({ x: window.ng.getComponent(document.querySelector("ww-app")).nearFieldPoint().x, y: window.ng.getComponent(document.querySelector("ww-app")).nearFieldPoint().y }));
  assert.equal((await state()).inventory.herb, 1);
  await page.evaluate(async () => { const a = window.ng.getComponent(document.querySelector("ww-app")); window.__fieldMock.now += 86400000; await a.refreshField(); });
  await approach("cache");
  const nextCache = await page.evaluate(() => ({ x: window.ng.getComponent(document.querySelector("ww-app")).nearFieldPoint().x, y: window.ng.getComponent(document.querySelector("ww-app")).nearFieldPoint().y }));
  assert.notDeepEqual(nextCache, previousCache);
  await collect("cache");
  assert.equal((await state()).inventory.herb, 2);
  assert.equal((await state()).inventory.fruit, 2);

  // Recover an uncertain, committed reward through its request receipt.
  await page.evaluate(() => { window.__fieldMock.failAfterCommit = true; });
  await approach("fruit");
  await page.locator(".context-actions button").filter({ hasText: "Coletar · +2" }).click();
  await page.locator(".field-feedback.online-error").waitFor();
  await page.getByRole("button", { name: "Conferir mochila", exact: true }).click();
  await page.waitForFunction(() => !window.ng.getComponent(document.querySelector("ww-app")).fieldError());
  assert.equal((await state()).inventory.fruit, 4);
  await page.evaluate(async () => { const a = window.ng.getComponent(document.querySelector("ww-app")); await a.refreshField(); });
  assert.equal((await state()).inventory.fruit, 4);
  await openBackpack();
  await page.evaluate(async () => { window.__fieldMock.failLoad = true; await window.ng.getComponent(document.querySelector("ww-app")).refreshField(); });
  await panel.getByRole("alert").filter({ hasText: "Falha de rede simulada" }).waitFor();
  await panel.getByRole("button", { name: "Tentar novamente", exact: true }).click();
  await page.waitForFunction(() => !window.ng.getComponent(document.querySelector("ww-app")).fieldError());
  for (const [width, height] of [[320, 568], [390, 844], [768, 1024], [1360, 900]]) {
    await page.setViewportSize({ width, height });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Horizontal page overflow at ${width}`);
    const drawer = page.getByRole("dialog", { name: "Menu da expedição", exact: true });
    const box = await drawer.boundingBox();
    assert.ok(box.x >= 0 && box.y >= 0 && box.x + box.width <= width + 1 && box.height <= height + 1, `Drawer bounds at ${width}`);
    assert.ok(await panel.evaluate(el => el.scrollWidth <= el.clientWidth + 1), `Backpack overflow at ${width}`);
    await panel.getByRole("button", { name: "Todos", exact: true }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: `artifacts/field-backpack-${width}.png` });
  }
  await page.keyboard.press("Escape");
  await page.getByRole("dialog", { name: "Menu da expedição", exact: true }).waitFor({ state: "hidden" });
  assert.deepEqual(errors, []);
  console.log("Field browser passed: empty bag, filters, gathering, recipe, restoration, one-time chest, rotating cache, server cycle renewal, uncertain commit recovery, recoverable load, focus and four responsive sizes.");
} catch (error) {
  console.log(await page.evaluate(() => ({ body: document.body.innerText.slice(-2200), field: window.ng?.getComponent(document.querySelector("ww-app"))?.fieldState() })).catch(() => null));
  throw error;
} finally { await browser.close(); }
