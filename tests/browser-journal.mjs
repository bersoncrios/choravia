import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";

// Synthetic identity and local game commands only; never writes to Firebase.
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
await context.route(/https:\/\/.*googleapis.com\//, route => route.abort());
const page = await context.newPage(), errors = [];
page.on("pageerror", error => errors.push(error.message));
const panel = page.locator("ww-journal-panel");
const drawer = page.getByRole("dialog", { name: "Menu da expedição", exact: true });
async function openJournal() {
  await page.getByRole("button", { name: "Abrir menu da expedição", exact: true }).click();
  await page.locator(".drawer-navigation").getByRole("button", { name: "Mapa e diário", exact: true }).click();
  await panel.getByRole("heading", { name: "Diário de exploração", exact: true }).waitFor();
}
async function mapSection() {
  await panel.getByRole("button", { name: "Mapa de regiões", exact: true }).click();
  await panel.locator(".journal-route").waitFor();
}
async function ecoSection() {
  await panel.getByRole("button", { name: "Diário dos Ecos", exact: true }).click();
  await panel.locator(".journal-ecos").waitFor();
}
try {
  await mkdir("artifacts", { recursive: true });
  await page.goto(new URL("/jogar", process.env.BASE_URL ?? "http://127.0.0.1:5173").href);
  await page.waitForFunction(() => window.ng?.getComponent(document.querySelector("ww-app"))?.loaded());
  await page.evaluate(() => {
    const a = window.ng.getComponent(document.querySelector("ww-app"));
    a.receiveAccount = () => {};
    a.profile.set({ uid: "journal-test", name: "Guardiã de teste", email: "journal@example.invalid", photoURL: null });
    a.cloudStatus.set("saved");
  });
  await page.getByRole("button", { name: "Começar a jornada", exact: false }).click();
  await page.getByRole("button", { name: /Começar com/ }).click();
  await page.getByRole("dialog", { name: "Escolha seu Eco inicial" }).waitFor({ state: "hidden" });
  await openJournal();
  await panel.getByText("1 / 5 regiões visitadas · 1 / 6 espécies observadas", { exact: true }).waitFor();
  assert.equal(await panel.locator(".journal").evaluate(el => getComputedStyle(el).display), "grid");
  assert.equal(await panel.locator(".journal-region").first().evaluate(el => getComputedStyle(el).backgroundColor), "rgb(245, 244, 232)");
  assert.equal(await panel.locator('.journal-region[aria-current="location"]').count(), 1);
  assert.deepEqual(await panel.locator(".journal-region h4").allTextContents(), ["Clareira do Primeiro Canto", "Clareira Antiga", "Trilha das Copas", "Gruta das Marés", "Brejo dos Pirilampos"]);
  assert.match(await panel.locator(".journal-region").last().innerText(), /Próximo portal → Clareira do Primeiro Canto/);
  assert.equal(await panel.getByText("Ainda não visitada", { exact: true }).count(), 4);
  await ecoSection();
  assert.equal(await panel.getByRole("heading", { name: "Eco ainda não observado", exact: true }).count(), 5);
  await panel.getByRole("heading", { name: "Braseco", exact: true }).waitFor();
  assert.equal(await panel.getByRole("heading", { name: "Gotril", exact: true }).count(), 0);
  assert.equal(await panel.getByText("Jato d’água", { exact: true }).count(), 0);

  // A real portal walk records the destination without a synthetic journal write.
  await page.evaluate(async () => {
    const a = window.ng.getComponent(document.querySelector("ww-app"));
    const { reduceGame, REGION_PORTALS } = await import("/src/app/domain/game.ts");
    const portal = REGION_PORTALS.clearing;
    const before = { ...a.game(), player: { x: portal.position.x - 1, y: portal.position.y } };
    const next = reduceGame(before, { type: "walk", dx: 1, dy: 0 });
    if (next.region !== "old-grove") throw new Error("Portal command failed");
    a.session.state = next; a.game.set(next);
  });
  await mapSection();
  await panel.getByText("2 / 5 regiões visitadas · 1 / 6 espécies observadas", { exact: true }).waitFor();
  assert.match(await panel.locator('.journal-region[aria-current="location"]').innerText(), /Clareira Antiga/);

  // A real NPC challenge observes a species; JSON recovery retains it while not owning it.
  const observedName = await page.evaluate(async () => {
    const a = window.ng.getComponent(document.querySelector("ww-app"));
    const { reduceGame, layoutIn, mapTile, species } = await import("/src/app/domain/game.ts");
    const { isGame } = await import("/src/app/domain/save-validation.ts");
    const g = a.game(), layout = layoutIn(g, "old-grove");
    const npc = layout.npcs.find(n => !g.collection.some(c => c.speciesId === n.speciesId));
    if (!npc) throw new Error("Expected an unowned NPC species");
    const position = [{x:npc.x-1,y:npc.y},{x:npc.x+1,y:npc.y},{x:npc.x,y:npc.y-1},{x:npc.x,y:npc.y+1}].find(p => ["ground","path","grass","healer"].includes(mapTile(p.x,p.y,"old-grove")) && !layout.npcs.some(n => n.x===p.x && n.y===p.y));
    if (!position) throw new Error("NPC has no reachable approach");
    const started = reduceGame({...g, player:position}, {type:"challengeNpc",npcId:npc.id});
    if (started.scene !== "battle") throw new Error("NPC command failed");
    const recovered = JSON.parse(JSON.stringify(started));
    if (!isGame(recovered)) throw new Error("Recovered journal snapshot invalid");
    a.session.state = recovered; a.game.set(recovered);
    return species(npc.speciesId).name;
  });
  await ecoSection();
  await panel.getByText("2 / 5 regiões visitadas · 2 / 6 espécies observadas", { exact: true }).waitFor();
  await panel.getByRole("heading", { name: observedName, exact: true }).waitFor();
  assert.equal(await panel.getByRole("heading", { name: "Eco ainda não observado", exact: true }).count(), 4);
  await panel.getByRole("button", { name: "Observados", exact: true }).click();
  await page.waitForFunction(() => document.querySelectorAll("ww-journal-panel .journal-eco").length === 2);
  await panel.getByRole("button", { name: "Na coleção", exact: true }).click();
  await page.waitForFunction(() => document.querySelectorAll("ww-journal-panel .journal-eco").length === 1);
  await panel.getByRole("heading", { name: "Braseco", exact: true }).waitFor();
  assert.equal(await panel.getByRole("heading", { name: observedName, exact: true }).count(), 0);
  await panel.getByRole("button", { name: "Todos", exact: true }).click();
  await page.waitForFunction(() => document.querySelectorAll("ww-journal-panel .journal-eco").length === 6);
  await page.locator(".feedback-toast").waitFor({state:"hidden"});

  for (const [width, height] of [[320,568],[390,844],[768,1024],[1360,900]]) {
    await page.setViewportSize({width,height});
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Page overflow at ${width}`);
    const box = await drawer.boundingBox();
    assert.ok(box.x >= 0 && box.y >= 0 && box.x+box.width <= width+1 && box.height <= height+1, `Drawer bounds at ${width}`);
    assert.ok(await panel.evaluate(el => el.scrollWidth <= el.clientWidth+1), `Journal overflow at ${width}`);
    await panel.locator(".journal-eco").first().evaluate(el => el.scrollIntoView({block:"start"}));
    await page.screenshot({path:`artifacts/journal-ecos-${width}.png`});
    await mapSection();
    await panel.locator('.journal-region[aria-current="location"]').evaluate(el => el.scrollIntoView({block:"start"}));
    await page.screenshot({path:`artifacts/journal-map-${width}.png`});
    await ecoSection();
  }
  await page.keyboard.press("Escape");
  await drawer.waitFor({state:"hidden"});
  await page.waitForFunction(() => document.activeElement?.getAttribute("aria-label") === "Abrir menu da expedição");
  await page.evaluate(() => {
    const a = window.ng.getComponent(document.querySelector("ww-app"));
    const marsh = {...a.game(), region:"firefly-marsh", scene:"exploration", battle:null, player:{x:10,y:10}};
    a.session.state = marsh; a.game.set(marsh);
  });
  await page.waitForFunction(() => window.ng.getComponent(document.querySelector("ww-app")).game().region === "firefly-marsh");
  await page.waitForTimeout(180);
  await page.locator("canvas").screenshot({path:"artifacts/firefly-marsh.png"});
  assert.deepEqual(errors, []);
  console.log("Journal browser passed: five-region circuit, six Ecos, hidden discoveries, real portal/NPC commands, focus, four responsive sizes and Brejo Canvas capture.");
} catch (error) {
  console.log(await page.evaluate(() => ({body:document.body.innerText.slice(-2500),errors:[]})).catch(() => null));
  throw error;
} finally { await browser.close(); }
