import { fieldPoints, fieldAvailable } from "../domain/field-world.js";
import type { FieldState } from "../domain/field.js";
import { explorationTile, fieldMechanisms } from "../domain/field-abilities.js";
import {
  Game,
  type Command,
  type Position,
  SpeciesId,
  species,
  affectedCells,
  same,
  distance,
  layoutIn,
  REGION_NAMES,
  RESONANCE_SEALS,
  creatureLevel,
  creatureMaxHp,
} from "../domain/game.js";
import { visualFeedback, type VisualFeedback } from "../application/visual-feedback.js";
import { DEFAULT_AVATAR, type AvatarAppearance } from "../domain/avatar.js";
const PIXELS: Record<SpeciesId, readonly string[]> = {
  WW001: [
    "..o...o..",
    "..oo.oo..",
    "..ooooo..",
    ".oowowoo.",
    ".oo.o.oo.",
    "..ooooo..",
    "...ooo.oo",
    "..oooooo.",
    "..o..o...",
  ],
  WW002: [
    "....o....",
    "...ooo...",
    "..ooooo..",
    ".oowowoo.",
    "ooo.o.ooo",
    "ooooooooo",
    ".ooooooo.",
    "..o...o..",
    ".........",
  ],
  WW003: [
    "..oo.oo..",
    ".ooooooo.",
    ".oowowoo.",
    ".ooo.ooo.",
    "..ooooo..",
    "..oooooo.",
    ".oooooooo",
    "..oo.oo..",
    ".........",
  ],
  WW004: [
    ".oo...oo.",
    "..oo.oo..",
    "..ooooo..",
    ".oowowoo.",
    ".oo.o.oo.",
    "..ooooo.o",
    "..ooooo.o",
    ".oo..ooo.",
    ".........",
  ],
  WW005: [
    "...ooo...",
    "..ooooo..",
    ".ooooooo.",
    "ooo.o.ooo",
    "ooooooooo",
    ".oowowoo.",
    "..ooooo..",
    ".oo...oo.",
    ".........",
  ],
};
export function drawCreature(
  ctx: CanvasRenderingContext2D,
  id: SpeciesId,
  cx: number,
  cy: number,
  scale = 3,
): void {
  const shape = PIXELS[id];
  const s = species(id);
  ctx.fillStyle = "#081b2270";
  ctx.beginPath();
  ctx.ellipse(
    cx,
    cy + (13 * scale) / 3,
    (12 * scale) / 3,
    (4 * scale) / 3,
    0,
    0,
    Math.PI * 2,
  );
  ctx.fill();
  for (let y = 0; y < shape.length; y++)
    for (let x = 0; x < (shape[y]?.length ?? 0); x++) {
      const p = shape[y]?.[x];
      if (p === ".") continue;
      ctx.fillStyle = p === "w" ? "#f4f1de" : s.color;
      ctx.fillRect(
        Math.round(cx + (x - 4.5) * scale),
        Math.round(cy + (y - 5) * scale),
        scale,
        scale,
      );
      if (p === "w") {
        ctx.fillStyle = "#14272b";
        ctx.fillRect(
          Math.round(cx + (x - 4.5) * scale),
          Math.round(cy + (y - 5) * scale),
          Math.max(1, scale / 2),
          Math.max(1, scale / 2),
        );
      }
    }
}
export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private action: { from: Game; to: Game; command: Command; feedback: VisualFeedback; start: number; side?: "ally" | "enemy" } | null = null;
  private enteredAt = -Infinity;
  private regionAt = -Infinity;
  private moving = false;
  play(before: Game, after: Game, command: Command, now: number, side?: "ally" | "enemy"): void {
    const feedback = visualFeedback(before, after, command);
    if (feedback) {
      if (side) feedback.enemyActs = side === "enemy";
      const from = side === "enemy" && before.battle && (command.type === "basic" || command.type === "skill") ? { ...before, battle: { ...before.battle, plan: { ...before.battle.plan, action: command.type, target: command.target } } } : before;
      this.action = { from, to: after, command, feedback, start: now, side };
    }
  }
  resetMotion(): void {
    this.action = null;
    this.enteredAt = this.regionAt = -Infinity;
    this.last = null;
    this.lastTime = 0;
  }
  private last: Game | null = null;
  private shown = { x: 9, y: 11 };
  private lastTime = 0;
  private facing: "up" | "down" | "left" | "right" = "down";
  private previousPlayer = { x: 9, y: 11 };
  constructor(private canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Seu navegador não oferece Canvas 2D.");
    this.ctx = ctx;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = 480 * dpr;
    canvas.height = 360 * dpr;
    ctx.scale(dpr, dpr);
    ctx.imageSmoothingEnabled = false;
  }
  draw(g: Game, time: number, reduced: boolean, selection: string, field?: {state: FieldState | null; cycle: number}): void {
    const dt = Math.min(Math.max(0, (time - this.lastTime) / 1000), 0.083);
    if (this.action && time - this.action.start > this.action.feedback.duration) this.action = null;
    if (reduced) this.action = null;
    if (this.last && g.battle && g.scene === "battle" && g.battle.id !== this.last.battle?.id) this.enteredAt = time;
    if (this.last?.scene === "exploration" && g.scene === "exploration" && this.last.region !== g.region) this.regionAt = time;
    this.lastTime = time;
    const ctx = this.ctx;
    ctx.fillStyle = "#142d30";
    ctx.fillRect(0, 0, 480, 360);
    if (g.scene === "exploration") {
      const regionChanged = this.last?.scene !== "exploration" || this.last?.region !== g.region;
      if (regionChanged) {
        this.facing = "down";
        this.previousPlayer = { ...g.player };
      } else if (g.player.x !== this.previousPlayer.x || g.player.y !== this.previousPlayer.y) {
        const dx = g.player.x - this.previousPlayer.x;
        const dy = g.player.y - this.previousPlayer.y;
        this.facing = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? "left" : "right") : (dy < 0 ? "up" : "down");
        this.previousPlayer = { ...g.player };
      }
      if (
        this.last?.scene !== "exploration" ||
        this.last?.region !== g.region ||
        reduced
      )
        this.shown = { ...g.player };
      this.moving = !reduced && Math.hypot(g.player.x - this.shown.x, g.player.y - this.shown.y) > 0.015;
      const factor = reduced ? 1 : Math.min(1, dt * 22);
      this.shown.x += (g.player.x - this.shown.x) * factor;
      this.shown.y += (g.player.y - this.shown.y) * factor;
      const zoom = 1.5;
      const worldWidth = 480, worldHeight = 360;
      const cameraWidth = worldWidth / zoom, cameraHeight = worldHeight / zoom;
      const clampCamera = (value: number, maximum: number) => Math.max(0, Math.min(maximum, value));
      const cameraX = clampCamera(this.shown.x * 24 + 12 - cameraWidth / 2, worldWidth - cameraWidth);
      const cameraY = clampCamera(this.shown.y * 24 + 12 - cameraHeight / 2, worldHeight - cameraHeight);
      ctx.save();
      ctx.translate(-cameraX * zoom, -cameraY * zoom);
      ctx.scale(zoom, zoom);
      this.drawMap(g, time, reduced);
      if (field?.state) this.drawField(g, field.state, field.cycle, time, reduced);
      this.drawFieldEnvironment(g, time, reduced);
      this.hero(
        this.shown.x * 24 + 12,
        this.shown.y * 24 + 12,
        time,
        reduced,
        g.avatar ?? DEFAULT_AVATAR,
        this.facing,
      );
      this.drawForegroundCanopies(g);
      this.drawWorldFeedback(time, reduced);
      ctx.restore();
      if (!reduced && time - this.regionAt < 340) {
        ctx.fillStyle = `rgba(16, 39, 42, ${0.55 * (1 - (time - this.regionAt) / 340)})`;
        ctx.fillRect(0, 0, 480, 360);
      }
      ctx.fillStyle = "#d7ead580";
      ctx.font = "9px monospace";
      ctx.fillText(
        REGION_NAMES[g.region ?? "clearing"].toLocaleUpperCase("pt-BR"),
        18,
        24,
      );
    } else if (g.battle) {
      this.drawBattle(g, time, reduced, selection);
      if (!reduced && time - this.enteredAt < 420) {
        const p = Math.max(0, (time - this.enteredAt) / 420);
        ctx.fillStyle = `rgba(16, 39, 42, ${0.65 * (1 - p)})`;
        ctx.fillRect(0, 0, 480, 360);
        ctx.strokeStyle = `rgba(234, 205, 118, ${1 - p})`;
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.ellipse(240, 180, 30 + p * 270, 18 + p * 180, 0, 0, Math.PI * 2); ctx.stroke();
      }
    }
    this.last = g;
  }
  private drawMap(g: Game, time: number, reduced: boolean): void {
    const c = this.ctx;
    const region = g.region ?? "clearing";
    const ancient = region === "old-grove";
    const cavern = region === "tide-cavern";
    const canopy = region === "canopy-trail";
    const layout = layoutIn(g, region);
    const pots = layout.pots.filter(
      (pot) => !(g.brokenPots ?? []).includes(pot.id),
    );
    for (let y = 0; y < 15; y++)
      for (let x = 0; x < 20; x++) {
        const t = explorationTile(g, x, y),
          px = x * 24,
          py = y * 24;
        const noise = (x * 17 + y * 11) % 7;
        c.fillStyle =
          t === "path"
            ? cavern ? "#788788" : canopy ? "#a0966b" : ancient ? "#867d68" : "#aa9b6c"
            : t === "grass"
              ? cavern ? "#607d81" : ancient ? "#637e5d" : canopy ? "#648950" : "#528450"
              : t === "water"
                ? cavern ? "#315b78" : canopy ? "#739b69" : "#427f8e"
                : t === "wall"
                  ? ancient
                    ? "#273d3a"
                    : "#193d37"
                  : cavern ? "#344b59" : canopy ? "#42674c" : ancient ? "#4a604d" : "#356347";
        c.fillRect(px, py, 24, 24);
        this.terrainDetails(g, x, y, t, noise);
        if (t === "grass") {
          for (let n = 0; n < 4; n++) {
            const gx = px + 3 + ((n * 7 + noise) % 20),
              gy = py + 6 + ((n * 9) % 18);
            const wind = reduced ? 0 : Math.sin(time / 900 + x + y) * 1.4;
            c.fillStyle = n % 2 ? (cavern ? "#9cb8b2" : canopy ? "#a0bd77" : "#8db66a") : (cavern ? "#3f5962" : "#284f3c");
            c.fillRect(gx, gy, 2, 6);
            c.fillRect(gx - 2 + wind, gy - 2, 2, 4);
            c.fillRect(gx + 2, gy - 1, 2, 4);
          }
        }
        if (t === "ground" && noise < 3) {
          c.fillStyle = cavern ? "#77939a" : ancient ? "#85986d" : "#6b9357";
          c.fillRect(px + 6, py + 9, 2, 2);
          c.fillRect(px + 16, py + 17, 2, 3);
        }
        if (t === "path") {
          c.fillStyle = cavern ? "#a7b6b0" : "#c2b789";
          c.fillRect(px + noise * 3, py + 7, 3, 2);
        }
        if (t === "water") {
          c.fillStyle = "#8cc3c4";
          const shift = reduced ? 0 : Math.sin(time / 1100 + y) * 3;
          c.fillRect(px + 4 + shift, py + 7, 10, 1);
          c.fillRect(px + 10 - shift, py + 18, 7, 1);
        }
        if (t === "wall") this.tree(px, py, noise, region);
        if (t === "ruin") {
          c.fillStyle = ancient ? "#8c9277" : "#7d9485";
          c.fillRect(px + 1, py + 1, 22, 22);
          c.fillStyle = ancient ? "#c1b77d" : "#adbea0";
          c.fillRect(px + 2, py + 1, 19, 3);
          c.fillStyle = "#3a5c53";
          c.fillRect(px + 4, py + 12, 14, 1);
          if (x === 14) {
            c.fillStyle = "#eacd76";
            c.fillRect(px + 10, py + 5, 3, 11);
            c.fillRect(px + 6, py + 9, 11, 3);
          }
        }
        const sealIndex = RESONANCE_SEALS.findIndex(
          (seal) => ancient && seal.x === x && seal.y === y,
        );
        if (sealIndex >= 0) {
          const activated = sealIndex < (g.resonanceStep ?? 0),
            color = activated
              ? "#f0db8b"
              : RESONANCE_SEALS[sealIndex]!.element === "fire"
                ? "#d9825f"
                : RESONANCE_SEALS[sealIndex]!.element === "electric"
                  ? "#eacd76"
                  : "#a9b49a";
          c.fillStyle = activated ? "#f0db8b38" : "#142b2b70";
          c.fillRect(px + 3, py + 3, 18, 18);
          c.fillStyle = color;
          c.fillRect(px + 9, py + 5, 6, 14);
          c.fillRect(px + 6, py + 9, 12, 5);
        }
        if (t === "healer") {
          c.fillStyle = "#152c2e";
          c.fillRect(px + 5, py + 17, 16, 5);
          c.fillStyle = "#eacd76";
          c.fillRect(px + 8, py + 9, 10, 12);
          c.fillStyle = "#e4bb91";
          c.fillRect(px + 9, py + 3, 8, 8);
          c.fillStyle = "#f4f1de";
          c.fillRect(px + 7, py + 1, 12, 4);
        }
        if (t === "gate") {
          this.portal(region, px, py, time, reduced);
        }
        if (layout.pots.some(pot => pot.x === x && pot.y === y && (g.brokenPots ?? []).includes(pot.id))) {
          c.fillStyle = "#845b48"; c.fillRect(px + 6, py + 18, 5, 3); c.fillRect(px + 14, py + 16, 4, 3);
          c.fillStyle = "#bf9771"; c.fillRect(px + 8, py + 18, 3, 1);
        }
        if (pots.some((pot) => pot.x === x && pot.y === y)) {
          c.fillStyle = "#142b2b80";
          c.fillRect(px + 5, py + 19, 15, 3);
          c.fillStyle = "#9b6143";
          c.fillRect(px + 7, py + 8, 11, 11);
          c.fillRect(px + 5, py + 7, 15, 3);
          c.fillStyle = "#c78c5a";
          c.fillRect(px + 8, py + 9, 9, 2);
          c.fillRect(px + 10, py + 12, 5, 4);
          c.fillStyle = "#eacd76";
          c.fillRect(px + 11, py + 13, 3, 2);
        }
        const npc = layout.npcs.find((entry) => entry.x === x && entry.y === y);
        if (npc) {
          c.fillStyle = "#142b2b80";
          c.fillRect(px + 5, py + 20, 15, 3);
          c.fillStyle = "#2f4740";
          c.fillRect(px + 8, py + 13, 4, 8);
          c.fillRect(px + 14, py + 13, 4, 8);
          c.fillStyle = cavern ? "#6c9ca7" : canopy ? "#8b9e66" : ancient ? "#8c8b73" : "#5e9a77";
          c.fillRect(px + 6, py + 7, 13, 10);
          c.fillStyle = "#d9ad83";
          c.fillRect(px + 8, py + 1, 10, 9);
          c.fillStyle = "#5c4438";
          c.fillRect(px + 7, py + 1, 12, 4);
          // Shape distinguishes the initial duel from unlocked repeat practice.
          const trained = (g.npcDuelWins ?? []).includes(npc.id);
          c.fillStyle = "#193630"; c.fillRect(px + 8, py - 7, 9, 7);
          c.strokeStyle = trained ? "#a9d8bd" : "#f3dc96";
          c.lineWidth = 1;
          c.beginPath();
          if (trained) {
            c.moveTo(px + 10, py - 6); c.lineTo(px + 15, py - 2);
            c.moveTo(px + 15, py - 6); c.lineTo(px + 10, py - 2);
          } else {
            c.moveTo(px + 12, py - 6); c.lineTo(px + 15, py - 4);
            c.lineTo(px + 12, py - 1); c.lineTo(px + 9, py - 4); c.closePath();
          }
          c.stroke();
        }
      }
    if (!reduced) {
      // Deterministic ambient motes: fixed count, no allocations or game RNG.
      for (let n = 0; n < 12; n++) {
        const px = (n * 83 + time / (100 + n * 7)) % 480;
        const py = (n * 47 + Math.sin(time / 1800 + n) * 9) % 350;
        c.globalAlpha = 0.18 + (Math.sin(time / 900 + n) + 1) * 0.18;
        c.fillStyle = cavern ? "#9bdae8" : "#e2db96";
        c.fillRect(px, py, 2, 2);
      }
      c.globalAlpha = 1;
    }
    c.fillStyle = "#142d3040";
    c.fillRect(0, 0, 480, 12);
  }
  private drawField(g: Game, state: FieldState, cycle: number, time: number, reduced: boolean): void {
    if ((g.region ?? "clearing") !== "clearing") return;
    const c = this.ctx;
    for (const point of fieldPoints(g, cycle)) {
      const x = point.x * 24, y = point.y * 24, available = fieldAvailable(state, point.id, cycle);
      c.fillStyle = "#112e3560"; c.beginPath(); c.ellipse(x + 12, y + 20, 9, 3, 0, 0, Math.PI * 2); c.fill();
      c.save(); c.globalAlpha = available ? 1 : 0.5;
      if (point.id === "treasure") {
        c.fillStyle = "#80583f"; c.fillRect(x + 4, y + 10, 16, 10);
        c.fillStyle = "#d6ad65"; c.fillRect(x + 4, y + (available ? 8 : 3), 16, 4);
        c.fillRect(x + 6, y + 11, 2, 8); c.fillRect(x + 17, y + 11, 2, 8);
        c.fillStyle = "#182e2c"; c.fillRect(x + 8, y + (available ? 12 : 8), 8, available ? 2 : 5);
      } else if (point.id === "sap") {
        c.fillStyle = "#70563b"; c.fillRect(x + 7, y + 4, 9, 16);
        c.fillStyle = available ? "#e9d385" : "#8d8161"; c.fillRect(x + 13, y + 9, 4, 7);
        c.fillStyle = "#588459"; c.fillRect(x + 4, y + 3, 16, 5);
      } else if (point.id === "crystal") {
        c.fillStyle = available ? "#9ddacb" : "#697c7c";
        c.beginPath(); c.moveTo(x + 12, y + (available ? 3 : 14)); c.lineTo(x + 19,y + 15); c.lineTo(x + 13,y + 21); c.lineTo(x + 6,y + 16); c.fill();
      } else if (point.id === "cache") {
        c.fillStyle = "#4e7052"; c.fillRect(x + 3,y + 12,18,8);
        c.fillStyle = available ? "#ead79a" : "#a4aa89"; c.fillRect(x + 9,y + 13,7,4);
        c.fillStyle = "#709262"; c.fillRect(x + 4,y + 10,8,4); c.fillRect(x + 15,y + 16,5,3);
      } else {
        c.fillStyle = available ? "#77ae71" : "#65836a";
        c.fillRect(x + 11,y + (available ? 7 : 15),2,13 - (available ? 0 : 8));
        c.fillRect(x + 5,y + 12,7,4); c.fillRect(x + 13,y + 9,7,4);
        if (point.id === "fruit" && available) { c.fillStyle = "#e4a274"; c.fillRect(x + 5,y + 10,4,4); c.fillRect(x + 16,y + 7,4,4); }
      }
      c.restore();
      if (distance(g.player, point) <= 1) {
        c.strokeStyle = "#f5e4b1"; c.lineWidth = 1; c.strokeRect(x + 1,y + 1,22,22);
      }
      if (available) {
        c.fillStyle = "#f1df9e";
        const lift = reduced ? 0 : Math.sin(time / 550 + point.x) * 2;
        c.fillRect(x + 11,y - 2 + lift,2,3);
      } else { c.fillStyle = "#e4dfc2"; c.font = "8px monospace"; c.fillText(point.id === "treasure" ? "✓" : "−", x + 10,y + 3); }
    }
    if (state.restored) {
      const x = 7 * 24 + 12, y = 10 * 24 + 5;
      c.fillStyle = "#e8ce7680"; c.beginPath(); c.ellipse(x,y + 4,19,14,0,0,Math.PI*2); c.fill();
      c.fillStyle = "#f5e3a1"; c.fillRect(x - 3,y - 3,6,8);
      c.fillStyle = "#72543c"; c.fillRect(x - 4,y - 5,8,2); c.fillRect(x - 4,y + 5,8,2);
    }
  }
  /** Pure presentation: the domain supplies eligible positions and completed restorations. */
  private drawFieldEnvironment(g: Game, time: number, reduced: boolean): void {
    const c = this.ctx;
    const restorations = g.fieldRestorations ?? [];
    if (g.region === "tide-cavern") this.drawTideBridge(restorations.includes("tide-bridge"));
    for (const mechanism of fieldMechanisms(g)) {
      const restored = restorations.includes(mechanism.id);
      const x = mechanism.x * 24, y = mechanism.y * 24;
      c.save();
      c.fillStyle = "#12292e80";
      c.beginPath(); c.ellipse(x + 12, y + 21, 10, 3, 0, 0, Math.PI * 2); c.fill();
      if (mechanism.element === "fire") {
        if (restored) {
          c.fillStyle = "#e7b55b28";
          c.beginPath(); c.ellipse(x + 12, y + 10, 21, 17, 0, 0, Math.PI * 2); c.fill();
        }
        c.fillStyle = "#6f573e";
        c.fillRect(x + 10, y + 14, 4, 9);
        c.fillRect(x + 6, y + 4, 12, 3);
        c.fillRect(x + 6, y + 16, 12, 3);
        c.fillRect(x + 6, y + 7, 2, 9);
        c.fillRect(x + 16, y + 7, 2, 9);
        c.fillStyle = restored ? "#f3d47c" : "#3a4740";
        c.fillRect(x + 9, y + 8, 6, 7);
        c.fillStyle = restored ? "#fff1bd" : "#8e9272";
        c.fillRect(x + 11, y + (restored ? 8 : 13), 2, restored ? 5 : 2);
      } else if (mechanism.element === "plant") {
        c.fillStyle = "#76553d";
        c.fillRect(x + 3, y + 15, 18, 6);
        c.fillStyle = "#a99161";
        c.fillRect(x + 3, y + 15, 18, 2);
        c.fillStyle = restored ? "#6fa45e" : "#766b4a";
        c.fillRect(x + 6, y + (restored ? 7 : 12), 2, restored ? 9 : 4);
        c.fillRect(x + 16, y + (restored ? 6 : 13), 2, restored ? 10 : 3);
        c.fillRect(x + 3, y + (restored ? 9 : 13), 4, 2);
        c.fillRect(x + 17, y + (restored ? 8 : 14), 4, 2);
        if (restored) {
          this.drawFlower(x + 7, y + 6, "#edd7a2");
          this.drawFlower(x + 17, y + 5, "#d99e9a");
          // Existing paths gain a fixed, sparse line of flowers toward the exit.
          const exit = g.region === "old-grove" ? 2 : 17;
          for (let trailX = 3; trailX < 18; trailX += 2) {
            if ((exit === 2 ? trailX > mechanism.x : trailX < mechanism.x) || explorationTile(g, trailX, 10) !== "path") continue;
            this.drawFlower(trailX * 24 + 5, 10 * 24 + 19, "#e7d28e");
          }
        } else {
          c.strokeStyle = "#c1aa78"; c.lineWidth = 1;
          c.beginPath(); c.moveTo(x + 9, y + 10); c.lineTo(x + 14, y + 15); c.stroke();
        }
      } else if (mechanism.element === "water") {
        c.fillStyle = "#7f8a7b"; c.fillRect(x + 1, y + 17, 22, 5);
        c.fillStyle = restored ? "#75bec7" : "#455b63";
        c.fillRect(x + 2, y + 19, 20, 2);
        c.save(); c.translate(x + 12, y + 11);
        if (restored && !reduced) c.rotate(time / 1800);
        c.strokeStyle = restored ? "#c8ad76" : "#7c715a";
        c.lineWidth = 2;
        c.beginPath(); c.arc(0, 0, 8, 0, Math.PI * (restored ? 2 : 1.65)); c.stroke();
        for (let spoke = 0; spoke < 6; spoke++) {
          const angle = spoke * Math.PI / 3;
          c.beginPath(); c.moveTo(0, 0); c.lineTo(Math.cos(angle) * 8, Math.sin(angle) * 8); c.stroke();
        }
        c.fillStyle = "#dfc28b"; c.fillRect(-2, -2, 4, 4); c.restore();
        if (restored) {
          c.fillStyle = "#c5e4d2";
          c.fillRect(x + 2, y + 17, 3, 2);
          c.fillRect(x + 18, y + 19, 3, 2);
        }
      } else if (mechanism.element === "electric") {
        c.fillStyle = "#738270"; c.fillRect(x + 6, y + 5, 12, 17);
        c.fillStyle = "#a6b393"; c.fillRect(x + 6, y + 4, 12, 3);
        c.fillStyle = restored ? "#ead976" : "#344d43";
        c.fillRect(x + 9, y + 8, 6, 9);
        c.strokeStyle = restored ? "#fff2ae" : "#c4b87d"; c.lineWidth = 1.5;
        c.beginPath(); c.moveTo(x + 13, y + 8); c.lineTo(x + 10, y + 12); c.lineTo(x + 14, y + 12); c.lineTo(x + 11, y + 17); c.stroke();
        if (restored) {
          c.strokeStyle = "#e9da934f";
          c.beginPath(); c.ellipse(x + 12, y + 3, 13, 5, 0, 0, Math.PI * 2); c.stroke();
          c.fillStyle = "#f8e8a1"; c.fillRect(x + 10, y, 4, 3);
        } else {
          c.fillStyle = "#253d38"; c.fillRect(x + 5, y + 18, 14, 2);
        }
      } else {
        c.fillStyle = restored ? "#a9b294" : "#6b7d7e";
        c.fillRect(x + 4, y + 13, 16, 8);
        c.fillRect(x + 7, y + 7, 10, 9);
        c.fillStyle = "#d2c29a"; c.fillRect(x + 8, y + 7, 8, 2);
        c.strokeStyle = "#354d4c"; c.lineWidth = 1;
        c.beginPath();
        c.moveTo(x + (restored ? 7 : 10), y + 13);
        c.lineTo(x + (restored ? 11 : 13), y + (restored ? 17 : 16));
        c.lineTo(x + (restored ? 17 : 10), y + (restored ? 10 : 20));
        c.stroke();
      }
      if (distance(g.player, mechanism) <= 1) {
        c.strokeStyle = "#f4e4b4"; c.lineWidth = 1;
        c.strokeRect(x + 1, y + 1, 22, 22);
      }
      // Status remains visible without color or movement: hollow diamond / completed tick.
      c.fillStyle = restored ? "#f5e5b2" : "#e6e0c4";
      c.font = "9px monospace"; c.fillText(restored ? "✓" : "◇", x + 9, y - 2);
      if (restored && !reduced) {
        // Three deterministic motes per restored mechanism; no allocations or game RNG.
        for (let mote = 0; mote < 3; mote++) {
          const phase = time / (1000 + mote * 180) + mote * 2;
          c.globalAlpha = 0.28 + (Math.sin(phase) + 1) * 0.2;
          c.fillStyle = mechanism.element === "water" ? "#b6e0e7" : "#f0df9f";
          c.fillRect(x + 10 + Math.cos(phase) * 11, y + 6 + Math.sin(phase) * 7, 1.5, 1.5);
        }
      }
      c.restore();
    }
  }
  private drawFlower(x: number, y: number, petals: string): void {
    const c = this.ctx;
    c.fillStyle = "#55845c"; c.fillRect(x, y + 2, 1, 4);
    c.fillStyle = petals; c.fillRect(x - 2, y, 5, 1); c.fillRect(x, y - 2, 1, 5);
    c.fillStyle = "#b18f51"; c.fillRect(x, y, 1, 1);
  }
  private drawTideBridge(restored: boolean): void {
    const c = this.ctx, y = 8 * 24;
    if (!restored) {
      c.fillStyle = "#77664c";
      c.fillRect(4 * 24, y + 3, 11, 3); c.fillRect(6 * 24 + 13, y + 17, 11, 3);
      c.fillStyle = "#b09b72";
      c.fillRect(4 * 24 + 2, y + 5, 3, 13); c.fillRect(6 * 24 + 19, y + 4, 3, 15);
      return;
    }
    // Optional crossing uses exactly the domain's three restored path tiles.
    c.fillStyle = "#263c4080"; c.fillRect(4 * 24, y + 3, 72, 20);
    for (let plank = 0; plank < 12; plank++) {
      c.fillStyle = plank % 2 ? "#baaa7d" : "#9b8d69";
      c.fillRect(4 * 24 + plank * 6, y + 4, 5, 16);
      c.fillStyle = "#645e4d"; c.fillRect(4 * 24 + plank * 6 + 2, y + 6, 1, 1);
    }
    c.fillStyle = "#d3bf8e";
    c.fillRect(4 * 24, y + 2, 72, 2); c.fillRect(4 * 24, y + 20, 72, 2);
    for (const end of [4 * 24, 7 * 24 - 3]) { c.fillRect(end, y, 3, 7); c.fillRect(end, y + 17, 3, 7); }
  }
  private portal(region: NonNullable<Game["region"]>, x: number, y: number, time: number, reduced: boolean): void {
    const c = this.ctx;
    const palettes = {
      clearing: { frame: "#76543a", highlight: "#e1c47b", glow: "#f5d17c" },
      "old-grove": { frame: "#405f47", highlight: "#a6bf79", glow: "#c2e39a" },
      "canopy-trail": { frame: "#327a55", highlight: "#90d68d", glow: "#80f0ad" },
      "tide-cavern": { frame: "#456d91", highlight: "#a6d7ed", glow: "#65d9f2" },
    }[region];
    c.fillStyle = "#10262b";
    c.fillRect(x + 6, y + 7, 12, 15);
    c.fillStyle = palettes.frame;
    c.fillRect(x + 3, y + 5, 4, 18);
    c.fillRect(x + 17, y + 5, 4, 18);
    c.fillRect(x + 5, y + 2, 14, 4);
    c.fillStyle = palettes.highlight;
    c.fillRect(x + 7, y + 4, 10, 2);
    const pulse = reduced ? 0.7 : 0.45 + (Math.sin(time / 360) + 1) * 0.22;
    c.globalAlpha = pulse;
    c.fillStyle = palettes.glow;
    c.fillRect(x + 8, y + 8, 8, 12);
    c.globalAlpha = 1;
    if (region === "clearing") {
      c.fillStyle = "#4e8453";
      c.fillRect(x + 2, y + 3, 4, 3);
      c.fillRect(x + 18, y + 2, 4, 3);
      c.fillRect(x + 1, y + 7, 3, 3);
    } else if (region === "old-grove") {
      c.fillStyle = "#708c57";
      c.fillRect(x + 2, y + 4, 5, 3);
      c.fillRect(x + 17, y + 3, 5, 4);
      c.fillRect(x + 4, y + 1, 4, 3);
    } else if (region === "canopy-trail") {
      c.fillStyle = "#a5dc76";
      c.fillRect(x + 2, y + 7, 2, 8);
      c.fillRect(x + 19, y + 3, 2, 12);
      c.fillRect(x + 1, y + 13, 3, 2);
      c.fillRect(x + 18, y + 15, 3, 2);
    } else {
      c.fillStyle = "#a6d7ed";
      c.fillRect(x + 2, y + 4, 4, 4);
      c.fillRect(x + 18, y + 3, 4, 5);
      c.fillRect(x + 3, y + 9, 2, 5);
      c.fillRect(x + 19, y + 10, 2, 5);
    }
    if (!reduced) {
      c.fillStyle = palettes.highlight;
      const sparkle = Math.floor(time / 250) % 3;
      c.fillRect(x + 9 + sparkle * 2, y + 10 + (sparkle % 2) * 4, 2, 2);
    }
  }
  private terrainDetails(g: Game, x: number, y: number, tile: ReturnType<typeof explorationTile>, noise: number): void {
    const c = this.ctx, px = x * 24, py = y * 24, region = g.region ?? "clearing";
    const cavern = region === "tide-cavern", ancient = region === "old-grove", canopy = region === "canopy-trail";
    if (tile === "path") {
      // Borders use the exact exploration terrain, including the restored bridge.
      c.fillStyle = cavern ? "#4d6469" : "#6e7955";
      if (explorationTile(g, x, y - 1) !== "path") c.fillRect(px, py, 24, 2);
      if (explorationTile(g, x, y + 1) !== "path") c.fillRect(px, py + 22, 24, 2);
      if (explorationTile(g, x - 1, y) !== "path") c.fillRect(px, py, 2, 24);
      if (explorationTile(g, x + 1, y) !== "path") c.fillRect(px + 22, py, 2, 24);
      c.fillStyle = cavern ? "#98aaa6" : "#baac7e";
      c.fillRect(px + 6 + noise, py + 14, 4, 2);
      c.fillStyle = cavern ? "#586e74" : "#8e855e";
      c.fillRect(px + 16, py + 5 + noise, 2, 1);
      if (ancient && noise % 3 === 0) { c.fillStyle = "#6f7754"; c.fillRect(px + 4, py + 17, 4, 1); }
    } else if (tile === "water") {
      c.fillStyle = cavern ? "#213e59" : canopy ? "#4c6b53" : "#2b5964";
      if (explorationTile(g, x, y - 1) !== "water") c.fillRect(px, py, 24, 3);
      if (explorationTile(g, x - 1, y) !== "water") c.fillRect(px, py, 3, 24);
      c.fillStyle = cavern ? "#8bb1bc" : "#8caaa0";
      if (explorationTile(g, x, y + 1) !== "water") c.fillRect(px + 2, py + 22, 20, 1);
      if (explorationTile(g, x + 1, y) !== "water") c.fillRect(px + 22, py + 3, 1, 18);
    } else if (tile === "ground" || tile === "grass") {
      if (explorationTile(g, x, y - 1) === "wall") { c.fillStyle = "#122d3030"; c.fillRect(px + 2, py, 22, 4); }
      if (cavern && noise % 2 === 0) {
        c.fillStyle = "#526974"; c.fillRect(px + 12, py + 7, 5, 2);
        c.fillStyle = "#263e4c"; c.fillRect(px + 13, py + 9, 4, 1);
      } else if (ancient && noise === 4) {
        c.strokeStyle = "#777553"; c.lineWidth = 1; c.beginPath();
        c.moveTo(px + 3, py + 18); c.lineTo(px + 7, py + 16); c.lineTo(px + 9, py + 10); c.stroke();
      } else if (canopy && noise === 2) {
        c.fillStyle = "#a0aa63"; c.fillRect(px + 7, py + 15, 4, 2);
        c.fillStyle = "#274e39"; c.fillRect(px + 8, py + 14, 1, 4);
      } else if (region === "clearing" && noise === 5) {
        c.fillStyle = "#9cbb76"; c.fillRect(px + 17, py + 8, 3, 1);
        c.fillStyle = "#d5c997"; c.fillRect(px + 18, py + 7, 1, 3);
      }
    }
  }
  private tree(x: number, y: number, n: number, region: NonNullable<Game["region"]>): void {
    const c = this.ctx;
    if (region === "tide-cavern") {
      c.fillStyle = "#1e3444"; c.fillRect(x + 3, y + 18, 20, 6);
      c.fillStyle = n % 2 ? "#425865" : "#4b626b";
      c.beginPath(); c.moveTo(x + 3, y + 19); c.lineTo(x + 4, y + 8); c.lineTo(x + 11, y + 2); c.lineTo(x + 19, y + 5); c.lineTo(x + 23, y + 17); c.lineTo(x + 19, y + 22); c.closePath(); c.fill();
      c.fillStyle = "#71878b"; c.fillRect(x + 9, y + 5, 8, 2);
      c.strokeStyle = "#2b4354"; c.lineWidth = 1; c.beginPath(); c.moveTo(x + 15, y + 10); c.lineTo(x + 11, y + 14); c.lineTo(x + 13, y + 19); c.stroke();
      if (n === 0 || n === 3) {
        c.fillStyle = "#81b8c6"; c.beginPath(); c.moveTo(x + 6, y + 12); c.lineTo(x + 8, y + 6); c.lineTo(x + 11, y + 12); c.lineTo(x + 9, y + 16); c.closePath(); c.fill();
        c.fillStyle = "#c1ddd8"; c.fillRect(x + 8, y + 8, 1, 5);
      }
      return;
    }
    const ancient = region === "old-grove", canopy = region === "canopy-trail";
    c.fillStyle = "#132e2b"; c.fillRect(x + 4, y + 19, 20, 4);
    c.fillStyle = ancient ? "#61563e" : "#4a5037"; c.fillRect(x + 9, y + 12, 6, 12);
    c.fillStyle = "#263b2d"; c.fillRect(x + 11, y + 15, 2, 8);
    c.fillStyle = ancient ? "#284c3f" : canopy ? "#285941" : "#24523e";
    c.fillRect(x + 1, y + 5, 22, 13);
    c.fillRect(x + 4, y + 1, 16, 17);
    c.fillStyle = ancient ? "#3d6350" : canopy ? "#46805a" : n % 2 ? "#3b7851" : "#346c49";
    c.fillRect(x + 4, y + 4, 15, 9);
    c.fillRect(x + 8, y + 1, 11, 8);
    c.fillStyle = ancient ? "#73805b" : canopy ? "#76a668" : "#659559";
    c.fillRect(x + 9, y + 2, 7, 2);
    c.fillRect(x + 5, y + 6, 4, 2);
    if (ancient) { c.fillStyle = "#8b8d5d"; c.fillRect(x + 7, y + 14, 2, 4); }
    if (canopy) { c.fillStyle = "#638453"; c.fillRect(x + 19, y + 9, 1, 11); }
  }
  private drawForegroundCanopies(g: Game): void {
    const region = g.region ?? "clearing";
    if (region === "tide-cavern") return;
    const c = this.ctx, nextRow = Math.floor(this.shown.y) + 1;
    // At most three crowns. A translucent lip preserves the hero silhouette.
    if (nextRow >= 15) return;
    c.save(); c.globalAlpha = 0.7;
    for (let x = Math.max(0, Math.floor(this.shown.x) - 1); x <= Math.min(19, Math.floor(this.shown.x) + 1); x++) {
      if (explorationTile(g, x, nextRow) !== "wall") continue;
      c.fillStyle = region === "old-grove" ? "#3d6350" : region === "canopy-trail" ? "#46805a" : "#346c49";
      c.fillRect(x * 24 + 4, nextRow * 24 - 3, 16, 6);
      c.fillStyle = "#86a56c"; c.fillRect(x * 24 + 9, nextRow * 24 - 2, 6, 1);
    }
    c.restore();
  }
  private hero(
    x: number,
    y: number,
    time: number,
    reduced: boolean,
    avatar: AvatarAppearance,
    facing: "up" | "down" | "left" | "right",
  ): void {
    const c = this.ctx;
    const stride = reduced || !this.moving ? 0 : Math.sin(time / 65);
    const bob = reduced ? 0 : this.moving ? -Math.abs(stride) * 1.5 : Math.sin(time / 550) * 0.35;
    const flutter = reduced ? 0 : Math.sin(time / (this.moving ? 85 : 360)) * (this.moving ? 2 : 0.6);
    const skin = { sand: "#edc69b", copper: "#bd805f", umber: "#754a3b" }[
      avatar.skin
    ];
    const outfit = { moss: "#eacd76", sunset: "#d98362", river: "#68aaba", cloak: "#4e7652" }[
      avatar.outfit
    ];
    const hair = {
      dark: "#294c48",
      chestnut: "#704332",
      copper: "#b85f3e",
      silver: "#c4c6b4",
    }[avatar.hairColor];
    c.fillStyle = "#122a2e80";
    c.beginPath();
    c.ellipse(x, y + 8, 7, 3, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = "#203638";
    c.fillRect(x - 5, y + 4 + stride * 2, 4, 5);
    c.fillRect(x + 1, y + 4 - stride * 2, 4, 5);
    c.fillStyle = outfit;
    c.fillRect(x - 6, y - 3 + bob, 12, 9);
    if (avatar.outfit === "cloak") {
      c.fillRect(x - 7 + flutter, y + 4 + bob, 6, 4);
      c.fillRect(x + 1 + flutter, y + 4 + bob, 6, 4);
    }
    c.fillStyle = skin;
    c.fillRect(x - 4, y - 10 + bob, 9, 8);
    c.fillStyle = hair;
    if (avatar.hair === "curls") {
      c.fillRect(x - 7, y - 12 + bob, 14, 4);
      c.fillRect(x - 5, y - 15 + bob, 4, 4);
      c.fillRect(x + 1, y - 15 + bob, 4, 4);
    } else if (avatar.hair === "long") {
      c.fillRect(x - 7, y - 12 + bob, 14, 4);
      c.fillRect(x - 7, y - 9 + bob, 3, 12);
      c.fillRect(x + 4, y - 9 + bob, 3, 12);
      if (facing === "up") c.fillRect(x - 5, y - 8 + bob, 10, 12);
    } else if (avatar.hair === "braids") {
      c.fillRect(x - 6, y - 12 + bob, 12, 4);
      for (const side of [-1, 1]) {
        const braidX = x + side * 7;
        for (let segment = 0; segment < 4; segment++) {
          c.fillStyle = hair;
          c.fillRect(braidX + side * (segment % 2), y - 8 + segment * 3 + bob, 2, 3);
        }
        c.fillStyle = "#eacd76";
        c.fillRect(braidX, y + 4 + bob, 3, 2);
        c.fillStyle = hair;
        c.fillRect(braidX, y + 6 + bob, 2, 2);
      }
    } else {
      c.fillRect(x - 7, y - 12 + bob, 14, 4);
      c.fillRect(x - 4, y - 15 + bob, 9, 4);
    }
    if (avatar.accessory === "scarf") {
      c.fillStyle = "#d77b5b";
      c.fillRect(x - 6, y - 1 + bob, 12, 3);
      c.fillRect(x + 3 + flutter, y + 1 + bob, 3, 5);
    } else if (avatar.accessory === "satchel") {
      c.fillStyle = "#78583e";
      c.fillRect(x + 5, y - 1 + bob, 4, 7);
      c.fillStyle = "#c3a16d";
      c.fillRect(x + 6, y + 1 + bob, 2, 2);
    } else if (avatar.accessory === "sun-scarf") {
      c.fillStyle = "#e88745";
      c.fillRect(x - 6, y - 1 + bob, 12, 3);
      c.fillRect(x + 3 + flutter, y + 1 + bob, 3, 5);
    } else if (avatar.accessory === "moon-pin") {
      c.fillStyle = "#dfe8d6";
      c.fillRect(x + 3, y - 9 + bob, 3, 3);
      c.fillStyle = "#c5d4ee";
      c.fillRect(x + 4, y - 8 + bob, 2, 2);
    }
    if (avatar.customAccessory) {
      c.fillStyle = avatar.customAccessory.color;
      if (avatar.customAccessory.shape === "scarf") { c.fillRect(x - 6, y - 1 + bob, 12, 3); c.fillRect(x + 3 + flutter, y + 1 + bob, 3, 5); }
      else if (avatar.customAccessory.shape === "crown") { c.fillRect(x - 6, y - 15 + bob, 12, 3); c.fillRect(x - 6, y - 18 + bob, 2, 4); c.fillRect(x - 1, y - 19 + bob, 2, 4); c.fillRect(x + 4, y - 18 + bob, 2, 4); }
      else { c.fillRect(x + 3, y - 4 + bob, 4, 4); }
    }
    if (facing !== "up") {
      c.fillStyle = "#142d30";
      if (facing === "left") c.fillRect(x - 4, y - 7 + bob, 2, 2);
      else if (facing === "right") c.fillRect(x + 3, y - 7 + bob, 2, 2);
      else c.fillRect(x + 2, y - 7 + bob, 2, 2);
    }
    c.fillStyle = "#c68059";
    c.fillRect(x - 8, y + 1 + bob, 4, 7);
  }
  private livingCreature(id: SpeciesId, x: number, y: number, time: number, reduced: boolean, scale = 4): void {
    const c = this.ctx, phase = time / 450;
    c.save(); c.translate(x, y);
    if (!reduced) {
      if (id === "WW001") { c.translate(0, Math.sin(phase * 1.5) * 1.4); c.scale(1, 1 + Math.sin(phase * 1.5) * 0.025); }
      else if (id === "WW002") c.rotate(Math.sin(phase * 0.65) * 0.035);
      else if (id === "WW003") c.scale(1 + Math.sin(phase) * 0.035, 1 - Math.sin(phase) * 0.025);
      else if (id === "WW004") c.translate(Math.sin(phase * 4) * Math.pow(Math.max(0, Math.sin(phase)), 8) * 1.5, 0);
      else c.translate(0, Math.sin(phase * 0.45) * 0.6);
    }
    drawCreature(c, id, 0, 0, scale); c.restore();
  }
  private burst(x: number, y: number, progress: number, color: string, count = 10): void {
    const c = this.ctx;
    c.save(); c.globalAlpha = Math.max(0, 1 - progress); c.fillStyle = color;
    for (let n = 0; n < count; n++) {
      const angle = n * Math.PI * 2 / count;
      const r = 6 + progress * 26;
      c.fillRect(x + Math.cos(angle) * r, y + Math.sin(angle) * r - progress * 9, 3, 3);
    }
    c.restore();
  }
  private drawWorldFeedback(time: number, reduced: boolean): void {
    const a = this.action;
    if (!a || a.feedback.kind !== "world" || reduced) return;
    const p = Math.min(1, (time - a.start) / a.feedback.duration);
    const x = a.feedback.worldPosition.x * 24 + 12, y = a.feedback.worldPosition.y * 24 + 12;
    this.burst(x, y, p, "#eacd76", 10);
    this.ctx.save(); this.ctx.globalAlpha = Math.min(1, (1 - p) * 3);
    this.ctx.font = "bold 10px monospace"; this.ctx.textAlign = "center";
    this.ctx.lineWidth = 3; this.ctx.strokeStyle = "#14272b"; this.ctx.fillStyle = "#fff0cf";
    const labelX = Math.max(70, Math.min(410, x));
    this.ctx.strokeText(a.feedback.label, labelX, Math.max(18, y - 22 - p * 12));
    this.ctx.fillText(a.feedback.label, labelX, Math.max(18, y - 22 - p * 12)); this.ctx.restore();
  }
  private drawAction(a: NonNullable<Renderer["action"]>, time: number): void {
    const age = time - a.start, before = a.from.battle, after = a.to.battle;
    if (!before || !after) return;
    const c = this.ctx;
    const center = (p: Position) => ({ x: 96 + p.x * 72, y: 38 + p.y * 72 });
    const attack = (who: "ally" | "enemy", kind: string, target: Position, offset: number) => {
      const t = (age - offset) / 260;
      if (t < 0 || t > 1 || !["basic", "skill"].includes(kind)) return;
      const actor = who === "ally" ? before.ally : { ...before.enemy, pos: after.enemy.pos };
      const origin = center(actor.pos), dest = center(target);
      c.save(); c.globalAlpha = Math.sin(Math.PI * t); c.lineWidth = kind === "skill" ? 3 : 2;
      c.strokeStyle = kind === "skill" ? species(actor.speciesId).color : "#f4f1de";
      c.beginPath(); c.moveTo(origin.x, origin.y);
      if (kind === "skill" && actor.speciesId === "WW004") {
        c.lineTo((origin.x + dest.x) / 2 + 7, (origin.y + dest.y) / 2 - 6);
      }
      c.lineTo(dest.x, dest.y); c.stroke();
      const cells = affectedCells(before, actor, kind as "basic" | "skill", target);
      // At most the arena's 25 cells; effects never use the game RNG.
      for (const cell of cells) {
        const point = center(cell);
        this.burst(point.x, point.y, t, c.strokeStyle as string, kind === "basic" ? 5 : 7);
        if (kind === "skill" && actor.speciesId === "WW004") {
          c.beginPath(); c.moveTo(point.x - 15, point.y - 9); c.lineTo(point.x + 2, point.y - 2); c.lineTo(point.x - 3, point.y + 5); c.lineTo(point.x + 15, point.y + 12); c.stroke();
        }
      }
      c.restore();
    };
    if (a.side !== "enemy" && (a.command.type === "basic" || a.command.type === "skill")) attack("ally", a.command.type, a.command.target, 0);
    if (a.feedback.enemyActs && (after.mode === "classic" || distance(after.enemy.pos, before.plan.target) === 1)) attack("enemy", before.plan.action, before.plan.target, a.side === "enemy" ? 0 : 240);
    if (a.command.type === "capture") {
      const pos = center(after.enemy.pos), p = Math.min(1, age / 620);
      c.save(); c.strokeStyle = "#eacd76"; c.globalAlpha = 1 - p; c.lineWidth = 2;
      const radius = 38 - Math.min(1, p * 2) * 24;
      if (after.result !== "capture") c.setLineDash([5, 5]);
      c.beginPath(); c.ellipse(pos.x, pos.y, radius, radius, 0, 0, Math.PI * 2); c.stroke();
      c.setLineDash([]); c.fillStyle = "#eacd76";
      for (let n = 0; n < 12; n++) {
        const angle = n * Math.PI / 6 + p * 1.4, r = Math.max(3, 45 * (1 - p * 1.5));
        c.fillRect(pos.x + Math.cos(angle) * r, pos.y + Math.sin(angle) * r, 2, 2);
      }
      if (after.result === "capture" && p > 0.4) this.burst(pos.x, pos.y, (p - 0.4) / 0.6, "#eacd76", 16);
      c.font = "bold 12px monospace"; c.fillStyle = "#fff0cf"; c.textAlign = "center";
      c.fillText(a.feedback.label, 240, 24); c.restore();
    }
  }
  private drawBattle(
    g: Game,
    time: number,
    reduced: boolean,
    selection: string,
  ): void {
    const c = this.ctx,
      b = g.battle;
    if (!b) return;
    const size = 72,
      left = 60,
      top = 0;
    c.fillStyle = "#10272a";
    c.fillRect(0, 0, 480, 360);
    const plan = b.plan;
    const hits = affectedCells(
      b,
      { ...b.enemy, pos: plan.destination },
      plan.action,
      plan.target,
    );
    if (b.mode === "classic") {
      const gradient = c.createLinearGradient(0, 0, 0, 360);
      gradient.addColorStop(0, "#254d43"); gradient.addColorStop(1, "#122a30");
      c.fillStyle = gradient; c.fillRect(0, 0, 480, 360);
      for (const fighter of [b.ally, b.enemy]) {
        c.fillStyle = "#7c9e6655"; c.beginPath();
        c.ellipse(left + fighter.pos.x * size + size / 2, fighter.pos.y * size + size * .55 + 22, 58, 16, 0, 0, Math.PI * 2); c.fill();
      }
    }
    for (let y = 0; b.mode !== "classic" && y < 5; y++)
      for (let x = 0; x < 5; x++) {
        const p = { x, y },
          cell = b.cells[y * 5 + x];
        const px = left + x * size,
          py = top + y * size;
        c.fillStyle =
          cell?.terrain === "grass"
            ? "#3b6545"
            : cell?.terrain === "water"
              ? "#336778"
              : cell?.terrain === "fire"
                ? "#94533e"
                : (x + y) % 2
                  ? "#304b46"
                  : "#354f48";
        c.fillRect(px + 1, py + 1, size - 2, size - 2);
        if (cell?.terrain === "grass") {
          c.fillStyle = "#78a260";
          for (let n = 0; n < 5; n++)
            c.fillRect(px + 8 + n * 12, py + 14 + (n % 2) * 10, 3, 12);
        }
        if (cell?.terrain === "water") {
          c.fillStyle = "#81b4bf";
          c.fillRect(px + 12 + (reduced ? 0 : Math.sin(time / 800 + y) * 3), py + 24, 30, 2);
          c.fillRect(px + 32, py + 48, 26, 2);
        }
        if (cell?.terrain === "fire") {
          c.fillStyle = "#f4c57d";
          c.font = "22px monospace";
          c.fillText("♨", px + 26, py + 43 + (reduced ? 0 : Math.sin(time / 180 + x) * 2));
        }
        if (!b.result && hits.some((h) => same(h, p))) {
          c.strokeStyle = "#ed917b";
          c.lineWidth = 2;
          c.setLineDash([5, 4]);
          c.strokeRect(px + 6, py + 6, size - 12, size - 12);
          c.setLineDash([]);
        }
        if (
          !b.result &&
          selection === "move" &&
          !b.moved &&
          distance(p, b.ally.pos) === 1 &&
          !same(p, b.enemy.pos)
        ) {
          c.strokeStyle = "#eacd76";
          c.lineWidth = 2;
          c.strokeRect(px + 4, py + 4, size - 8, size - 8);
        }
        if (!b.result && same(plan.destination, p) && !same(p, b.enemy.pos)) {
          c.fillStyle = "#ed917b";
          c.font = "14px monospace";
          c.fillText("↘", px + size - 20, py + 19);
        }
      }
    const action = this.action?.from.battle?.id === b.id ? this.action : null;
    const age = action ? time - action.start : Infinity;
    const before = action?.from.battle;
    const enter = reduced ? 1 : Math.min(1, Math.max(0, (time - this.enteredAt) / 280));
    for (const side of ["ally", "enemy"] as const) {
      const fighter = b[side];
      const previous = before?.[side];
      const motion = reduced ? 1 : Math.min(1, age / (side === "enemy" ? 260 : 150));
      const smooth = 1 - Math.pow(1 - Math.max(0, motion), 3);
      const pos = previous ? { x: previous.pos.x + (fighter.pos.x - previous.pos.x) * smooth, y: previous.pos.y + (fighter.pos.y - previous.pos.y) * smooth } : fighter.pos;
      let x = left + pos.x * size + size / 2, y = top + pos.y * size + size * 0.55;
      const attacking = action && (side === "ally" ? action.side !== "enemy" && ["basic", "skill"].includes(action.command.type) : action.feedback.enemyActs && before?.plan.action !== "defend" && (b.mode === "classic" || distance(fighter.pos, before!.plan.target) === 1));
      const attackAge = age - (side === "ally" || action?.side === "enemy" ? 0 : 240);
      if (!reduced && attacking && attackAge >= 0 && attackAge < 220) {
        const target = side === "ally" && (action.command.type === "basic" || action.command.type === "skill") ? action.command.target : before!.plan.target;
        const pulse = Math.sin(Math.PI * attackAge / 220) * 11;
        x += Math.sign(target.x - fighter.pos.x) * pulse;
        y += Math.sign(target.y - fighter.pos.y) * pulse;
      }
      const loss = side === "ally" ? action?.feedback.allyLoss : action?.feedback.enemyLoss;
      if (!reduced && loss && age > 240 && age < 440) x += Math.sin((age - 240) / 15) * 3 * (1 - (age - 240) / 200);
      c.save();
      c.globalAlpha = enter;
      this.livingCreature(fighter.speciesId, x, y + (1 - enter) * 9, time, reduced, b.mode === "classic" ? 6 : 4);
      c.restore();
      const barX = left + pos.x * size + 8, barY = top + pos.y * size + size - 12;
      const hpProgress = reduced ? 1 : Math.min(1, Math.max(0, (age - 180) / 220));
      const shownHp = previous ? previous.hp + (fighter.hp - previous.hp) * hpProgress : fighter.hp;
      c.fillStyle = "#14272b"; c.fillRect(barX, barY, size - 16, 4);
      c.fillStyle = side === "ally" ? "#eacd76" : "#ed917b";
      c.fillRect(barX, barY, ((size - 16) * shownHp) / creatureMaxHp(fighter.speciesId, creatureLevel(fighter), b.balance), 4);
      const defending = fighter.guarding || (action && age < 500 && (side === "ally" ? action.command.type === "defend" : action.feedback.enemyActs && (before?.plan.action === "defend" || (b.mode !== "classic" && distance(fighter.pos, before!.plan.target) !== 1))));
      if (defending) {
        c.strokeStyle = "#c4e3d8"; c.lineWidth = 2;
        c.beginPath(); c.ellipse(x, y - 5, 24, 28, 0, 0, Math.PI * 2); c.stroke();
        c.fillStyle = "#f4f1de"; c.font = "12px monospace"; c.fillText("◇", barX + size - 28, barY - 30);
      }
      if (loss && age >= 240 && age < 620) {
        c.save(); c.globalAlpha = Math.min(1, (620 - age) / 150);
        c.fillStyle = "#fff0cf"; c.strokeStyle = "#14272b"; c.lineWidth = 3; c.font = "bold 15px monospace";
        const label = `−${loss}`;
        const floatY = Math.max(16, y - 22 - Math.min(18, (age - 240) / 18));
        c.strokeText(label, x - 12, floatY); c.fillText(label, x - 12, floatY); c.restore();
      }
    }
    if (action && !reduced) this.drawAction(action, time);
    c.font = "9px monospace";
    c.fillStyle = "#88a89b";
  }
}
