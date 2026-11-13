import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";

// Development-only Angular fixture: exercise real local commands and IndexedDB,
// without signing in or creating Firebase users. Never ship an auth bypass.
console.log("Launching browser…");
const browser = await chromium.launch({ timeout: 20000, executablePath: process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true });
console.log("Browser ready");
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
await context.route(/https:\/\/.*googleapis.com\//, route => route.abort());
const page = await context.newPage();
const errors = [];
page.on("pageerror", error => errors.push(error.message));
const app = (fn) => page.evaluate(fn);
const boot = async () => {
  console.log("Loading game…");
  await page.goto(new URL("/jogar", process.env.BASE_URL ?? "http://127.0.0.1:5173").href);
  await page.waitForFunction(() => window.ng?.getComponent(document.querySelector("ww-app"))?.loaded(), null, { timeout: 20000 }).catch(async error => { console.log(await page.evaluate(() => ({ ng: !!window.ng, text: document.body.innerText.slice(0, 500) }))); throw error; });
  await app(() => {
    const a = window.ng.getComponent(document.querySelector("ww-app"));
    a.receiveAccount = () => {};
    a.profile.set({ uid: "ui-test", name: "Guardião de nome longo para teste", email: "ui@example.invalid", photoURL: null });
    a.cloudStatus.set("offline");
  });
};
const state = () => app(() => JSON.parse(JSON.stringify(window.ng.getComponent(document.querySelector("ww-app")).game())));
const noOverflow = async () => {
  const overflow = await page.evaluate(() => ({ width: innerWidth, total: document.documentElement.scrollWidth, elements: Array.from(document.querySelectorAll("body *")).filter(el => el.getBoundingClientRect().right > innerWidth + 1).slice(0, 10).map(el => el.className) }));
  assert.ok(overflow.total <= overflow.width, JSON.stringify(overflow));
};
try {
  await mkdir("artifacts", { recursive: true });
  await boot();
  await page.getByRole("button", { name: "Começar a jornada" }).click();
  await page.getByRole("button", { name: "Começar com" }).click();
  await page.getByRole("dialog", { name: "Escolha seu Eco inicial" }).waitFor({ state: "hidden" });
  await page.getByLabel("Objetivo atual").getByText("Forme seu primeiro vínculo", { exact: true }).waitFor();
  const before = await state();
  const openWardrobe = async () => {
    await page.getByRole("button", { name: "Abrir configurações" }).click();
    await page.getByRole("dialog", { name: "Configurações", exact: true }).waitFor();
    await page.getByRole("button", { name: "Mudar aparência", exact: true }).click();
  };
  await openWardrobe();
  const wardrobe = page.getByRole("dialog", { name: "Mudar aparência", exact: true });
  await wardrobe.getByRole("button", { name: "Rio", exact: true }).click();
  await wardrobe.getByRole("button", { name: "Cancelar", exact: true }).click();
  assert.deepEqual(await state(), before, "cancel must leave expedition unchanged");
  await page.getByRole("button", { name: "Mudar aparência", exact: true }).click();
  await wardrobe.getByRole("button", { name: "Musgo", exact: true }).waitFor();
  assert.equal(await wardrobe.getByRole("button", { name: "Musgo", exact: true }).getAttribute("aria-pressed"), "true");
  await wardrobe.getByRole("button", { name: "Rio", exact: true }).click();
  await wardrobe.getByRole("button", { name: "Bolsa", exact: true }).click();
  await wardrobe.getByRole("button", { name: "Salvar aparência", exact: true }).click();
  await wardrobe.waitFor({ state: "hidden" });
  const saved = await state();
  assert.equal(saved.avatar.outfit, "river");
  assert.equal(saved.avatar.accessory, "satchel");
  for (const key of ["collection", "activeId", "player", "rng", "seeds", "starterChosen", "scene"])
    assert.deepEqual(saved[key], before[key], `${key} must survive customization`);
  await page.keyboard.press("Escape");
  await boot();
  assert.equal((await state()).avatar.outfit, "river", "appearance persists on reload");
  for (const [width, height] of [[320,568], [360,640], [390,844], [768,1024], [1024,768], [1360,900], [667,375]]) {
    await page.setViewportSize({ width, height });
    await noOverflow();
    await page.getByRole("button", { name: "Abrir configurações" }).click();
    const settings = page.getByRole("dialog", { name: "Configurações", exact: true });
    await settings.waitFor();
    const bounds = await settings.boundingBox();
    assert.ok(bounds.x >= 0 && bounds.y >= 0 && bounds.x + bounds.width <= width + 1 && bounds.y + bounds.height <= height + 1);
    await page.getByRole("button", { name: "Mudar aparência", exact: true }).click();
    assert.equal(await wardrobe.getByRole("button", { name: "Rio", exact: true }).getAttribute("aria-pressed"), "true", "editor uses equipped appearance");
    await wardrobe.getByRole("button", { name: "Cancelar", exact: true }).focus();
    await page.keyboard.press("Tab");
    assert.ok(await wardrobe.evaluate(el => el.contains(document.activeElement)), "focus stays in wardrobe");
    await page.keyboard.press("Escape");
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Abrir menu da expedição", exact: true }).click();
    await page.getByRole("button", { name: /Seus Ecos/ }).click();
    const collection = page.getByRole("dialog", { name: "Coleção de Ecos" });
    await collection.waitFor();
    await noOverflow();
    const position = (await state()).player;
    await page.keyboard.press("w");
    assert.deepEqual((await state()).player, position, "dialog blocks map commands");
    await page.keyboard.press("Escape");
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Loja", exact: true }).click();
    await page.getByRole("dialog", { name: "Loja da Clareira" }).waitFor();
    await noOverflow();
    await page.keyboard.press("w");
    assert.deepEqual((await state()).player, position, "store blocks map commands");
    await page.screenshot({ path: `artifacts/ui-store-${width}.png` });
    await page.keyboard.press("Escape");
    await page.screenshot({ path: `artifacts/ui-${width}.png`, fullPage: true });
  }
  await page.getByRole("button", { name: "Loja", exact: true }).click();
  const store = page.getByRole("dialog", { name: "Loja da Clareira" });
  const cloak = store.locator("article").filter({ has: page.getByRole("heading", { name: "Capa de samambaia" }) });
  await cloak.getByRole("button", { name: "65 ✦", exact: true }).click();
  const equipped = page.getByRole("button", { name: "Equipado: Capa de samambaia", exact: true });
  await equipped.waitFor();
  assert.equal((await state()).seeds, saved.seeds - 65);
  await equipped.click();
  await wardrobe.getByRole("button", { name: "Rio", exact: true }).click();
  await wardrobe.getByRole("button", { name: "Salvar aparência", exact: true }).click();
  await wardrobe.waitFor({ state: "hidden" });
  const experiment = page.getByRole("button", { name: "Experimentar: Capa de samambaia", exact: true });
  await experiment.waitFor();
  const purchased = await state();
  await experiment.click();
  assert.equal(await wardrobe.getByRole("button", { name: "Capa de samambaia", exact: true }).getAttribute("aria-pressed"), "true");
  await wardrobe.getByRole("button", { name: "Cancelar", exact: true }).click();
  await wardrobe.waitFor({ state: "hidden" });
  await store.waitFor();
  assert.deepEqual(await state(), purchased, "cancel from store must preserve equipped appearance");
  await experiment.click();
  await wardrobe.getByRole("button", { name: "Salvar aparência", exact: true }).click();
  await wardrobe.waitFor({ state: "hidden" });
  await page.getByRole("button", { name: "Equipado: Capa de samambaia", exact: true }).waitFor();
  assert.equal((await state()).avatar.outfit, "cloak");
  assert.equal((await state()).seeds, purchased.seeds, "equipping must not charge again");
  await page.keyboard.press("Escape");
  await app(async () => {
    const a = window.ng.getComponent(document.querySelector("ww-app"));
    const { createBattle } = await import("/src/app/domain/game.ts");
    const g = structuredClone(a.game());
    g.encountered += 1;
    g.scene = "battle";
    g.battle = createBattle("local-ui", g.collection[0], "WW002", false);
    await a.session.replaceState(g);
  });
  await page.setViewportSize({ width: 320, height: 568 });
  await page.getByRole("grid", { name: /Arena tática/ }).waitFor();
  await noOverflow();
  await page.getByRole("button", { name: /Atacar/ }).click();
  await page.getByLabel("Dica da ação selecionada").getByText(/ataque básico é neutro/).waitFor();
  await page.getByRole("button", { name: /Faísca/ }).click();
  await page.getByLabel("Dica da ação selecionada").getByText(/Vantagem elemental · ×1,5/).waitFor();
  const round = (await state()).battle.round;
  await page.getByRole("button", { name: /Defender/ }).click();
  await page.waitForFunction(previous => window.ng.getComponent(document.querySelector("ww-app")).game().battle.round > previous, round);
  await page.screenshot({ path: "artifacts/ui-battle-320.png", fullPage: true });
  await app(async () => {
    const a = window.ng.getComponent(document.querySelector("ww-app"));
    const g = structuredClone(a.game());
    g.scene = "result";
    g.battle.result = "fled";
    g.message = "A trilha continua. Você pode recuperar seu Eco e voltar a explorar a floresta quando estiver pronto.";
    await a.session.replaceState(g);
  });
  for (const [width, height] of [[320, 568], [667, 375]]) {
    await page.setViewportSize({ width, height });
    const next = page.getByRole("button", { name: /Continuar explorando/ });
    await next.scrollIntoViewIfNeeded();
    await next.click({ trial: true });
    const reachable = await next.evaluate(el => {
      const button = el.getBoundingClientRect(), container = el.closest(".viewport").getBoundingClientRect();
      return button.top >= container.top && button.bottom <= container.bottom + 1;
    });
    assert.ok(reachable, "result action must be reachable inside canvas overlay");
    await page.screenshot({ path: `artifacts/ui-result-${width}.png` });
  }
  await page.getByRole("button", { name: /Continuar explorando/ }).click();
  await page.waitForFunction(() => window.ng.getComponent(document.querySelector("ww-app")).game().scene === "exploration");
  // Role updates use the real panel lifecycle with a fake subscription (no Firebase users).
  await app(() => {
    const a = window.ng.getComponent(document.querySelector("ww-app")), panel = a.onlinePanel;
    panel.unsubscribeAccount?.(); panel.unsubscribeAccount = undefined;
    panel.stopGameMasterAccess();
    a.testRoleWatches = [];
    panel.client = {
      signedIn: true, anonymous: false,
      async syncUserProfile() {},
      watchLiveContent() { return () => {}; },
      watchGameMasterRole(uid, changed, failed) {
        const watch = { uid, changed, failed, stopped: false };
        a.testRoleWatches.push(watch);
        return () => { watch.stopped = true; };
      },
    };
    panel.publishAccount({ profile: a.profile(), cloud: async () => { throw new Error("Unused fixture"); } });
    a.testRoleWatches.at(-1).failed(new Error("Temporary role read failure"));
  });
  assert.equal(await page.getByRole("button", { name: "GM", exact: true }).count(), 0);
  await page.getByRole("button", { name: "Abrir menu da expedição", exact: true }).click();
  await page.getByRole("button", { name: "Conta e trocas", exact: true }).click();
  await page.getByText(/Não foi possível verificar o acesso Game Master/).waitFor();
  await page.getByRole("button", { name: "Verificar acesso Game Master", exact: true }).click();
  await app(() => window.ng.getComponent(document.querySelector("ww-app")).testRoleWatches.at(-1).changed(true));
  await page.getByRole("button", { name: "Game Master", exact: true }).click();
  await page.getByRole("dialog", { name: "Painel Game Master", exact: true }).waitFor();
  await app(() => window.ng.getComponent(document.querySelector("ww-app")).testRoleWatches.at(-1).changed(false));
  await page.getByRole("dialog", { name: "Painel Game Master", exact: true }).waitFor({ state: "hidden" });
  assert.equal(await page.getByRole("button", { name: "Game Master", exact: true }).count(), 0);
  const roleIsolation = await app(() => {
    const a = window.ng.getComponent(document.querySelector("ww-app")), panel = a.onlinePanel;
    const old = a.testRoleWatches.at(-1);
    panel.publishAccount({ profile: { ...a.profile(), uid: "other-role-account" }, cloud: async () => { throw new Error("Unused fixture"); } });
    old.changed(true);
    const staleIgnored = !a.gameMaster() && old.stopped;
    a.testRoleWatches.at(-1).changed(true);
    panel.publishAccount(null);
    return staleIgnored && !a.gameMaster() && a.testRoleWatches.at(-1).stopped;
  });
  assert.ok(roleIsolation, "account switch/logout must cancel the role listener and ignore stale admin callbacks");
  await page.keyboard.press("Escape");
  assert.deepEqual(errors, []);
  console.log("UI passed: 7 viewports, objectives, store purchase/equipped/preview/cancel/save, wardrobe persistence, dialogs/focus, blocked map commands, combat tips, battle action, reachable results and Game Master role recovery/revocation/account isolation.");
} finally { await browser.close(); }
