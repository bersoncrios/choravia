import { FirestoreLiveOps } from "./firestore-live-ops.js";
import type { LiveOpsRequest, LiveContent, PlayerBadge } from "../domain/live-ops.js";
import { getApps, initializeApp } from "firebase/app";
import {
  getAuth,
  connectAuthEmulator,
  signInAnonymously,
  signInWithPopup,
  linkWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
} from "firebase/auth";
import { GameService } from "../domain/online-engine/service.js";
import { BrowserFirestoreStore } from "./firestore-online.js";
import { FirestoreGameMaster } from "./firestore-game-master.js";
import type { FirebaseClientConfig } from "./firebase-config.js";
import type {
  OnlineGateway,
  RemoteMethod,
  Requests,
  Responses,
} from "../domain/online.js";
import { validateResponse } from "../domain/online-validation.js";
import type { AccountAccess, UserProfile } from "../application/cloud-save.js";
import type { GameMasterRequest, GameMasterResponse } from "../domain/game-master.js";
import { firestore, saveUserProfile, userHasGameMasterRole, watchUserGameMasterRole } from "./cloud-save.js";
import { userProfile } from "../application/profile.js";
export class FirebaseGateway implements OnlineGateway {
  private readonly app;
  private readonly auth;
  private readonly gameService: GameService;
  private readonly gameMaster: FirestoreGameMaster;
  private readonly liveOps: FirestoreLiveOps;
  private readonly emulators: boolean;
  constructor(config: FirebaseClientConfig) {
    this.emulators = config.emulators;
    const existing = getApps().find((a) => a.name === "wildwoods");
    this.app = existing ?? initializeApp(config, "wildwoods");
    this.auth = getAuth(this.app);
    if (config.emulators) {
      if (
        !config.projectId.startsWith("demo-") ||
        !["localhost", "127.0.0.1", "[::1]"].includes(location.hostname)
      )
        throw new Error("Emuladores exigem projeto demo e origem local.");
      if (!existing) {
        connectAuthEmulator(this.auth, "http://127.0.0.1:9099", {
          disableWarnings: true,
        });
      }
    }
    const db = firestore(this.app, config.emulators);
    this.gameService = new GameService(new BrowserFirestoreStore(db, () => this.uid));
    this.gameMaster = new FirestoreGameMaster(db, () => this.uid);
    this.liveOps = new FirestoreLiveOps(db, () => this.uid);
  }
  get uid(): string {
    return this.auth.currentUser?.uid ?? "";
  }
  get signedIn(): boolean {
    return !!this.auth.currentUser;
  }
  get anonymous(): boolean {
    return this.auth.currentUser?.isAnonymous ?? false;
  }
  get profile(): UserProfile | null {
    return userProfile(this.auth.currentUser);
  }
  account(): AccountAccess | null {
    const profile = this.profile;
    if (!profile) return null;
    return {
      profile,
      cloud: async () => {
        const { FirestoreCloudSave } = await import("./cloud-save.js");
        return new FirestoreCloudSave(
          this.app,
          profile.uid,
          () => this.uid,
          this.emulators,
        );
      },
    };
  }
  async logout(): Promise<void> {
    await signOut(this.auth);
  }
  observeAccount(
    listener: (account: AccountAccess | null) => void,
  ): () => void {
    return onAuthStateChanged(this.auth, () => listener(this.account()));
  }
  async restoreAccount(): Promise<void> {
    await this.auth.authStateReady();
  }
  async anonymousSignIn(): Promise<void> {
    await this.auth.authStateReady();
    if (!this.auth.currentUser) await signInAnonymously(this.auth);
  }
  async google(switchAccount = false): Promise<void> {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    if (this.auth.currentUser?.isAnonymous && !switchAccount) {
      try {
        await linkWithPopup(this.auth.currentUser, provider);
      } catch (error) {
        if (
          error &&
          typeof error === "object" &&
          "code" in error &&
          error.code === "auth/credential-already-in-use"
        )
          throw Object.assign(
            new Error(
              "Esta conta Google já existe. Use “Abrir conta Google existente” para trocar de conta sem mesclar inventários.",
            ),
            { code: "auth/credential-already-in-use" },
          );
        throw error;
      }
    } else await signInWithPopup(this.auth, provider);
  }
  async call<K extends RemoteMethod>(
    method: K,
    input: Requests[K],
  ): Promise<Responses[K]> {
    if (!this.uid)
      throw new Error(
        "Entre com Google ou ative o login anônimo para usar a expedição online.",
      );
    const response = await this.gameService.execute(this.uid, method, input);
    return validateResponse(method, response);
  }
  async callGameMaster(input: GameMasterRequest): Promise<GameMasterResponse> {
    if (!this.uid) throw new Error("Entre com Google para usar o painel Game Master.");
    return this.gameMaster.execute(input);
  }
  liveOpsAudit() { return this.liveOps.audit(); }
  callLiveOps(request: LiveOpsRequest) { return this.liveOps.execute(request); }
  watchLiveContent(uid: string, changed: (content: LiveContent) => void, badges: (value: PlayerBadge[]) => void, failed: (error: Error) => void) { return this.liveOps.watch(uid, changed, badges, failed); }
  async hasGameMasterRole(uid: string): Promise<boolean> {
    return userHasGameMasterRole(this.app, uid, () => this.uid, this.emulators);
  }
  watchGameMasterRole(uid: string, changed: (isAdmin: boolean) => void, failed: (error: Error) => void): () => void {
    return watchUserGameMasterRole(this.app, uid, () => this.uid, this.emulators, changed, failed);
  }
  async syncUserProfile(): Promise<void> {
    const user = this.auth.currentUser;
    if (!user || user.isAnonymous) return;
    await saveUserProfile(this.app, user.uid, () => this.uid, this.emulators, {
      displayName: user.displayName,
      email: user.email,
      photoURL: user.photoURL,
    });
  }
}
