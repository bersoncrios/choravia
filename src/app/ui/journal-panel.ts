import { activitiesView } from "../application/exploration-activities.js";
import { ChangeDetectionStrategy, Component, Input, signal } from "@angular/core";
import type { Game } from "../domain/game.js";
import { journalView } from "../application/exploration-journal.js";

type JournalSection = "map" | "ecos" | "activities";
type EcoFilter = "all" | "seen" | "owned";

@Component({
  selector: "ww-journal-panel",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`
    :host { display: block; min-width: 0; }
    .journal { display: grid; gap: 1rem; min-width: 0; color: #f5f4e8; overflow-wrap: anywhere; }
    .journal * { box-sizing: border-box; }
    .journal h3, .journal h4, .journal p { margin: 0; }
    .journal h3 { font-size: 1.35rem; }
    .journal h4 { font-size: 1rem; line-height: 1.35; }
    .journal p, .journal li { line-height: 1.55; }
    .journal-header { display: grid; gap: .6rem; }
    .journal-eyebrow { font-size: .68rem; font-weight: 800; letter-spacing: .1em; color: #c5d794; }
    .journal-progress { font-size: .85rem; color: #d9dec9; }
    .journal-nav, .journal-filters { display: flex; flex-wrap: wrap; gap: .45rem; }
    .journal button { min-height: 44px; min-width: 0; max-width: 100%; padding: .65rem .8rem; border: 1px solid #7e8e70; border-radius: 10px; background: #fffdf4; color: #26382d; font: inherit; font-weight: 650; white-space: normal; cursor: pointer; }
    .journal-nav button { flex: 1 1 110px; }
    .journal-filters button { flex: 1 1 75px; font-size: .82rem; }
    .journal button[aria-pressed="true"] { background: #315743; border-color: #7e8e70; color: #fffdf4; }
    .journal button:hover:not(:disabled) { background: #e5ecd9; border-color: #6f8544; }
    .journal button[aria-pressed="true"]:hover { background: #3d674e; color: #fffdf4; }
    .journal button:focus-visible { outline: 3px solid #e2c575; outline-offset: 3px; }
    .journal-section { display: grid; gap: .85rem; }
    .journal-note { font-size: .82rem; color: #d9dec9; line-height: 1.55; }
    .journal-route { display: grid; gap: 1.8rem; margin: 0; padding: 0; list-style: none; }
    .journal-region, .journal-eco, .journal-milestones { padding: 1rem; border: 1px solid #c8ceb8; border-radius: 14px; background: #f5f4e8; color: #26382d; }
    .journal-region { position: relative; display: grid; gap: .65rem; }
    .journal-route > .journal-region:not(:last-child)::after { position: absolute; bottom: -1.6rem; left: 50%; content: "↓"; color: #e3d28f; font-size: 1.15rem; }
    .journal-region[aria-current="location"] { border-left: 4px solid #6f8544; }
    .journal-region-heading { display: flex; flex-wrap: wrap; align-items: baseline; gap: .4rem .65rem; }
    .journal-region-heading h4 { flex: 1 1 150px; }
    .journal-state { display: inline-block; padding: .2rem .45rem; border-radius: 6px; background: #e3e9d8; color: #365139; font-size: .72rem; font-weight: 750; }
    .journal-state.current { background: #315743; color: #fffdf4; }
    .journal-region p, .journal-eco p { font-size: .84rem; }
    .journal-region dl, .journal-eco dl { display: grid; gap: .45rem; margin: 0; font-size: .8rem; line-height: 1.5; }
    .journal-region dl div, .journal-eco dl div { display: grid; gap: .12rem; }
    .journal dt { font-weight: 750; }
    .journal dd { margin: 0; color: #526149; }
    .journal-activities { margin: 0; padding-left: 1.1rem; color: #526149; font-size: .8rem; }
    .journal-next { padding-top: .55rem; border-top: 1px solid #d5dac8; color: #526149; }
    .journal-ecos, .journal-field-list, .journal-training-list { display: grid; gap: .75rem; }
    .journal-eco { display: grid; gap: .7rem; }
    .journal-eco-heading { display: flex; gap: .7rem; align-items: center; }
    .journal-eco-art { display: grid; place-items: center; flex: 0 0 48px; width: 48px; height: 48px; border-radius: 12px; background: #e0e9d6; color: #35543b; font-size: 1.8rem; border-bottom: 4px solid var(--eco-color, #8c9e7b); }
    .journal-eco-title { min-width: 0; display: grid; gap: .2rem; }
    .journal-element { color: #526149; font-size: .78rem; }
    .journal-unknown { background: #e9ecdf; border-style: dashed; }
    .journal-empty { padding: 1rem; border: 1px dashed #8d9e78; border-radius: 12px; font-size: .85rem; }
    .journal-milestones { display: grid; gap: .7rem; }
    .journal-milestones ul { display: grid; gap: .75rem; list-style: none; margin: 0; padding: 0; }
    .journal-milestones li { display: grid; gap: .2rem; font-size: .85rem; }
    .journal-milestones span { color: #526149; font-size: .8rem; }
    @media (max-width: 360px) {
      .journal-region, .journal-eco, .journal-milestones { padding: .75rem; }
      .journal-nav button { flex-basis: 100%; }
      .journal-filters button { padding-inline: .55rem; }
    }
  `],
  template: `
    <section class="journal" aria-label="Diário de exploração">
      <header class="journal-header">
        <p class="journal-eyebrow">MEMÓRIAS DO CAMINHO</p>
        <h3>Diário de exploração</h3>
        <p class="journal-progress">{{ view().visitedCount }} / {{ view().regions.length }} regiões visitadas · {{ view().seenCount }} / {{ view().ecos.length }} espécies observadas</p>
      </header>

      <nav class="journal-nav" aria-label="Seções do diário">
        <button type="button" (click)="section.set('map')" [attr.aria-pressed]="section() === 'map'">Mapa de regiões</button>
        <button type="button" (click)="section.set('ecos')" [attr.aria-pressed]="section() === 'ecos'">Diário dos Ecos</button>
        <button type="button" (click)="section.set('activities')" [attr.aria-pressed]="section() === 'activities'">Atividades de campo</button>
      </nav>

      @if (section() === 'map') {
        <section class="journal-section" aria-label="Mapa de regiões">
          <p class="journal-note">Os portais seguem este circuito. Ao sair de uma região, você chega à próxima; o último portal retorna à clareira inicial.</p>
          <ol class="journal-route" aria-label="Circuito de portais">
            @for (region of view().regions; track region.id) {
              <li class="journal-region" [attr.aria-current]="region.current ? 'location' : null">
                <div class="journal-region-heading">
                  <h4>{{ region.name }}</h4>
                  <span class="journal-state" [class.current]="region.current">{{ region.current ? 'Você está aqui' : region.visited ? 'Visitada' : 'Ainda não visitada' }}</span>
                </div>
                <p>{{ region.subtitle }}</p>
                <dl><div><dt>Habitats</dt><dd>{{ region.habitats.join(' · ') }}</dd></div></dl>
                <div><p><strong>O que explorar</strong></p><ul class="journal-activities">@for (activity of region.activities; track activity) { <li>{{ activity }}</li> }</ul></div>
                <p class="journal-next">Próximo portal → {{ region.nextName }}</p>
              </li>
            }
          </ol>
          <p class="journal-note">Este mapa orienta a caminhada. As travessias continuam acontecendo pelos portais do mundo.</p>
        </section>
      } @else if (section() === 'ecos') {
        <section class="journal-section" aria-label="Diário dos Ecos">
          <p class="journal-note">{{ view().ownedCount }} / {{ view().ecos.length }} espécies estão na sua coleção. Observe um Eco em encontro ou duelo, ou conheça-o pela sua coleção, para registrar seus detalhes.</p>
          <nav class="journal-filters" aria-label="Filtrar Ecos do diário">
            <button type="button" (click)="filter.set('all')" [attr.aria-pressed]="filter() === 'all'">Todos</button>
            <button type="button" (click)="filter.set('seen')" [attr.aria-pressed]="filter() === 'seen'">Observados</button>
            <button type="button" (click)="filter.set('owned')" [attr.aria-pressed]="filter() === 'owned'">Na coleção</button>
          </nav>
          <div class="journal-ecos" aria-live="polite">
            @for (eco of filteredEcos(); track eco.id) {
              <article class="journal-eco" [class.journal-unknown]="!eco.seen">
                <div class="journal-eco-heading">
                  <span class="journal-eco-art" aria-hidden="true" [style.--eco-color]="eco.seen ? eco.color : '#8c9e7b'">{{ eco.seen ? eco.glyph : '?' }}</span>
                  <div class="journal-eco-title"><h4>{{ eco.seen ? eco.name : 'Eco ainda não observado' }}</h4>@if (eco.seen) { <span class="journal-element">{{ eco.element }} · {{ eco.owned ? 'Na coleção' : 'Observado' }}</span> }</div>
                </div>
                @if (eco.seen) {
                  <p>{{ eco.description }}</p>
                  <dl><div><dt>Habilidade de combate</dt><dd>{{ eco.skill }}</dd></div><div><dt>Onde encontrar</dt><dd>{{ eco.habitats.join(' · ') }}</dd></div></dl>
                } @else {
                  <p>Uma descoberta espera por você nas trilhas. Seus detalhes aparecem após a primeira observação.</p>
                }
              </article>
            } @empty {
              <p class="journal-empty">Nenhum Eco corresponde a este filtro. Continue explorando para fazer novas descobertas.</p>
            }
          </div>
        </section>
      }

      @if (section() === 'activities') {
        <section class="journal-section" aria-label="Atividades de campo">
          <h4>Memórias da floresta · {{ activities().restored }} / 5</h4>
          <p class="journal-note">Cada elemento ajuda a restaurar o ambiente. Você também pode resolver cada mecanismo manualmente, sem custo e com o mesmo resultado.</p>
          <div class="journal-field-list">
            @for (mechanism of activities().mechanisms; track mechanism.id) {
              <article class="journal-region"><h4>{{ mechanism.complete ? '✓ ' : '○ ' }}{{ mechanism.name }}</h4><p>{{ mechanism.region }} · {{ mechanism.element }}</p><p>{{ mechanism.description }}</p><span class="journal-state">{{ mechanism.complete ? 'Restaurada' : 'Aproxime-se no mapa para interagir' }}</span></article>
            }
          </div>
          <h4>Revanche de treino</h4>
          <p class="journal-note">Vença o duelo inicial para liberar a revanche. Treinos registram vitórias, melhor rodada e estratégias de habilidade ou defesa. Sem Sementes, XP, captura ou progresso das Trilhas do dia.</p>
          <div class="journal-training-list">
            @for (rival of activities().training; track rival.id) {
              <article class="journal-region"><h4>{{ rival.name }} · {{ rival.region }}</h4>
                <p>{{ rival.unlocked ? 'Treino disponível perto do duelista' : 'Vença o duelo inicial para liberar' }}</p>
                @if (rival.wins) { <p>{{ rival.wins }} vitórias · Melhor marca: {{ rival.bestRound }} rodadas</p> }
                <p>{{ rival.skill ? '✓' : '○' }} Vitória com habilidade · {{ rival.guard ? '✓' : '○' }} Vitória com defesa</p>
              </article>
            }
          </div>
        </section>
      }
      <section class="journal-milestones" aria-label="Marcos da expedição">
        <h4>Marcos da expedição</h4>
        <ul>
          <li><strong>{{ restored === true ? '✓ Luz de Iara restaurada' : '○ Uma luz para Iara' }}</strong><span>{{ restored === null ? 'Abra a mochila para consultar a restauração de Iara.' : restored ? 'O marco da clareira permanece iluminado.' : 'Reúna ervas e seiva, fabrique uma lanterna na mochila e entregue no marco da clareira.' }}</span></li>
          <li><strong>{{ sealCount() === 3 ? '✓ Santuário restaurado' : '○ Santuário da Clareira Antiga' }}</strong><span>{{ sealCount() }} / 3 selos ativados. {{ sealCount() === 3 ? 'Os três elementos voltaram a ressoar.' : 'Aproxime-se dos selos com Ecos de Fogo, Elétrico e Terra.' }}</span></li>
        </ul>
      </section>
    </section>
  `,
})
export class JournalPanelComponent {
  @Input({ required: true }) game!: Game;
  @Input() restored: boolean | null = null;
  readonly section = signal<JournalSection>("map");
  readonly filter = signal<EcoFilter>("all");
  view() { return journalView(this.game); }
  activities() { return activitiesView(this.game); }
  filteredEcos() { return this.view().ecos.filter(eco => this.filter() === "all" || (this.filter() === "seen" ? eco.seen : eco.owned)); }
  sealCount(): number { return Math.min(3, Math.max(0, this.game.resonanceStep ?? 0)); }
}
