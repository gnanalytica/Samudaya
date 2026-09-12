import { describe, expect, it } from 'vitest';
import {
  INVITE_CODE_ALPHABET,
  formatInviteCode,
  isPlausibleInviteCode,
  isRedeemSuccess,
  normalizeInviteCode,
  redeemMessage,
} from '../src/invite-codes';

describe('normalizeInviteCode', () => {
  it('accepts whatever shape the human typed', () => {
    for (const input of ['k7mq3xpb', 'K7MQ-3XPB', ' k7mq 3xpb ', 'K7MQ_3XPB', 'k7mq.3xpb']) {
      expect(normalizeInviteCode(input)).toBe('K7MQ3XPB');
    }
  });

  it('is idempotent', () => {
    const once = normalizeInviteCode('k7mq-3xpb');
    expect(normalizeInviteCode(once)).toBe(once);
  });

  it('survives an empty string', () => {
    expect(normalizeInviteCode('')).toBe('');
  });
});

describe('formatInviteCode', () => {
  it('groups an eight-character code for readability', () => {
    expect(formatInviteCode('K7MQ3XPB')).toBe('K7MQ-3XPB');
    expect(formatInviteCode('k7mq-3xpb')).toBe('K7MQ-3XPB');
  });

  it('leaves other lengths alone rather than mangling them', () => {
    expect(formatInviteCode('K7MQ3X')).toBe('K7MQ3X');
  });
});

describe('isPlausibleInviteCode', () => {
  it('rejects characters the generator never emits', () => {
    // The alphabet deliberately omits 0/O, 1/I/L and U.
    for (const ch of ['0', 'O', '1', 'I', 'L', 'U']) {
      expect(INVITE_CODE_ALPHABET.includes(ch)).toBe(false);
      expect(isPlausibleInviteCode(`K7MQ3XP${ch}`)).toBe(false);
    }
  });

  it('rejects codes that are too short or too long', () => {
    expect(isPlausibleInviteCode('K7MQ')).toBe(false);
    expect(isPlausibleInviteCode('K'.repeat(20))).toBe(false);
  });

  it('accepts a well-formed code in any casing', () => {
    expect(isPlausibleInviteCode('k7mq-3xpb')).toBe(true);
  });
});

describe('redeem outcomes', () => {
  it('treats already_member as success, because the member is in either way', () => {
    expect(isRedeemSuccess('ok')).toBe(true);
    expect(isRedeemSuccess('already_member')).toBe(true);
    expect(isRedeemSuccess('expired')).toBe(false);
  });

  it('has a distinct message for every failure the database can return', () => {
    const statuses = ['not_found', 'expired', 'revoked', 'exhausted', 'rate_limited'];
    const messages = statuses.map(redeemMessage);
    expect(new Set(messages).size).toBe(statuses.length);
    for (const message of messages) expect(message.length).toBeGreaterThan(10);
  });

  it('falls back to something sane for an unrecognised status', () => {
    expect(redeemMessage('wat')).toMatch(/went wrong/i);
  });
});
