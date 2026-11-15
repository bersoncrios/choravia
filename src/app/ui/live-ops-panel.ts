import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, signal } from "@angular/core";
import { SPECIES, type SpeciesId } from "../domain/game.js";
import { BADGE_SYMBOLS, EMPTY_LIVE_CONTENT, type LiveContent, type LiveOpsRequest, type LiveOpsResult, type CustomAccessory, type BadgeDefinition, type BalanceEntry, type AccessoryShape, type BadgeSymbol, type ContentAuditEntry } from "../domain/live-ops.js";
@Component({
 selector: "ww-live-ops-panel", standalone: true, changeDetection: ChangeDetectionStrategy.OnPush,
 template: `
 <section class="live-ops-editor" aria-label="Conteúdo e eventos">
  <h3>Conteúdo e eventos</h3><p class="store-note">Publique peças na loja, ajuste atributos e reconheça jogadores. Alterações de atributos entram fora de batalhas em andamento.</p>
  <label>Motivo da alteração (compartilhado)<input aria-label="Motivo administrativo compartilhado" [value]="reason" (input)="reasonChange.emit($any($event.target).value)" minlength="5" maxlength="240" placeholder="Ex.: evento de aniversário da floresta" aria-describedby="live-ops-reason-help" /></label>
  <small id="live-ops-reason-help" class="live-ops-help">Esse motivo também vale para concessões de Sementes, cosméticos e redefinições. Mínimo de 5 caracteres.</small>
  <details><summary>Acessórios da loja</summary>
   <div class="live-ops-list">@for (item of content.accessories; track item.id) { <button (click)="accessory.set(copy(item))" [disabled]="busy()">{{ item.name }} · {{ item.active ? 'Publicado' : 'Retirado' }}</button> }</div>
   <button (click)="newAccessory()" [disabled]="busy()">Novo acessório</button>
   <div class="live-ops-form">
    <label>Nome do acessório<input aria-label="Nome do acessório" maxlength="60" [value]="accessory().name" (input)="patchAccessory('name', $any($event.target).value)" /></label>
    <label>Descrição do acessório<textarea maxlength="240" [value]="accessory().description" (input)="patchAccessory('description', $any($event.target).value)"></textarea></label>
    <div class="live-ops-row"><label>Preço em Sementes<input type="number" min="0" max="10000" [value]="accessory().price" (input)="patchAccessory('price', +$any($event.target).value)" /></label><label>Cor do acessório<input type="color" [value]="accessory().color" (input)="patchAccessory('color', $any($event.target).value)" /></label></div>
    <label>Modelo visual<select aria-label="Modelo visual" [value]="accessory().shape" (change)="patchAccessory('shape', $any($event.target).value)"><option value="pin">Broche</option><option value="scarf">Lenço</option><option value="crown">Coroa</option></select></label>
    <div class="accessory-sample" [style.color]="accessory().color" aria-label="Prévia do acessório">{{ accessory().shape === 'crown' ? '♛' : accessory().shape === 'scarf' ? '≈' : '◆' }}</div>
    <label class="live-ops-check"><input type="checkbox" [checked]="accessory().active" (change)="patchAccessory('active', $any($event.target).checked)" /> Disponível na loja</label>
    <button class="primary" (click)="saveAccessory()" [disabled]="!canSave()">Salvar acessório</button>
   </div>
  </details>
  <details><summary>Balanceamento dos Ecos</summary><div class="live-ops-form">
   <label>Eco<select aria-label="Eco" [value]="balance().id" (change)="selectBalance($any($event.target).value)">@for (eco of species; track eco.id) { <option [value]="eco.id">{{ eco.name }}</option> }</select></label>
   <button (click)="selectBalance(balance().id)" [disabled]="busy()">Carregar versão atual dos atributos</button>
   <div class="live-ops-row"><label>PV base (20–200)<input type="number" min="20" max="200" [value]="balance().hp" (input)="patchBalance('hp', +$any($event.target).value)" /></label><label>Ataque (1–50)<input type="number" min="1" max="50" [value]="balance().attack" (input)="patchBalance('attack', +$any($event.target).value)" /></label><label>Defesa (1–50)<input type="number" min="1" max="50" [value]="balance().defense" (input)="patchBalance('defense', +$any($event.target).value)" /></label></div>
   <p class="store-note">XP e níveis são preservados. Reduzir PV limita a vida atual; aumentar PV não cura o Eco.</p>
   <button class="primary" (click)="saveBalance()" [disabled]="!canSave()">Publicar balanceamento</button>
  </div></details>
  <details><summary>Badges de eventos e marcos</summary>
   <div class="live-ops-list">@for (item of content.badges; track item.id) { <button (click)="badge.set(copy(item))" [disabled]="busy()">{{ symbols[item.symbol] }} {{ item.name }} · {{ item.active ? 'Ativa' : 'Inativa' }}</button> }</div>
   <button (click)="newBadge()" [disabled]="busy()">Nova badge</button>
   <div class="live-ops-form">
    <label>Nome da badge<input maxlength="60" [value]="badge().name" (input)="patchBadge('name', $any($event.target).value)" /></label>
    <label>Descrição da badge<textarea maxlength="240" [value]="badge().description" (input)="patchBadge('description', $any($event.target).value)"></textarea></label>
    <div class="live-ops-row"><label>Categoria<select aria-label="Categoria" [value]="badge().category" (change)="patchBadge('category', $any($event.target).value)"><option value="event">Evento</option><option value="milestone">Marco</option><option value="special">Especial</option></select></label><label>Cor da badge<input type="color" [value]="badge().color" (input)="patchBadge('color', $any($event.target).value)" /></label><label>Símbolo<select aria-label="Símbolo" [value]="badge().symbol" (change)="patchBadge('symbol', $any($event.target).value)"><option value="star">★ Estrela</option><option value="leaf">❧ Folha</option><option value="flame">♨ Chama</option><option value="gem">◆ Cristal</option><option value="crown">♛ Coroa</option></select></label></div>
    <label class="live-ops-check"><input type="checkbox" [checked]="badge().active" (change)="patchBadge('active', $any($event.target).checked)" /> Permitir novas concessões</label>
    <button class="primary" (click)="saveBadge()" [disabled]="!canSave()">Salvar badge</button>
    <label>UID para conceder badge<input [value]="grantUid() || targetUid || ''" (input)="grantUid.set($any($event.target).value)" placeholder="Selecione um jogador ou cole o UID" /></label>
    <p class="store-note">Concede a badge selecionada acima após publicá-la. O motivo identifica o evento ou marco e fica registrado para o jogador.</p>
    <button (click)="grantBadge()" [disabled]="!canSave() || !(grantUid() || targetUid)">Conceder badge selecionada</button>
   </div>
  </details>
  <details><summary>Histórico de conteúdo e badges</summary><button (click)="refreshAudit()" [disabled]="busy()">Atualizar histórico de conteúdo</button>
   @for (entry of audit(); track entry.id) { <article class="gm-message"><strong>{{ actionLabel(entry.action) }} · {{ entry.entityPath }}</strong><p>{{ entry.reason }}</p><small>{{ auditDate(entry.createdAt) }} · {{ entry.actorUid }}</small></article> } @empty { <p class="store-note">Carregue o histórico para consultar as alterações.</p> }
  </details>
  @if (message()) { <p class="gm-message" role="status">{{ message() }}</p> } @if (error()) { <p class="online-error" role="alert">{{ error() }}</p> }
 </section>`,
})
export class LiveOpsPanelComponent {
 @Input() content: LiveContent = EMPTY_LIVE_CONTENT;
 @Input() targetUid: string | null = null;
 @Input() reason = "";
 @Output() readonly reasonChange = new EventEmitter<string>();
 @Input() loadAudit!: () => Promise<ContentAuditEntry[]>;
 readonly audit = signal<ContentAuditEntry[]>([]);
 async refreshAudit() { this.busy.set(true); this.error.set(""); try { this.audit.set(await this.loadAudit()); } catch (e) { this.error.set((e as Error).message); } finally { this.busy.set(false); } }
 @Input() execute!: (request: LiveOpsRequest) => Promise<LiveOpsResult>;
 readonly species = SPECIES; readonly symbols = BADGE_SYMBOLS;
 readonly grantUid = signal(""); readonly busy = signal(false); readonly message = signal(""); readonly error = signal("");
 readonly accessory = signal<CustomAccessory>(this.accessoryDraft());
 readonly badge = signal<BadgeDefinition>(this.badgeDraft());
 readonly balance = signal<BalanceEntry>({ id: "WW001", hp: 36, attack: 10, defense: 7, revision: 0 });
 private ids = new Map<string, string>();
 actionLabel(action: string) { return ({ saveAccessory: "Acessório publicado", saveBalance: "Atributos atualizados", saveBadge: "Badge publicada", grantBadge: "Badge concedida" } as Record<string, string>)[action] ?? action; }
 auditDate(time: number) { return new Date(time).toLocaleString("pt-BR"); }
 copy<T>(value: T): T { return structuredClone(value); }
 private accessoryDraft(): CustomAccessory { return { id: `custom-${crypto.randomUUID()}`, name: "", description: "", shape: "pin", color: "#f0cf78", price: 50, active: true, revision: 0 }; }
 private badgeDraft(): BadgeDefinition { return { id: `badge-${crypto.randomUUID()}`, name: "", description: "", color: "#f0cf78", symbol: "star", category: "event", active: true, revision: 0 }; }
 newAccessory() { this.accessory.set(this.accessoryDraft()); }
 newBadge() { this.badge.set(this.badgeDraft()); }
 patchAccessory<K extends keyof CustomAccessory>(key: K, value: CustomAccessory[K]) { this.accessory.update(v => ({ ...v, [key]: value })); }
 patchBadge<K extends keyof BadgeDefinition>(key: K, value: BadgeDefinition[K]) { this.badge.update(v => ({ ...v, [key]: value })); }
 patchBalance(key: "hp" | "attack" | "defense", value: number) { this.balance.update(v => ({ ...v, [key]: value })); }
 selectBalance(id: SpeciesId) { const saved = this.content.balance.find(v => v.id === id), base = SPECIES.find(v => v.id === id)!; this.balance.set(saved ? this.copy(saved) : { id, hp: base.hp, attack: base.attack, defense: base.defense, revision: 0 }); }
 canSave() { return !this.busy() && this.reason.trim().length >= 5; }
 async saveAccessory() { const v = this.copy(this.accessory()); if (await this.run({ method: "saveAccessory", value: v })) this.accessory.set({ ...v, revision: v.revision + 1 }); }
 async saveBalance() { const v = this.copy(this.balance()); if (await this.run({ method: "saveBalance", value: v })) this.balance.set({ ...v, revision: v.revision + 1 }); }
 async saveBadge() { const v = this.copy(this.badge()); if (await this.run({ method: "saveBadge", value: v })) this.badge.set({ ...v, revision: v.revision + 1 }); }
 async grantBadge() { await this.run({ method: "grantBadge", badgeId: this.badge().id, targetUid: (this.grantUid() || this.targetUid || "").trim() }); }
 private async run(payload: { method: "saveAccessory"; value: CustomAccessory } | { method: "saveBalance"; value: BalanceEntry } | { method: "saveBadge"; value: BadgeDefinition } | { method: "grantBadge"; badgeId: string; targetUid: string }): Promise<boolean> {
  if (!this.canSave()) return false;
  this.busy.set(true); this.error.set(""); this.message.set("");
  const reason = this.reason.trim();
  const key = JSON.stringify({ ...payload, reason });
  const requestId = this.ids.get(key) ?? crypto.randomUUID(); this.ids.set(key, requestId);
  try { const result = await this.execute({ ...payload, requestId, reason }); this.message.set(result.replay ? "Operação já confirmada. Nenhuma duplicação realizada." : "Operação confirmada e registrada no histórico administrativo."); return true; }
  catch (error) { this.error.set(error instanceof Error ? error.message : "Não foi possível confirmar. Tente novamente com os mesmos dados."); return false; }
  finally { this.busy.set(false); }
 }
}
