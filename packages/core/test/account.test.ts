import { describe, expect, it } from 'vitest';
import {
  DELETE_ACCOUNT_CONFIRMATION,
  deleteAccountMessage,
  isAccountDeleted,
  isDeleteConfirmed,
} from '../src/account';

/**
 * Both stores require an account-deletion path, so both apps have one, and the
 * thing that must not drift between them is what they say happened. These pin
 * the two answers that would do real harm if either app got them wrong: a
 * refusal read as a success, and a success read as a refusal.
 */
describe('isAccountDeleted', () => {
  it('is true for the one status that means the account is gone', () => {
    expect(isAccountDeleted('deleted')).toBe(true);
  });

  it('is false for every refusal, including ones we have not met yet', () => {
    for (const status of ['last_committee', 'unauthenticated', '', 'error', 'DELETED']) {
      expect(isAccountDeleted(status)).toBe(false);
    }
  });
});

describe('deleteAccountMessage', () => {
  it('names the societies holding a committee member, so the answer is actionable', () => {
    const message = deleteAccountMessage('last_committee', 'Hill Crest, Palm Court');
    expect(message).toContain('Hill Crest, Palm Court');
    expect(message).toContain('committee member');
  });

  it('still says something useful when the detail is missing', () => {
    const message = deleteAccountMessage('last_committee', null);
    expect(message).toContain('committee member');
    expect(message).not.toContain('null');
    expect(message).not.toContain('undefined');
  });

  it('confirms a deletion in the past tense, because it has already happened', () => {
    expect(deleteAccountMessage('deleted')).toBe('Your account has been deleted.');
  });

  it('falls back rather than showing a raw status to somebody', () => {
    expect(deleteAccountMessage('something_new_from_the_database')).toBe(
      'We could not delete your account. Please try again.',
    );
  });
});

describe('isDeleteConfirmed', () => {
  it('accepts the word, however it was typed', () => {
    for (const typed of ['DELETE', 'delete', ' Delete ']) {
      expect(isDeleteConfirmed(typed)).toBe(true);
    }
  });

  it('refuses anything else, so a mis-tap cannot delete an account', () => {
    for (const typed of ['', 'DELET', 'DELETE ME', 'yes', 'D E L E T E']) {
      expect(isDeleteConfirmed(typed)).toBe(false);
    }
  });

  it('asks for a word somebody has to mean, not a single keystroke', () => {
    expect(DELETE_ACCOUNT_CONFIRMATION.length).toBeGreaterThan(3);
  });
});
