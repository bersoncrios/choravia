import type { FieldAction, FieldGateway, FieldState } from "../domain/field.js";

function pendingRequest(raw: string): { action: FieldAction; id: string } | null {
  try {
    const value = JSON.parse(raw);
    if (!value || typeof value !== "object" || typeof value.id !== "string" || !/^[A-Za-z0-9_-]{8,100}$/.test(value.id) || !value.action || typeof value.action !== "object") return null;
    const action = value.action;
    if (action.type === "gather" ? !["herb", "fruit", "sap", "crystal", "cache"].includes(action.node) || Object.keys(action).length !== 2 : !["craft", "treasure", "restore"].includes(action.type) || Object.keys(action).length !== 1) return null;
    return { action, id: value.id };
  } catch { return null; }
}

/** Separate ledger: a restored old world snapshot cannot reset field claims or materials. */
export class FieldSession {
  state: FieldState | null = null;
  now: number | null = null;
  busy = false;
  error = "";
  message = "";
  private epoch = 0;
  private uid = "";
  private gateway: FieldGateway | null = null;
  constructor(private readonly storage: Pick<Storage, "getItem" | "setItem" | "removeItem">, private readonly changed: () => void, private readonly requestId: () => string = () => crypto.randomUUID(), private readonly timeoutMs = 15000) {}
  private async confirmed<T>(operation: Promise<T>): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([operation, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("A conta não confirmou a operação. Reconecte e confira a mochila.")), this.timeoutMs); })]);
    } finally { clearTimeout(timer); }
  }
  bind(uid: string, gateway: FieldGateway | null): void {
    this.epoch++; this.uid = uid; this.gateway = gateway;
    this.state = null; this.now = null; this.busy = false; this.error = ""; this.message = "";
    this.changed();
  }
  private key(): string { return `choravia-field-pending:${this.uid}`; }
  async refresh(): Promise<void> {
    if (!this.gateway || this.busy) return;
    const epoch = this.epoch, key = this.key(), gateway = this.gateway;
    this.busy = true; this.error = ""; this.changed();
    try {
      const raw = this.storage.getItem(key);
      // A receipt replay resolves uncertain commits before a new operation is enabled.
      const pending = raw ? pendingRequest(raw) : null;
      if (raw && !pending) {
        this.storage.removeItem(key);
        this.message = "O registro local de uma operação estava inválido. Confira o estoque recuperado da conta.";
      }
      if (pending) {
        await this.confirmed(gateway.execute(pending.action, pending.id));
        if (this.storage.getItem(key) === raw) this.storage.removeItem(key);
      }
      const result = await this.confirmed(gateway.load());
      if (epoch !== this.epoch) return;
      this.state = result.state; this.now = result.now;
      if (pending) this.message = "A operação pendente foi conferida na conta.";
    } catch (error) {
      if (epoch === this.epoch) this.error = error instanceof Error ? error.message : "Não foi possível conferir a mochila.";
    } finally { if (epoch === this.epoch) { this.busy = false; this.changed(); } }
  }
  async perform(action: FieldAction): Promise<void> {
    if (!this.gateway || !this.state || this.busy || this.error) return;
    const epoch = this.epoch, key = this.key(), gateway = this.gateway;
    this.busy = true; this.error = ""; this.message = ""; this.changed();
    try {
      const id = this.requestId();
      const raw = JSON.stringify({ action, id });
      this.storage.setItem(key, raw);
      const result = await this.confirmed(gateway.execute(action, id));
      if (this.storage.getItem(key) === raw) this.storage.removeItem(key);
      if (epoch !== this.epoch) return;
      const previous = this.state;
      this.state = result.state; this.now = result.now;
      const gains = Object.entries(result.state.inventory).filter(([item, quantity]) => quantity > previous!.inventory[item as keyof FieldState["inventory"]]);
      this.message = previous!.revision === result.state.revision ? "Nenhum item alterado. Confira o estoque e a disponibilidade do ponto." : action.type === "restore" && !previous!.restored && result.state.restored ? "O marco de Iara voltou a brilhar. A clareira guarda sua ajuda." : action.type === "craft" && result.state.inventory.lantern > previous!.inventory.lantern ? "Lanterna de seiva criada e guardada na mochila." : gains.length ? `Guardado na mochila: ${gains.map(([item, quantity]) => `+${quantity - previous!.inventory[item as keyof FieldState["inventory"]]} ${{ herb: "erva luminosa", fruit: "fruto do bosque", sap: "seiva dourada", crystal: "cristal de memória", lantern: "lanterna de seiva" }[item]}`).join(", ")}.` : "Mochila conferida com o progresso atual da conta.";
    } catch (error) {
      if (epoch === this.epoch) this.error = `${error instanceof Error ? error.message : "Falha ao confirmar coleta."} Use Conferir mochila para verificar a operação antes de tentar outra.`;
    } finally { if (epoch === this.epoch) { this.busy = false; this.changed(); } }
  }
}
