import { ChangeDetectionStrategy, Component, HostListener, Input, OnDestroy, signal } from "@angular/core";
import type { CloudStatus } from "../../application/cloud-save.js";

@Component({
  selector: "ww-save-toast",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="announcement" [attr.role]="kind() === 'failure' ? 'alert' : 'status'" aria-atomic="true">
      @if (kind()) {
        <button type="button" class="toast" [class.failure]="kind() === 'failure'"
          [class.leaving]="leaving()" (click)="dismiss()">
          {{ kind() === 'failure' ? 'Falha ao salvar — exporte o estado' : 'Progresso salvo ✓' }}
        </button>
      }
    </div>
  `,
  styles: `
    :host { position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%); z-index: 1200; width: max-content; max-width: 90vw; pointer-events: none; }
    .announcement { display: flex; justify-content: center; }
    .toast { pointer-events: auto; max-width: 100%; border: 1px solid #7bb99a; border-radius: 12px; padding: 12px 20px; background: #173f2c; color: #fff; font: inherit; font-size: 14px; line-height: 1.4; box-shadow: 0 6px 24px #0005; cursor: pointer; animation: save-toast-in 180ms ease-out both; }
    .toast.failure { background: #641f28; border-color: #d88b94; }
    .toast.leaving { animation: save-toast-out 180ms ease-in both; }
    .toast:focus-visible { outline: 2px solid white; outline-offset: 3px; }
    @keyframes save-toast-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes save-toast-out { from { opacity: 1; } to { opacity: 0; } }
    @media (max-width: 600px) { .toast { font-size: 13px; padding: 10px 16px; } }
    @media (prefers-reduced-motion: reduce) { .toast, .toast.leaving { animation: none; } .toast.leaving { opacity: 0; } }
  `,
})
export class SaveToastComponent implements OnDestroy {
  readonly kind = signal<"success" | "failure" | null>(null);
  readonly leaving = signal(false);
  private hideTimer?: ReturnType<typeof setTimeout>;
  private removeTimer?: ReturnType<typeof setTimeout>;

  @Input({ required: true })
  set status(status: CloudStatus) {
    if (status === "pending" || status === "conflict") this.show("failure");
    else if (status === "saved") this.show("success");
  }

  private show(kind: "success" | "failure"): void {
    this.clearTimers();
    this.leaving.set(false);
    this.kind.set(kind);
    if (kind === "success") this.hideTimer = setTimeout(() => this.dismiss(), 2500);
  }

  @HostListener("document:keydown.escape")
  dismiss(): void {
    if (!this.kind() || this.leaving()) return;
    this.clearTimers();
    this.leaving.set(true);
    this.removeTimer = setTimeout(() => { this.kind.set(null); this.leaving.set(false); },
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 180);
  }

  private clearTimers(): void {
    clearTimeout(this.hideTimer);
    clearTimeout(this.removeTimer);
  }

  ngOnDestroy(): void { this.clearTimers(); }
}
