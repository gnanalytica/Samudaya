import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Ideas means the same thing on both apps.
 *
 * It did not for a while. The split between "about an event" and "about the
 * society" is a column, not two features, but each surface picked a side: the
 * web's Ideas page filtered to `event_id is null`, and the phone app had no
 * Ideas screen at all because the one that held it was switched off with
 * Polls. A resident wondering whether something had already been suggested had
 * to know which kind it was to know where to look — and on a phone, one of
 * those places did not exist.
 */
const ROOT = join(import.meta.dirname, '..', '..');
const web = (...parts: string[]) => readFileSync(join(ROOT, 'web', 'src', ...parts), 'utf8');
const mobile = (...parts: string[]) => readFileSync(join(ROOT, 'mobile', ...parts), 'utf8');

describe('both apps list both kinds of idea', () => {
  it('the web asks for every suggestion in the society, with its event', () => {
    const lib = web('lib', 'events.ts');
    const query = lib.slice(lib.indexOf('export const getIdeas'));
    expect(query.slice(0, 600)).not.toContain("is('event_id', null)");
    expect(lib).toContain('events(slug, name, emoji)');
  });

  it('and so does the phone', () => {
    const lib = mobile('src', 'lib', 'events.ts');
    const query = lib.slice(lib.indexOf('export async function fetchIdeas'));
    expect(query.slice(0, 900)).not.toContain("is('event_id', null)");
    expect(query.slice(0, 900)).toContain('events(slug, name, emoji)');
  });

  it('each row says which event it is about, and links to it', () => {
    // Otherwise the mixed list reads as one list of unrelated things.
    expect(web('components', 'suggestion-board.tsx')).toContain('For the society');
    expect(mobile('src', 'components', 'suggestions.tsx')).toContain('For the society');
  });
});

describe('suggesting from the Ideas page', () => {
  const actions = () => web('app', 'app', '[community]', 'events', 'actions.ts');

  it('is for the society, without asking which', () => {
    // A resident already in the society was being asked to pick "The society"
    // again. An idea for an event comes from that event's page instead.
    const action = actions().slice(actions().indexOf('export async function suggestIdea'));
    expect(action.slice(0, 1200)).toContain('event_id: null');
    const form = web('app', 'app', '[community]', 'suggest', 'suggest-form.tsx');
    expect(form).not.toContain('name="event"');
    expect(mobile('app', 'ideas.tsx')).toContain("[{ id: null, label: 'The society' }]");
  });

  it('leaves an event’s ideas to the event’s own page', () => {
    const page = web('app', 'app', '[community]', 'events', '[event]', 'page.tsx');
    expect(page).toContain('<SuggestionForm');
  });
});

describe('a vote shows up everywhere the suggestion does', () => {
  const actions = () => web('app', 'app', '[community]', 'events', 'actions.ts');

  it('refreshes the event page and the Ideas page, not one or the other', () => {
    // An event's suggestion is on two pages now. Revalidating whichever page
    // the vote was cast from leaves the other showing yesterday's tally.
    const ternary = /revalidatePath\(\s*eventSlug \?/;
    expect(actions()).not.toMatch(ternary);
    const both = actions().split('revalidatePath(`/app/${slug}/suggest`)').length - 1;
    expect(both).toBeGreaterThanOrEqual(3);
  });

  it('tells the action which event the row belongs to, not which page it is on', () => {
    // The Ideas page is on neither event, so the board reads it off the row.
    expect(web('components', 'suggestion-board.tsx')).toContain(
      'const eventOf = (row: SuggestionRow) => row.events?.slug ?? eventSlug',
    );
  });
});
