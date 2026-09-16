import { describe, expect, it, vi } from 'vitest';
import { friendlyDbError } from '@/lib/action-state';

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
