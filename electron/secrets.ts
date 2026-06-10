import { app, safeStorage } from 'electron';
import { randomBytes } from 'crypto';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import path from 'path';

const userData = (): string => app.getPath('userData');
const authSecretPath = (): string => path.join(userData(), 'auth-secret.bin');
const byoPath = (): string => path.join(userData(), 'byo-keys.bin');

// The env var names the bundled Next server reads. Keep in sync with the
// settings UI and the spawn env in electron/server.ts.
export const BYO_KEYS = [
  'OPENAI_API_KEY',
  'OPENAI_BASE_URL',
  'LIVEKIT_API_KEY',
  'LIVEKIT_API_SECRET',
  'NEXT_PUBLIC_LIVEKIT_URL',
] as const;
export type ByoKey = (typeof BYO_KEYS)[number];

function encryptToFile(file: string, plain: string): void {
  const data = safeStorage.isEncryptionAvailable()
    ? safeStorage.encryptString(plain)
    : Buffer.from('PLAIN:' + plain, 'utf8'); // rare fallback (e.g. Linux w/o keyring)
  writeFileSync(file, data);
}

function decryptFromFile(file: string): string | null {
  if (!existsSync(file)) return null;
  const buf = readFileSync(file);
  if (buf.subarray(0, 6).toString('utf8') === 'PLAIN:') return buf.subarray(6).toString('utf8');
  try {
    return safeStorage.decryptString(buf);
  } catch {
    return null;
  }
}

/** Read-or-generate a per-install NextAuth secret. Never shipped in the binary. */
export function ensureAuthSecret(): string {
  const existing = decryptFromFile(authSecretPath());
  if (existing) return existing;
  const secret = randomBytes(32).toString('base64');
  encryptToFile(authSecretPath(), secret);
  return secret;
}

/** All saved BYO keys (decrypted) as an env map. Empty when none set. */
export function loadByoKeys(): Record<string, string> {
  const raw = decryptFromFile(byoPath());
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, string>;
    const out: Record<string, string> = {};
    for (const k of BYO_KEYS) {
      const v = parsed[k];
      if (typeof v === 'string' && v.length > 0) out[k] = v;
    }
    return out;
  } catch {
    return {};
  }
}

/** Merge + persist BYO keys. Empty-string values delete that key. */
export function saveByoKeys(partial: Record<string, string>): void {
  const current = loadByoKeys();
  for (const k of BYO_KEYS) {
    if (k in partial) {
      const v = partial[k];
      if (v) current[k] = v;
      else delete current[k];
    }
  }
  encryptToFile(byoPath(), JSON.stringify(current));
}

/** Which BYO keys are set (names only — never return values to the renderer). */
export function byoKeyStatus(): Record<string, boolean> {
  const set = loadByoKeys();
  return Object.fromEntries(BYO_KEYS.map((k) => [k, Boolean(set[k])]));
}
