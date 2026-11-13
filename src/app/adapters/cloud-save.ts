import type { FirebaseApp } from "firebase/app";
import {
  getFirestore,
  connectFirestoreEmulator,
  doc,
  getDocFromServer,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  setDoc,
  type Firestore,
} from "firebase/firestore";
import type {
  CloudRecord,
  CloudSaveGateway,
  CloudWrite,
} from "../application/cloud-save.js";
import {
  encodeSnapshot,
  decodeCloudRecord,
  snapshotContent,
  resolveCloudWrite,
} from "../domain/cloud-snapshot.js";
import type { Game } from "../domain/game.js";
const databases = new WeakMap<FirebaseApp, Firestore>();
export function firestore(app: FirebaseApp, emulators: boolean): Firestore {
  let db = databases.get(app);
  if (!db) {
    db = getFirestore(app);
    if (emulators) connectFirestoreEmulator(db, "127.0.0.1", 8080);
    databases.set(app, db);
  }
  return db;
}
export async function userHasGameMasterRole(
  app: FirebaseApp,
  uid: string,
  currentUid: () => string,
  emulators: boolean,
): Promise<boolean> {
  if (currentUid() !== uid) return false;
  const snapshot = await getDocFromServer(doc(firestore(app, emulators), "users", uid));
  if (currentUid() !== uid) return false;
  return snapshot.exists() && snapshot.get("role") === "admin";
}
export function watchUserGameMasterRole(
  app: FirebaseApp,
  uid: string,
  currentUid: () => string,
  emulators: boolean,
  changed: (isAdmin: boolean) => void,
  failed: (error: Error) => void,
): () => void {
  if (currentUid() !== uid) { changed(false); return () => {}; }
  return onSnapshot(doc(firestore(app, emulators), "users", uid), { includeMetadataChanges: true }, snapshot => {
    if (currentUid() !== uid || snapshot.metadata.fromCache) return;
    changed(snapshot.exists() && snapshot.get("role") === "admin");
  }, error => { if (currentUid() === uid) failed(error); });
}
export async function saveUserProfile(
  app: FirebaseApp,
  uid: string,
  currentUid: () => string,
  emulators: boolean,
  profile: { displayName: string | null; email: string | null; photoURL: string | null },
): Promise<void> {
  if (currentUid() !== uid) throw new Error("A conta mudou.");
  await setDoc(
    doc(firestore(app, emulators), "users", uid),
    {
      ...profile,
      displayNameSearch: (profile.displayName ?? "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim(),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
  if (currentUid() !== uid) throw new Error("A conta mudou durante o salvamento do perfil.");
}
async function timed<T>(promise: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () =>
            reject(
              new Error(
                "Sem confirmação da nuvem. O progresso continua salvo neste navegador; tente sincronizar novamente.",
              ),
            ),
          15000,
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
export class FirestoreCloudSave implements CloudSaveGateway {
  private readonly db: Firestore;
  constructor(
    app: FirebaseApp,
    readonly uid: string,
    private readonly currentUid: () => string,
    emulators: boolean,
  ) {
    this.db = firestore(app, emulators);
  }
  private identity(): void {
    if (this.currentUid() !== this.uid)
      throw new Error(
        "A conta mudou. A sincronização anterior foi interrompida.",
      );
  }
  async load(): Promise<CloudRecord | null> {
    this.identity();
    const snap = await timed(
      getDocFromServer(doc(this.db, "users", this.uid, "saves", "solo")),
    );
    this.identity();
    return snap.exists() ? decodeCloudRecord(snap.data()) : null;
  }
  async write(input: CloudWrite): Promise<CloudRecord> {
    this.identity();
    const snapshot = encodeSnapshot(input.snapshot);
    if (
      !Number.isSafeInteger(input.expectedRevision) ||
      input.expectedRevision < 0 ||
      !/^[A-Za-z0-9_-]{8,100}$/.test(input.writeId)
    )
      throw new Error("Pedido de salvamento inválido.");
    return timed(
      runTransaction(this.db, async (tx) => {
        this.identity();
        const ref = doc(this.db, "users", this.uid, "saves", "solo"),
          snap = await tx.get(ref),
          data = snap.exists() ? snap.data() : null,
          old = data ? decodeCloudRecord(data) : null;
        const decision = resolveCloudWrite(old, input);
        if (decision.replay) return decision.record;
        this.identity();
        const active = input.snapshot.collection.find(c => c.id === input.snapshot.activeId);
        const activeCreatureId = input.snapshot.scene === "battle" && active?.provenance === "validated" ? active.id : null;
        if (activeCreatureId) {
          const creature = await tx.get(doc(this.db, "creatures", activeCreatureId));
          if (!creature.exists() || creature.get("ownerId") !== this.uid || creature.get("lock")?.kind === "trade") throw new Error("O Eco da batalha está reservado ou foi transferido. Seu progresso foi preservado.");
        }
        const revision = decision.record.revision;
        tx.set(ref, {
          schemaVersion: 1,
          revision,
          writeId: input.writeId,
          snapshot,
          createdAt: data?.["createdAt"] ?? serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        tx.set(doc(this.db, "users", this.uid, "expedition", "status"), { activeCreatureId, saveRevision: revision, updatedAt: serverTimestamp() });
        return decision.record;
      }),
    );
  }
}
export async function cloudFingerprint(game: Game): Promise<string> {
  const bytes = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(snapshotContent(game)),
  );
  return [...new Uint8Array(bytes)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
