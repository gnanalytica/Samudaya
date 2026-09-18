import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * A PostgREST `.select()` takes one string literal, never a concatenation.
 *
 * supabase-js reads the row type off the literal you pass it, so
 *
 *   .select('id, amount, ' + 'counterpart')
 *
 * widens the argument to `string`, and every row comes back typed
 * `GenericStringError` instead of the view's columns. The query still runs and
 * returns the right data — it is only the types that collapse — so the failure
 * arrives as a wall of "Property 'amount' does not exist" a long way from the
 * line that caused it. The native Money screen was written this way first and
 * produced fifteen errors in one typecheck.
 *
 * A `const` holding a plain literal is fine and keeps its literal type; it is
 * the `+` that does the damage. Both apps are scanned, because the rule is
 * about supabase-js rather than about either app.
 */
const ROOTS = [
  join(import.meta.dirname, '..', 'src'),
  join(import.meta.dirname, '..', '..', 'mobile', 'src'),
  join(import.meta.dirname, '..', '..', 'mobile', 'app'),
];

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(entry) ? [path] : [];
  });
}

const allFiles = () => ROOTS.flatMap(sourceFiles);

/** The text of one `.select(...)` call, balanced on parentheses. */
function selectArgument(src: string[], start: number, column: number): string {
  let depth = 0;
  let out = '';
  for (let i = start; i < Math.min(start + 12, src.length); i++) {
    const line = src[i] ?? '';
    for (const char of i === start ? line.slice(column) : line) {
      if (char === '(') depth++;
      if (depth > 0) out += char;
      if (char === ')') {
        depth--;
        if (depth === 0) return out;
      }
    }
    out += ' ';
  }
  return out;
}

describe('PostgREST select strings', () => {
  const offenders = allFiles().flatMap((file) => {
    const src = readFileSync(file, 'utf8').split('\n');
    return src.flatMap((line, i) => {
      const at = line.indexOf('.select(');
      if (at === -1) return [];
      const prose = line.trimStart();
      if (prose.startsWith('*') || prose.startsWith('//')) return [];
      return selectArgument(src, i, at).includes('+') ? [`${file}:${i + 1}`] : [];
    });
  });

  it('are never built by concatenation', () => {
    expect(offenders).toEqual([]);
  });

  it('is looking at both apps', () => {
    const files = allFiles();
    expect(files.some((f) => f.includes(`mobile${sep}`))).toBe(true);
    expect(files.some((f) => f.includes(`web${sep}src`))).toBe(true);
  });

  it('reads the call it is on, not the rest of the file', () => {
    const src = ["  .select('id, amount')", "  const other = 'a' + 'b';"];
    expect(selectArgument(src, 0, 2).includes('+')).toBe(false);

    const bad = ["  .select('id, ' + 'amount')"];
    expect(selectArgument(bad, 0, 2).includes('+')).toBe(true);
  });
});
