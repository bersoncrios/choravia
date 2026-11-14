import { ChangeDetectionStrategy, Component, EventEmitter, Input, OnDestroy, Output, signal } from "@angular/core";

export type SyncModalState = "idle" | "syncing" | "saved" | "error";

@Component({
  selector: "ww-sync-modal",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (visible()) {
      <div class="sync-overlay">
        <section class="sync-panel" [class.failure]="phase() === 'error'" role="dialog" aria-label="Recuperação do progresso" [attr.aria-busy]="phase() === 'syncing'">
          <div role="status" aria-live="polite" aria-atomic="true">
            @if (phase() === 'syncing') { <span class="spinner" aria-hidden="true"></span> }
            <p>{{ phase() === 'syncing' ? 'Recuperando progresso…' : phase() === 'saved' ? 'Progresso recuperado ✓' : 'Falha ao recuperar progresso — tente novamente ou exporte o estado' }}</p>
          </div>
          @if (phase() === 'error') {
            <div class="actions">
              <button type="button" (click)="exportState.emit()">Exportar estado</button>
              <button type="button" (click)="retry.emit()">Tentar novamente</button>
            </div>
          }
        </section>
      </div>
    }
  `,
  styles: `
    :host { position: fixed; inset: 0; z-index: 1200; pointer-events: none; }
    .sync-overlay { position: absolute; inset: 0; display: grid; place-items: center; background: #07110db3; animation: sync-in 180ms ease-out; }
    .sync-panel { pointer-events: auto; width: max-content; max-width: 90vw; box-sizing: border-box; padding: 24px; border: 1px solid #7bb99a; border-radius: 16px; background: #173f2c; color: white; text-align: center; box-shadow: 0 12px 40px #0006; font-size: 16px; }
    .sync-panel.failure { background: #641f28; border-color: #d88b94; }
    p { margin: 12px 0; }
    .actions { display: flex; flex-wrap: wrap; justify-content: center; gap: 12px; }
    button { cursor: pointer; font: inherit; padding: 10px 14px; border: 1px solid #aac9b8; border-radius: 8px; background: #102c20; color: white; }
    button:focus-visible { outline: 2px solid white; outline-offset: 3px; }
    .spinner { display: inline-block; width: 24px; height: 24px; border: 3px solid #ffffff40; border-top-color: white; border-radius: 50%; animation: sync-spin 800ms linear infinite; }
    @keyframes sync-spin { to { transform: rotate(360deg); } }
    @keyframes sync-in { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
    @media (max-width: 600px) { .sync-panel { font-size: 14px; padding: 20px; } }
    @media (prefers-reduced-motion: reduce) { .sync-overlay, .spinner { animation: none; } }
  `,
})
export class SyncModalComponent implements OnDestroy {
  readonly visible = signal(false);
  readonly phase = signal<SyncModalState>("idle");
  @Output() readonly exportState = new EventEmitter<void>();
  @Output() readonly retry = new EventEmitter<void>();
  private timer?: ReturnType<typeof setTimeout>;

  @Input({ required: true }) set state(state: SyncModalState) {
    clearTimeout(this.timer);
    this.phase.set(state);
    if (state === "idle") this.visible.set(false);
    else if (state === "saved") {
      if (this.visible()) this.timer = setTimeout(() => this.visible.set(false), 1000);
    } else this.visible.set(true);
  }

  ngOnDestroy(): void { clearTimeout(this.timer); }
}
