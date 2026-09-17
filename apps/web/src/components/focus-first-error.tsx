'use client';

import { useEffect, useRef } from 'react';

/**
 * Moves the caret to whatever a rejected submit complained about.
 *
 * Forms here validate on the server, so a rejected submit re-renders with the
 * errors in place — but the page does not move, and on a phone the field at
 * fault is often above the fold you are looking at. Nothing appears to have
 * happened. This puts you on the first problem instead.
 *
 * Drop it inside a form and pass the action state as `signal`; it re-runs each
 * time the server answers. It renders nothing.
 */
export function FocusFirstError({ signal }: { signal: unknown }) {
  const anchor = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const form = anchor.current?.closest('form');
    if (!form) return;

    // A field that failed, if there is one. Otherwise the form-wide message —
    // worth scrolling to, but it is a paragraph, so it cannot take focus.
    const invalid = form.querySelector<HTMLElement>('[aria-invalid="true"]');
    const target = invalid ?? form.querySelector<HTMLElement>('[role="alert"]');
    if (!target) return;

    target.scrollIntoView({ block: 'center' });
    invalid?.focus({ preventScroll: true });
  }, [signal]);

  return <span ref={anchor} hidden />;
}
