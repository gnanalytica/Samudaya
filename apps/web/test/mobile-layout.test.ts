import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Two rules that keep the web app usable on a phone, both of which were broken
 * everywhere at once because the offending class was copied from page to page.
 *
 * 1. A row of stats is never three across on a phone. A third of a 360px screen
 *    leaves about 77px of text space inside a tile; `₹1,25,000` needs 97px and a
 *    crore needs 128px. A digit string has no space or hyphen to wrap at, so the
 *    number ran past its tile and dragged the page with it — measured at 384px
 *    of scroll on a 360px screen, on all seven pages that show these tiles.
 *    `StatTiles` is the fix, so the raw grid is what this looks for.
 *
 * 2. A form control is at least 16px on a phone. Mobile Safari zooms the page in
 *    on any field it focuses whose text is smaller, and does not zoom back out,
 *    which left every form in the app displaced sideways after the first tap.
 *    Pairing `text-base` with `sm:text-sm` keeps the desktop size unchanged.
 *
 * Both are the kind of thing that looks fine in a desktop browser window and is
 * only wrong on the device nobody tests on, which is why they are pinned here
 * rather than left to review.
 */
const SRC = join(import.meta.dirname, '..', 'src');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(entry) ? [path] : [];
  });
}

const lines = (file: string) => readFileSync(file, 'utf8').split('\n');
const isProse = (line: string) => {
  const t = line.trimStart();
  return t.startsWith('*') || t.startsWith('//') || t.startsWith('{/*');
};

describe('stat tiles', () => {
  const offenders = sourceFiles(SRC).flatMap((file) =>
    lines(file).flatMap((line, i) =>
      !isProse(line) && /\bgrid-cols-3\b/.test(line) && !/\b(sm|md|lg|xl):grid-cols-3\b/.test(line)
        ? [`${file}:${i + 1}`]
        : [],
    ),
  );

  it('are never three across before the sm breakpoint', () => {
    expect(offenders).toEqual([]);
  });

  it('go through StatTiles on every page that shows them', () => {
    const users = sourceFiles(SRC).filter((f) => readFileSync(f, 'utf8').includes('<StatTiles'));
    // Home, Me, Money, Admin, Admin event, Reconcile, Event.
    expect(users).toHaveLength(7);
  });

  it('would catch a bare three-up grid if one came back', () => {
    const bad = '<div className="grid grid-cols-3 gap-3">';
    expect(/\bgrid-cols-3\b/.test(bad) && !/\bsm:grid-cols-3\b/.test(bad)).toBe(true);
    const good = '<div className="grid grid-cols-2 gap-3 sm:grid-cols-3">';
    expect(/\bgrid-cols-3\b/.test(good) && !/\bsm:grid-cols-3\b/.test(good)).toBe(false);
  });
});

describe('form controls', () => {
  it('start at 16px on a phone in the shared control class', () => {
    const field = readFileSync(join(SRC, 'components', 'ui', 'field.tsx'), 'utf8');
    expect(field).toContain('text-base sm:text-sm');
    expect(field).not.toMatch(/px-3 py-2 text-sm/);
  });

  /**
   * The text of one opening tag, and no further. Reading a fixed number of
   * lines ahead instead pulled in the className of whatever element came next,
   * which flagged every `<input type="hidden">` in the app for the size of a
   * sibling `<span>`.
   */
  function openingTag(src: string[], start: number): string {
    const out: string[] = [];
    for (let i = start; i < Math.min(start + 20, src.length); i++) {
      const line = src[i] ?? '';
      out.push(line);
      const trimmed = line.trimEnd();
      if (i === start && trimmed.endsWith('>')) break;
      if (i > start && /^\s*\/?>$/.test(trimmed)) break;
    }
    return out.join(' ');
  }

  // A raw control is one written inline rather than through Field's Input,
  // Select or Textarea, so it does not inherit the size fixed above.
  const rawOffenders = sourceFiles(SRC).flatMap((file) => {
    const src = lines(file);
    return src.flatMap((line, i) => {
      if (isProse(line) || !/<(input|select|textarea)\b/.test(line)) return [];
      const tag = openingTag(src, i);
      // A hidden input renders nothing, and a file input opens the picker
      // rather than taking text focus, so neither is a field Safari zooms for.
      if (/type="(hidden|file)"/.test(tag)) return [];
      const className = /className="([^"]*)"/.exec(tag)?.[1] ?? '';
      const small = /\btext-(xs|sm)\b/.test(className);
      const hasMobileBase = /\btext-base\b/.test(className);
      return small && !hasMobileBase ? [`${file}:${i + 1}`] : [];
    });
  });

  it('are never under 16px on a phone, even when written inline', () => {
    expect(rawOffenders).toEqual([]);
  });
});

describe('the scan itself', () => {
  it('is reading the source tree it thinks it is', () => {
    const files = sourceFiles(SRC);
    expect(files.length).toBeGreaterThan(50);
    expect(files.some((f) => f.endsWith('badges.tsx'))).toBe(true);
    expect(files.some((f) => f.endsWith('field.tsx'))).toBe(true);
  });
});
