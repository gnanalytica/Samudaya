import { describe, expect, it, vi } from 'vitest';
import { EMPTY_STATE, friendlyDbError, wasAccepted } from '@/lib/action-state';

describe('friendlyDbError', () => {
  it('never tells someone to retry a function the database does not have', () => {
    // The "Start a society" form spent a day and a half telling founders to try
    // again, because create_society() had shipped to the web without its
    // migration. Retrying could not have worked.
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});

    const message = friendlyDbError({
      code: 'PGRST202',
      message:
        'Could not find the function public.create_society(p_city, p_name) in the schema cache',
    });

    expect(message).not.toMatch(/try again/i);
    expect(message).toMatch(/our side/i);
    // Swallowed into form state, this error reaches no dashboard unless we log.
    expect(logged).toHaveBeenCalledOnce();
    logged.mockRestore();
  });

  it('keeps the guard messages the database already wrote for people', () => {
    expect(friendlyDbError({ message: 'You cannot raise your own role' })).toBe(
      'You cannot raise your own role.',
    );
  });

  it('explains a named constraint instead of leaking it', () => {
    expect(friendlyDbError({ code: '23514', message: 'communities_pincode_format' })).toBe(
      'Enter a 6-digit PIN code.',
    );
  });

  it('turns an RLS denial into permission, not a crash', () => {
    expect(friendlyDbError({ code: '42501' })).toBe('You don’t have permission to do that.');
  });

  it('falls back without saying anything about the database', () => {
    const message = friendlyDbError({
      code: 'XX000',
      message: 'relation "secrets" does not exist',
    });
    expect(message).toBe('Something went wrong. Please try again.');
    expect(message).not.toMatch(/secrets|relation/i);
  });
});

describe('wasAccepted', () => {
  it('treats a fresh form as accepted, so clearing it is a no-op', () => {
    expect(wasAccepted(EMPTY_STATE)).toBe(true);
  });

  it('accepts a result with no message, which is how postComment answers', () => {
    // The comment appears in the thread on revalidation. A "Posted." line
    // underneath would be noise, so success is silent — and a form that keyed
    // off the message would have stopped clearing itself.
    expect(wasAccepted({})).toBe(true);
  });

  it('accepts a result that does carry a message', () => {
    expect(wasAccepted({ success: 'Activity added.' })).toBe(true);
  });

  it('refuses a form-wide error', () => {
    expect(wasAccepted({ error: 'That event no longer exists.' })).toBe(false);
  });

  it('refuses field errors, so a rejected form keeps what was typed', () => {
    expect(wasAccepted({ fieldErrors: { name: 'Give it a name.' } })).toBe(false);
  });

  it('refuses when a message and an error somehow arrive together', () => {
    expect(wasAccepted({ success: 'Saved.', error: 'But not really.' })).toBe(false);
  });
});
