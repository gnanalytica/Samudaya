'use client';

import { useEffect, useRef } from 'react';
import { wasAccepted, type ActionState } from './action-state';

/**
 * A form ref that empties itself only when the server accepted the submission.
 *
 * These forms used to clear in the action wrapper, right after awaiting it —
 * which runs whether or not it worked. A comment the server rejected, or a
 * suggestion that failed validation, was wiped from the box it would have to be
 * retyped into, with the error message sitting above the blank field.
 *
 * useActionState hands back a fresh state object on every submit, so depending
 * on the whole object (not on a message, which may be the same string twice)
 * means a second successful submit clears the form too.
 */
export function useResetOnSuccess(state: ActionState) {
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (wasAccepted(state)) ref.current?.reset();
  }, [state]);

  return ref;
}
