import { type LiveContent, type LiveOpsRequest, type PlayerBadge } from "../domain/live-ops.js";
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  HostListener,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  signal,
} from "@angular/core";
import type { Game, Command, SpeciesId } from "../domain/game.js";
import { SPECIES, species } from "../domain/game.js";
import type { CreatureMapping } from "../application/account-expedition.js";
import type { DailyContractType } from "../domain/daily-challenges.js";
import type { OnlineState } from "../domain/online.js";
import type { DailyBoard } from "../domain/daily-challenges.js";
import type { FirebaseGateway } from "../adapters/firebase.js";
import { firebaseConfig } from "../adapters/firebase-config.js";
import { BrowserPendingStore } from "../adapters/pending.js";
import {
  OnlineSession,
  parseInvite,
  inviteLink,
} from "../application/online-session.js";
import type { Invite } from "../application/online-session.js";
import {
  firebaseFeedback,
  type FirebasePhase,
} from "../application/firebase-feedback.js";
import type { AccountAccess, UserProfile } from "../application/cloud-save.js";
import { profileInitials } from "../application/profile.js";
import type { GameMasterRequest, GameMasterResponse } from "../domain/game-master.js";

@Component({
  selector: "ww-online-panel",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: ` <section
    class="online-panel"
    aria-label="Conta e trocas"
  >
    <div class="section-title">
      <div>
        <p class="eyebrow">VÍNCULOS QUE VIAJAM</p>
        <h2>Sua conta e trocas</h2>
      </div>
      <span class="connection-status">{{ identity() || "Conectando" }}</span>
    </div>
    <p class="online-intro">
      Sua expedição, seus Ecos e suas trocas ficam vinculados à conta Google.
    </p>
    @if (profile(); as user) {
      <div
        class="account-profile"
        id="ww-account-profile"
        tabindex="-1"
        aria-label="Perfil da conta conectada"
      >
        @if (user.photoURL && !photoFailed()) {
          <img
            [src]="user.photoURL"
            alt=""
            referrerpolicy="no-referrer"
            (error)="photoFailed.set(true)"
          />
        } @else {
          <span class="profile-avatar">{{ initials(user.name) }}</span>
        }
        <div>
          <strong>{{ user.name }}</strong
          ><span>{{ user.email }}</span
          ><small>Conta Google conectada</small>
        </div>
        <button (click)="google(false)" [disabled]="busy() || mode()">
          Trocar conta
        </button>
        <button (click)="logout()" [disabled]="busy()">Sair</button>
      </div>
    }
    <div class="online-toolbar">
      @if (!profile()) {
        <button
          (click)="google(false)"
          [disabled]="!clientReady() || busy() || mode()"
        >
          Entrar com Google
        </button>
      }
      @if (existingAccount()) {
        <button (click)="google(true)" [disabled]="busy() || mode()">
          Abrir conta Google existente
        </button>
      }
      <button
        (click)="connect()"
        [disabled]="!enabled || busy() || !configured"
      >
        Conectar / sincronizar
      </button>

    </div>
    @if (authMessage()) {
      <p class="auth-result" role="status">{{ authMessage() }}</p>
    }
    @if (authError()) {
      <p class="online-error" role="alert">
        <strong>Autenticação:</strong> {{ authError() }}
      </p>
    }
    @if (profileSaveError()) {
      <p class="online-error" role="alert"><strong>Perfil Firestore:</strong> {{ profileSaveError() }}</p>
    }
    <p class="online-status" role="status">{{ status() }}</p>
    @if (contentError()) { <p class="online-error" role="alert">Catálogo e badges: {{ contentError() }}</p><button (click)="refreshLiveContent()">Atualizar catálogo e badges</button> }
    @if (gameMasterRoleError()) {
      <p class="online-error" role="alert">{{ gameMasterRoleError() }}</p>
      <button (click)="refreshGameMasterAccess()">Verificar acesso Game Master</button>
    }
    @if (error()) {
      <p class="online-error" role="alert">
        <strong>Encontros e trocas:</strong> {{ error() }}
      </p>
    }
    @if (hasPending()) {
      <button (click)="retry()" [disabled]="busy()">
        Repetir pedido pendente
      </button>
    }
    @if (state(); as snapshot) {
      <div class="online-inventory-heading">
        <h3>Seus Ecos para trocas</h3>
        <span
          >{{ snapshot.creatures.length }} Ecos{{
            snapshot.nextCursor ? " · mais disponíveis" : ""
          }}</span
        >
      </div>
      @if (snapshot.nextCursor) {
        <button (click)="more()" [disabled]="busy() || !ready() || !canEnter">
          Carregar mais Ecos
        </button>
      }
      @if (snapshot.encounter) {
        <p class="online-intro">
          Há uma batalha da versão anterior em andamento. Ela será retomada antes de sincronizar a coleção.
        </p>
        <button (click)="abandon()" [disabled]="busy() || !ready() || !canEnter">
          Encerrar encontro e liberar Eco
        </button>
      }
      <div class="trade-columns">
        <section aria-label="Criar oferta de troca">
          <h3>Deixe um convite</h3>
          @if (snapshot.offer; as offer) {
            <p>
              Você oferece
              <strong>{{ species(offer.offeredSpeciesId).name }} · Nv. {{ offer.offeredLevel }}</strong> por
              <strong>{{ species(offer.requestedSpeciesId).name }}</strong
              >.
            </p>
            <p class="muted">
              Válido até {{ date(offer.expiresAt) }}. O Eco fica reservado até a
              troca, o cancelamento ou a expiração.
            </p>
            @if (link()) {
              <label
                >Link para compartilhar<input
                  id="ww-trade-link"
                  readonly
                  [value]="link()"
                  aria-label="Link da oferta"
              /></label>
              <div class="online-toolbar">
                <button (click)="copy()">Copiar link</button
                ><button (click)="share()">Compartilhar</button>
              </div>
            }
            <div class="online-toolbar">
              <button (click)="rotate()" [disabled]="busy() || !ready() || !canEnter">
                {{
                  link() ? "Substituir link anterior" : "Gerar novo link"
                }}</button
              ><button (click)="cancel()" [disabled]="busy() || !ready() || !canEnter">
                Cancelar oferta
              </button>
            </div>
          } @else {
            <label
              >Eco que você oferece<select
                [value]="offeredId()"
                (change)="selectOffered($event)"
              >
                <option value="">Escolha uma criatura</option>
                @for (eco of snapshot.creatures; track eco.id) {
                  @if (!eco.lock) {
                    <option [value]="eco.id">
                      {{ species(eco.speciesId).name }} · {{ eco.id.slice(-6) }}
                    </option>
                  }
                }
              </select></label
            >
            <label
              >Espécie que você quer<select
                [value]="requested()"
                (change)="selectRequested($event)"
              >
                @for (eco of catalog; track eco.id) {
                  <option [value]="eco.id">{{ eco.name }}</option>
                }
              </select></label
            >
            <p class="muted">
              Qualquer pessoa com o link e a espécie solicitada pode aceitar.
              Dura 24 horas. O Eco ofertado fica indisponível; se for seu único,
              você pode cancelar para voltar a batalhar.
            </p>
            <button
              (click)="create()"
              [disabled]="!offeredId() || busy() || !ready() || !canEnter"
            >
              Reservar Eco e criar convite
            </button>
          }
        </section>
        <section aria-label="Aceitar convite">
          <h3>Encontrou um convite?</h3>
          <label
            >Link recebido<input
              type="url"
              [value]="incomingText()"
              (input)="setIncoming($event)"
              placeholder="Cole o link de troca aqui"
              autocomplete="off" /></label
          ><button (click)="inspect()" [disabled]="busy()">Ver oferta</button>
          @if (preview(); as trade) {
            <p>
              Receba
              <strong>{{ species(trade.offeredSpeciesId).name }} · Nv. {{ trade.offeredLevel }}</strong>
              oferecendo
              <strong>{{ species(trade.requestedSpeciesId).name }}</strong
              >.
            </p>
            @if (trade.status === "open") {
              <label
                >Seu Eco para a troca<select
                  [value]="recipientId()"
                  (change)="selectRecipient($event)"
                >
                  <option value="">Escolha uma criatura</option>
                  @for (eco of snapshot.creatures; track eco.id) {
                    @if (
                      !eco.lock && eco.speciesId === trade.requestedSpeciesId
                    ) {
                      <option [value]="eco.id">
                        {{ species(eco.speciesId).name }} ·
                        {{ eco.id.slice(-6) }}
                      </option>
                    }
                  }
                </select></label
              >
              <p class="muted">
                Ao confirmar, as duas criaturas mudam de Guardião. O remetente
                pode estar offline.
              </p>
              <button
                class="primary"
                (click)="accept()"
                [disabled]="!recipientId() || busy() || !ready() || !canEnter"
              >
                Confirmar troca
              </button>
            } @else {
              <p class="trade-result">
                {{
                  trade.status === "completed"
                    ? "Troca salva nas duas contas."
                    : trade.status === "expired"
                      ? "Este convite expirou."
                      : "Este convite foi cancelado."
                }}
              </p>
            }
          }
        </section>
      </div>
    }
  </section>`,
})
export class OnlinePanelComponent implements OnChanges, OnDestroy {
  @Input() enabled = false;
  @Input() canEnter = true;
  @Output() readonly readyChanged = new EventEmitter<boolean>();
  @Output() readonly modeChanged = new EventEmitter<boolean>();
  @Output() readonly viewChanged = new EventEmitter<Game>();
  @Output() readonly busyChanged = new EventEmitter<boolean>();
  @Output() readonly accountChanged = new EventEmitter<AccountAccess | null>();
  @Output() readonly contentChanged = new EventEmitter<LiveContent | null>();
  @Output() readonly badgesChanged = new EventEmitter<PlayerBadge[]>();
  readonly contentError = signal("");
  private unsubscribeContent: (() => void) | undefined;
  @Output() readonly gameMasterAccessChanged = new EventEmitter<boolean>();
  readonly profile = signal<UserProfile | null>(null);
  readonly profileSaveError = signal("");
  readonly gameMasterRoleError = signal("");
  private unsubscribeRole: (() => void) | undefined;
  private roleEpoch = 0;
  readonly photoFailed = signal(false);
  readonly configured = !!firebaseConfig();
  readonly catalog = SPECIES;
  readonly species = species;
  readonly mode = signal(false);
  readonly ready = signal(false);
  readonly busy = signal(false);
  readonly clientReady = signal(false);
  readonly identity = signal("");
  readonly status = signal("A conexão online será preparada depois do mapa.");
  readonly error = signal("");
  readonly authMessage = signal("");
  readonly authError = signal("");
  readonly existingAccount = signal(false);
  readonly state = signal<OnlineState | null>(null);
  readonly link = signal("");
  readonly offeredId = signal("");
  readonly requested = signal<SpeciesId>("WW002");
  readonly recipientId = signal("");
  readonly incomingText = signal("");
  readonly hasPending = signal(false);
  readonly preview = signal<import("../domain/online.js").TradePreview | null>(
    null,
  );
  private client: FirebaseGateway | null = null;
  private controller: OnlineSession | null = null;
  private started = false;
  private incoming: Invite | null = null;
  private unsubscribeAccount: (() => void) | null = null;
  constructor() {
    this.incoming = parseInvite(location.href, location.origin);
    if (location.hash.startsWith("#t="))
      history.replaceState(
        history.state,
        "",
        location.pathname + location.search,
      );
    if (!this.configured)
      this.status.set(
        "Firebase não configurado. Configure a conexão para abrir sua expedição.",
      );
    else if (location.pathname.startsWith("/troca/") && !this.incoming)
      this.status.set(
        "Reabra o convite original para recuperar o token do link.",
      );
  }
  ngOnChanges(): void {
    if (this.enabled && !this.started && this.configured) {
      this.started = true;
      void this.initialize();
    }
  }
  private async initialize(): Promise<void> {
    this.busy.set(true);
    this.status.set("Preparando conexão com Firebase…");
    let phase: FirebasePhase = "authentication";
    try {
      const { FirebaseGateway } = await import("../adapters/firebase.js");
      const config = firebaseConfig();
      if (!config) return;
      this.client = new FirebaseGateway(config);
      this.unsubscribeAccount = this.client.observeAccount((account) =>
        this.publishAccount(account),
      );
      this.clientReady.set(true);
      await this.client.restoreAccount();
      if (!this.client.profile) { this.status.set("Entre com Google para abrir sua expedição."); return; }
      phase = "online";
      await this.attach();
    } catch (error) {
      this.failure(error, phase);
    } finally {
      this.busy.set(false);
    }
  }
  private failure(error: unknown, phase: FirebasePhase): void {
    const feedback = firebaseFeedback(error, phase);
    if (phase === "authentication") {
      this.authMessage.set("Esta tentativa de autenticação não foi concluída.");
      this.authError.set(feedback.message);
    } else this.error.set(feedback.message);
    this.status.set("Encontros e trocas ainda não conectados.");
    if (this.client?.signedIn)
      this.identity.set(this.client.anonymous ? "Visitante" : "Google");
    if (feedback.code === "auth/credential-already-in-use")
      this.existingAccount.set(true);
  }
  private async attach(): Promise<void> {
    if (!this.client) return;
    this.identity.set(this.client.anonymous ? "Visitante" : "Google");
    this.authMessage.set(
      this.client.anonymous
        ? "Sessão de visitante conectada."
        : "Login Google concluído.",
    );
    this.authError.set("");
    this.publishAccount(this.client.account());
    this.controller = new OnlineSession(
      this.client,
      () => this.sync(),
      () => crypto.randomUUID(),
      new BrowserPendingStore(),
    );
    await this.controller.load();
    this.sync();
    if (this.incoming && this.controller.ready) {
      await this.controller.inspect(this.incoming);
      this.sync();
    }
  }
  private sync(): void {
    const c = this.controller;
    if (!c) return;
    this.state.set(
      c.state ? { ...c.state, creatures: [...c.state.creatures] } : null,
    );
    this.ready.set(c.ready);
    this.busy.set(c.busy);
    this.error.set(c.error);
    this.hasPending.set(!!c.pending);
    this.preview.set(c.preview);
    this.link.set(c.outgoing ? inviteLink(c.outgoing, location.origin) : "");
    this.status.set(
      c.busy
        ? "Sincronizando sua conta…"
        : c.ready
          ? "Inventário salvo na sua conta."
          : c.pending
            ? "Há um pedido pendente. Repita para confirmar o resultado."
            : "A conexão precisa ser sincronizada.",
    );
    if (
      c.state &&
      !c.state.creatures.some((eco) => eco.id === this.offeredId() && !eco.lock)
    )
      this.offeredId.set("");
    if (
      c.state &&
      !c.state.creatures.some(
        (eco) => eco.id === this.recipientId() && !eco.lock,
      )
    )
      this.recipientId.set("");
    if (this.mode()) {
      this.viewChanged.emit(c.view);
      this.busyChanged.emit(c.busy || !c.ready);
    }
    this.readyChanged.emit(c.ready);
  }
  async connect(): Promise<void> {
    if (!this.enabled || this.busy()) return;
    if (!this.client) {
      await this.initialize();
      return;
    }
    let phase: FirebasePhase = "authentication";
    try {
      await this.client.restoreAccount();
      if (!this.client.profile) { this.status.set("Entre com Google para abrir sua expedição."); return; }
      this.authError.set("");
      phase = "online";
      if (this.controller?.uid === this.client.uid)
        await this.controller.refresh();
      else await this.attach();
      this.sync();
    } catch (error) {
      this.failure(error, phase);
    }
  }
  async google(existing: boolean): Promise<void> {
    if (!this.client || this.busy() || this.mode()) return;
    this.busy.set(true);
    this.authError.set("");
    this.error.set("");
    this.authMessage.set("Aguardando a escolha da conta Google…");
    let phase: FirebasePhase = "authentication";
    try {
      await this.client.google(existing);
      phase = "online";
      this.authMessage.set("Login Google concluído.");
      this.existingAccount.set(false);
      await this.attach();
    } catch (error) {
      this.failure(error, phase);
    } finally {
      this.busy.set(false);
    }
  }
  private publishAccount(account: AccountAccess | null): void {
    const oldUid = this.profile()?.uid;
    this.profile.set(account?.profile ?? null);
    if (oldUid !== account?.profile.uid) {
      this.stopGameMasterAccess();
      this.unsubscribeContent?.(); this.unsubscribeContent = undefined;
      this.contentChanged.emit(null); this.badgesChanged.emit([]); this.contentError.set("");
      this.photoFailed.set(false);
      if (this.mode()) this.leave();
      this.controller = null;
      this.state.set(null);
      this.ready.set(false);
      this.link.set("");
      this.preview.set(null);
      this.hasPending.set(false);
    }
    this.identity.set(
      account ? "Google" : this.client?.signedIn ? "Visitante" : "",
    );
    this.accountChanged.emit(account);
    const uid = account?.profile.uid;
    if (uid && this.client) {
      void this.client.syncUserProfile().then(
        () => this.profileSaveError.set(""),
        (error) => this.profileSaveError.set(error instanceof Error ? error.message : "Não foi possível salvar o perfil."),
      );
      if (!this.unsubscribeRole) this.refreshGameMasterAccess();
      if (!this.unsubscribeContent) this.refreshLiveContent();
    }
  }
  refreshLiveContent(): void {
    this.unsubscribeContent?.(); this.unsubscribeContent = undefined;
    const uid = this.profile()?.uid;
    this.contentError.set("");
    if (!uid || !this.client) return;
    this.unsubscribeContent = this.client.watchLiveContent(uid, value => { if (this.profile()?.uid === uid) this.contentChanged.emit(value); }, value => { if (this.profile()?.uid === uid) this.badgesChanged.emit(value); }, error => { if (this.profile()?.uid === uid) this.contentError.set(error.message); });
  }
  async liveOpsAudit() { if (!this.client) throw new Error("Aguarde a conexão da conta."); return this.client.liveOpsAudit(); }
  async liveOpsCall(request: LiveOpsRequest) {
    if (!this.client) throw new Error("Aguarde a conexão da conta.");
    return this.client.callLiveOps(request);
  }
  private stopGameMasterAccess(): void {
    this.roleEpoch++;
    this.unsubscribeRole?.();
    this.unsubscribeRole = undefined;
    this.gameMasterRoleError.set("");
    this.gameMasterAccessChanged.emit(false);
  }
  refreshGameMasterAccess(): void {
    this.stopGameMasterAccess();
    const uid = this.profile()?.uid, client = this.client;
    if (!uid || !client) return;
    const epoch = this.roleEpoch;
    this.unsubscribeRole = client.watchGameMasterRole(uid, isAdmin => {
      if (epoch !== this.roleEpoch || this.profile()?.uid !== uid) return;
      this.gameMasterRoleError.set("");
      this.gameMasterAccessChanged.emit(isAdmin);
    }, error => {
      if (epoch !== this.roleEpoch || this.profile()?.uid !== uid) return;
      this.unsubscribeRole?.();
      this.unsubscribeRole = undefined;
      this.gameMasterAccessChanged.emit(false);
      this.gameMasterRoleError.set(`Não foi possível verificar o acesso Game Master. ${error.message}`);
    });
  }
  async gameMasterCall(request: GameMasterRequest): Promise<GameMasterResponse> {
    if (!this.client) throw new Error("A conexão do painel Game Master não está pronta.");
    return this.client.callGameMaster(request);
  }
  readonly initials = profileInitials;
  async logout(): Promise<void> {
    if (!this.client || this.busy()) return;
    this.busy.set(true);
    try {
      this.leave();
      await this.client.logout();
      this.publishAccount(null);
      this.authMessage.set(
        "Você saiu da conta. Entre com Google para continuar sua expedição.",
      );
      this.authError.set("");
      this.error.set("");
      this.status.set("Entre com Google para recuperar o progresso da conta.");
    } catch (error) {
      this.failure(error, "authentication");
    } finally {
      this.busy.set(false);
    }
  }
  ngOnDestroy(): void {
    this.stopGameMasterAccess();
    this.unsubscribeContent?.();
    this.unsubscribeAccount?.();
  }
  enter(): void {
    if (!this.controller?.ready || !this.canEnter) return;
    this.mode.set(true);
    this.modeChanged.emit(true);
    this.sync();
  }
  leave(): void {
    this.mode.set(false);
    this.busyChanged.emit(false);
    this.modeChanged.emit(false);
  }
  async dispatch(command: Command): Promise<void> {
    await this.controller?.dispatch(command);
    this.sync();
  }
  async synchronizeExpedition(world: Game): Promise<{ mapping: CreatureMapping[]; creatures: import("../domain/online.js").ValidatedCreature[] }> {
    if (!this.client || !this.controller?.ready) throw new Error("Aguarde a conexão com sua conta.");
    if (this.controller.state?.encounter) throw new Error("Conclua a batalha anterior antes de reunir a coleção.");
    const uid = this.client.uid;
    const mapping: CreatureMapping[] = [];
    for (let start = 0; start < world.collection.length; start += 100) {
      const result = await this.client.call("syncExpedition", { creatures: world.collection.slice(start, start + 100) });
      if (uid !== this.client.uid) throw new Error("A conta mudou.");
      mapping.push(...result.mapping);
    }
    await this.controller.refresh();
    while (this.controller.state?.nextCursor && this.controller.ready) await this.controller.loadMore();
    if (uid !== this.client.uid || !this.controller.ready || this.controller.state?.nextCursor) throw new Error(this.controller.error || "Não foi possível carregar a coleção completa.");
    this.sync();
    return { mapping, creatures: this.controller.state?.creatures ?? [] };
  }
  async recordExpeditionDaily(cycleId: string, types: DailyContractType[]): Promise<void> {
    if (!this.client || !this.controller?.ready) throw new Error("Aguarde a conexão para registrar as trilhas.");
    await this.client.call("recordExpeditionDaily", { cycleId, types });
  }
  resumePreviousEncounter(world: Game): boolean {
    if (!this.controller?.state?.encounter || !this.controller.ready) return false;
    this.controller.adoptWorld(world);
    this.mode.set(true);
    this.modeChanged.emit(true);
    this.sync();
    return true;
  }
  async loadDailyBoard(): Promise<DailyBoard> {
    if (!this.client) throw new Error("Conecte-se para carregar os desafios diários.");
    return this.client.call("getDailyBoard", {});
  }
  async acknowledgeDailyRewards(receiptIds: string[]): Promise<void> {
    if (!this.client) throw new Error("Conecte-se para salvar as recompensas.");
    await this.client.call("ackDailyRewards", { receiptIds });
  }
  locked(id: string): boolean {
    return this.controller?.locked(id) ?? false;
  }
  async retry(): Promise<void> {
    await this.controller?.retry();
    this.sync();
  }
  @HostListener("window:online")
  @HostListener("window:focus") async onFocus(): Promise<void> {
    if (this.profile() && !this.unsubscribeRole) this.refreshGameMasterAccess();
    if (this.profile() && this.contentError()) this.refreshLiveContent();
    if (this.controller?.state && !this.busy() && !this.hasPending()) {
      await this.controller.refresh();
      this.sync();
    }
  }
  async more(): Promise<void> {
    await this.controller?.loadMore();
    this.sync();
  }
  async create(): Promise<void> {
    if (!this.canEnter) return;
    await this.controller?.createOffer(this.offeredId(), this.requested());
    this.sync();
  }
  async cancel(): Promise<void> {
    await this.controller?.cancelOffer();
    this.sync();
  }
  async rotate(): Promise<void> {
    await this.controller?.rotate();
    this.sync();
  }
  async abandon(): Promise<void> {
    await this.controller?.abandonEncounter();
    this.sync();
  }
  setIncoming(event: Event): void {
    this.incomingText.set((event.target as HTMLInputElement).value);
    this.incoming = null;
    this.recipientId.set("");
    this.preview.set(null);
  }
  async inspect(): Promise<void> {
    const invite =
      this.incoming ?? parseInvite(this.incomingText(), location.origin);
    if (!invite) {
      this.error.set("Use um link completo de troca de Choravia.");
      return;
    }
    this.incoming = invite;
    this.incomingText.set("");
    await this.controller?.inspect(invite);
    this.sync();
  }
  async accept(): Promise<void> {
    if (!this.canEnter) return;
    if (this.incoming)
      await this.controller?.accept(this.incoming, this.recipientId());
    this.sync();
  }
  selectOffered(event: Event): void {
    this.offeredId.set((event.target as HTMLSelectElement).value);
  }
  selectRequested(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    if (SPECIES.some((s) => s.id === value))
      this.requested.set(value as SpeciesId);
  }
  selectRecipient(event: Event): void {
    this.recipientId.set((event.target as HTMLSelectElement).value);
  }
  date(value: number): string {
    return new Date(value).toLocaleString("pt-BR");
  }
  async copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.link());
      this.status.set("Link copiado. Envie ao seu amigo.");
    } catch {
      const input = document.getElementById(
        "ww-trade-link",
      ) as HTMLInputElement | null;
      input?.focus();
      input?.select();
      this.status.set("Selecione e copie o link exibido.");
    }
  }
  async share(): Promise<void> {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Uma troca em Choravia",
          url: this.link(),
        });
      } catch {
        /* Closing the share sheet does not change the offer. */
      }
    } else await this.copy();
  }
}
