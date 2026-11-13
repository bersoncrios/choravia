import type { UserProfile } from "./cloud-save.js";
export interface AuthProfile {
  uid: string;
  isAnonymous: boolean;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
}
export function userProfile(user: AuthProfile | null): UserProfile | null {
  if (!user || user.isAnonymous) return null;
  let photoURL: string | null = null;
  try {
    if (user.photoURL && new URL(user.photoURL).protocol === "https:")
      photoURL = user.photoURL;
  } catch {}
  const email = user.email?.trim() ?? "";
  return {
    uid: user.uid,
    name: user.displayName?.trim() || email || "Guardião",
    email,
    photoURL,
  };
}
export function profileInitials(name: string): string {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => Array.from(part)[0] ?? "")
      .join("")
      .toUpperCase() || "G"
  );
}
