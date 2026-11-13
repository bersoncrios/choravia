import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
await mkdir("artifacts", { recursive: true });
const browser = await chromium.launch({
  executablePath:
    process.env.CHROME_PATH ??
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true,
});
const context = await browser.newContext({
  viewport: { width: 1360, height: 1100 },
  reducedMotion: "reduce",
});
// This smoke test covers local gameplay and must not create real Firebase users.
await context.route("https://identitytoolkit.googleapis.com/**", (route) =>
  route.abort(),
);
const page = await context.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
const url = new URL("/jogar", process.env.BASE_URL ?? "http://127.0.0.1:5173").href;
const ready = async () => {
  await page.waitForFunction(() => window.ng?.getComponent(document.querySelector("ww-app"))?.loaded(), null, { timeout: 20000 });
  await page.evaluate(async () => {
    const a = window.ng.getComponent(document.querySelector("ww-app"));
    a.receiveAccount = () => {};
    a.profile.set({ uid: "smoke-test", name: "Guardião", email: "smoke@example.invalid", photoURL: null });
    a.cloudStatus.set("offline");
    if (!a.game().avatar) {
      const { initialGame } = await import("/src/app/domain/game.ts");
      await a.session.replaceState(initialGame(827361));
      await a.confirmAvatar();
      await a.confirmStarter();
    }
  });
};
try {
  await page.goto(url);
  await ready();
  await page.screenshot({ path: "artifacts/desktop.png", fullPage: true });
  const readyMs = await page.evaluate(
    () => performance.getEntriesByName("choravia-game-ready")[0]?.startTime,
  );
  const walk = async (key) => {
    const before = await page.locator("canvas").getAttribute("aria-label");
    await page.keyboard.press(key);
    await page.waitForFunction(
      (label) =>
        document.querySelector("canvas")?.getAttribute("aria-label") !== label,
      before,
    );
  };
  for (let i = 0; i < 4; i++) await walk("w");
  for (let i = 0; i < 7; i++) await walk(i % 2 === 0 ? "a" : "d");
  await page.getByText("RODADA 1", { exact: true }).waitFor();
  for (let i = 0; i < 3; i++) {
    await page.getByRole("button", { name: /Atacar/ }).click();
    await page.getByRole("button", { name: "Acelerar", exact: true }).click();
    await page.getByText(`RODADA ${i + 2}`, { exact: true }).waitFor();
  }
  await page.getByRole("button", { name: /Vínculo 100%/ }).click();
  await page.getByRole("heading", { name: "Brotatu", exact: true }).waitFor();
  await page.screenshot({
    path: "artifacts/first-capture.png",
    fullPage: true,
  });
  await page.reload();
  await ready();
  await page.getByRole("heading", { name: "Brotatu", exact: true }).waitFor();
  await page.getByRole("button", { name: /Continuar explorando/ }).click();
  await page.getByRole("button", { name: /Recuperar/ }).waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "artifacts/mobile.png", fullPage: true });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
    "mobile must not overflow",
  );
  const beforeTouch = await page.locator("canvas").getAttribute("aria-label");
  await page.getByRole("button", { name: "Cima", exact: true }).click();
  await page.waitForFunction(
    (label) =>
      document.querySelector("canvas")?.getAttribute("aria-label") !== label,
    beforeTouch,
  );
  const second = await context.newPage();
  await second.goto(url);
  await second
    .getByText("Expedição aberta em outra aba", { exact: true })
    .waitFor();
  await second.close();
  // Corrupt only this isolated test profile; load must recover the previous snapshot.
  await page.evaluate(
    () =>
      new Promise((resolve, reject) => {
        const r = indexedDB.open("wildwoods-v1", 1);
        r.onsuccess = () => {
          const db = r.result,
            tx = db.transaction("snapshots", "readwrite");
          tx.objectStore("snapshots").put({ broken: true }, "current");
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
        r.onerror = () => reject(r.error);
      }),
  );
  await page.reload();
  await ready();
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify(
      {
        readyMs,
        checks: [
          "desktop render",
          "real first capture",
          "reload persistence",
          "mobile layout",
          "touch movement",
          "multi-tab lock",
          "corrupt snapshot backup",
        ],
        errors,
      },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}
