'use client';

import { useEffect, useRef } from 'react';

/**
 * Scrolls the current tab into view inside a horizontally scrolling strip.
 *
 * Nine tabs do not fit across a phone, and the one you are on is often the
 * furthest right — open Bills and the strip would sit at the far left showing
 * About, with no sign of where you actually were. Wrapping instead would cost
 * three rows of chrome above every event.
 *
 * Scrolling an element is exactly what an effect is for: it synchronises the
 * DOM with state React has already rendered, and it runs once on arrival.
 */
export function ScrollActiveIntoView() {
  const anchor = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const strip = anchor.current?.parentElement;
    const active = strip?.querySelector('[aria-current="page"]');
    active?.scrollIntoView({ inline: 'center', block: 'nearest' });
  }, []);

  return <span ref={anchor} hidden />;
}
