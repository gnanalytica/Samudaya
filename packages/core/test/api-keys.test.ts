import { describe, expect, it } from 'vitest';
import {
  KEY_PREFIX_LENGTH,
  generateApiKey,
  hasScope,
  keyPrefixOf,
  looksLikeApiKey,
  parseBearerToken,
  sha256Hex,
} from '../src/api-keys';

describe('generateApiKey', () => {
  it('produces a key whose prefix and hash line up with it', async () => {
    const { key, prefix, hash } = await generateApiKey();
    expect(key.startsWith('sam_live_')).toBe(true);
    expect(prefix).toBe(key.slice(0, KEY_PREFIX_LENGTH));
    expect(hash).toBe(await sha256Hex(key));
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('never repeats', async () => {
    const keys = await Promise.all(Array.from({ length: 50 }, () => generateApiKey()));
    expect(new Set(keys.map((k) => k.key)).size).toBe(50);
  });

  it('marks test keys distinctly, so they cannot be confused with live ones', async () => {
    const { key } = await generateApiKey('test');
    expect(key.startsWith('sam_test_')).toBe(true);
  });
});

describe('parseBearerToken', () => {
  it('pulls the token out of the header', () => {
    expect(parseBearerToken('Bearer sam_live_abc')).toBe('sam_live_abc');
    expect(parseBearerToken('bearer sam_live_abc')).toBe('sam_live_abc');
  });

  it('returns null when there is nothing usable', () => {
    expect(parseBearerToken(null)).toBeNull();
    expect(parseBearerToken('')).toBeNull();
    expect(parseBearerToken('Basic abc')).toBeNull();
  });
});

describe('looksLikeApiKey', () => {
  it('accepts generated keys and rejects a JWT', async () => {
    const { key } = await generateApiKey();
    expect(looksLikeApiKey(key)).toBe(true);
    expect(keyPrefixOf(key)).toHaveLength(KEY_PREFIX_LENGTH);
    expect(looksLikeApiKey('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.abc.def')).toBe(false);
    expect(looksLikeApiKey('sam_live_short')).toBe(false);
  });
});

describe('hasScope', () => {
  it('matches an exact grant', () => {
    expect(hasScope(['requests:read'], 'requests:read')).toBe(true);
  });

  it('lets write imply read for the same resource', () => {
    expect(hasScope(['requests:write'], 'requests:read')).toBe(true);
  });

  it('does not let read imply write, nor cross resources', () => {
    expect(hasScope(['requests:read'], 'requests:write')).toBe(false);
    expect(hasScope(['announcements:write'], 'requests:read')).toBe(false);
  });

  it('denies when nothing is granted', () => {
    expect(hasScope([], 'requests:read')).toBe(false);
  });
});
