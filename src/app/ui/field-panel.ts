import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, signal } from "@angular/core";
import { FIELD_ITEMS, type FieldAction, type FieldState } from "../domain/field.js";

type InventoryFilter = "all" | "resources" | "tools";
type ItemId = "herb" | "fruit" | "sap" | "crystal" | "lantern";
interface BagItem { id: ItemId; name: string; symbol: string; category: Exclude<InventoryFilter, "all">; description: string; origin: string; use: string }

@Component({
  selector: "ww-field-panel",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`:host { display: block; min-width: 0; }
.field-panel { display: grid; gap: 1rem; min-width: 0; color: #f5f4e8; overflow-wrap: anywhere; }
.field-panel * { box-sizing: border-box; }
.field-panel header .field-eyebrow { color: #c5d794; }
.field-panel > .field-note { color: #d9dec9; }
.field-panel h3, .field-panel h4, .field-panel p { margin: 0; }
.field-panel h3 { font-size: 1.35rem; }
.field-panel h4 { font-size: 1rem; }
.field-panel p { line-height: 1.55; }
.field-panel header, .field-quest, .field-recipe, .field-renewal { display: grid; gap: .65rem; }
.field-eyebrow { font-size: .68rem; font-weight: 800; letter-spacing: .1em; color: #49623e; }
.field-panel button { min-height: 44px; max-width: 100%; padding: .65rem .85rem; border: 1px solid #7e8e70; border-radius: 10px; background: #fffdf4; color: #26382d; font: inherit; font-weight: 650; white-space: normal; overflow-wrap: anywhere; cursor: pointer; }
.field-panel button.primary { background: #315743; border-color: #315743; color: #fffdf4; }
.field-panel button:disabled { opacity: .55; cursor: default; }
.field-panel button:focus-visible { outline: 3px solid #9c741f; outline-offset: 3px; }
.field-panel small, .field-note { font-size: .8rem; line-height: 1.55; color: #526149; }
.field-quest, .field-recipe, .field-renewal { padding: 1rem; border: 1px solid #c8ceb8; border-radius: 14px; background: #f5f4e8; color: #26382d; }
.field-quest { border-left: 4px solid #7f8d45; }
.field-steps { display: grid; gap: .75rem; list-style: none; padding: 0; margin: .3rem 0; }
.field-steps li { display: grid; gap: .2rem; padding-left: .65rem; border-left: 2px solid #b1b79d; }
.field-steps li.complete { border-color: #3d6e4c; }
.field-steps strong { font-size: .88rem; }
.field-steps span { font-size: .8rem; line-height: 1.5; color: #526149; }
.field-reward { padding: .75rem; border-radius: 10px; background: #e0ecd9; color: #254f32; }
.field-recipe-title { display: flex; gap: .55rem; align-items: center; }
.field-recipe-title > span { font-size: 1.8rem; color: #86631d; }
.field-cost { font-weight: 750; font-size: .85rem; }
.field-filters { display: flex; flex-wrap: wrap; gap: .4rem; }
.field-filters button { flex: 1 1 90px; padding-inline: .6rem; font-size: .83rem; white-space: nowrap; overflow-wrap: normal; }
.field-filters button[aria-pressed="true"] { background: #315743; color: #fffdf4; border-color: #315743; }
.field-items { display: grid; gap: .75rem; }
.field-item { padding: .9rem; border: 1px solid #c8ceb8; border-radius: 12px; background: #fffdf4; color: #26382d; }
.field-item-heading { display: flex; align-items: center; gap: .5rem; margin-bottom: .5rem; }
.field-item-heading h4 { flex: 1; min-width: 0; }
.field-item-symbol { flex: 0 0 1.8rem; text-align: center; font-size: 1.4rem; color: #526c42; }
.field-count { font-size: .9rem; font-weight: 800; flex-shrink: 0; }
.field-item > p { font-size: .83rem; }
.field-item dl { display: grid; gap: .4rem; margin: .7rem 0 .25rem; font-size: .78rem; line-height: 1.5; }
.field-item dl div { display: grid; grid-template-columns: 3.2rem minmax(0, 1fr); gap: .35rem; }
.field-item dt { font-weight: 750; }
.field-item dd { margin: 0; color: #526149; }
.field-empty .field-count { color: #68725e; }
.field-error { padding: .85rem; border: 1px solid #a55943; border-radius: 12px; background: #fff0e8; color: #26382d; display: grid; gap: .6rem; }
.field-status { padding: .65rem; border-radius: 8px; background: #e9eddf; color: #26382d; font-size: .85rem; }
@media (max-width: 360px) {
  .field-quest, .field-recipe, .field-renewal, .field-item { padding: .75rem; }
  .field-item-heading { flex-wrap: wrap; }
}
`],
  template: `
    <section class="field-panel" aria-label="Mochila e missão de campo" [attr.aria-busy]="busy">
      <header>
        <p class="field-eyebrow">COLHER, CRIAR, RESTAURAR</p>
        <h3>Mochila de campo</h3>
        <p>Os materiais encontrados no caminho ficam aqui. Suas roupas e acessórios continuam no guarda-roupa.</p>
      </header>

      @if (error) {
        <div class="field-error" role="alert">
          <p>{{ error }}</p>
          <button type="button" (click)="refresh.emit()" [disabled]="busy">Tentar novamente</button>
        </div>
      }
      @if (!canAct) { <p class="field-note">Volte à exploração para fabricar ou entregar itens.</p> }
      @if (busy) {
        <p class="field-status" role="status">Confirmando sua mochila…</p>
      }

      @if (state; as bag) {
        <section class="field-quest" aria-label="Missão Uma luz para Iara">
          <p class="field-eyebrow">{{ bag.restored ? 'MEMÓRIA RESTAURADA' : 'MISSÃO DE CAMPO' }}</p>
          <h4>Uma luz para Iara</h4>
          <p>Iara cuida de quem chega à clareira. Prepare uma lanterna de seiva para devolver a luz ao marco ao lado dela.</p>
          <ol class="field-steps">
            <li [class.complete]="bag.restored || bag.inventory.lantern > 0 || hasIngredients()">
              <strong>{{ bag.restored || bag.inventory.lantern > 0 || hasIngredients() ? '✓' : '1.' }} Reúna os materiais</strong>
              <span>Ervas: {{ bag.inventory.herb }} / 2 · Seiva: {{ bag.inventory.sap }} / 2</span>
            </li>
            <li [class.complete]="bag.restored || bag.inventory.lantern > 0">
              <strong>{{ bag.restored || bag.inventory.lantern > 0 ? '✓' : '2.' }} Fabrique uma lanterna</strong>
              <span>A receita está logo abaixo.</span>
            </li>
            <li [class.complete]="bag.restored">
              <strong>{{ bag.restored ? '✓' : '3.' }} Ilumine o marco de Iara</strong>
              <span>{{ bag.restored ? 'A luz voltou e permanece na sua expedição.' : 'Volte ao marco de recuperação da Clareira do Primeiro Canto.' }}</span>
            </li>
          </ol>
          @if (bag.restored) {
            <p class="field-reward" role="status">Missão concluída! O marco ganhou uma luz permanente. Iara continua recuperando seus Ecos gratuitamente.</p>
          } @else {
            <p class="field-note">Recompensa: restauração permanente do marco. Entregar consome 1 lanterna.</p>
            @if (!canRestore) {
              <p class="field-note">Aproxime-se do marco de Iara na clareira para entregar.</p>
            }
            <button type="button" class="primary" (click)="requestRestore()" [disabled]="busy || !!error || !canAct || !canRestore || bag.inventory.lantern < 1">Entregar lanterna e restaurar marco</button>
          }
        </section>

        <section class="field-recipe" aria-label="Receita de lanterna de seiva">
          <div class="field-recipe-title"><span aria-hidden="true">✧</span><h4>Lanterna de seiva</h4></div>
          <p>Trance as ervas ao redor da seiva luminosa para criar uma luz para o marco.</p>
          <p class="field-cost">2 Ervas + 2 Seivas → 1 Lanterna</p>
          <button type="button" (click)="requestCraft()" [disabled]="busy || !!error || !canAct || !hasIngredients() || bag.inventory.lantern >= 99">Fabricar lanterna</button>
          @if (!hasIngredients()) { <small>Encontre ervas e seiva no mapa da clareira. Cada ponto disponível rende 2 unidades.</small> }
          @if (bag.inventory.lantern >= 99) { <small>Você chegou ao limite de 99 lanternas na mochila.</small> }
        </section>

        <nav class="field-filters" aria-label="Filtrar itens da mochila">
          <button type="button" (click)="filter.set('all')" [attr.aria-pressed]="filter() === 'all'">Todos</button>
          <button type="button" (click)="filter.set('resources')" [attr.aria-pressed]="filter() === 'resources'">Recursos</button>
          <button type="button" (click)="filter.set('tools')" [attr.aria-pressed]="filter() === 'tools'">Ferramentas</button>
        </nav>
        <div class="field-items" aria-label="Catálogo e quantidades da mochila" aria-live="polite" aria-atomic="false">
          @for (item of visibleItems(); track item.id) {
            <article class="field-item" [class.field-empty]="bag.inventory[item.id] === 0">
              <div class="field-item-heading">
                <span class="field-item-symbol" aria-hidden="true">{{ item.symbol }}</span>
                <h4>{{ item.name }}</h4>
                <span class="field-count" [attr.aria-label]="bag.inventory[item.id] + ' unidades'">×{{ bag.inventory[item.id] }}</span>
              </div>
              <p>{{ item.description }}</p>
              <dl><div><dt>Origem</dt><dd>{{ item.origin }}</dd></div><div><dt>Uso</dt><dd>{{ item.use }}</dd></div></dl>
              @if (bag.inventory[item.id] === 0) { <small>Nenhuma unidade na mochila.</small> }
            </article>
          }
        </div>
        <section class="field-renewal" aria-label="Renovação dos recursos">
          <h4>A floresta se renova</h4>
          <p>Ervas, frutos, seiva, cristais e esconderijos podem ser recolhidos uma vez por ciclo. Os baús de história são únicos e permanecem abertos.</p>
          @if (now !== null) {
            <p>Próxima renovação: <strong>{{ nextRenewal() }}</strong>.</p>
          } @else {
            <p>Conecte-se para confirmar a próxima renovação.</p>
          }
          <small>O ciclo muda às 00h UTC. O horário acima aparece no fuso deste dispositivo, a partir da última confirmação da conta.</small>
          <button type="button" (click)="refresh.emit()" [disabled]="busy">Atualizar mochila e renovação</button>
        </section>
      } @else if (!busy && !error) {
        <p class="field-note">Abra sua mochila para consultar materiais e começar a missão de Iara.</p>
        <button type="button" (click)="refresh.emit()">Carregar mochila</button>
      }
    </section>
  `,
})
export class FieldPanelComponent {
  @Input() state: FieldState | null = null;
  @Input() busy = false;
  @Input() error = "";
  @Input() now: number | null = null;
  @Input() canRestore = false;
  @Input() canAct = true;
  @Output() readonly action = new EventEmitter<FieldAction>();
  @Output() readonly refresh = new EventEmitter<void>();
  readonly filter = signal<InventoryFilter>("all");
  readonly items: readonly BagItem[] = FIELD_ITEMS.map(item => ({
    ...item,
    category: item.category === "resource" ? "resources" : "tools",
    symbol: ({ herb: "❧", fruit: "●", sap: "◒", crystal: "◆", lantern: "✧" })[item.id],
  }));

  visibleItems(): readonly BagItem[] {
    return this.items.filter(item => this.filter() === "all" || item.category === this.filter());
  }
  hasIngredients(): boolean {
    return !!this.state && this.state.inventory.herb >= 2 && this.state.inventory.sap >= 2;
  }
  requestCraft(): void {
    if (!this.busy && !this.error && this.canAct && this.hasIngredients() && this.state!.inventory.lantern < 99) this.action.emit({ type: "craft" });
  }
  requestRestore(): void {
    if (!this.busy && !this.error && this.canAct && this.canRestore && this.state && !this.state.restored && this.state.inventory.lantern > 0) this.action.emit({ type: "restore" });
  }
  nextRenewal(): string {
    if (this.now === null || !Number.isFinite(this.now)) return "aguardando confirmação";
    const next = (Math.floor(this.now / 86400000) + 1) * 86400000;
    return new Date(next).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZoneName: "short" });
  }
}
