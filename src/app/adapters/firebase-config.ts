export interface FirebaseClientConfig {
  apiKey: string;
  projectId: string;
  authDomain: string;
  appId: string;
  storageBucket: string;
  messagingSenderId: string;
  emulators: boolean;
}
export function firebaseConfig(): FirebaseClientConfig | null {
  const env = import.meta.env;
  if (!env["VITE_FIREBASE_API_KEY"] || !env["VITE_FIREBASE_PROJECT_ID"])
    return null;
  return {
    apiKey: env["VITE_FIREBASE_API_KEY"],
    projectId: env["VITE_FIREBASE_PROJECT_ID"],
    authDomain: env["VITE_FIREBASE_AUTH_DOMAIN"] ?? "",
    appId: env["VITE_FIREBASE_APP_ID"] ?? "",
    storageBucket: env["VITE_FIREBASE_STORAGE_BUCKET"] ?? "",
    messagingSenderId: env["VITE_FIREBASE_MESSAGING_SENDER_ID"] ?? "",
    emulators: env["VITE_FIREBASE_EMULATORS"] === "true",
  };
}
