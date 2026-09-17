import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Every PostgREST embed of `memberships` must name the foreign key it travels.
 *
 * `memberships(profiles(full_name))` is ambiguous wherever a junction table sits
 * between the parent and memberships — PostgREST finds several routes and
 * answers 300 Multiple Choices instead of rows. activity_suggestions has three
 * such tables (suggestion_votes, suggestion_interests, comments), so the
 * suggestion board asked for a tally it could never receive and rendered
 * "Nothing to vote on yet" to every society for two days, 102 requests a day,
 * while the discarded error said exactly what was wrong.
 *
 * Naming the key — `memberships!activity_suggestions_suggested_by_fkey(…)` —
 * removes the ambiguity, and is immune to a later migration adding a fourth
 * junction. A table that is unambiguous today may not be tomorrow, so this
 * applies to all of them rather than only the ones that are currently broken.
 */
const SRC = join(import.meta.dirname, '..', 'src');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(entry) ? [path] : [];
  });
}

describe('PostgREST embeds', () => {
  const offenders = sourceFiles(SRC).flatMap((file) =>
    readFileSync(file, 'utf8')
      .split('\n')
      .flatMap((line, index) => {
        const prose = line.trimStart();
        if (prose.startsWith('*') || prose.startsWith('//')) return [];
        // `memberships!fk(` does not contain `memberships(`, so a plain search
        // finds exactly the ones that never named their key.
        if (!line.includes('memberships(')) return [];
        return [`${file.replace(SRC, 'src')}:${index + 1}`];
      }),
  );

  it('always name the foreign key when embedding memberships', () => {
    expect(offenders).toEqual([]);
  });

  it('finds the files it is meant to be scanning', () => {
    const files = sourceFiles(SRC);
    expect(files.length).toBeGreaterThan(50);
    expect(files.some((f) => f.endsWith('events.ts'))).toBe(true);
  });

  it('would catch a bare embed if one were reintroduced', () => {
    const bad = "  .select('id, memberships(profiles(full_name))')";
    expect(bad.includes('memberships(')).toBe(true);
    const good = "  .select('id, memberships!activity_suggestions_suggested_by_fkey(profiles(*))')";
    expect(good.includes('memberships(')).toBe(false);
  });
});
