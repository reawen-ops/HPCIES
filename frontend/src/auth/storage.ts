export interface StoredAuth {
  token: string;
  expiresAt: string; // ISO string
  user: { id: number; username: string };
}

const KEY = "hpcies_auth";

export function readStoredAuth(): StoredAuth | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredAuth;
    if (!parsed?.token || !parsed?.expiresAt || !parsed?.user) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeStoredAuth(auth: StoredAuth) {
  localStorage.setItem(KEY, JSON.stringify(auth));
}

export function clearStoredAuth() {
  localStorage.removeItem(KEY);
}

export function isExpired(expiresAt: string) {
  const t = Date.parse(expiresAt);
  if (Number.isNaN(t)) return true;
  return Date.now() >= t;
}


