import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The app's look, pinned so it cannot drift back: ivory and ink with the
 * colour left to the festival, a serif for the things that are an occasion,
 * each festival dressed in its own things, and motion that never runs for
 * somebody who asked for less.
 */
const SRC = join(import.meta.dirname, '..', 'src');
const read = (...parts: string[]) => readFileSync(join(SRC, ...parts), 'utf8');

describe('the look', () => {
  it('sets Inter for reading and Fraunces for occasions, on <html>', () => {
    const fonts = read('app', 'fonts.ts');
    expect(fonts).toContain('Inter(');
    expect(fonts).toContain('Fraunces(');
    expect(read('app', 'layout.tsx')).toContain('${sans.variable} ${serif.variable}');
    const css = read('app', 'globals.css');
    expect(css).toContain('--font-serif: var(--font-fraunces)');
    expect(css).toContain('--font-sans:\n    var(--font-inter)');
  });

  it('keeps the primary button ink and leaves the festival colour to `festive`', () => {
    const button = read('components', 'ui', 'button.tsx');
    expect(button).toContain("primary: 'bg-ink text-surface");
    expect(button).toContain("festive: 'bg-accent text-accent-ink");
  });

  it('paints the page ivory and matches the browser toolbar to it', () => {
    expect(read('app', 'globals.css')).toContain('--surface: oklch(0.972 0.007 84)');
    expect(read('lib', 'appearance.ts')).toContain("light: '#f8f5f1'");
  });
});

describe('each festival', () => {
  it('leads its event page with its own banner and motif, not one toran for all', () => {
    const event = read('app', 'app', '[community]', 'events', '[event]', 'page.tsx');
    expect(event).toContain('<FestivalHero');
    const festival = read('components', 'festival.tsx');
    expect(festival).not.toContain('function Toran');
    expect(festival).not.toContain('function FestivalHeader');
    expect(festival).toContain('<Motif');
  });

  it('marks every event in a list with its festival’s tile', () => {
    for (const page of [
      ['app', 'app', '[community]', 'events', 'page.tsx'],
      ['app', 'app', '[community]', 'contribute', 'page.tsx'],
    ]) {
      expect(read(...page), page.join('/')).toContain('<FestivalTile');
    }
  });

  it('hangs a garland on the front page only for festivals a doorway is dressed that way for', () => {
    const theme = read('app', '_landing', 'theme.tsx');
    expect(theme).toContain('wearsGarland(look)');
    expect(read('app', 'page.tsx')).toContain('<SeasonTrim');
    expect(read('app', 'page.tsx')).not.toContain('<Garland');
  });

  it('takes the whole app, from the shell down, into the season', () => {
    const layout = read('app', 'app', '[community]', 'layout.tsx');
    expect(layout).toContain('getSeason(');
    expect(layout).toContain('style={festivalVars(season.festival)}');
  });
});

describe('motion', () => {
  it('never loops for somebody who asked for less of it', () => {
    const css = read('app', 'globals.css');
    const safe = css.slice(
      css.indexOf('@media (prefers-reduced-motion: no-preference) {\n  .motif-'),
    );
    expect(safe).toContain('.motif-flicker');
    expect(safe).toContain('.motif-swing');
    // Outside that block the loops have no animation at all.
    const before = css.slice(
      0,
      css.indexOf('@media (prefers-reduced-motion: no-preference) {\n  .motif-'),
    );
    expect(before).not.toMatch(/\.motif-flicker\s*\{\s*animation/);
  });

  it('keeps a list still: only a banner’s motif moves', () => {
    expect(read('components', 'motif.tsx')).toContain('const moving = !compact && layer.motion');
  });

  it('rolls amounts up in CSS alone, with the number itself for screen readers', () => {
    const amount = read('components', 'rolling-amount.tsx');
    expect(amount).not.toContain("'use client'");
    expect(amount).toContain('<span className="sr-only">{text}</span>');
  });
});
