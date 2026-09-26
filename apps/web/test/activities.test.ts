import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Running an event's activities, on the web and on the phone alike.
 *
 * An activity used to be fixed the moment it was added: nothing could change
 * its name or places, or say who coordinates it and when it practises, though
 * both apps already read those columns. The phone could not add one without a
 * catalogue type, showed a count where the web names people, and registered a
 * family member without the age group the web asks for.
 *
 * The web's own organiser section had also been out of reach since the tab
 * strip was shared: the strip's Activities tab is the reader's, and the
 * console only answered to its own tabs, so nothing ever rendered it.
 */
const ROOT = join(import.meta.dirname, '..', '..');
const read = (...parts: string[]) => readFileSync(join(ROOT, ...parts), 'utf8');

/**
 * One top-level declaration, from its name to the next thing at column zero,
 * so a check about one function cannot pass on the strength of its neighbour.
 */
function body(source: string, name: string): string {
  const start = source.search(new RegExp(`(function|const) ${name}\\b`));
  if (start === -1) throw new Error(`${name} not found`);
  const next = source.slice(start + 1).search(/\n(export |function |const |type |\/\*\*)/);
  return next === -1 ? source.slice(start) : source.slice(start, start + 1 + next);
}

const WEB_ADMIN_EVENT = ['web', 'src', 'app', 'app', '[community]', 'admin', 'events', '[event]'];
const WEB_ACTIONS = ['web', 'src', 'app', 'app', '[community]', 'admin', 'events', 'actions.ts'];
const WEB_EVENT = ['web', 'src', 'app', 'app', '[community]', 'events', '[event]'];
const PHONE_ADMIN_EVENT = ['mobile', 'app', 'admin', 'event', '[slug].tsx'];
const PHONE_EVENT = ['mobile', 'app', 'event', '[slug].tsx'];

describe('editing an activity on the web', () => {
  const action = () => body(read(...WEB_ACTIONS), 'editActivity');
  const page = () => read(...WEB_ADMIN_EVENT, 'page.tsx');

  it('goes through a server action gated by activities:manage', () => {
    expect(action()).toContain("requireCapability(communitySlug, 'activities:manage')");
    expect(action()).toContain('updateActivitySchema.safeParse');
    expect(action()).toContain(".eq('community_id', context.community.id)");
    expect(action()).toContain('refreshEvent(communitySlug, eventSlug)');
  });

  it('refuses fewer places than people, and a name the event already has', () => {
    expect(action()).toContain('placesProblem(');
    expect(action()).toContain("'23505'");
    expect(action()).toContain('This event already has an activity with that name.');
  });

  it('stops once the event is closed or cancelled, on the server and on the page', () => {
    expect(action()).toContain("event.status === 'completed' || event.status === 'cancelled'");
    expect(page()).toContain("const locked = closed || event.status === 'cancelled';");
    expect(page()).toContain('{!locked ? (');
    const gated = page().slice(page().indexOf('{!locked ? ('));
    expect(gated.slice(0, 1000)).toContain('<EditActivityForm');
  });

  it('opens an inline form on each activity with every field', () => {
    expect(page()).toContain('<EditActivityForm');
    const form = body(read(...WEB_ADMIN_EVENT, 'forms.tsx'), 'EditActivityForm');
    expect(form).toContain('(editActivity, EMPTY_STATE)');
    for (const field of ['emoji', 'name', 'capacity', 'description', 'coordinator_id']) {
      expect(form, field).toContain(`name="${field}"`);
    }
    // A list, added to and taken from.
    expect(form).toContain('name="practice_date"');
    expect(form).toContain('Add date');
    expect(form).toContain('Remove');
  });

  it('can be reached: the event page links to it, and the organiser page answers', () => {
    expect(page()).toContain("t.id === 'activities' && can(role, 'activities:manage')");
    const event = read(...WEB_EVENT, 'page.tsx');
    expect(event).toContain('/admin/events/${event.slug}?tab=activities');
    expect(event).toContain("can(role, 'activities:manage')");
  });
});

describe('the phone runs activities as the web does', () => {
  const screen = () => read(...PHONE_ADMIN_EVENT);
  const card = () => body(screen(), 'ActivitiesCard');

  it('adds one without a type, even from an empty catalogue', () => {
    const chips = body(read('mobile', 'src', 'components', 'event-form.tsx'), 'ActivityTypeChips');
    expect(chips).toContain('label="Other"');
    expect(chips).toContain('id: null');
    // An empty catalogue used to return a caption and nothing to tap.
    expect(chips).not.toMatch(/if \(!types\?\.length\)\s*return/);
    expect(card()).toContain('<ActivityTypeChips');
    expect(card()).toContain('typeId: item.id');
    expect(read('mobile', 'app', 'admin', 'event', 'new.tsx')).toContain('<ActivityTypeChips');
  });

  it('asks for places and a description when adding', () => {
    expect(card()).toContain('label="Places"');
    expect(card()).toContain('label="Description"');
    expect(card()).toContain('capacity: parsed.data.capacity');
    expect(card()).toContain('description: parsed.data.description');
  });

  it('names who registered, and who registered a family member', () => {
    expect(screen()).toContain(
      'memberships!activity_participants_membership_id_fkey(profiles(full_name))',
    );
    expect(body(screen(), 'registrantLine')).toContain('registered by');
    expect(card()).toContain('registrantLine(row)');
  });

  it('edits an activity with the same fields and rules as the web', () => {
    expect(card()).toContain('<Chip label="Edit"');
    expect(card()).toContain('<ActivityEditor');
    const editor = body(screen(), 'ActivityEditor');
    expect(editor).toContain('updateActivitySchema.safeParse');
    expect(editor).toContain('placesProblem(');
    expect(editor).toContain("'23505'");
    expect(editor).toContain("rpc('society_people'");
    expect(editor).toContain('<DateField');
    for (const label of ['Places', 'Description', 'Coordinator', 'Practice dates']) {
      expect(editor, label).toContain(label);
    }
  });

  it('keeps every control away once the event is closed or cancelled', () => {
    expect(card()).toContain(
      "const locked = event.status === 'completed' || event.status === 'cancelled';",
    );
    expect(card()).toContain('{!locked ? <Chip label="Edit"');
  });
});

describe('registering a family member', () => {
  it('asks the age group on the phone, and saves it', () => {
    const activities = body(read(...PHONE_EVENT), 'Activities');
    expect(activities).toContain('AGE_GROUPS.map');
    expect(activities).toContain('age_group: participantName ? familyAge : null');
  });

  it('offers the same age groups on both, from one list', () => {
    const web = read(...WEB_EVENT, 'participation-forms.tsx');
    expect(web).toContain('AGE_GROUPS.map');
    expect(web).not.toContain('<option>Teens</option>');
  });
});

describe('who coordinates an activity, and when it practises', () => {
  it('is read by both apps', () => {
    for (const [parts, query] of [
      [['web', 'src', 'lib', 'events.ts'], 'getActivities'],
      [['mobile', 'src', 'lib', 'events.ts'], 'fetchEventDetail'],
    ] as const) {
      const reader = body(read(...parts), query);
      expect(reader, query).toContain('practice_dates');
      expect(reader, query).toContain('event_activities_coordinator_id_fkey(profiles(full_name))');
    }
  });

  it('is shown to residents on both, only when set', () => {
    for (const parts of [[...WEB_EVENT, 'page.tsx'], PHONE_EVENT]) {
      const screen = read(...parts);
      expect(screen, parts.join('/')).toContain('Coordinator: {activity.memberships');
      expect(screen, parts.join('/')).toContain('activity.practice_dates.length ?');
      expect(screen, parts.join('/')).toContain('practiceDatesLine(activity.practice_dates)');
    }
  });
});
