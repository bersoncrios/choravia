import { Command, Game, initialGame, reduceGame } from "../domain/game.js";
import type { SaveRepository } from "./ports.js";
export class Session {
  state: Game = initialGame();
  ready = false;
  saving = false;
  error = "";
  loadedFromDisk = false;
  private idleWaiters: Array<() => void> = [];
  constructor(
    private readonly repository: SaveRepository,
    private readonly changed: () => void,
  ) {}
  async load(timeoutMs = 3000): Promise<void> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(
          () =>
            reject(
              new Error(
                "A leitura do save demorou demais. Recarregue para recuperar o progresso ou escolha jogar sem salvar.",
              ),
            ),
          timeoutMs,
        );
      });
      const saved = await Promise.race([this.repository.load(), timeout]);
      this.loadedFromDisk = saved !== null;
      this.state = saved ?? initialGame();
      this.ready = true;
    } catch (e) {
      this.error = e instanceof Error ? e.message : "Falha ao ler progresso.";
    } finally {
      clearTimeout(timer);
    }
    this.changed();
  }
  async dispatch(command: Command): Promise<void> {
    if (!this.ready || this.saving) return;
    const next = reduceGame(this.state, command);
    if (next === this.state) return;
    this.saving = true;
    this.error = "";
    this.changed();
    try {
      await this.repository.save(next);
      this.state = next;
    } catch (e) {
      this.state = next;
      this.error = e instanceof Error ? e.message : "Falha ao salvar.";
      this.ready = false;
    } finally {
      this.saving = false;
      for (const done of this.idleWaiters.splice(0)) done();
      this.changed();
    }
  }
  async whenIdle(): Promise<void> {
    if (this.saving)
      await new Promise<void>((resolve) => this.idleWaiters.push(resolve));
  }
  async reconcile(transform: (current: Game) => Game): Promise<void> {
    while (this.saving) await this.whenIdle();
    if (!this.ready || !this.repository.replace) throw new Error("Aguarde o armazenamento da expedição.");
    const current = this.state;
    const next = transform(current);
    if (JSON.stringify(next) === JSON.stringify(current)) return;
    this.saving = true;
    this.changed();
    try { this.state = await this.repository.replace({ ...structuredClone(next), revision: current.revision }); }
    finally { this.saving = false; for (const done of this.idleWaiters.splice(0)) done(); this.changed(); }
  }
  async replaceState(
    game: Game,
    expectedRevision = this.state.revision,
  ): Promise<void> {
    await this.whenIdle();
    if (!this.ready || this.state.revision !== expectedRevision)
      throw Object.assign(
        new Error("O progresso local mudou durante a recuperação."),
        { code: "local/conflict" },
      );
    if (!this.repository.replace)
      throw new Error("Este armazenamento não permite recuperar saves.");
    this.saving = true;
    this.changed();
    try {
      this.state = await this.repository.replace({
        ...structuredClone(game),
        revision: Math.max(game.revision, this.state.revision),
      });
    } finally {
      this.saving = false;
      for (const done of this.idleWaiters.splice(0)) done();
      this.changed();
    }
  }
}
export class MemorySave implements SaveRepository {
  async load(): Promise<null> {
    return null;
  }
  async save(_game: Game): Promise<void> {}
  async replace(game: Game): Promise<Game> {
    return { ...structuredClone(game), revision: game.revision + 1 };
  }
}
