/**
 * API key minting and verification helpers.
 *
 * The full key is shown to the admin exactly once. What we keep is a SHA-256
 * digest (in a table no client role can read) plus a prefix used to find the
 * row, so a database leak does not hand an attacker working keys.
 *
 * Uses Web Crypto rather than node:crypto so the same code runs in Node, in an
 * edge runtime, and in a React Native bundle.
 */

const KEY_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
const SECRET_LENGTH = 32;

/** Long enough to be unique in practice, short enough to show in a table. */
export const KEY_PREFIX_LENGTH = 16;

export type GeneratedApiKey = {
  /** Full secret. Shown once, never stored. */
  key: string;
  /** Stored in public.api_keys for lookup and display. */
  prefix: string;
  /** Stored in public.api_key_secrets. */
  hash: string;
};

function randomString(length: number): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let out = '';
  for (let i = 0; i < length; i += 1) {
    // 256 % 62 leaves a small modulo bias. With 32 characters of output the
    // remaining entropy is far beyond what brute force could reach.
    out += KEY_ALPHABET[bytes[i]! % KEY_ALPHABET.length];
  }
  return out;
}

export async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function generateApiKey(
  environment: 'live' | 'test' = 'live',
): Promise<GeneratedApiKey> {
  const key = `sam_${environment}_${randomString(SECRET_LENGTH)}`;
  return {
    key,
    prefix: key.slice(0, KEY_PREFIX_LENGTH),
    hash: await sha256Hex(key),
  };
}

/** Pulls a bearer token out of an Authorization header, if there is one. */
export function parseBearerToken(header: string | null | undefined): string | null {
  if (!header) return null;
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1]!.trim() : null;
}

export function looksLikeApiKey(token: string): boolean {
  return /^sam_(live|test)_[A-Za-z0-9]{16,}$/.test(token);
}

export function keyPrefixOf(token: string): string {
  return token.slice(0, KEY_PREFIX_LENGTH);
}

/**
 * Scope check. `announcements:write` also satisfies `announcements:read`,
 * so callers do not have to list both.
 */
export function hasScope(granted: readonly string[], required: string): boolean {
  if (granted.includes(required)) return true;
  const [resource, action] = required.split(':');
  if (action === 'read' && resource) return granted.includes(`${resource}:write`);
  return false;
}
