import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
const browser = await chromium.launch({ timeout: 20000, executablePath: process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
await context.route(/https:\/\/.*googleapis.com\//, route => route.abort());
const page = await context.newPage(), errors = [];
page.on("pageerror", e => errors.push(e.message));
try {
  await mkdir("artifacts", { recursive: true });
  await page.goto(new URL("/jogar", process.env.BASE_URL ?? "http://127.0.0.1:5173").href);
  await page.waitForFunction(() => window.ng?.getComponent(document.querySelector("ww-app"))?.loaded(), null, { timeout: 20000 }).catch(async error => { console.log(await page.locator("body").innerText()); throw error; });
  await page.evaluate(() => {
    const a = window.ng.getComponent(document.querySelector("ww-app"));
    a.receiveAccount = () => {};
    a.profile.set({ uid: "hair-daily-test", name: "Guardião", email: "test@example.invalid", photoURL: null }); a.cloudStatus.set("offline");
  });
  await page.getByRole("button", { name: "Começar a jornada" }).click();
  await page.getByRole("button", { name: "Começar com" }).click();
  await page.getByRole("dialog", { name: "Escolha seu Eco inicial" }).waitFor({ state: "hidden" });
  await page.getByRole("button", { name: "Abrir configurações" }).click();
  await page.getByRole("button", { name: "Mudar aparência", exact: true }).click();
  await page.getByRole("button", { name: "Longo", exact: true }).click();
  const long = await page.locator(".avatar-preview").screenshot({ path: "artifacts/hair-long.png" });
  await page.getByRole("button", { name: "Tranças", exact: true }).click();
  const braids = await page.locator(".avatar-preview").screenshot({ path: "artifacts/hair-braids.png" });
  assert.notDeepEqual(long, braids, "preview styles must differ");
  await page.getByRole("button", { name: "Salvar aparência", exact: true }).click();
  await page.getByRole("dialog", { name: "Mudar aparência", exact: true }).waitFor({ state: "hidden" });
  await page.keyboard.press("Escape");
  assert.equal(await page.evaluate(() => window.ng.getComponent(document.querySelector("ww-app")).game().avatar.hair), "braids");
  const canvasDifferent = await page.evaluate(() => {
    const a = window.ng.getComponent(document.querySelector("ww-app")), r = a.renderer, g = structuredClone(a.game()), canvas = document.querySelector("canvas");
    return ["up", "down", "left", "right"].every(direction => {
      r.last = g; r.previousPlayer = { ...g.player }; r.facing = direction;
      g.avatar.hair = "long"; r.draw(g, 1000, true, "move"); const first = canvas.toDataURL();
      g.avatar.hair = "braids"; r.draw(g, 1000, true, "move"); return first !== canvas.toDataURL();
    });
  });
  assert.ok(canvasDifferent, "map styles must differ in all directions");
  const checks = await page.evaluate(async () => {
    const a = window.ng.getComponent(document.querySelector("ww-app"));
    const seedBoard = {
      cycleId: "2026-11-13", resetAt: Date.now() + 3600000,
      contracts: [
        { id: "resolve-encounter", title: "Encontro concluído", description: "Conclua um encontro na expedição online.", rewardSeeds: 12, target: 1, progress: 0, completed: false },
        { id: "move-in-battle", title: "Use sua estratégia", description: "Use habilidade na expedição online.", rewardSeeds: 6, target: 1, progress: 0, completed: false },
        { id: "basic-attack", title: "Treino de precisão", description: "Use ataque básico na expedição online.", rewardSeeds: 8, target: 1, progress: 0, completed: false }
      ], completionBonusSeeds: 8, completionBonusEarned: false,
      weekly: { qualifiedDays: 0, requiredDays: 4, completed: false, rewardItemId: null }, pendingRewards: []
    };
    const complete = structuredClone(seedBoard);
    complete.contracts[2].completed = true; complete.contracts[2].progress = 1;
    complete.pendingRewards = [{ receiptId: "daily:2026-11-13:basic-attack", seeds: 8 }];
    let acks = 0;
    a.onlinePanel.loadDailyBoard = async () => structuredClone(complete);
    a.onlinePanel.acknowledgeDailyRewards = async () => { acks++; };
    const balance = a.session.state.seeds;
    a.cloud = { observe() {}, async flush() {}, status: "pending" };
    await a.refreshDailyBoard();
    const visibleDuringFailure = a.dailyBoard().contracts[2].completed && !!a.dailyError();
    const firstBalance = a.session.state.seeds;
    a.cloud.status = "saved";
    await a.refreshDailyBoard();
    const retriedOnce = a.session.state.seeds === firstBalance && firstBalance === balance + 8 && acks === 1 && !a.dailyError();
    a.cloud = null;
    let release;
    let calls = 0;
    a.onlinePanel.loadDailyBoard = async () => {
      calls++;
      if (calls === 1) return new Promise(resolve => { release = () => resolve(structuredClone(seedBoard)); });
      const latest = structuredClone(complete); latest.pendingRewards = []; return latest;
    };
    const pending = a.refreshDailyBoard();
    await Promise.resolve();
    await a.refreshDailyBoard();
    release(); await pending;
    while (a.dailyBusy()) await new Promise(resolve => setTimeout(resolve, 10));
    const queuedRefresh = calls === 2 && a.dailyBoard().contracts[2].completed;
    a.onlinePanel.loadDailyBoard = async () => { throw new Error("Falha de conexão de teste"); };
    await a.refreshDailyBoard();
    const preservesBoard = a.dailyBoard().contracts[2].completed && a.dailyError().includes("Falha de conexão");
    a.dailyError.set("");
    const original = JSON.stringify(a.dailyBoard());
    let lateResolve;
    a.onlinePanel.loadDailyBoard = async () => new Promise(resolve => { lateResolve = resolve; });
    const oldAccount = a.refreshDailyBoard(); await Promise.resolve();
    a.accountEpoch++;
    lateResolve(seedBoard); await oldAccount;
    const ignoresOldAccount = JSON.stringify(a.dailyBoard()) === original;
    return { visibleDuringFailure, retriedOnce, queuedRefresh, preservesBoard, ignoresOldAccount, limit: a.dailyRewardLimit() };
  });
  for (const [key, value] of Object.entries(checks)) if (typeof value === "boolean") assert.ok(value, key);
  assert.equal(checks.limit, 34);
  await page.getByRole("button", { name: "Abrir menu da expedição", exact: true }).click();
  await page.getByRole("button", { name: "Trilhas do dia", exact: true }).click();
  const panel = page.getByRole("region", { name: "Desafios diários" });
  await panel.getByText(/Suas ações de batalha nesta expedição/).waitFor();
  await panel.screenshot({ path: "artifacts/daily-personal-scope.png" });

  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ checks, errors }, null, 2));
} finally { await browser.close(); }
