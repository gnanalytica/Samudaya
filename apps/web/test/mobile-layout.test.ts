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
    // Home, Me, My contributions, Admin, Admin event, Reconcile, Event. Money
    // leads with its balance instead, on a card whose figures wrap.
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

/**
 * Apple asks for 44pt, Android for 48dp, WCAG 2.5.5 for 44 CSS px. 44 is the
 * floor a finger needs; a mouse does not, so the web keeps its density behind
 * `pointer: coarse` rather than a width breakpoint — a tablet in landscape is a
 * touch device at desktop width, and a narrow desktop window is still a mouse.
 *
 * Measured in Chromium with `hasTouch`, against the compiled stylesheet: the
 * `sm` button went 32px → 44px on a finger and stayed 32px under a mouse.
 */
describe('touch targets', () => {
  const read = (...parts: string[]) => readFileSync(join(SRC, ...parts), 'utf8');

  it('grow the small and medium buttons for a finger, and only for a finger', () => {
    const button = read('components', 'ui', 'button.tsx');
    expect(button).toContain("sm: 'h-8 px-3 text-sm gap-1.5 pointer-coarse:h-11'");
    expect(button).toContain("md: 'h-10 px-4 text-sm gap-2 pointer-coarse:h-11'");
    // A width breakpoint would be the wrong question; it must not creep back.
    expect(button).not.toMatch(/\bsm:h-11\b/);
  });

  it('grow the two controls that sit in the header of every phone page', () => {
    expect(read('components', 'notification-bell.tsx')).toContain('pointer-coarse:min-h-11');
    expect(read('components', 'profile-menu.tsx')).toContain('pointer-coarse:min-h-11');
  });

  it('grow the sidebar rows, which are desktop-width but not mouse-only', () => {
    expect(read('components', 'sidebar-nav.tsx')).toContain('pointer-coarse:min-h-11');
    expect(read('components', 'community-switcher.tsx')).toContain('pointer-coarse:min-h-11');
  });
});

/**
 * The native app already had 48pt buttons and inputs; what it did not have was
 * a floor under the smaller controls. A pill sized to its own 13px text lands
 * around 30, a row around 36, and an inline link with the codebase's habitual
 * `hitSlop={8}` around 32 — all of them under 44, and all of them things people
 * tap all day.
 */
describe('native touch targets', () => {
  const MOBILE = join(import.meta.dirname, '..', '..', 'mobile', 'src');
  const mobile = (...parts: string[]) => readFileSync(join(MOBILE, ...parts), 'utf8');

  it('have one number for the floor, not four', () => {
    const theme = mobile('lib', 'theme.ts');
    expect(theme).toMatch(/export const minTapTarget = 44;/);
    // Vertical reach is what lifts a 16pt line over the floor.
    expect(theme).toMatch(/export const tapSlop = \{ top: 14, bottom: 14/);
  });

  it('apply it to every small pressable in admin-ui', () => {
    const adminUi = mobile('components', 'admin-ui.tsx');
    // Chip, LinkRow, the segmented tab and the disclosure header.
    expect(adminUi.match(/minHeight: minTapTarget/g)).toHaveLength(4);
  });

  it('widen the inline links rather than moving them', () => {
    expect(mobile('components', 'date-field.tsx')).toContain('hitSlop={tapSlop}');
    expect(mobile('components', 'catalogue-ui.tsx')).toContain('hitSlop={tapSlop}');
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
