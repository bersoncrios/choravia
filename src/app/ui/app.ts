import { DEFAULT_AUDIO_MIX, normalizeAudioMix, type AudioMix, type AudioChannel, type AudioCue } from "../domain/audio.js";
import { commandSound, battleFrameSound, levelIncreased } from "../application/audio-feedback.js";
import { fieldMechanisms, fieldMechanismReady } from "../domain/field-abilities.js";
import { JournalPanelComponent } from "./journal-panel.js";
import { FieldPanelComponent } from "./field-panel.js";
import { FieldSession } from "../application/field-session.js";
import { fieldCycle, type FieldAction, type FieldState } from "../domain/field.js";
import { fieldPoints, fieldAvailable } from "../domain/field-world.js";
import { SyncModalComponent, type SyncModalState } from "./sync-modal/sync-modal.js";
import { SaveToastComponent } from "./save-toast/save-toast.js";
import { LiveOpsPanelComponent } from "./live-ops-panel.js";
import { applyLiveContent } from "../application/live-content.js";
import { BADGE_SYMBOLS, isCustomAccessoryId, type LiveContent, type PlayerBadge, type LiveOpsRequest, type CustomAccessoryId } from "../domain/live-ops.js";
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  NgZone,
  OnDestroy,
  ViewChild,
  signal,
  inject,
  effect,
} from "@angular/core";
import {
  Game,
  Command,
  SpeciesId,
  SPECIES,
  SKILL_NAMES,
  ELEMENT_NAMES,
  activeCreature,
  initialGame,
  reduceGame,
  species,
  canCapture,
  captureChance,
  distance,
  same,
  layoutIn,
  RESONANCE_SEALS,
  REGION_NAMES,
  REGION_PORTALS,
  creatureLevel,
  creatureStats,
  creatureMaxHp,
  xpToNextLevel,
} from "../domain/game.js";
import { DailyActionQueue, dailyActionTypes, dailyCycle, reconcileExpedition, mergePreviousEncounter } from "../application/account-expedition.js";
import { frameGame, skillReady, type BattlePhase } from "../application/battle-playback.js";
import { visualFeedback, progressFeedback } from "../application/visual-feedback.js";
import { explorationObjective, battleGuidance } from "../application/game-guidance.js";
import type { DailyBoard } from "../domain/daily-challenges.js";
import { IndexedDbSave } from "../adapters/save.js";
import { Session } from "../application/session.js";
import { Renderer } from "../adapters/renderer.js";
import { GameAudio } from "../adapters/audio.js";
import { OnlinePanelComponent } from "./online-panel.js";
import { WelcomePageComponent } from "./welcome-page.js";
import {
  CloudSaveSession,
  type AccountAccess,
  type UserProfile,
  type CloudStatus,
} from "../application/cloud-save.js";
import { profileInitials } from "../application/profile.js";
import { STORE_ITEMS, type StoreItemId } from "../domain/store.js";
import type {
  GameMasterAuditEntry,
  GameMasterPlayer,
  GameMasterRequest,
  GameMasterResponse,
  GameMasterSearchResult,
} from "../domain/game-master.js";
import {
  DEFAULT_AVATAR,
  type Accessory,
  type AvatarAppearance,
  type HairColor,
  type HairStyle,
  type Outfit,
  type SkinTone,
} from "../domain/avatar.js";
interface Preferences {
  audio: AudioMix;
  sound: boolean;
  reduced: boolean;
  timing: boolean;
}
@Component({
  selector: "ww-app",
  standalone: true,
  imports: [JournalPanelComponent, FieldPanelComponent, OnlinePanelComponent, WelcomePageComponent, LiveOpsPanelComponent, SyncModalComponent, SaveToastComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
  <ww-sync-modal [state]="syncModalState()" (exportState)="exportSave()" (retry)="retrySyncModal()" />
  @if (!presentation() && accountAccessPresent() && accountSynchronized()) {
    <ww-save-toast [status]="cloudStatus()" />
  }
  @if (presentation()) {
    <ww-welcome-page [authenticated]="!!profile()" (enterGame)="enterJourney()" />
  }
  <div class="app-shell" [style.display]="presentation() ? 'none' : null" [attr.inert]="presentation() ? '' : null" [class.reduced-motion]="prefs().reduced" [class.drawer-open]="!!sidePanel()">
    @for (notice of feedbackNotices(); track notice.id) {
      <div class="feedback-toast" role="status" aria-live="polite">✧ {{ notice.text }}</div>
    }
    @if (!profile()) {
      <section class="account-gate" role="dialog" aria-modal="true" aria-labelledby="gate-title">
        <div class="account-gate-card">
          <img class="brand-mark brand-logo" src="/brand/choravia-mark.png" width="48" height="48" alt="" />
          <p class="eyebrow">SUA JORNADA COMEÇA COM VOCÊ</p>
          <h1 id="gate-title">Entre na floresta</h1>
          <p>Crie ou entre com sua conta Google para começar. Seu personagem e sua jornada ficam salvos na sua conta.</p>
          <button class="primary gate-login" (click)="signInForGame()" [disabled]="!onlinePanel?.clientReady() || onlinePanel?.busy()" autofocus>
            {{ onlinePanel?.busy() ? "Conectando…" : "Entrar com Google" }}
          </button>
          @if (onlinePanel?.existingAccount()) {
            <button class="quiet-button" (click)="useExistingGoogleAccount()" [disabled]="onlinePanel?.busy()">
              Usar conta Google já existente
            </button>
          }
          @if (onlinePanel?.authError(); as authError) {
            <p class="online-error" role="alert">{{ authError }}</p>
          } @else if (onlinePanel && !onlinePanel.configured) {
            <p class="online-error" role="alert">O login precisa da configuração Firebase deste projeto.</p>
          } @else if (!onlinePanel?.clientReady()) {
            <p class="muted">Preparando login seguro… Se não iniciar, recarregue a página.</p>
          }
          <small>Choravia não permite jogar como visitante.</small>
          <button class="quiet-button gate-login" (click)="showPresentation()">Voltar à apresentação</button>
        </div>
      </section>
    } @else if (profile() && loaded() && cloudStatus() === "loading" && (!game().avatar || hasUnchosenStarter())) {
      <section class="account-gate" role="status" aria-live="polite">
        <div class="account-gate-card">
          <p class="eyebrow">BEM-VINDO, {{ profile()!.name }}</p>
          <h1>Preparando sua expedição</h1>
          <p>Estamos carregando seu personagem e seu progresso salvo.</p>
        </div>
      </section>
    } @else if (creatingCharacter()) {
      <section class="character-creator" role="dialog" aria-modal="true" aria-labelledby="creator-title">
        <div class="character-creator-card">
          <p class="eyebrow">{{ game().avatar ? "SEU GUARDA-ROUPA" : "UM NOVO GUARDIÃO" }}</p>
          <h1 id="creator-title">{{ game().avatar ? "Mudar aparência" : "Como será sua aparência?" }}</h1>
          <p>{{ game().avatar ? "Experimente seu visual e salve quando estiver pronto. Seu progresso será preservado." : "Escolha as peças gratuitas para começar. Você poderá mudar seu visual depois." }}</p>
          <div class="avatar-preview" aria-label="Prévia do personagem">
            <div
              class="avatar-doll"
              [class.hair-curls]="avatarDraft().hair === 'curls'"
              [class.hair-long]="avatarDraft().hair === 'long'"
              [class.hair-braids]="avatarDraft().hair === 'braids'"
              [class.accessory-scarf]="avatarDraft().accessory === 'scarf'"
              [class.accessory-satchel]="avatarDraft().accessory === 'satchel'"
              [class.accessory-sun-scarf]="avatarDraft().accessory === 'sun-scarf'"
              [class.accessory-moon-pin]="avatarDraft().accessory === 'moon-pin'"
              [style.--skin-color]="skinColor()"
              [style.--hair-color]="hairColor()"
              [style.--outfit-color]="outfitColor()"
            >
              <span class="avatar-doll-hair"></span>
              <span class="avatar-doll-face"><i></i></span>
              <span class="avatar-doll-body"></span>
              <span class="avatar-doll-accessory"></span>
              @if (avatarDraft().customAccessory; as custom) { <span class="custom-avatar-accessory" [attr.data-shape]="custom.shape" [style.color]="custom.color">{{ custom.shape === 'crown' ? '♛' : custom.shape === 'scarf' ? '≈' : '◆' }}</span> }
            </div>
            <span>Seu Guardião</span>
          </div>
          <div class="avatar-options">
            <fieldset><legend>Tom de pele</legend>
              @for (tone of skinChoices; track tone.id) {
                <button [class.selected]="avatarDraft().skin === tone.id" [attr.aria-pressed]="avatarDraft().skin === tone.id" (click)="chooseSkin(tone.id)">{{ tone.label }}</button>
              }
            </fieldset>
            <fieldset><legend>Cabelo</legend>
              @for (style of hairChoices; track style.id) {
                <button [class.selected]="avatarDraft().hair === style.id" [attr.aria-pressed]="avatarDraft().hair === style.id" (click)="chooseHair(style.id)">{{ style.label }}</button>
              }
            </fieldset>
            <fieldset><legend>Cor do cabelo</legend>
              @for (color of hairColorChoices; track color.id) {
                <button [class.selected]="avatarDraft().hairColor === color.id" [attr.aria-pressed]="avatarDraft().hairColor === color.id" (click)="chooseHairColor(color.id)">{{ color.label }}</button>
              }
            </fieldset>
            <fieldset><legend>Roupa</legend>
              @for (outfit of outfitChoices; track outfit.id) {
                <button [attr.aria-label]="outfit.label" [class.selected]="avatarDraft().outfit === outfit.id" [attr.aria-pressed]="avatarDraft().outfit === outfit.id" (click)="chooseOutfit(outfit.id)">{{ outfit.label }} @if (game().avatar?.outfit === outfit.id) { <small aria-hidden="true">· Equipado</small> }</button>
              }
            </fieldset>
            <fieldset><legend>Acessório</legend>
              @for (item of accessoryChoices; track item.id) {
                <button [attr.aria-label]="item.label" [class.selected]="!avatarDraft().customAccessory && avatarDraft().accessory === item.id" [attr.aria-pressed]="!avatarDraft().customAccessory && avatarDraft().accessory === item.id" (click)="chooseAccessory(item.id)">{{ item.label }} @if (!game().avatar?.customAccessory && game().avatar?.accessory === item.id) { <small aria-hidden="true">· Equipado</small> }</button>
              }
              @for (item of ownedCustomAccessories(); track item.id) { <button [class.selected]="avatarDraft().customAccessory?.id === item.id" [attr.aria-pressed]="avatarDraft().customAccessory?.id === item.id" (click)="chooseCustomAccessory(item.id)">{{ item.name }}</button> }
            </fieldset>
          </div>
          <p class="free-items-note">Peças gratuitas e cosméticos desbloqueados. As escolhas são apenas visuais.</p>
          <button class="primary gate-login" (click)="confirmAvatar()" [disabled]="busy() || !loaded()">{{ game().avatar ? "Salvar aparência" : "Começar a jornada →" }}</button>
          @if (game().avatar) {
            <button class="quiet-button gate-login" (click)="cancelAvatar()" [disabled]="busy()">Cancelar</button>
          }
        </div>
      </section>
    } @else if (needsStarterChoice()) {
      <section class="character-creator" role="dialog" aria-modal="true" aria-labelledby="starter-title">
        <div class="character-creator-card starter-creator-card">
          <p class="eyebrow">SEU PRIMEIRO VÍNCULO</p>
          <h1 id="starter-title">Escolha seu Eco inicial</h1>
          <p>Todos os cinco estão disponíveis. Cada um tem um elemento e um jeito diferente de lutar.</p>
          <div class="starter-choices">
            @for (eco of catalog; track eco.id) {
              <button
                [class.selected]="starterDraft() === eco.id"
                [attr.aria-pressed]="starterDraft() === eco.id"
                (click)="starterDraft.set(eco.id)"
              >
                <span [style.color]="eco.color">{{ eco.glyph }}</span>
                <strong>{{ eco.name }}</strong>
                <small>{{ elementNames[eco.element] }}</small>
                <small>{{ eco.hp }} PV · {{ eco.attack }} ATQ · {{ eco.defense }} DEF</small>
              </button>
            }
          </div>
          <p class="free-items-note">Você poderá encontrar os outros Ecos durante a jornada.</p>
          <button class="primary gate-login" (click)="confirmStarter()" [disabled]="busy() || !loaded()">Começar com {{ species(starterDraft()).name }} →</button>
        </div>
      </section>
    }
    <header class="masthead" [attr.inert]="sidePanel() ? '' : null">
      <a class="wordmark" href="/" (click)="$event.preventDefault(); showPresentation()" aria-label="Choravia, início"
        ><img class="brand-mark brand-logo" src="/brand/choravia-mark.png" width="48" height="48" alt="" /> CHORA<span>VIA</span
        ><sup>ALPHA 01</sup></a
      >
      <div class="header-right">
        @if (profile(); as user) {
          <div
            class="header-profile"
            [attr.aria-label]="'Conectado como ' + user.name"
          >
            <span class="profile-avatar">{{ initials(user.name) }}</span
            ><strong>{{ user.name }}</strong>
          </div>
        }
        <span class="local-badge"
          ><i></i>
          {{
            profile() ? "EXPEDIÇÃO DA CONTA" : "CONECTE SUA CONTA"
          }}</span
        ><span class="seed-wallet" aria-label="Saldo de Sementes">{{ game().seeds ?? 120 }} ✦</span
        ><button
          class="store-button"
          (click)="release(); storeOpen.set(true)"
          [disabled]="!profile() || !game().avatar || hasUnchosenStarter() || onlineMode()"
        >Loja</button>
        @if (gameMaster()) {
          <button class="gm-button" (click)="openGameMaster()">GM</button>
        }
        <button class="expedition-menu-button" (click)="openSidePanel('companion')" aria-label="Abrir menu da expedição" aria-controls="expedition-drawer" [attr.aria-expanded]="!!sidePanel()" [disabled]="!profile()">☰ Menu</button>
        <button
          class="icon-button"
          (click)="togglePanel('settings')"
          aria-label="Abrir configurações"
          [attr.aria-expanded]="settings()"
        >
          ⚙
        </button>
      </div>
    </header>
    <main id="game-main" tabindex="-1">
      @if (profile() && accountAccessPresent() && (!connectionAvailable() || onlineMode())) {
        <section class="account-save" role="status" aria-live="polite">
          <div><strong>{{ !connectionAvailable() ? 'Sem conexão — expedição pausada' : 'Conclua a batalha salva para retomar sua expedição' }}</strong>
          <p>{{ !connectionAvailable() ? 'Seu progresso foi preservado. A expedição retoma automaticamente quando a conexão voltar.' : 'Ao terminar esta batalha, sua coleção será atualizada automaticamente.' }}</p></div>
        </section>
      }
      <section class="intro">
        <div>
          <p class="eyebrow">SEU CADERNO DE AVENTURAS</p>
          <h1>Sua expedição</h1>
        </div>
        <p class="intro-note">
          Explore no seu ritmo. Há sempre um novo vínculo pelo caminho.
        </p>
      </section>
      @if (profile() && cloudStatus() === "conflict") {
        <section class="account-save" aria-label="Salvamento da conta">
          <div>
            <span class="account-owner">{{ profile()?.name }}</span>
            <p>{{ cloudError() }}</p>
          </div>
          @if (cloudStatus() === "conflict") {
            <button (click)="useCloudSave()" [disabled]="cloudBusy()">
              Carregar progresso da conta
            </button>
            <button (click)="useLocalSave()" [disabled]="cloudBusy()">
              Enviar progresso deste dispositivo
            </button>
          }
        </section>
      }
      <div class="game-layout" [attr.inert]="sidePanel() ? '' : null">
        <section class="game-panel" aria-label="Jogo Choravia">
          <div class="scene-heading">
            <div>
              <span class="location-dot">◆</span
              ><strong>{{
                battleView().scene === "exploration"
                  ? regionNames[game().region ?? "clearing"]
                  : battleView().battle?.kind === "npc"
                    ? "Duelo amistoso"
                    : "Ritual da clareira"
              }}</strong
              ><span class="scene-sub">{{
                battleView().scene === "exploration"
                  ? regionSubtitle()
                  : (classicBattle() ? "RODADA " : "ARENA 5 × 5 · TURNO ") + battleView().battle?.round
              }}</span>
            </div>
            <span class="weather">{{
              battleView().scene === "exploration" ? "☼  DIA SERENO" : battleView().scene === "result" ? "◇ ENCONTRO ENCERRADO" : turnPhase() === "enemy" ? "◇ VEZ DO ADVERSÁRIO" : turnPhase() === "player" ? "◇ SUA AÇÃO" : "◇ SUA VEZ"
            }}</span>
          </div>
          @if (battleView().scene === "exploration") {
            <div class="current-objective" aria-label="Objetivo atual" aria-live="polite">
              <span class="eyebrow">PRÓXIMO PASSO</span>
              <strong>{{ objective().title }}</strong>
              <p>{{ objective().detail }}</p>
              @if (fieldState(); as bag) {
                <div class="field-mission-tracker"><span>✧ {{ bag.restored ? 'Marco de Iara restaurado' : bag.inventory.lantern ? 'Uma luz para Iara · entregue a lanterna no marco' : 'Uma luz para Iara · reúna 2 ervas e 2 seivas' }}</span><button class="quiet-button" (click)="openSidePanel('backpack')">Ver missão</button></div>
              }
            </div>
          }
          @if (battleView().battle; as b) {
            @if (b.rematch; as training) {
              <div class="training-objective" role="status"><strong>REVANCHE DE TREINO · {{ training.goal === 'skill' ? 'Vença usando uma habilidade' : 'Vença após defender ao menos uma vez' }}</strong><p>{{ (training.goal === 'skill' ? training.usedSkill : training.usedGuard) ? '✓ Ação do objetivo realizada; conclua com vitória.' : 'Experimente a estratégia indicada nesta luta.' }} Sem Sementes, XP, captura ou progresso das Trilhas.</p></div>
            }
            <div class="turn-banner" role="status" aria-live="polite" [attr.data-phase]="turnPhase()">
              <div><strong>{{ battleView().scene === 'result' ? 'Batalha encerrada' : busy() && turnPhase() === 'choice' ? 'Confirmando sua ação…' : turnPhase() === 'choice' ? 'Sua vez — escolha uma ação' : turnPhase() === 'player' ? 'Resolvendo sua ação' : 'Vez do adversário' }}</strong>
              <p>{{ battleView().scene === 'result' ? battleView().message : turnPhase() === 'choice' ? (classicBattle() ? 'Uma ação por rodada. Depois, o adversário responde.' : 'Combate tático salvo: mova e escolha uma ação.') : battleView().message }}</p></div>
              @if (turnPhase() !== 'choice') { <button (click)="finishPlayback()">Acelerar</button> }
            </div>
            <div class="battle-hud">
              <div>
                <span class="tiny-label">SEU ECO</span
                ><strong>{{ species(b.ally.speciesId).name }} · Nv. {{ creatureLevel(b.ally) }}</strong
                ><span
                  >{{ b.ally.hp }} / {{ creatureMaxHp(b.ally.speciesId, creatureLevel(b.ally)) }} PV</span
                >
              </div>
              <span class="versus">×</span>
              <div class="enemy-stat">
                <span class="tiny-label">ECO SELVAGEM</span
                ><strong>{{ species(b.enemy.speciesId).name }} · Nv. {{ creatureLevel(b.enemy) }}</strong
                ><span
                  >{{ b.enemy.hp }} /
                  {{ creatureMaxHp(b.enemy.speciesId, creatureLevel(b.enemy)) }} PV</span
                >
              </div>
            </div>
          }
          <div
            class="viewport"
            [class.in-battle]="battleView().scene !== 'exploration'"
          >
            <canvas #canvas role="img" [attr.aria-label]="canvasLabel()"
              >Seu navegador precisa oferecer Canvas 2D para renderizar a
              floresta.</canvas
            >
            @if (battleView().scene === "battle" && !classicBattle()) {
              <div
                class="arena-grid"
                role="grid"
                aria-label="Arena tática, cinco linhas e cinco colunas"
              >
                @for (row of rows; track row) {
                  <div role="row">
                    @for (col of rows; track col) {
                      <button
                        role="gridcell"
                        class="arena-cell"
                        [attr.aria-label]="cellLabel(col, row)"
                        [attr.tabindex]="gridFocus() === row * 5 + col ? 0 : -1"
                        (focus)="gridFocus.set(row * 5 + col)"
                        (keydown)="gridKey($event, col, row)"
                        (click)="selectCell(col, row)"
                        [disabled]="busy() || ritual() || turnPhase() !== 'choice'"
                      ></button>
                    }
                  </div>
                }
              </div>
            }
            @if (!loaded()) {
              <div class="canvas-overlay">
                <span class="orb-spinner">◇</span
                ><strong>{{
                  readonly()
                    ? "Expedição aberta em outra aba"
                    : "Ouvindo a floresta…"
                }}</strong>
                <p>
                  {{
                    readonly()
                      ? "Feche a outra aba e recarregue para continuar."
                      : "Recuperando seu progresso local."
                  }}
                </p>
              </div>
            }
            @if (ritual()) {
              <div class="canvas-overlay ritual-overlay">
                <span class="ritual-orb">◇</span>
                <h2>Ritual de Vínculo</h2>
                <p>Respire com o pulso. O timing não altera a chance.</p>
                <div class="ritual-track">
                  <span></span><i [style.left.%]="ritualProgress()"></i>
                </div>
                <button
                  class="primary"
                  (click)="confirmRitual()"
                  [disabled]="ritualConfirmed()"
                >
                  {{ ritualConfirmed() ? "Ouvindo o Eco…" : "Firmar vínculo" }}
                </button>
              </div>
            }
            @if (battleView().scene === "result") {
              <div class="canvas-overlay result-overlay">
                <span class="result-icon">{{
                  battleView().battle?.result === "capture" ? "✧" : "◇"
                }}</span>
                <p class="eyebrow">
                  {{
                    battleView().battle?.result === "capture"
                      ? "UM NOVO COMPANHEIRO"
                      : "O CAMINHO CONTINUA"
                  }}
                </p>
                <h2>
                  {{
                    battleView().battle?.result === "capture"
                      ? species(battleView().battle!.enemy.speciesId).name
                      : "De volta à floresta"
                  }}
                </h2>
                <p>{{ battleView().message }}</p>
                <button
                  class="primary"
                  (click)="send({ type: 'return' })"
                  [disabled]="busy()"
                >
                  Continuar explorando <span>→</span>
                </button>
              </div>
            }
          </div>
          <div class="message-bar" role="status" aria-live="polite">
            <span>✧</span>
            <p>{{ battleView().message }}</p>
            <small>{{
              busy() ? "SINCRONIZANDO…" : "◇"
            }}</small>
          </div>
          @if (battleView().scene === "battle") {
            <div class="action-bar" aria-label="Ações de batalha">
              @if (!classicBattle()) { <button
                [class.selected]="selection() === 'move'"
                (click)="selection.set('move')"
                [disabled]="busy() || ritual() || battleView().battle!.moved"
              >
                ↟ <span>Mover</span>
              </button> }
              <button
                [class.selected]="selection() === 'basic'"
                (click)="chooseBattleAction('basic')"
                [disabled]="busy() || ritual() || turnPhase() !== 'choice'"
              >
                ⚔ <span>Atacar</span>
              </button>
              @if (classicBattle() || ["WW001", "WW004"].includes(battleView().battle!.ally.speciesId)) {
                <button
                  [class.selected]="selection() === 'skill'"
                  (click)="chooseBattleAction('skill')"
                  [disabled]="busy() || ritual() || turnPhase() !== 'choice' || !skillAvailable()"
                >
                  ϟ
                  <span>{{ skillNames[battleView().battle!.ally.speciesId] }}</span>
                  @if (classicBattle()) { <small>{{ skillAvailable() ? 'Elemental · pronta' : 'Recarga · 1 rodada' }}</small> }
                </button>
              }
              <button
                (click)="send({ type: 'defend' })"
                [disabled]="busy() || ritual() || turnPhase() !== 'choice'"
              >
                ◇ <span>Defender</span>
              </button>
              <button
                class="capture-button"
                (click)="capture()"
                [disabled]="!captureReady() || busy() || ritual() || turnPhase() !== 'choice'"
              >
                ◎ <span>{{ captureReady() ? "Vínculo " + chance() + "%" : "Vínculo bloqueado" }}</span>
              </button>
              <button
                (click)="send({ type: 'flee' })"
                [disabled]="busy() || ritual() || turnPhase() !== 'choice'"
              >
                ↗ <span>Fugir</span>
              </button>
            </div>
            @if (classicBattle() && turnPhase() === 'choice' && game().battle?.turnFrames?.length) {
              <ol class="turn-history" aria-label="Última rodada">
                @for (frame of game().battle!.turnFrames!; track frame.actor) { <li>{{ frame.message }}</li> }
              </ol>
            }
            @if (combatHelp(); as help) {
              <div class="battle-help" aria-live="polite" aria-label="Dica da ação selecionada">
                <strong>{{ help.title }}</strong>
                <p>{{ help.detail }}</p>
                @if (!classicBattle()) { <span>Tracejado coral: próximo ataque inimigo.</span> }
                @if (classicBattle()) { <span>{{ captureReady() ? 'Vínculo disponível: o alvo está enfraquecido.' : 'Para capturar: reduza os PV do selvagem à metade, sem derrotá-lo. Duelo de NPC não permite captura.' }}</span> }
              </div>
            }
          } @else if (battleView().scene === "exploration") {
            <div class="exploration-controls">
              <div class="keyboard-hint">
                <span
                  ><kbd>W</kbd><br /><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd></span
                >
                <p>
                  Seu caminho, seu ritmo.<small
                    >WASD ou setas para explorar</small
                  >
                </p>
              </div>
              <div class="context-actions">
              @if (nearEnvironmentMechanism(); as mechanism) {
                <section class="environment-controls" [attr.aria-label]="mechanism.name">
                  <strong>{{ mechanism.name }} · {{ elementNames[mechanism.element] }}</strong>
                  @if (environmentCompleted(mechanism.id)) {
                    <p class="environment-status" role="status">✓ {{ mechanism.completedText }}</p>
                  } @else {
                    <p>{{ mechanism.description }}</p>
                    <button class="quiet-button environment-action" [disabled]="busy() || !loaded() || !environmentEcoReady(mechanism)" (click)="send({type: 'restoreEnvironment', id: mechanism.id, method: 'eco'})">{{ mechanism.ecoLabel }} · {{ elementNames[mechanism.element] }} <kbd>E</kbd></button>
                    <button class="quiet-button environment-action" [disabled]="busy() || !loaded()" (click)="send({type: 'restoreEnvironment', id: mechanism.id, method: 'manual'})">{{ mechanism.manualLabel }} · alternativa gratuita</button>
                    @if (!environmentEcoReady(mechanism)) { <small>Use um Eco saudável de {{ elementNames[mechanism.element] }} ou resolva manualmente. O resultado é o mesmo.</small> }
                  }
                </section>
              }

              @if (nearFieldPoint(); as point) {
                <button class="quiet-button" [disabled]="fieldBusy() || busy() || !fieldState() || !!fieldError() || !fieldPointAvailable(point.id)" (click)="collectField()">
                  {{ point.symbol }} {{ point.name }} · {{ fieldPointAvailable(point.id) ? (point.id === 'treasure' ? 'Abrir · +1 cristal' : point.id === 'cache' ? 'Buscar · +1 erva e +1 fruto' : 'Coletar · +2 na mochila') : (point.id === 'treasure' ? 'Baú aberto' : 'Recolhido · renova no próximo ciclo') }} <kbd>E</kbd>
                </button>
              }
              @if (canRestoreField() && fieldState() && !fieldState()!.restored) {
                <button class="quiet-button" (click)="fieldAction({type: 'restore'})" [disabled]="fieldBusy() || busy() || !fieldState()!.inventory.lantern">✧ Entregar lanterna a Iara</button>
              }
              <button class="quiet-button" (click)="openSidePanel('backpack')">Mochila e missão</button>

              @if (nearPortal()) {
                <p class="portal-route" aria-live="polite">→ Esta porta só leva à {{ nextRegionName() }}.</p>
              }
              @if (nearAncientMarker()) {
                <button
                  class="quiet-button"
                  [disabled]="busy() || !loaded()"
                  (click)="send({ type: 'interact' })"
                  aria-label="Ativar o próximo selo do santuário"
                >
                  ◈ Selo de {{ nextSealName() }} <kbd>E</kbd>
                </button>
              }
              @if (nearRival()) {
                <button
                  class="quiet-button"
                  [disabled]="busy() || !loaded() || active().hp <= 0"
                  (click)="send(rivalWon() ? { type: 'rematchNpc', npcId: nearbyNpc()?.id } : { type: 'challengeNpc', npcId: nearbyNpc()?.id })"
                >
                  {{ rivalWon() ? "Revanche de treino · " + nearbyNpc()?.name : "Desafiar " + nearbyNpc()?.name + " · +" + nearbyNpc()?.reward + " Sementes" }}
                </button>
              }
              @if (nearRival() && rivalWon()) { <p class="training-note">Treino livre: sem Sementes, XP, captura ou Trilhas do dia. Registre vitórias, estratégia e melhor rodada.</p> }
              @if (nearPot()) {
                <button
                  class="quiet-button"
                  [disabled]="busy() || !loaded()"
                  (click)="send({ type: 'breakPot' })"
                  aria-label="Quebrar vaso e recolher 8 Sementes"
                >
                  ◇ Quebrar vaso · +8 Sementes <kbd>E</kbd>
                </button>
              }
              <button
                class="quiet-button"
                [disabled]="!nearHealer() || busy() || !loaded()"
                (click)="send({ type: 'heal' })"
              >
                ✧ Recuperar no marco
              </button>
              </div>
              <div class="dpad" aria-label="Controle de movimento touch">
                @for (dir of directions; track dir.label) {
                  <button
                    [class]="dir.class"
                    [attr.aria-label]="dir.label"
                    (pointerdown)="hold($event, dir.dx, dir.dy)"
                    (pointerup)="release()"
                    (pointercancel)="release()"
                    (lostpointercapture)="release()"
                  >
                    {{ dir.icon }}
                  </button>
                }
              </div>
            </div>
          }
        </section>

      </div>
      @if (fieldMessage()) { <p class="field-feedback" role="status">{{ fieldMessage() }}</p> }
      @if (fieldError()) { <p class="field-feedback online-error" role="alert">{{ fieldError() }} <button (click)="refreshField()" [disabled]="fieldBusy()">Conferir mochila</button></p> }
      @if (error()) {
        <div class="error-box" role="alert">
          <p>{{ error() }}</p>
          <button (click)="exportSave()">Exportar backup</button>

        </div>
      }
      <div class="expedition-drawer-layer" [style.display]="sidePanel() ? null : 'none'" (click)="closeSidePanel()">
        <section id="expedition-drawer" class="expedition-drawer" [attr.role]="sidePanel() ? 'dialog' : null" [attr.aria-modal]="sidePanel() ? 'true' : null" aria-label="Menu da expedição" (click)="$event.stopPropagation()" [attr.inert]="collectionOpen() || settings() || storeOpen() || gameMasterOpen() || avatarEditorOpen() ? '' : null">
          <div class="drawer-heading"><div><p class="eyebrow">SEU CADERNO DE AVENTURAS</p><h2>Menu da expedição</h2></div><button (click)="closeSidePanel()" aria-label="Fechar menu da expedição">Fechar ×</button></div>
          <nav class="drawer-navigation" aria-label="Painéis da expedição">
            <button (click)="openSidePanel('journal')" [attr.aria-pressed]="sidePanel() === 'journal'">Mapa e diário</button>
            <button (click)="openSidePanel('backpack')" [attr.aria-pressed]="sidePanel() === 'backpack'">Mochila e missão</button>
            <button (click)="openSidePanel('companion')" [attr.aria-pressed]="sidePanel() === 'companion'">Companheiro</button>
            <button (click)="openSidePanel('daily')" [attr.aria-pressed]="sidePanel() === 'daily'">Trilhas do dia</button>
            <button (click)="openSidePanel('account')" [attr.aria-pressed]="sidePanel() === 'account'">Conta e trocas</button>
          </nav>
          <div class="drawer-content">
            <ww-journal-panel [style.display]="sidePanel() === 'journal' ? null : 'none'" [game]="game()" [restored]="fieldState()?.restored ?? null" />
            <ww-field-panel [style.display]="sidePanel() === 'backpack' ? null : 'none'" [state]="fieldState()" [busy]="fieldBusy()" [error]="fieldError()" [now]="fieldNow()" [canRestore]="canRestoreField()" [canAct]="!busy() && game().scene === 'exploration' && connectionAvailable() && !readonly()" (action)="fieldAction($event)" (refresh)="refreshField()" />
        <aside class="journey-panel" aria-label="Sua expedição" [style.display]="sidePanel() === 'companion' ? null : 'none'">
          <p class="eyebrow">SEU COMPANHEIRO</p>
          <div
            class="companion-art"
            [style.--eco-color]="species(active().speciesId).color"
          >
            <div class="orbit orbit-one"></div>
            <div class="orbit orbit-two"></div>
            <span class="eco-symbol" [attr.data-species]="active().speciesId">{{
              species(active().speciesId).glyph
            }}</span>
            @if (active().cosmeticId === "eco-moss-glyph") {
              <span class="eco-cosmetic">✦</span>
            }
            <span class="companion-ground"></span>
          </div>
          <div class="companion-name">
            <h2>{{ species(active().speciesId).name }}</h2>
            <strong class="eco-level">NÍVEL {{ creatureLevel(active()) }}</strong>
            <span
              class="element-tag"
              [style.color]="species(active().speciesId).color"
              >{{ species(active().speciesId).glyph }}
              {{ elementNames[species(active().speciesId).element] }}</span
            >
          </div>
          <div class="health-label">
            <span>VITALIDADE</span
            ><strong
              >{{ battleView().battle ? battleView().battle!.ally.hp : active().hp }}
              <small>/ {{ creatureMaxHp(active().speciesId, creatureLevel(active())) }}</small></strong
            >
          </div>
          <div class="health-track">
            <span
              [style.width.%]="
                (100 * (battleView().battle ? battleView().battle!.ally.hp : active().hp)) /
                creatureMaxHp(active().speciesId, creatureLevel(active()))
              "
            ></span>
          </div>
          <div class="eco-stats"><span>ATQ <b>{{ creatureStats(active().speciesId, creatureLevel(active())).attack }}</b></span><span>DEF <b>{{ creatureStats(active().speciesId, creatureLevel(active())).defense }}</b></span></div>
          @if (creatureLevel(active()) < 30) {
            <div class="xp-caption"><span>EXPERIÊNCIA</span><small>{{ active().experience ?? 0 }} / {{ xpToNextLevel(creatureLevel(active())) }} XP</small></div>
            <div class="xp-track"><span [style.width.%]="100 * (active().experience ?? 0) / xpToNextLevel(creatureLevel(active()))"></span></div>
          } @else { <div class="xp-caption"><span>NÍVEL MÁXIMO</span><small>30</small></div> }
          <div class="divider"></div>
          <div class="journal-heading">
            <p class="eyebrow">DIÁRIO DE CAMPO</p>
            <span>{{ discovered() }} / 5</span>
          </div>
          <p class="journal-copy">
            Toda lembrança tem uma forma.<br />Quantas você vai conhecer?
          </p>
          <div class="discovery-slots">
            @for (s of catalog; track s.id) {
              <span
                [class.found]="hasSpecies(s.id)"
                [style.color]="hasSpecies(s.id) ? s.color : ''"
                [attr.title]="hasSpecies(s.id) ? s.name : 'Eco desconhecido'"
                >{{ hasSpecies(s.id) ? s.glyph : "?" }}</span
              >
            }
          </div>
          <button
            class="collection-button"
            (click)="togglePanel('collection')"
            [attr.aria-expanded]="collectionOpen()"
          >
            Seus Ecos <span>{{ game().collection.length }} &nbsp; ↗</span>
          </button>
          <div class="quest-note">
            <span>❧</span>
            <div>
              <strong>O primeiro canto</strong>
              <p>
                {{
                  game().captured
                    ? "Um vínculo despertou. Descubra os outros Ecos da clareira."
                    : "Explore a grama ao norte e forme seu primeiro vínculo."
                }}
              </p>
            </div>
          </div>
          <section class="player-badges" aria-label="Badges do Guardião"><h3>Badges do Guardião</h3>
            @for (badge of playerBadges(); track badge.badgeId) { <article><span [style.color]="badge.color" aria-hidden="true">{{ badgeSymbols[badge.symbol] }}</span><div><strong>{{ badge.name }}</strong><p>{{ badge.description }}</p><small>{{ badge.reason }}</small></div></article> } @empty { <p>Reconhecimentos de eventos e marcos aparecerão aqui.</p> }
          </section>
          <p class="save-note">◇ Uma expedição vinculada à sua conta Google.<br /><span>Cache de recuperação neste navegador; progresso sincronizado na conta.</span></p>
        </aside>
          <section class="drawer-daily" aria-label="Suas trilhas" [style.display]="sidePanel() === 'daily' ? null : 'none'">
          @if (dailyBoard(); as board) {
            <section class="daily-challenges" aria-label="Desafios diários">
              <div class="daily-heading"><div><strong>Trilhas do dia</strong><small>Renovam à meia-noite de Brasília</small></div><span>🌱 {{ dailySeedsEarned() }} / {{ dailyRewardLimit() }}</span></div>
              <p class="daily-scope">Suas ações de batalha nesta expedição contam automaticamente. Cada trilha recompensa uma vez por dia.</p>
              @if (dailyError()) { <p class="daily-error" role="alert">{{ dailyError() }}</p> }
              <button class="quiet-button" (click)="refreshDailyBoard()" [disabled]="dailyBusy()">{{ dailyBusy() ? 'Atualizando trilhas…' : dailyError() ? 'Tentar atualizar novamente' : 'Atualizar trilhas' }}</button>
              @for (contract of board.contracts; track contract.id) {
                <article [class.done]="contract.completed"><div><strong>{{ contract.title }}</strong><small>{{ contract.description }}</small></div><span>{{ contract.completed ? "✓" : "○" }} +{{ contract.rewardSeeds }} 🌱</span></article>
              }
              @if (board.completionBonusEarned) { <p class="daily-bonus">Bônus por concluir as três trilhas: +{{ board.completionBonusSeeds }} Sementes</p> }
              <p class="daily-weekly">Semana: {{ board.weekly.qualifiedDays }} / {{ board.weekly.requiredDays }} dias com 2 trilhas concluídas · recompensa cosmética</p>
            </section>
          }
          @if (!dailyBoard() && profile() && loaded()) {
            <section class="daily-challenges" aria-label="Desafios diários">
              <strong>Trilhas do dia</strong>
              <p class="daily-scope">Conclua batalhas, use habilidades, ataques ou defesa nesta expedição.</p>
              @if (dailyError()) { <p class="daily-error" role="alert">{{ dailyError() }}</p> }
              <button class="quiet-button" (click)="refreshDailyBoard()" [disabled]="dailyBusy()">{{ dailyBusy() ? 'Carregando trilhas…' : 'Carregar trilhas' }}</button>
            </section>
          }
          </section>
      <ww-online-panel [style.display]="sidePanel() === 'account' ? null : 'none'"
        [enabled]="true"
        [canEnter]="canEnterOnline()"
        (readyChanged)="accountReadyChanged($event)"
        (modeChanged)="switchOnlineMode($event)"
        (viewChanged)="receiveOnlineView($event)"
        (busyChanged)="receiveOnlineBusy($event)"
        (accountChanged)="receiveAccount($event)"
        (gameMasterAccessChanged)="receiveGameMasterAccess($event)"
        (contentChanged)="receiveLiveContent($event)"
        (badgesChanged)="playerBadges.set($event)"
      />
          </div>
          <div class="drawer-footer">@if (gameMaster()) { <button class="gm-button" (click)="openGameMaster()">Game Master</button> }<button (click)="togglePanel('settings')">Configurações</button></div>
        </section>
      </div>
      @if (collectionOpen()) {
        <div class="store-overlay" (click)="closePanel('collection')">
        <section class="collection-panel" role="dialog" aria-modal="true" aria-label="Coleção de Ecos" (click)="$event.stopPropagation()">
          <div class="section-title">
            <div>
              <p class="eyebrow">LEMBRANÇAS QUE CAMINHAM</p>
              <h2>Seus Ecos</h2>
            </div>
            <button (click)="closePanel('collection')">Fechar ×</button>
          </div>
          <div class="creature-list">
            @for (c of game().collection; track c.id) {
              <article [class.active-eco]="c.id === game().activeId">
                <span
                  class="collection-glyph"
                  [style.color]="species(c.speciesId).color"
                  >{{ species(c.speciesId).glyph }}</span
                >
                <div>
                  <h3>{{ species(c.speciesId).name }}</h3>
                  <p>
                    {{ elementNames[species(c.speciesId).element] }} ·
                    Nv. {{ creatureLevel(c) }} · {{ c.hp }}/{{ creatureMaxHp(c.speciesId, creatureLevel(c)) }} PV · ATQ {{ creatureStats(c.speciesId, creatureLevel(c)).attack }} · DEF {{ creatureStats(c.speciesId, creatureLevel(c)).defense }}
                  </p>
                  @if (creatureLevel(c) < 30) { <small>{{ c.experience ?? 0 }} / {{ xpToNextLevel(creatureLevel(c)) }} XP para o próximo nível</small> }
                  <small>{{
                    c.provenance === "validated"
                      ? creatureLocked(c.id)
                        ? "Na conta · reservado"
                        : "Na conta · disponível"
                      : "Sincronizando com a conta"
                  }}</small>
                </div>
                <button
                  (click)="send({ type: 'activate', id: c.id })"
                  [disabled]="
                    c.id === game().activeId ||
                    c.hp === 0 ||
                    battleView().scene !== 'exploration' ||
                    busy() ||
                    creatureLocked(c.id)
                  "
                >
                  {{ c.id === game().activeId ? "Ao seu lado" : "Escolher" }}
                </button>
              </article>
            }
          </div>
        </section>
        </div>
      }
      @if (settings()) {
        <div class="store-overlay" (click)="closePanel('settings')">
        <section class="settings-panel" role="dialog" aria-modal="true" aria-label="Configurações" (click)="$event.stopPropagation()">
          <div class="section-title">
            <h2>Seu jeito de explorar</h2>
            <button (click)="closePanel('settings')">Fechar ×</button>
          </div>
          @if (profile()) {
            <section class="account-save" aria-label="Salvamento da conta">
              <div><strong>{{ cloudLabel() }}</strong><p>Seu progresso é salvo automaticamente enquanto você joga.</p>
                @if (cloudError()) { <p role="alert">{{ cloudError() }}</p> }
                @if (expeditionError()) { <p role="alert">{{ expeditionError() }}</p> }
              </div>
              @if (cloudError() || expeditionError()) {
                <button (click)="retryExpedition()" [disabled]="expeditionSyncing() || cloudBusy() || !connectionAvailable() || onlineMode()">Tentar novamente</button>
              }
            </section>
          }
          <label
            ><input
              type="checkbox"
              [checked]="prefs().sound"
              (change)="togglePref('sound')"
            />
            Sons da floresta</label>
          <section class="audio-settings" aria-label="Volumes do jogo">
            <p>Ambientes por região, música e efeitos. Cada volume pode ser ajustado separadamente.</p>
            @for (channel of audioChannels; track channel.id) {
              <label class="audio-volume"><span>{{ channel.label }} <output>{{ audioVolume(channel.id) }}%</output></span><input type="range" min="0" max="100" step="1" [attr.aria-label]="channel.label" [attr.aria-valuetext]="audioVolume(channel.id) + '%'" [value]="audioVolume(channel.id)" (input)="setAudioVolume(channel.id, $event)" /></label>
            }
            <button class="quiet-button" (click)="previewAudio()" [disabled]="!prefs().sound">Ouvir prévia</button>
            <small>{{ prefs().sound ? 'Ao voltar ao jogo, toque em um controle para retomar o som.' : 'Ative Sons da floresta para ouvir. As informações do jogo também aparecem na tela.' }}</small>
          </section><label
            ><input
              type="checkbox"
              [checked]="prefs().reduced"
              (change)="togglePref('reduced')"
            />
            Reduzir movimento</label
          ><label
            ><input
              type="checkbox"
              [checked]="prefs().timing"
              (change)="togglePref('timing')"
            />
            Pulso visual na captura (opcional, sem bônus)</label
          ><button class="quiet-button" (click)="exportSave()">
            Exportar backup da expedição
          </button>@if (profile() && game().avatar) {
            <button class="quiet-button" (click)="openAvatarEditor()" [disabled]="onlineMode()">
              Mudar aparência
            </button>
          }
        </section>
        </div>
      }
      @if (storeOpen()) {
        <div class="store-overlay" (click)="storeOpen.set(false)" (keydown.escape)="storeOpen.set(false)">
          <section class="store-panel" role="dialog" aria-modal="true" aria-label="Loja da Clareira" (click)="$event.stopPropagation()">
            <div class="section-title">
              <div><p class="eyebrow">FEIRA DA CLAREIRA</p><h2>Peças para sua jornada</h2></div>
              <button (click)="storeOpen.set(false)">Fechar ×</button>
            </div>
            <p class="store-balance">Seu saldo: <strong>{{ game().seeds ?? 120 }} Sementes</strong></p>

            <div class="store-items">
              @for (item of storeItems; track item.id) {
                <article class="store-item">
                  <div><small>{{ item.category }}</small><h3>{{ item.name }}</h3><p>{{ item.description }}</p></div>
                  @if (ownsItem(item.id)) {
                    @if (item.category === "Guardião") {
                      <button (click)="openAvatarEditor(item.id)" [disabled]="busy()" [attr.aria-label]="(itemEquipped(item.id) ? 'Equipado: ' : 'Experimentar: ') + item.name">
                        {{ itemEquipped(item.id) ? "Equipado" : "Experimentar" }}
                      </button>
                    } @else { <span class="equipped-label">Ativo</span> }
                  } @else {
                    <button (click)="buyItem(item.id)" [disabled]="busy() || (game().seeds ?? 120) < item.price">{{ item.price }} ✦</button>
                  }
                </article>
              }
            </div>
            <p class="store-note">A compra equipa a peça do Guardião imediatamente. Depois, abra a peça adquirida para experimentar outro visual; confirme em Salvar aparência para trocar. Itens de Eco e exploração são ativados ao adquirir. Nenhum item altera o combate.</p>
          </section>
        </div>
      }
      @if (gameMasterOpen()) {
        <div class="store-overlay gm-overlay" (click)="gameMasterOpen.set(false)" (keydown.escape)="gameMasterOpen.set(false)">
          <section class="store-panel gm-panel" role="dialog" aria-modal="true" aria-label="Painel Game Master" (click)="$event.stopPropagation()">
            <div class="section-title">
              <div><p class="eyebrow">FERRAMENTAS DE OPERAÇÃO</p><h2>Game Master</h2></div>
              <button (click)="gameMasterOpen.set(false)">Fechar ×</button>
            </div>
            <p class="store-note">Acesso administrativo confirmado. Toda alteração exige motivo e fica registrada.</p>
            <div class="gm-lookup">
              <label>UID do jogador<input [value]="gmUid()" (input)="gmUid.set($any($event.target).value)" (keydown.enter)="lookupGameMasterPlayer()" autocomplete="off" spellcheck="false" placeholder="Cole o UID do Firebase Auth" /></label>
              <button (click)="lookupGameMasterPlayer()" [disabled]="gmBusy() || !gmUid().trim()">{{ gmBusy() ? "Consultando…" : "Consultar UID" }}</button>
            </div>
            <div class="gm-lookup gm-name-lookup">
              <label>Ou busque pelo nome<input [value]="gmNameQuery()" (input)="gmNameQuery.set($any($event.target).value)" (keydown.enter)="searchGameMasterPlayers()" autocomplete="off" placeholder="Digite ao menos 2 letras" /></label>
              <button (click)="searchGameMasterPlayers()" [disabled]="gmBusy() || gmNameQuery().trim().length < 2">{{ gmBusy() ? "Buscando…" : "Buscar nome" }}</button>
            </div>
            <label>Motivo obrigatório (compartilhado)<input aria-label="Motivo administrativo compartilhado" [value]="gmReason()" (input)="gmReason.set($any($event.target).value)" minlength="5" maxlength="240" placeholder="Ex.: compensação por falha de sincronização" /><small>Este mesmo motivo habilita as alterações de conteúdo. Mínimo de 5 caracteres.</small></label>
            @if (gmSearchResults().length) {
              <div class="gm-search-results" aria-label="Resultados da busca por nome">
                @for (candidate of gmSearchResults(); track candidate.uid) {
                  <button (click)="selectGameMasterPlayer(candidate)" [disabled]="gmBusy()"><strong>{{ candidate.displayName }}</strong><code>{{ candidate.uid }}</code><span>Selecionar →</span></button>
                }
              </div>
            }
            @if (gmPlayer(); as player) {
              <article class="gm-player">
                <div class="gm-player-heading"><div><small>CONTA</small><h3>{{ player.displayName || "Guardião sem nome" }}</h3><code>{{ player.uid }}</code></div><span>{{ player.hasSave ? "Save encontrado" : "Sem save" }}</span></div>
                <div class="gm-stats"><span><small>SEMENTES</small><strong>{{ player.seeds ?? "—" }}</strong></span><span><small>REGIÃO</small><strong>{{ player.region ?? "—" }}</strong></span><span><small>ECOS NA CONTA</small><strong>{{ player.collection.length }}</strong></span><span><small>INICIAL</small><strong>{{ player.starterChosen === null ? "—" : player.starterChosen ? "Escolhido" : "Pendente" }}</strong></span></div>
                <p class="gm-collection">{{ collectionNames(player.collection) }}</p>
                @if (!player.hasSave) { <p class="gm-form-help" role="status">Este jogador não tem save na nuvem; Sementes, cosméticos e redefinição ficam indisponíveis. Badges podem ser concedidas pelo UID.</p> }
                <div class="gm-actions">
                  <div class="gm-seed-action"><input type="number" min="1" max="5000" [value]="gmAmount()" (input)="gmAmount.set(+$any($event.target).value)" aria-label="Quantidade de Sementes" /><button (click)="grantGameMasterSeeds()" [disabled]="gmBusy() || !player.hasSave || !gmReason().trim()">Conceder Sementes</button></div>
                  <details><summary>Conceder cosmético</summary><div class="gm-cosmetics">@for (item of storeItems; track item.id) { <button (click)="grantGameMasterCosmetic(item.id)" [disabled]="gmBusy() || !player.hasSave || player.ownedItems.includes(item.id) || !gmReason().trim()">{{ player.ownedItems.includes(item.id) ? item.name + " · já possui" : item.name }}</button> }</div></details>
                  <button class="gm-reset" (click)="resetGameMasterProgress()" [disabled]="gmBusy() || !player.hasSave || !gmReason().trim()">Redefinir save…</button>
                </div>
              </article>
            }
            <ww-live-ops-panel [content]="liveContent() || emptyLiveContent" [targetUid]="gmPlayer()?.uid || null" [reason]="gmReason()" (reasonChange)="gmReason.set($event)" [execute]="executeLiveOps" [loadAudit]="loadLiveOpsAudit" />
            @if (gmMessage()) { <p class="gm-message" role="status">{{ gmMessage() }}</p> }
            @if (gmError()) { <p class="online-error" role="alert">{{ gmError() }}</p> }
            <div class="gm-audit-heading"><h3>Últimas ações</h3><button (click)="loadGameMasterAudit()" [disabled]="gmBusy()">{{ gmAuditLoaded() ? "Atualizar" : "Carregar histórico" }}</button></div>
            <div class="gm-audit-list">
              @for (entry of gmAudit(); track entry.id) {
                <article><div><strong>{{ auditAction(entry) }}</strong><small>{{ entry.createdAt ? dateLabel(entry.createdAt) : "Horário indisponível" }}</small></div><p>{{ entry.targetUid }} · {{ entry.reason }}</p></article>
              } @empty { <p class="store-note">{{ gmAuditLoaded() ? "Nenhuma ação administrativa registrada." : "Histórico ainda não carregado." }}</p> }
            </div>
          </section>
        </div>
      }
      <footer>
        <span>✳ CHORAVIA</span>
        <p>Cinco caminhos. A mesma raiz.</p>
        <small>SEM PRESSA. SEM PAY-TO-WIN.</small>
      </footer>
    </main>
  </div>`,
})
export class AppComponent implements AfterViewInit, OnDestroy {
  readonly sidePanel = signal<"companion" | "daily" | "account" | "backpack" | "journal" | null>(null);
  private sidePanelTrigger: HTMLElement | null = null;
  openSidePanel(panel: "companion" | "daily" | "account" | "backpack" | "journal"): void {
    if (!this.sidePanel()) this.sidePanelTrigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    this.release();
    this.finishPlayback();
    this.ritual.set(false);
    this.sidePanel.set(panel);
    if (panel === "backpack") void this.refreshField();
    requestAnimationFrame(() => document.querySelector<HTMLElement>('.drawer-navigation button[aria-pressed="true"]')?.focus());
  }
  closeSidePanel(): void {
    this.sidePanel.set(null);
    requestAnimationFrame(() => this.sidePanelTrigger?.focus());
  }
  readonly presentation = signal(!/^\/(jogar|entrar|troca)(\/|$)/.test(location.pathname));
  enterJourney(): void {
    this.navigateJourney(this.profile() ? "/jogar" : "/entrar");
  }
  showPresentation(): void {
    this.navigateJourney("/");
  }
  private navigateJourney(path: string): void {
    this.sidePanel.set(null);
    this.release();
    this.finishPlayback();
    this.avatarEditorOpen.set(false);
    this.settings.set(false);
    this.storeOpen.set(false);
    this.collectionOpen.set(false);
    this.gameMasterOpen.set(false);
    if (location.pathname !== path) history.pushState(null, "", path);
    this.updateJourneyPage();
    window.scrollTo({ top: 0, behavior: "instant" });
    requestAnimationFrame(() => {
      document.querySelector<HTMLElement>(this.presentation() ? "ww-welcome-page h1" : !this.profile() ? ".gate-login" : "#game-main")?.focus();
    });
  }
  @HostListener("window:popstate") updateJourneyPage(): void {
    this.release();
    this.presentation.set(!/^\/(jogar|entrar|troca)(\/|$)/.test(location.pathname));
    if (this.presentation()) this.sidePanel.set(null);
    document.title = this.presentation() ? "Choravia · Ecos da Floresta" : this.profile() ? "Sua expedição · Choravia" : "Entrar · Choravia";
    if (this.viewInitialized && !this.presentation()) void this.acquire();
  }
  @ViewChild("canvas", { static: true }) canvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild(OnlinePanelComponent) onlinePanel?: OnlinePanelComponent;
  readonly onlineMode = signal(false); // Only used to finish encounters saved by older versions.
  readonly connectionAvailable = signal(navigator.onLine);
  readonly accountSynchronized = signal(false);
  readonly expeditionSyncing = signal(false);
  readonly expeditionError = signal("");
  private expeditionRetryTimer: ReturnType<typeof setTimeout> | undefined;
  private expeditionRetryDelay = 3000;
  private readonly dailyActions = new DailyActionQueue(localStorage);
  private dailySending = false;
  private dailySendAgain = false;
  accountAccessPresent(): boolean { return !!this.accountAccess; }
  readonly profile = signal<UserProfile | null>(null);
  readonly cloudStatus = signal<CloudStatus>("loading");
  readonly cloudBusy = signal(false);
  readonly dailyBoard = signal<DailyBoard | null>(null);
  readonly dailyBusy = signal(false);
  readonly dailyError = signal("");
  private dailyRefreshAgain = false;
  readonly dailySeedsEarned = signal(0);
  readonly cloudError = signal("");
  readonly switchingAccount = signal(false);
  private accountUid: string | null = null;
  private sessionUid: string | null = null;
  private accountAccess: AccountAccess | null = null;
  private readonly pendingGameMasterIds = new Map<string, string>();
  private accountEpoch = 0;
  private cloud: CloudSaveSession | null = null;
  readonly species = species;
  readonly creatureLevel = creatureLevel;
  readonly creatureStats = (id: SpeciesId, level = 1) => creatureStats(id, level, this.game().balance);
  readonly creatureMaxHp = (id: SpeciesId, level = 1) => creatureMaxHp(id, level, this.game().balance);
  readonly xpToNextLevel = xpToNextLevel;
  readonly elementNames = ELEMENT_NAMES;
  readonly regionNames = REGION_NAMES;
  get catalog() { return SPECIES.map(eco => ({ ...eco, ...this.game().balance?.[eco.id] })); }
  readonly rows = [0, 1, 2, 3, 4];
  readonly directions = [
    { label: "Cima", icon: "↑", dx: 0, dy: -1, class: "up" },
    { label: "Esquerda", icon: "←", dx: -1, dy: 0, class: "left" },
    { label: "Baixo", icon: "↓", dx: 0, dy: 1, class: "down" },
    { label: "Direita", icon: "→", dx: 1, dy: 0, class: "right" },
  ];
  readonly game = signal<Game>(initialGame());
  readonly turnPhase = signal<BattlePhase>("choice");
  private readonly playbackView = signal<Game | null>(null);
  private playbackTimers: ReturnType<typeof setTimeout>[] = [];
  readonly skillNames = SKILL_NAMES;
  battleView(): Game { return this.playbackView() ?? this.game(); }
  classicBattle(): boolean { return this.battleView().battle?.mode === "classic"; }
  skillAvailable(): boolean { return !!this.game().battle && skillReady(this.game().battle!); }
  chooseBattleAction(type: "basic" | "skill"): void {
    if (this.turnPhase() !== "choice" || this.busy()) return;
    if (this.classicBattle()) {
      const b = this.game().battle;
      if (b) void this.send({ type, target: { ...b.enemy.pos } });
    } else this.selection.set(type);
  }
  finishPlayback(): void {
    if (this.pendingLevelSound) { this.pendingLevelSound = false; this.playAudioCue("level"); }
    for (const timer of this.playbackTimers) clearTimeout(timer);
    this.playbackTimers = [];
    this.playbackView.set(null);
    this.turnPhase.set("choice");
    this.renderer?.resetMotion();
  }
  private playTurn(before: Game, after: Game, command: Command): boolean {
    const frames = after.battle?.turnFrames;
    if (before.scene !== "battle" || after.battle?.mode !== "classic" || !frames?.length || after === before || before.battle?.turnFrames === frames) return false;
    this.finishPlayback();
    const round = before.battle!.round;
    const views = frames.map(frame => ({ ...frameGame(after, frame, round), collection: before.collection }));
    const show = (index: number): void => {
      this.turnPhase.set(index === 0 ? "player" : "enemy");
      this.playbackView.set(views[index]!);
      const sound = battleFrameSound(frames[index]!, after);
      if (sound) this.playAudioCue(sound.cue, sound.variant);
      const frameCommand: Command = index === 0 ? command : { type: frames[index]!.action === "skill" ? "skill" : "basic", target: before.battle!.ally.pos };
      this.renderer?.play(index === 0 ? before : views[0]!, views[index]!, frameCommand, performance.now(), index === 0 ? "ally" : "enemy");
    };
    if (document.hidden) return true;
    show(0);
    // Keep phases explicit even when motion is reduced; no dependency on CSS duration.
    if (frames.length > 1) this.playbackTimers.push(setTimeout(() => show(1), 850));
    this.playbackTimers.push(setTimeout(() => this.finishPlayback(), frames.length * 850));
    return true;
  }
  readonly avatarDraft = signal<AvatarAppearance>({ ...DEFAULT_AVATAR });
  readonly avatarEditorOpen = signal(false);
  readonly storeOpen = signal(false);
  readonly gameMaster = signal(false);
  readonly gameMasterOpen = signal(false);
  readonly gmUid = signal("");
  readonly gmNameQuery = signal("");
  readonly gmAmount = signal(100);
  readonly gmReason = signal("");
  readonly gmBusy = signal(false);
  readonly gmMessage = signal("");
  readonly gmError = signal("");
  readonly gmPlayer = signal<GameMasterPlayer | null>(null);
  readonly gmAudit = signal<GameMasterAuditEntry[]>([]);
  readonly gmSearchResults = signal<GameMasterSearchResult[]>([]);
  readonly gmAuditLoaded = signal(false);
  readonly liveContent = signal<LiveContent | null>(null);
  readonly emptyLiveContent: LiveContent = { accessories: [], balance: [], badges: [] };
  readonly playerBadges = signal<PlayerBadge[]>([]);
  readonly badgeSymbols = BADGE_SYMBOLS;
  private applyingContent = false;
  get storeItems() { return [...STORE_ITEMS, ...(this.liveContent()?.accessories ?? []).filter(v => v.active).map(v => ({ ...v, category: "Guardião" as const }))]; }
  ownedCustomAccessories() { return (this.game().shopCatalog ?? []).filter(item => this.ownsItem(item.id)); }
  readonly loadLiveOpsAudit = () => this.onlinePanel!.liveOpsAudit();
  readonly executeLiveOps = (request: LiveOpsRequest) => {
    if (!this.gameMaster() || !this.onlinePanel) return Promise.reject(new Error("Acesso administrativo indisponível."));
    return this.onlinePanel.liveOpsCall(request);
  };
  receiveLiveContent(value: LiveContent | null): void { this.liveContent.set(value); void this.applyCurrentContent(); }
  private async applyCurrentContent(): Promise<void> {
    const content = this.liveContent(), session = this.session, epoch = this.accountEpoch;
    if (!content || !session?.ready || this.applyingContent || !this.loaded() || this.switchingAccount() || this.onlineMode() || this.cloudStatus() === "loading" || this.cloudStatus() === "conflict" || this.cloudStatus() === "pending" && !this.accountSynchronized() || session.state.scene !== "exploration") return;
    if (applyLiveContent(session.state, content) === session.state) return;
    this.applyingContent = true;
    try { await session.reconcile(current => epoch === this.accountEpoch && this.liveContent() ? applyLiveContent(current, this.liveContent()!) : current); }
    catch (error) { if (epoch === this.accountEpoch) this.expeditionError.set(error instanceof Error ? error.message : "Não foi possível atualizar o catálogo."); }
    finally { this.applyingContent = false; }
  }
  chooseCustomAccessory(id: CustomAccessoryId): void {
    const item = this.ownedCustomAccessories().find(v => v.id === id);
    if (item) this.avatarDraft.update(v => ({ ...v, accessory: "none", customAccessory: { id: item.id, shape: item.shape, color: item.color } }));
  }
  readonly starterDraft = signal<SpeciesId>("WW001");
  readonly skinChoices = [
    { id: "sand" as const, label: "Areia" },
    { id: "copper" as const, label: "Cobre" },
    { id: "umber" as const, label: "Escuro" },
  ];
  readonly hairChoices = [
    { id: "short" as const, label: "Curto" },
    { id: "curls" as const, label: "Cachos" },
    { id: "long" as const, label: "Longo" },
    { id: "braids" as const, label: "Tranças" },
  ];
  readonly hairColorChoices = [
    { id: "dark" as const, label: "Escuro" },
    { id: "chestnut" as const, label: "Castanho" },
    { id: "copper" as const, label: "Acobreado" },
    { id: "silver" as const, label: "Prateado" },
  ];
  private readonly baseOutfitChoices = [
    { id: "moss" as const, label: "Musgo" },
    { id: "sunset" as const, label: "Entardecer" },
    { id: "river" as const, label: "Rio" },
  ];
  private readonly baseAccessoryChoices = [
    { id: "none" as const, label: "Sem acessório" },
    { id: "scarf" as const, label: "Lenço" },
    { id: "satchel" as const, label: "Bolsa" },
  ];
  get outfitChoices() {
    return [...this.baseOutfitChoices, ...(this.ownsItem("forest-cloak") ? [{ id: "cloak" as const, label: "Capa de samambaia" }] : [])];
  }
  get accessoryChoices() {
    return [...this.baseAccessoryChoices,
      ...(this.ownsItem("sun-scarf") ? [{ id: "sun-scarf" as const, label: "Lenço do poente" }] : []),
      ...(this.ownsItem("moon-pin") ? [{ id: "moon-pin" as const, label: "Broche lunar" }] : [])];
  }
  readonly loaded = signal(false);
  readonly busy = signal(false);
  readonly error = signal("");
  readonly readonly = signal(false);
  readonly temporary = signal(false);
  readonly settings = signal(false);
  readonly collectionOpen = signal(false);
  readonly selection = signal("move");
  readonly gridFocus = signal(16);
  readonly ritual = signal(false);
  readonly ritualProgress = signal(0);
  readonly feedbackNotices = signal<{ id: number; text: string }[]>([]);
  private feedbackSequence = 0;
  private feedbackTimer: ReturnType<typeof setTimeout> | null = null;
  readonly ritualConfirmed = signal(false);
  private readonly systemMotion = matchMedia("(prefers-reduced-motion: reduce)");
  readonly prefs = signal<Preferences>({
    audio: { ...DEFAULT_AUDIO_MIX },
    sound: false,
    reduced: matchMedia("(prefers-reduced-motion: reduce)").matches,
    timing: false,
  });
  private session: Session | null = null;
  private repository: IndexedDbSave | null = null;
  private renderer: Renderer | null = null;
  private audio = new GameAudio();
  readonly audioVisible = signal(!document.hidden);
  readonly audioChannels: readonly {id: AudioChannel; label: string}[] = [
    {id: "master", label: "Volume geral"}, {id: "music", label: "Música"}, {id: "ambience", label: "Ambiente"}, {id: "effects", label: "Efeitos"},
  ];
  private pendingLevelSound = false;
  refreshAudioScene(): void {
    const prefs = this.prefs(), game = this.game();
    this.audio.configure(prefs.sound, prefs.audio);
    this.audio.setScene({region: game.region ?? "clearing", battle: this.battleView().scene === "battle", active: this.audioVisible() && !this.presentation() && !!this.profile() && this.loaded() && !!game.avatar && !this.hasUnchosenStarter() && !this.readonly() && !this.switchingAccount() && this.connectionAvailable()});
  }
  @HostListener("document:pointerdown") activateAudioFromGesture(): void {
    if (!this.prefs().sound || this.presentation() || document.hidden) return;
    this.refreshAudioScene();
    this.audio.unlock();
  }
  previewAudio(): void {
    if (!this.prefs().sound) return;
    this.activateAudioFromGesture(); this.playAudioCue("confirm");
  }
  private playAudioCue(cue: AudioCue, variant?: string): void {
    if (this.prefs().sound && !document.hidden && !this.presentation()) this.audio.cue(cue, variant);
  }
  audioVolume(channel: AudioChannel): number { return Math.round(this.prefs().audio[channel] * 100); }
  setAudioVolume(channel: AudioChannel, event: Event): void {
    const input = event.target;
    if (!(input instanceof HTMLInputElement)) return;
    const value = Number(input.value);
    if (!Number.isFinite(value)) return;
    this.prefs.update(p => ({...p, audio: normalizeAudioMix({...p.audio, [channel]: value / 100})}));
    this.savePreferences(); this.refreshAudioScene(); this.activateAudioFromGesture();
  }
  readonly fieldState = signal<FieldState | null>(null);
  readonly fieldNow = signal<number | null>(null);
  readonly fieldBusy = signal(false);
  readonly fieldError = signal("");
  readonly fieldMessage = signal("");
  private fieldUid = "";
  private fieldResetTimer: ReturnType<typeof setTimeout> | undefined;
  private readonly field = new FieldSession(localStorage, () => {
    this.fieldState.set(this.field.state); this.fieldNow.set(this.field.now);
    this.fieldBusy.set(this.field.busy); this.fieldError.set(this.field.error); this.fieldMessage.set(this.field.message);
  });
  async refreshField(): Promise<void> {
    const uid = this.profile()?.uid;
    if (!uid || !this.onlinePanel || this.readonly() || this.switchingAccount()) return;
    if (this.fieldUid !== uid || !this.field.state && !this.field.busy && !this.field.error) {
      try { this.field.bind(uid, this.onlinePanel.fieldGateway()); this.fieldUid = uid; }
      catch (error) { this.fieldError.set(error instanceof Error ? error.message : "Aguarde a conta."); return; }
    }
    await this.field.refresh();
    if (this.profile()?.uid !== uid || this.destroyed) return;
    clearTimeout(this.fieldResetTimer);
    if (this.field.now !== null && !this.field.error) {
      const remaining = (fieldCycle(this.field.now) + 1) * 86400000 - this.field.now;
      this.fieldResetTimer = setTimeout(() => { if (!this.destroyed && this.profile()?.uid === uid) void this.refreshField(); }, remaining + 500);
    }
  }
  nearEnvironmentMechanism() {
    if (this.game().scene !== "exploration") return null;
    return fieldMechanisms(this.game()).filter(m => distance(m, this.game().player) <= 1).sort((a, b) => distance(a, this.game().player) - distance(b, this.game().player))[0] ?? null;
  }
  environmentCompleted(id: string): boolean { return (this.game().fieldRestorations ?? []).includes(id); }
  environmentEcoReady(mechanism: ReturnType<typeof fieldMechanisms>[number]): boolean { return fieldMechanismReady(this.game(), mechanism); }
  nearFieldPoint() {
    if (this.game().scene !== "exploration" || this.fieldNow() === null) return null;
    const nearby = fieldPoints(this.game(), fieldCycle(this.fieldNow()!)).filter(p => distance(p, this.game().player) <= 1);
    nearby.sort((a, b) => distance(a, this.game().player) - distance(b, this.game().player) || Number(this.fieldPointAvailable(b.id)) - Number(this.fieldPointAvailable(a.id)));
    return nearby[0] ?? null;
  }
  fieldPointAvailable(id: Parameters<typeof fieldAvailable>[1]): boolean {
    return !!this.fieldState() && this.fieldNow() !== null && fieldAvailable(this.fieldState()!, id, fieldCycle(this.fieldNow()!));
  }
  canRestoreField(): boolean { return this.game().scene === "exploration" && (this.game().region ?? "clearing") === "clearing" && distance(this.game().player, {x: 7,y: 10}) <= 1; }
  async collectField(): Promise<void> {
    const point = this.nearFieldPoint();
    if (!point || !this.fieldPointAvailable(point.id)) return;
    await this.fieldAction(point.id === "treasure" ? {type: "treasure"} : {type: "gather", node: point.id});
  }
  async fieldAction(action: FieldAction): Promise<void> {
    if (!this.loaded() || !this.profile() || this.readonly() || this.busy() || this.switchingAccount() || !this.connectionAvailable() || this.cloudStatus() === "conflict" || this.game().scene !== "exploration" || !this.game().avatar || this.hasUnchosenStarter()) return;
    if (this.accountAccess && !this.accountSynchronized()) return;
    if (action.type === "restore" && !this.canRestoreField()) return;
    if (action.type === "gather" || action.type === "treasure") {
      const point = this.nearFieldPoint();
      if (!point || point.id !== (action.type === "treasure" ? "treasure" : action.node)) return;
    }
    this.release();
    const previous = this.fieldState();
    await this.field.perform(action);
    const current = this.fieldState();
    if (previous && current && !this.fieldError()) {
      if (action.type === "restore" && !previous.restored && current.restored) this.playAudioCue("restore");
      else if (Object.keys(current.inventory).some(key => current.inventory[key as keyof FieldState["inventory"]] > previous.inventory[key as keyof FieldState["inventory"]])) this.playAudioCue(action.type === "craft" ? "confirm" : "collect");
    }
  }

  private frame = 0;
  private held: { dx: number; dy: number } | null = null;
  private lastWalk = 0;
  private ritualElapsed = 0;
  private ritualLast = 0;
  private dailyResetTimer: ReturnType<typeof setTimeout> | null = null;
  private destroyed = false;
  private viewInitialized = false;
  private acquiring = false;
  private writerReady = false;
  private unlock: (() => void) | null = null;
  private zone = inject(NgZone);
  constructor() {
    try {
      const saved: unknown = JSON.parse(
        localStorage.getItem("wildwoods-preferences") ?? "null",
      );
      if (
        saved &&
        typeof saved === "object" &&
        "sound" in saved &&
        typeof saved.sound === "boolean" &&
        "reduced" in saved &&
        typeof saved.reduced === "boolean" &&
        "timing" in saved &&
        typeof saved.timing === "boolean"
      )
        this.prefs.set({sound: saved.sound, reduced: saved.reduced, timing: saved.timing, audio: normalizeAudioMix("audio" in saved ? saved.audio : undefined)});
    } catch {
      /* Use defaults. */
    }
    effect(() => this.refreshAudioScene());
  }
  ngAfterViewInit(): void {
    try {
      this.renderer = new Renderer(this.canvas.nativeElement);
    } catch (e) {
      this.error.set(String(e));
      return;
    }
    this.zone.runOutsideAngular(() => {
      const tick = (now: number): void => {
        if (this.destroyed) return;
        if (document.hidden || this.presentation()) { this.frame = requestAnimationFrame(tick); return; }
        if (
          this.held &&
          now - this.lastWalk >= (this.game().ownedItems?.includes("trail-boots") ? 190 : 250) &&
          !this.sidePanel() &&
          !this.collectionOpen() &&
          !this.settings() &&
          !this.storeOpen() &&
          !this.gameMasterOpen() &&
          !this.creatingCharacter()
        ) {
          this.lastWalk = now;
          void this.send({ type: "walk", ...this.held });
        }
        if (this.ritual() && !document.hidden) {
          const delta = this.ritualLast
            ? Math.min(now - this.ritualLast, 100)
            : 0;
          this.ritualElapsed += delta;
          this.ritualProgress.set(Math.min(100, this.ritualElapsed / 12));
          if (this.ritualElapsed >= 1200) {
            this.ritual.set(false);
            void this.send({ type: "capture" });
          }
        }
        this.ritualLast = now;
        this.renderer?.draw(
          this.creatingCharacter()
            ? { ...this.game(), avatar: this.avatarDraft() }
            : this.battleView(),
          now,
          this.prefs().reduced || this.systemMotion.matches,
          this.selection(),
          { state: this.fieldState(), cycle: this.fieldNow() === null ? -1 : fieldCycle(this.fieldNow()!) },
        );
        this.frame = requestAnimationFrame(tick);
      };
      this.frame = requestAnimationFrame(tick);
    });
    this.viewInitialized = true;
    if (!this.presentation()) void this.acquire();
  }
  private async acquire(): Promise<void> {
    if (this.acquiring || this.writerReady || this.destroyed) return;
    if (!navigator.locks) {
      this.error.set(
        "Este navegador não oferece bloqueio seguro entre abas. Exporte seu backup e use um navegador compatível para abrir sua expedição.",
      );
      return;
    }
    this.acquiring = true;
    try {
      await navigator.locks.request(
        "wildwoods-writer",
        { ifAvailable: true },
        async (lock) => {
          if (!lock) {
            this.readonly.set(true);
            return;
          }
          if (this.destroyed) return;
          this.readonly.set(false);
          try {
            this.repository = new IndexedDbSave();
            this.session = new Session(this.repository, () => this.sync());
            await this.session.load();
            if (this.destroyed) return;
            this.writerReady = true;
            if (this.accountAccess) await this.activateAccount(this.accountAccess);
            if (this.loaded()) performance.mark("choravia-game-ready");
          } catch (e) {
            this.error.set(String(e));
          }
          await new Promise<void>((resolve) => {
            if (this.destroyed) resolve();
            else this.unlock = resolve;
          });
        },
      );
    } catch (e) {
      this.error.set(String(e));
    } finally {
      this.acquiring = false;
    }
  }
  private sync(): void {
    if (!this.session) return;
    if (!this.onlineMode()) this.game.set(this.session.state);
    this.loaded.set(this.session.ready && !this.switchingAccount());
    if (!this.onlineMode()) this.busy.set(this.session.saving || !!this.accountAccess && (!this.connectionAvailable() || this.cloudStatus() === "loading" || this.cloudStatus() === "conflict" || !!this.game().avatar && this.game().starterChosen === true && !this.accountSynchronized()));
    this.error.set(this.session.error);
    if (this.session.ready && !this.session.saving) { this.cloud?.observe(); void this.applyCurrentContent(); }
  }
  async send(command: Command): Promise<void> {
    if (this.presentation()) return;
    if (this.turnPhase() !== "choice") return;
    if (this.accountAccess && (!this.connectionAvailable() || this.cloudStatus() === "conflict")) { this.release(); return; }
    if (this.accountAccess && !this.onlineMode() && !this.accountSynchronized() && !["customize", "chooseStarter", "flee"].includes(command.type)) return;
    const creatingAvatar = command.type === "customize" && !this.game().avatar;
    if (
      !this.profile() ||
      (!this.game().avatar && command.type !== "customize") ||
      (this.hasUnchosenStarter() && command.type !== "chooseStarter" && !creatingAvatar)
    )
      return;
    if (this.onlineMode()) {
      if (
        command.type === "breakPot" ||
        command.type === "chooseStarter" ||
        command.type === "challengeNpc" ||
        command.type === "rematchNpc" ||
        command.type === "restoreEnvironment" ||
        command.type === "purchase"
      )
        return;
      const before = this.game();
      await this.onlinePanel?.dispatch(command);
      this.presentCommand(before, command);
      if (command.type === "move" && this.game() !== before)
        this.selection.set("basic");
      if (
        this.game().battle?.round !== before.battle?.round ||
        this.game().scene !== before.scene
      )
        this.selection.set("move");
      if (this.game().scene !== "exploration") this.release();
      if (["move", "basic", "defend", "flee", "capture", "skill"].includes(command.type))
        await this.refreshDailyBoard();
      return;
    }
    if (!this.session || !this.loaded() || this.ritual() || this.readonly())
      return;
    const before = this.game();
    if (command.type === "activate" ? this.creatureLocked(command.id) : this.creatureLocked(before.activeId) && (command.type === "challengeNpc" || command.type === "rematchNpc" || command.type === "restoreEnvironment" && command.method === "eco" || command.type === "walk" && reduceGame(before, command).scene === "battle")) {
      this.expeditionError.set("Este Eco está reservado em uma troca ou batalha anterior. Conclua a operação ou escolha outro Eco.");
      return;
    }
    await this.session.dispatch(command);
    this.presentCommand(before, command);
    if (this.game() !== before) {
      const board = this.dailyBoard();
      const types = dailyActionTypes(before, this.game(), command).filter(type => !board || board.cycleId !== dailyCycle() || board.contracts.some(c => c.id === type && !c.completed));
      if (types.length && this.accountAccess) {
        try { this.dailyActions.add(this.accountAccess.profile.uid, types); }
        catch { this.dailyError.set("Não foi possível guardar o envio das trilhas neste navegador. Mantenha a conexão e tente sincronizar."); }
        void this.flushDailyActions();
      }
      if (command.type === "chooseStarter" || before.scene === "battle" && this.game().scene === "result") void this.synchronizeAccountExpedition();
    }
    if (this.session.ready && this.game() !== before && (command.type !== "walk" || this.game().scene === "battle"))
      this.cloud?.observe(true);
    if (this.game() !== before) {
      if (command.type === "move") this.selection.set("basic");
      if (
        this.game().battle?.round !== before.battle?.round ||
        before.scene !== this.game().scene
      )
        this.selection.set("move");
      if (this.game().scene !== "exploration") this.release();
    }
  }
  private presentCommand(before: Game, command: Command): void {
    const after = this.game();
    if (before === after) return;
    const staged = this.playTurn(before, after, command);
    if (staged) this.pendingLevelSound = levelIncreased(before, after);
    else { const sound = commandSound(before, after, command); if (sound) this.playAudioCue(sound.cue, sound.variant); }
    if (!staged && !document.hidden) this.renderer?.play(before, after, command, performance.now());
    const feedback = visualFeedback(before, after, command);
    const label = progressFeedback(before, after) || (feedback?.kind === "world" ? feedback.label : "");
    if (label) {
      if (this.feedbackTimer) clearTimeout(this.feedbackTimer);
      this.feedbackNotices.set([{ id: ++this.feedbackSequence, text: label }]);
      this.feedbackTimer = setTimeout(() => { this.feedbackNotices.set([]); this.feedbackTimer = null; }, 2400);
    }
  }
  active() {
    return activeCreature(this.game());
  }
  ownsItem(id: StoreItemId): boolean {
    return this.game().ownedItems?.includes(id) ?? false;
  }
  async buyItem(id: StoreItemId): Promise<void> {
    await this.send({ type: "purchase", itemId: id });
  }
  openGameMaster(): void {
    if (!this.gameMaster()) return;
    this.release();
    this.gameMasterOpen.set(true);
    this.gmError.set("");
    this.gmMessage.set("");
  }
  receiveGameMasterAccess(isAdmin: boolean): void {
    this.gameMaster.set(isAdmin);
    if (!isAdmin) {
      this.gameMasterOpen.set(false);
      this.gmPlayer.set(null);
      this.gmSearchResults.set([]);
      this.gmAudit.set([]);
    }
  }
  private async callGameMaster(request: GameMasterRequest): Promise<GameMasterResponse> {
    if (!this.gameMaster() || !this.onlinePanel)
      throw new Error("Acesso Game Master indisponível.");
    return this.onlinePanel.gameMasterCall(request);
  }
  private async runGameMaster(request: GameMasterRequest): Promise<GameMasterResponse | null> {
    if (this.gmBusy()) {
      this.gmError.set("Outra ação do painel ainda está em andamento. Aguarde e tente novamente.");
      return null;
    }
    this.gmBusy.set(true);
    this.gmError.set("");
    this.gmMessage.set("");
    try {
      const result = await this.callGameMaster(request);
      if ("requestId" in request)
        for (const [key, id] of this.pendingGameMasterIds)
          if (id === request.requestId) this.pendingGameMasterIds.delete(key);
      if ("player" in result) this.gmPlayer.set(result.player);
      if ("players" in result) {
        this.gmSearchResults.set(result.players);
        this.gmMessage.set(result.players.length ? `${result.players.length} resultado(s). Selecione a conta para consultar o save.` : "Nenhuma conta encontrada com esse nome.");
      }
      if ("entries" in result) {
        this.gmAudit.set(result.entries);
        this.gmAuditLoaded.set(true);
      }
      if ("player" in result && "replay" in result)
        this.gmMessage.set(result.replay ? "A operação já havia sido aplicada; nenhuma recompensa foi duplicada." : "Alteração salva. O jogador verá a mudança ao sincronizar o save da conta.");
      return result;
    } catch (error) {
      this.gmError.set(error instanceof Error ? error.message : "Falha na operação Game Master.");
      return null;
    } finally {
      this.gmBusy.set(false);
    }
  }
  async lookupGameMasterPlayer(): Promise<void> {
    const targetUid = this.gmUid().trim();
    if (!targetUid) return;
    this.gmPlayer.set(null);
    await this.runGameMaster({ method: "lookup", targetUid });
  }
  async searchGameMasterPlayers(): Promise<void> {
    const query = this.gmNameQuery().trim();
    if (query.length < 2) return;
    this.gmPlayer.set(null);
    this.gmSearchResults.set([]);
    await this.runGameMaster({ method: "search", query });
  }
  async selectGameMasterPlayer(candidate: GameMasterSearchResult): Promise<void> {
    this.gmUid.set(candidate.uid);
    this.gmSearchResults.set([]);
    await this.lookupGameMasterPlayer();
  }
  async grantGameMasterSeeds(): Promise<void> {
    const targetUid = this.gmPlayer()?.uid;
    if (!targetUid) return;
    const amount = this.gmAmount(), reason = this.gmReason().trim();
    const operationKey = JSON.stringify({ method: "grantSeeds", targetUid, amount, reason });
    const result = await this.runGameMaster({
      method: "grantSeeds",
      requestId: this.gameMasterRequestId(operationKey),
      targetUid,
      amount,
      reason,
    });
    if (result && "player" in result && "replay" in result) await this.loadGameMasterAudit();
  }
  async grantGameMasterCosmetic(itemId: StoreItemId): Promise<void> {
    const targetUid = this.gmPlayer()?.uid;
    if (!targetUid) return;
    const reason = this.gmReason().trim();
    const operationKey = JSON.stringify({ method: "grantCosmetic", targetUid, itemId, reason });
    const result = await this.runGameMaster({
      method: "grantCosmetic",
      requestId: this.gameMasterRequestId(operationKey),
      targetUid,
      itemId,
      reason,
    });
    if (result && "player" in result && "replay" in result) await this.loadGameMasterAudit();
  }
  async resetGameMasterProgress(): Promise<void> {
    const targetUid = this.gmPlayer()?.uid;
    if (!targetUid || !window.confirm(`Redefinir o save de ${targetUid}? Esta ação substitui todo o progresso salvo na nuvem.`)) return;
    const reason = this.gmReason().trim();
    const operationKey = JSON.stringify({ method: "resetProgress", targetUid, reason });
    const result = await this.runGameMaster({
      method: "resetProgress",
      requestId: this.gameMasterRequestId(operationKey),
      targetUid,
      reason,
    });
    if (result && "player" in result && "replay" in result) await this.loadGameMasterAudit();
  }
  async loadGameMasterAudit(): Promise<void> {
    if (!this.gameMaster()) return;
    this.gmAuditLoaded.set(false);
    await this.runGameMaster({ method: "listAudit" });
  }
  collectionNames(ids: readonly SpeciesId[]): string {
    return ids.length ? ids.map((id) => species(id).name).join(" · ") : "Nenhum Eco na conta";
  }
  auditAction(entry: GameMasterAuditEntry): string {
    if (entry.action === "grantSeeds") return `+${entry.amount ?? 0} Sementes`;
    if (entry.action === "grantCosmetic") return `Cosmético: ${entry.itemId ?? "item"}`;
    return "Save redefinido";
  }
  dateLabel(time: number): string {
    return new Date(time).toLocaleString("pt-BR");
  }
  private gameMasterRequestId(key: string): string {
    let id = this.pendingGameMasterIds.get(key);
    if (!id) {
      id = crypto.randomUUID();
      this.pendingGameMasterIds.set(key, id);
    }
    return id;
  }
  readonly initials = profileInitials;
  creatingCharacter(): boolean {
    return (
      !!this.profile() &&
      this.loaded() &&
      this.cloudStatus() !== "loading" &&
      (!this.game().avatar || this.avatarEditorOpen())
    );
  }
  needsStarterChoice(): boolean {
    return (
      !!this.profile() &&
      this.loaded() &&
      this.cloudStatus() !== "loading" &&
      this.hasUnchosenStarter()
    );
  }
  hasUnchosenStarter(): boolean {
    // Legacy saves still need a starter choice, but finish an active battle first.
    return this.game().starterChosen !== true && this.game().scene === "exploration";
  }
  signInForGame(): void {
    if (this.onlinePanel?.clientReady()) void this.onlinePanel.google(false);
  }
  useExistingGoogleAccount(): void {
    if (this.onlinePanel?.existingAccount())
      void this.onlinePanel.google(true);
  }
  chooseSkin(skin: SkinTone): void {
    this.avatarDraft.update((avatar) => ({ ...avatar, skin }));
  }
  chooseHair(hair: HairStyle): void {
    this.avatarDraft.update((avatar) => ({ ...avatar, hair }));
  }
  chooseHairColor(hairColor: HairColor): void {
    this.avatarDraft.update((avatar) => ({ ...avatar, hairColor }));
  }
  chooseOutfit(outfit: Outfit): void {
    this.avatarDraft.update((avatar) => ({ ...avatar, outfit }));
  }
  chooseAccessory(accessory: Accessory): void {
    this.avatarDraft.update(({ customAccessory: _, ...avatar }) => ({ ...avatar, accessory }));
  }
  skinColor(): string {
    return {
      sand: "#edc69b",
      copper: "#bd805f",
      umber: "#754a3b",
    }[this.avatarDraft().skin];
  }
  hairColor(): string {
    return {
      dark: "#294c48",
      chestnut: "#704332",
      copper: "#b85f3e",
      silver: "#c4c6b4",
    }[this.avatarDraft().hairColor];
  }
  outfitColor(): string {
    return {
      moss: "#eacd76",
      sunset: "#d98362",
      river: "#68aaba",
      cloak: "#4e7652",
    }[this.avatarDraft().outfit];
  }
  objective() { return explorationObjective(this.game()); }
  combatHelp() { return battleGuidance(this.battleView(), this.selection()); }
  itemEquipped(id: StoreItemId): boolean {
    const avatar = this.game().avatar;
    if (isCustomAccessoryId(id)) return avatar?.customAccessory?.id === id;
    return id === "forest-cloak" ? avatar?.outfit === "cloak"
      : id === "sun-scarf" ? avatar?.accessory === "sun-scarf"
      : id === "moon-pin" ? avatar?.accessory === "moon-pin" : false;
  }
  private wardrobeOrigin: "settings" | "store" = "settings";
  private focusWardrobeOrigin(): void {
    requestAnimationFrame(() => document.querySelector<HTMLElement>(this.wardrobeOrigin === "store" ? ".store-panel button" : ".settings-panel button")?.focus());
  }
  private panelTrigger: HTMLElement | null = null;
  togglePanel(panel: "settings" | "collection"): void {
    const state = panel === "settings" ? this.settings : this.collectionOpen;
    if (state()) { this.closePanel(panel); return; }
    this.release();
    this.panelTrigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    state.set(true);
    requestAnimationFrame(() => document.querySelector<HTMLElement>(`.${panel === "settings" ? "settings" : "collection"}-panel button`)?.focus());
  }
  closePanel(panel: "settings" | "collection"): void {
    (panel === "settings" ? this.settings : this.collectionOpen).set(false);
    requestAnimationFrame(() => this.panelTrigger?.focus());
  }
  openAvatarEditor(itemId?: StoreItemId): void {
    if (!this.game().avatar || this.busy()) return;
    if (itemId && (!this.ownsItem(itemId) || !["forest-cloak", "sun-scarf", "moon-pin"].includes(itemId) && !isCustomAccessoryId(itemId))) return;
    this.wardrobeOrigin = itemId ? "store" : "settings";
    this.release();
    this.avatarDraft.set({ ...this.game().avatar! });
    if (itemId === "forest-cloak") this.chooseOutfit("cloak");
    if (itemId === "sun-scarf" || itemId === "moon-pin") this.chooseAccessory(itemId);
    if (isCustomAccessoryId(itemId)) this.chooseCustomAccessory(itemId);
    this.avatarEditorOpen.set(true);
    requestAnimationFrame(() => document.querySelector<HTMLElement>(".character-creator button")?.focus());
  }
  cancelAvatar(): void {
    if (this.busy()) return;
    this.avatarDraft.set({ ...(this.game().avatar ?? DEFAULT_AVATAR) });
    this.avatarEditorOpen.set(false);
    this.focusWardrobeOrigin();
  }
  async confirmAvatar(): Promise<void> {
    const before = this.game();
    await this.send({ type: "customize", avatar: { ...this.avatarDraft() } });
    if (this.game() !== before && this.game().avatar) {
      this.avatarEditorOpen.set(false);
      this.focusWardrobeOrigin();
    }
  }
  async confirmStarter(): Promise<void> {
    await this.send({ type: "chooseStarter", speciesId: this.starterDraft() });
  }
  nearPot(): boolean {
    const g = this.game();
    const region = g.region ?? "clearing";
    return layoutIn(g, region).pots.some(
      (pot) =>
        Math.abs(g.player.x - pot.x) + Math.abs(g.player.y - pot.y) <= 1 &&
        !(g.brokenPots ?? []).includes(pot.id),
    );
  }
  nearPortal(): boolean {
    const g = this.game(), region = g.region ?? "clearing";
    return distance(g.player, REGION_PORTALS[region].position) <= 1;
  }
  nextRegionName(): string {
    const region = this.game().region ?? "clearing";
    return REGION_NAMES[REGION_PORTALS[region].target];
  }
  receiveAccount(account: AccountAccess | null): void {
    this.profile.set(account?.profile ?? null);
    this.accountAccess = account;
    if (!this.presentation() && location.pathname === "/entrar" && account) history.replaceState(null, "", "/jogar");
    this.updateJourneyPage();
    if (!this.writerReady) return;
    const uid = account?.profile.uid ?? null;
    if (
      uid === this.accountUid &&
      (this.cloud || this.switchingAccount() || !uid)
    )
      return;
    void this.activateAccount(account);
  }
  private async activateAccount(account: AccountAccess | null): Promise<void> {
    if (!this.writerReady || this.readonly() || this.destroyed) return;
    clearTimeout(this.expeditionRetryTimer);
    this.expeditionRetryTimer = undefined;
    this.expeditionRetryDelay = 3000;
    this.finishPlayback();
    this.accountSynchronized.set(false);
    this.expeditionError.set("");
    this.sidePanel.set(null);
    this.avatarEditorOpen.set(false); this.storeOpen.set(false); this.settings.set(false); this.collectionOpen.set(false);
    clearTimeout(this.fieldResetTimer);
    this.field.bind("", null); this.fieldUid = "";
    const epoch = ++this.accountEpoch,
      previous = this.session,
      previousUid = this.sessionUid;
    this.accountUid = account?.profile.uid ?? null;
    this.dailyBoard.set(null);
    this.dailyError.set("");
    this.dailySeedsEarned.set(0);
    if (this.dailyResetTimer) clearTimeout(this.dailyResetTimer);
    this.dailyResetTimer = null;
    this.switchingAccount.set(true);
    this.cloud?.stop();
    this.cloud = null;
    this.cloudStatus.set("loading");
    this.cloudError.set("");
    this.cloudBusy.set(false);
    this.release();
    this.ritual.set(false);
    this.onlinePanel?.leave();
    this.loaded.set(false);
    try {
      await previous?.whenIdle();
      if (epoch !== this.accountEpoch || this.destroyed) return;
      const seed =
        previousUid === null && previous
          ? structuredClone(previous.state)
          : initialGame();
      const repo = new IndexedDbSave(
        account ? `account:${account.profile.uid}` : "guest",
      );
      let session: Session;
      session = new Session(repo, () => {
        if (this.session === session && epoch === this.accountEpoch)
          this.sync();
      });
      await session.load();
      if (epoch !== this.accountEpoch || this.destroyed) return;
      if (!session.ready) throw new Error(session.error);
      this.avatarDraft.set(session.state.avatar ?? { ...DEFAULT_AVATAR });
      const hadCache = session.loadedFromDisk;
      if (account && !hadCache)
        await session.replaceState(previousUid === null ? seed : session.state);
      if (epoch !== this.accountEpoch || this.destroyed) return;
      this.repository = repo;
      this.session = session;
      this.sessionUid = account?.profile.uid ?? null;
      this.temporary.set(false);
      this.switchingAccount.set(false);
      this.sync();
      if (!account) return;
      if (location.pathname.startsWith("/troca/")) this.openSidePanel("account");
      const [{ cloudFingerprint }, gateway] = await Promise.all([
        import("../adapters/cloud-save.js"),
        account.cloud(),
      ]);
      if (epoch !== this.accountEpoch || this.destroyed) return;
      let cloud: CloudSaveSession;
      cloud = new CloudSaveSession(
        account.profile.uid,
        gateway,
        {
          current: () => session.state,
          restore: async (snapshot, revision) => {
            if (epoch !== this.accountEpoch) throw new Error("A conta mudou.");
            await session.replaceState(snapshot, revision);
          },
        },
        {
          load: () => repo.readMetadata(),
          save: (value) => repo.writeMetadata(value),
        },
        cloudFingerprint,
        () => crypto.randomUUID(),
        () => {
          if (this.cloud === cloud && epoch === this.accountEpoch)
            this.updateCloudStatus(cloud);
        },
        hadCache,
      );
      this.cloud = cloud;
      await cloud.start();
      if (epoch === this.accountEpoch) { void this.refreshDailyBoard(); void this.refreshField(); }
    } catch (error) {
      if (epoch !== this.accountEpoch) return;
      this.switchingAccount.set(false);
      this.cloudStatus.set("pending");
      this.cloudError.set(
        error instanceof Error
          ? error.message
          : "Não foi possível abrir o save da conta.",
      );
      if (!this.loaded())
        this.error.set(
          "Não foi possível abrir o cache desta conta. O progresso anterior foi preservado; recarregue para tentar novamente.",
        );
    }
  }
  private updateCloudStatus(cloud: CloudSaveSession): void {
    this.cloudStatus.set(cloud.status);
    this.cloudBusy.set(cloud.busy);
    if (cloud.status === "saved" && !this.accountSynchronized() && !this.expeditionSyncing()) queueMicrotask(() => void this.synchronizeAccountExpedition());
    this.cloudError.set(
      cloud.errorCode === "permission-denied"
        ? "A conta está conectada, mas o Firestore recusou o acesso ao save. Verifique as regras de acesso desta conta. O progresso local foi preservado."
        : cloud.error,
    );
    this.sync();
  }
  syncModalState(): SyncModalState {
    if (this.presentation() || !this.accountAccessPresent() || !this.profile() || !this.game().avatar || !this.game().starterChosen) return "idle";
    // Once the initial account reconciliation completes, background saves never reopen the modal.
    if (this.accountSynchronized()) return "saved";
    if (this.cloudBusy() || this.cloudStatus() === "saving" || this.expeditionSyncing()) return "syncing";
    if (this.cloudStatus() === "pending" || this.cloudStatus() === "conflict" || this.expeditionError() || !this.connectionAvailable()) return "error";
    if (this.cloudStatus() === "loading" || !this.accountSynchronized()) return "syncing";
    return this.cloudStatus() === "saved" ? "saved" : "idle";
  }
  async retrySyncModal(): Promise<void> {
    await this.retryCloudSave();
    await this.retryExpedition();
  }
  cloudLabel(): string {
    if (this.temporary())
      return "Sessão temporária · progresso apenas em memória";
    return {
      loading: "Carregando progresso da conta…",
      local: "Salvo neste navegador · aguardando sincronização",
      saving: "Salvando na conta Google…",
      saved: "Progresso salvo na conta Google",
      pending: "Salvo neste navegador · sincronização pendente",
      conflict: "Há duas versões do progresso",
    }[this.cloudStatus()];
  }
  async retryCloudSave(): Promise<void> {
    if (this.cloud) {
      await this.cloud.retry();
    } else if (this.accountAccess)
      await this.activateAccount(this.accountAccess);
  }
  async useCloudSave(): Promise<void> {
    await this.cloud?.useCloud();
  }
  async useLocalSave(): Promise<void> {
    await this.cloud?.useLocal();
  }
  @HostListener("window:online") async reconnectCloud(): Promise<void> {
    await this.cloud?.retry();
    void this.retryExpedition();
    void this.refreshDailyBoard();
    if (this.accountAccess && this.fieldUid) void this.refreshField();
  }
  @HostListener("window:focus") async refreshCloud(): Promise<void> {
    if (this.cloud?.status !== "conflict") await this.cloud?.retry();
    void this.flushDailyActions();
    if (!this.accountSynchronized()) void this.synchronizeAccountExpedition();
    void this.refreshDailyBoard();
    if (this.accountAccess && this.fieldUid) void this.refreshField();
  }
  @HostListener("window:pagehide") saveOnHide(): void {
    this.audioVisible.set(false); this.refreshAudioScene();
    void this.cloud?.flush();
  }
  @HostListener("window:offline") pauseDisconnected(): void {
    this.connectionAvailable.set(false); this.release(); this.finishPlayback(); this.sync();
  }
  accountReadyChanged(ready: boolean): void {
    if (ready && !this.onlinePanel?.busy() && this.accountAccess && !this.onlineMode() && (!this.accountSynchronized() || this.game().scene === "exploration")) void this.synchronizeAccountExpedition();
    else if (!ready && this.accountAccess && this.connectionAvailable()) this.scheduleExpeditionRetry();
  }
  async retryExpedition(): Promise<void> {
    const epoch = this.accountEpoch;
    this.connectionAvailable.set(navigator.onLine);
    if (!this.connectionAvailable()) return;
    await this.onlinePanel?.connect();
    if (epoch !== this.accountEpoch || this.destroyed) return;
    if (this.cloud?.status !== "conflict") await this.cloud?.retry();
    if (epoch !== this.accountEpoch || this.destroyed) return;
    await this.synchronizeAccountExpedition();
    if (epoch !== this.accountEpoch || this.destroyed) return;
    await this.flushDailyActions();
    if (!this.accountSynchronized() || this.expeditionError() || !this.onlinePanel?.ready()) this.scheduleExpeditionRetry();
  }
  async synchronizeAccountExpedition(): Promise<void> {
    if (this.onlineMode() || this.expeditionSyncing() || !this.accountAccess || !this.session?.ready || !this.onlinePanel?.ready() || !this.game().avatar || this.hasUnchosenStarter() || !this.connectionAvailable() || this.cloudStatus() === "loading" || this.cloudStatus() === "conflict") return;
    // Wait for the first cloud read before reconciling a potentially stale cache.
    if (!this.accountSynchronized() && this.cloudStatus() === "pending") return;
    if (this.accountSynchronized() && this.game().scene === "battle") { this.scheduleExpeditionRetry(); return; }
    if (this.onlinePanel.resumePreviousEncounter(this.session.state)) return;
    clearTimeout(this.expeditionRetryTimer);
    this.expeditionRetryTimer = undefined;
    const epoch = this.accountEpoch, session = this.session;
    this.expeditionSyncing.set(true); this.expeditionError.set(""); this.sync();
    try {
      await session.whenIdle();
      const source = session.state;
      const result = await this.onlinePanel.synchronizeExpedition(source);
      if (epoch !== this.accountEpoch || this.destroyed) return;
      let deferred = false;
      await session.reconcile(current => {
        if (epoch !== this.accountEpoch) throw new Error("A conta mudou.");
        if (JSON.stringify(current.collection) !== JSON.stringify(source.collection) || current.scene === "battle" && source.scene !== "battle") {
          deferred = true;
          return current;
        }
        return reconcileExpedition(current, result.creatures, result.mapping);
      });
      if (deferred) { this.scheduleExpeditionRetry(); return; }
      await this.cloud?.flush();
      if (epoch !== this.accountEpoch || this.destroyed) return;
      if (this.cloudStatus() === "conflict") return;
      if (!this.accountSynchronized() && this.cloud && this.cloud.status !== "saved") {
        this.scheduleExpeditionRetry();
        return;
      }
      this.accountSynchronized.set(true);
      this.expeditionRetryDelay = 3000;
      void this.flushDailyActions();
      void this.refreshDailyBoard();
    } catch (error) {
      if (epoch === this.accountEpoch) {
        this.expeditionError.set(error instanceof Error ? error.message : "Não foi possível reunir sua expedição. Seu progresso foi preservado.");
        this.scheduleExpeditionRetry();
      }
    } finally {
      this.expeditionSyncing.set(false); this.sync();
      if (epoch !== this.accountEpoch) queueMicrotask(() => void this.synchronizeAccountExpedition());
    }
  }
  private scheduleExpeditionRetry(): void {
    if (this.destroyed || !this.writerReady || this.expeditionRetryTimer || !this.accountAccess || this.cloudStatus() === "conflict") return;
    const epoch = this.accountEpoch;
    this.expeditionRetryTimer = setTimeout(() => {
      this.expeditionRetryTimer = undefined;
      if (epoch !== this.accountEpoch || this.destroyed) return;
      void this.retryExpedition().catch(() => this.scheduleExpeditionRetry());
    }, this.expeditionRetryDelay);
    this.expeditionRetryDelay = Math.min(30000, this.expeditionRetryDelay * 2);
  }
  private async flushDailyActions(): Promise<void> {
    if (this.dailySending) { this.dailySendAgain = true; return; }
    if (!this.accountAccess || !this.onlinePanel?.ready() || !this.connectionAvailable()) return;
    const uid = this.accountAccess.profile.uid, epoch = this.accountEpoch, cycle = dailyCycle();
    const types = this.dailyActions.read(uid, cycle);
    if (!types.length) return;
    this.dailySending = true;
    try {
      await this.onlinePanel.recordExpeditionDaily(cycle, types);
      if (epoch !== this.accountEpoch) return;
      this.dailyActions.acknowledge(uid, types, cycle);
      await this.refreshDailyBoard();
    } catch (error) {
      if (epoch === this.accountEpoch) this.dailyError.set(error instanceof Error ? error.message : "Trilhas aguardando sincronização. Reconecte para confirmar.");
    } finally {
      this.dailySending = false;
      if (this.dailySendAgain || epoch !== this.accountEpoch) {
        this.dailySendAgain = false;
        void this.flushDailyActions();
      }
    }
  }
  canEnterOnline(): boolean {
    return (
      !!this.session?.ready &&
      !!this.game().avatar &&
      !this.hasUnchosenStarter() &&
      !this.switchingAccount() &&
      this.loaded() &&
      !this.session.saving &&
      this.session.state.scene === "exploration"
    );
  }
  switchOnlineMode(value: boolean): void {
    this.finishPlayback();
    this.release();
    this.ritual.set(false);
    this.collectionOpen.set(false);
    this.onlineMode.set(value);
    this.selection.set("move");
    if (value) void this.refreshDailyBoard();
    if (!value) this.sync();
  }
  dailyRewardLimit(): number {
    const board = this.dailyBoard();
    return board ? board.contracts.reduce((sum, contract) => sum + contract.rewardSeeds, 0) + board.completionBonusSeeds : 0;
  }
  enterDailyExpedition(): void {
    if (this.canEnterOnline()) this.onlinePanel?.enter();
  }
  async refreshDailyBoard(): Promise<void> {
    if (this.dailyBusy()) { this.dailyRefreshAgain = true; return; }
    if (!this.onlinePanel || !this.session?.ready || !this.profile()) return;
    const epoch = this.accountEpoch;
    const session = this.session;
    this.dailyBusy.set(true);
    try {
      const board = await this.onlinePanel.loadDailyBoard();
      if (epoch !== this.accountEpoch || this.destroyed) return;
      this.dailyError.set("");
      this.dailySeedsEarned.set(board.contracts.filter((c) => c.completed).reduce((sum, c) => sum + c.rewardSeeds, 0) + (board.completionBonusEarned ? board.completionBonusSeeds : 0));
      this.dailyBoard.set(board);
      if (this.dailyResetTimer) clearTimeout(this.dailyResetTimer);
      this.dailyResetTimer = setTimeout(() => void this.refreshDailyBoard(), Math.max(1000, Math.min(board.resetAt - Date.now() + 1000, 2_147_000_000)));
      const applied: string[] = [];
      for (const reward of board.pendingRewards) {
        if (epoch !== this.accountEpoch || this.destroyed) return;
        if (session.state.dailyRewardReceipts?.includes(reward.receiptId)) {
          applied.push(reward.receiptId);
          continue;
        }
        await session.dispatch({ type: "applyDailyReward", ...reward });
        if (session.ready && session.state.dailyRewardReceipts?.includes(reward.receiptId)) applied.push(reward.receiptId);
      }
      if (applied.length) {
        if (epoch !== this.accountEpoch || this.destroyed) return;
        if (this.cloud) {
          await this.cloud.flush();
          if (this.cloud.status !== "saved") throw new Error("As recompensas foram salvas neste navegador e serão confirmadas quando a nuvem terminar de sincronizar.");
        }
        if (epoch !== this.accountEpoch || this.destroyed) return;
        await this.onlinePanel.acknowledgeDailyRewards(applied);
      }
    } catch (error) {
      if (epoch === this.accountEpoch && !this.destroyed) this.dailyError.set(error instanceof Error ? error.message : "Não foi possível sincronizar as trilhas. Tente novamente.");
    } finally {
      this.dailyBusy.set(false);
      if (this.dailyRefreshAgain && !this.destroyed) {
        this.dailyRefreshAgain = false;
        void this.refreshDailyBoard();
      }
    }
  }
  receiveOnlineView(game: Game): void {
    if (!this.onlineMode()) return;
    const before = this.game();
    this.game.set(game);
    if (game.scene === "exploration" && before.scene !== "exploration") void this.completePreviousEncounter(game, before);
  }
  private async completePreviousEncounter(online: Game, result: Game): Promise<void> {
    const session = this.session, epoch = this.accountEpoch;
    if (!session) return;
    this.onlineMode.set(false);
    this.expeditionSyncing.set(true);
    this.onlinePanel?.leave();
    try {
      await session.reconcile(current => {
        if (epoch !== this.accountEpoch) throw new Error("A conta mudou.");
        return mergePreviousEncounter(current, online, result);
      });
    } catch (error) {
      if (epoch === this.accountEpoch) this.expeditionError.set(error instanceof Error ? error.message : "Não foi possível retomar o mundo salvo.");
    } finally {
      this.expeditionSyncing.set(false); this.sync();
      if (epoch === this.accountEpoch) void this.synchronizeAccountExpedition();
    }
  }
  receiveOnlineBusy(busy: boolean): void {
    if (this.onlineMode()) this.busy.set(busy);
  }
  creatureLocked(id: string): boolean {
    return !!this.onlinePanel?.locked(id);
  }
  discovered(): number {
    return new Set(this.game().collection.map((c) => c.speciesId)).size;
  }
  hasSpecies(id: SpeciesId): boolean {
    return this.game().collection.some((c) => c.speciesId === id);
  }
  nearHealer(): boolean {
    const g = this.game();
    return distance(
      g.player,
      g.region === "old-grove" ? { x: 10, y: 10 } : { x: 7, y: 10 },
    ) <= 2;
  }
  nearAncientMarker(): boolean {
    const g = this.game();
    const seal = RESONANCE_SEALS[g.resonanceStep ?? 0];
    return (
      g.region === "old-grove" &&
      !g.ancientMarkerHeard &&
      !!seal &&
      distance(g.player, seal) <= 2
    );
  }
  nextSealName(): string {
    const seal = RESONANCE_SEALS[this.game().resonanceStep ?? 0];
    return seal ? ELEMENT_NAMES[seal.element] : "concluído";
  }
  nearRival(): boolean {
    return !!this.nearbyNpc();
  }
  nearbyNpc(): ReturnType<typeof layoutIn>["npcs"][number] | null {
    const g = this.game();
    return layoutIn(g, g.region ?? "clearing").npcs.find((npc) => distance(g.player, npc) <= 1) ?? null;
  }
  regionSubtitle(): string {
    return `${["clearing", "old-grove", "canopy-trail", "tide-cavern"].indexOf(this.game().region ?? "clearing") + 1} · EXPLORAÇÃO`;
  }
  rivalWon(): boolean {
    const npc = this.nearbyNpc();
    return !!npc && (this.game().npcDuelWins ?? []).includes(npc.id);
  }
  captureReady(): boolean {
    const b = this.game().battle;
    return !!b && canCapture(b);
  }
  chance(): number {
    const b = this.game().battle;
    if (!b) return 0;
    return b.guided
      ? 100
      : Math.round(
          captureChance(b.enemy.hp, creatureMaxHp(b.enemy.speciesId, creatureLevel(b.enemy), b.balance), b.failures) *
            100,
        );
  }
  capture(): void {
    if (!this.captureReady() || this.busy()) return;
    if (!this.prefs().timing) {
      void this.send({ type: "capture" });
      return;
    }
    this.ritualElapsed = 0;
    this.ritualLast = 0;
    this.ritualProgress.set(0);
    this.ritualConfirmed.set(false);
    this.ritual.set(true);
  }
  confirmRitual(): void {
    if (this.ritualConfirmed()) return;
    this.ritualConfirmed.set(true);
    if (this.ritualElapsed >= 400 && this.ritualElapsed <= 800) {
      this.ritual.set(false);
      void this.send({ type: "capture" });
    }
  }
  selectCell(x: number, y: number): void {
    const b = this.game().battle;
    if (!b) return;
    const type = this.selection();
    if (type === "move") void this.send({ type: "move", position: { x, y } });
    else if (type === "basic" || type === "skill")
      void this.send({ type, target: { x, y } });
  }
  cellLabel(x: number, y: number): string {
    const b = this.game().battle;
    if (!b) return "";
    const tile = b.cells[y * 5 + x]?.terrain;
    const names: Record<string, string> = {
      ground: "chão",
      grass: "grama",
      water: "água",
      fire: "fogo",
    };
    return `${String.fromCharCode(65 + y)}${x + 1}, ${names[tile ?? "ground"]}${same(b.ally.pos, { x, y }) ? ", seu Eco" : ""}${same(b.enemy.pos, { x, y }) ? ", " + species(b.enemy.speciesId).name : ""}`;
  }
  canvasLabel(): string {
    const g = this.battleView();
    if (g.scene === "exploration")
      return `${REGION_NAMES[g.region ?? "clearing"]}, posição coluna ${g.player.x}, linha ${g.player.y}. Siga os portais para descobrir outras áreas.${this.nearAncientMarker() ? ` Pressione E para ativar o selo de ${this.nextSealName()}.` : this.nearPot() ? " Pressione E para quebrar o vaso e recolher Sementes." : this.nearRival() ? ` ${this.nearbyNpc()?.name} está pronto para um duelo opcional de Ecos.` : ""}`;
    const b = g.battle;
    if (b?.mode === "classic") return `Batalha por turnos. ${this.turnPhase() === "choice" ? "Sua vez: escolha uma ação." : this.turnPhase() === "player" ? "Sua ação está sendo resolvida." : "Vez do adversário."} ${species(b.ally.speciesId).name}: ${b.ally.hp} PV. ${species(b.enemy.speciesId).name}: ${b.enemy.hp} PV.`;
    return b
      ? `Arena. ${species(b.ally.speciesId).name} com ${b.ally.hp} PV; ${species(b.enemy.speciesId).name} com ${b.enemy.hp} PV. Inimigo planeja ${b.plan.action === "defend" ? "defender" : `atacar ${String.fromCharCode(65 + b.plan.target.y)}${b.plan.target.x + 1}`}.`
      : "";
  }
  gridKey(e: KeyboardEvent, x: number, y: number): void {
    const offsets: Record<string, readonly [number, number]> = {
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
    };
    const delta = offsets[e.key];
    if (!delta) return;
    e.preventDefault();
    e.stopPropagation();
    const nx = Math.max(0, Math.min(4, x + delta[0])),
      ny = Math.max(0, Math.min(4, y + delta[1]));
    this.gridFocus.set(ny * 5 + nx);
    const buttons =
      this.canvas.nativeElement.parentElement?.querySelectorAll<HTMLButtonElement>(
        ".arena-cell",
      );
    buttons?.[ny * 5 + nx]?.focus();
  }
  hold(e: PointerEvent, dx: number, dy: number): void {
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    this.held = { dx, dy };
    this.lastWalk = performance.now();
    void this.send({ type: "walk", dx, dy });
  }
  release(): void {
    this.held = null;
  }
  @HostListener("document:keydown", ["$event"]) keydown(
    e: KeyboardEvent,
  ): void {
    if (!e.repeat) this.activateAudioFromGesture();
    if (this.presentation()) return;
    if (e.key === "Tab") {
      const dialogs = document.querySelectorAll<HTMLElement>('[role="dialog"]');
      const dialog = dialogs.item(dialogs.length - 1);
      // The wardrobe is rendered before the settings dialog, but sits above it.
      const top = document.querySelector<HTMLElement>(".character-creator") ?? dialog;
      if (top) {
        const controls = Array.from(top.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), [tabindex="0"]')).filter(el => el.getClientRects().length);
        const first = controls[0], last = controls[controls.length - 1];
        if (first && (!top.contains(document.activeElement) || (e.shiftKey ? document.activeElement === first : document.activeElement === last))) {
          e.preventDefault();
          (e.shiftKey ? last : first)?.focus();
        }
      }
    }
    if (e.key === "Escape") {
      this.release();
      if (this.avatarEditorOpen()) { this.cancelAvatar(); return; }
      if (this.creatingCharacter() || this.needsStarterChoice()) return;
      if (this.gameMasterOpen()) { this.gameMasterOpen.set(false); return; }
      if (this.storeOpen()) { this.storeOpen.set(false); return; }
      if (this.collectionOpen()) { this.closePanel("collection"); return; }
      if (this.settings()) { this.closePanel("settings"); return; }
      if (this.sidePanel()) { this.closeSidePanel(); return; }
      this.selection.set("move");
      return;
    }
    if (
      !this.profile() ||
      !this.game().avatar ||
      this.hasUnchosenStarter() ||
      this.game().scene !== "exploration" ||
      !!this.sidePanel() ||
      this.collectionOpen() ||
      this.settings() ||
      this.storeOpen() ||
      this.gameMasterOpen() ||
      this.creatingCharacter() ||
      e.ctrlKey ||
      e.metaKey ||
      e.altKey
    )
      return;
    if (
      e.target instanceof HTMLElement &&
      (["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName) ||
        e.target.isContentEditable)
    )
      return;
    const mechanism = this.nearEnvironmentMechanism();
    if (e.key.toLowerCase() === "e" && mechanism && !this.environmentCompleted(mechanism.id)) {
      e.preventDefault();
      if (!e.repeat) void this.send({type: "restoreEnvironment", id: mechanism.id, method: this.environmentEcoReady(mechanism) ? "eco" : "manual"});
      return;
    }
    const fieldPoint = this.nearFieldPoint();
    if (e.key.toLowerCase() === "e" && fieldPoint && this.fieldPointAvailable(fieldPoint.id)) {
      e.preventDefault(); if (!e.repeat) void this.collectField(); return;
    }
    if (e.key.toLowerCase() === "e" && this.nearAncientMarker()) {
      e.preventDefault();
      if (!e.repeat) void this.send({ type: "interact" });
      return;
    }
    if (e.key.toLowerCase() === "e" && this.nearPot()) {
      e.preventDefault();
      if (!e.repeat) void this.send({ type: "breakPot" });
      return;
    }
    if (e.key.toLowerCase() === "e" && this.nearRival()) {
      e.preventDefault();
      if (!e.repeat) void this.send(this.rivalWon() ? {type: "rematchNpc", npcId: this.nearbyNpc()?.id} : { type: "challengeNpc" });
      return;
    }
    const dirs: Record<string, readonly [number, number]> = {
      w: [0, -1],
      ArrowUp: [0, -1],
      s: [0, 1],
      ArrowDown: [0, 1],
      a: [-1, 0],
      ArrowLeft: [-1, 0],
      d: [1, 0],
      ArrowRight: [1, 0],
    };
    const d = dirs[e.key.toLowerCase()] ?? dirs[e.key];
    if (d) {
      e.preventDefault();
      if (e.repeat) return;
      this.held = { dx: d[0], dy: d[1] };
      this.lastWalk = performance.now();
      void this.send({ type: "walk", dx: d[0], dy: d[1] });
    }
  }
  @HostListener("document:keyup") keyup(): void {
    this.release();
  }
  @HostListener("window:blur") blur(): void {
    this.release();
  }
  @HostListener("window:pageshow") audioPageShown(): void { this.audioVisible.set(!document.hidden); this.refreshAudioScene(); }
  @HostListener("document:visibilitychange") visibility(): void {
    this.audioVisible.set(!document.hidden); this.refreshAudioScene();
    this.finishPlayback();
    this.release();
    this.renderer?.resetMotion();
    this.feedbackNotices.set([]);
    this.ritualLast = 0;
  }
  togglePref(key: "sound" | "reduced" | "timing"): void {
    this.prefs.update((p) => ({ ...p, [key]: !p[key] }));
    this.savePreferences();
    if (key === "sound") { this.refreshAudioScene(); if (this.prefs().sound) this.audio.unlock(); }
  }
  private savePreferences(): void {
    try {
      localStorage.setItem(
        "wildwoods-preferences",
        JSON.stringify(this.prefs()),
      );
    } catch {
      /* Preferences are optional. */
    }
  }
  async exportSave(): Promise<void> {
    const raw = this.repository
      ? await Promise.race([
          this.repository.exportRaw().catch(() => null),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 500)),
        ])
      : null;
    const text = JSON.stringify(
      {
        session: this.session?.state ?? this.game(),
        persisted: raw ? (JSON.parse(raw) as unknown) : null,
      },
      null,
      2,
    );
    const blob = new Blob([text], { type: "application/json" }),
      url = URL.createObjectURL(blob),
      a = document.createElement("a");
    a.href = url;
    a.download = "choravia-backup.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  ngOnDestroy(): void {
    clearTimeout(this.expeditionRetryTimer);
    this.finishPlayback();
    if (this.feedbackTimer) clearTimeout(this.feedbackTimer);
    this.destroyed = true;
    this.accountEpoch++;
    this.cloud?.stop();
    cancelAnimationFrame(this.frame);
    this.release();
    this.unlock?.();
    clearTimeout(this.fieldResetTimer);
    this.field.bind("", null);
    this.audio.close();
  }
}
