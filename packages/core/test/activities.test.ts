import { describe, expect, it } from 'vitest';
import { AGE_GROUPS, placesProblem, practiceDatesLine } from '../src/activities';
import { createActivitySchema, updateActivitySchema } from '../src/schemas';

const ID = '6f1c2f6e-3b1a-4c5d-9e8f-0a1b2c3d4e5f';
const COORDINATOR = '0b8c1f7a-2d3e-4f50-8a6b-7c8d9e0f1a2b';

/** Everything an edit form sends, filled in. */
const edit = {
  id: ID,
  name: 'Dance',
  emoji: '💃',
  description: 'Group dance for all ages',
  capacity: '20',
  coordinator_id: COORDINATOR,
  practice_dates: ['2026-10-03'],
};

describe('updateActivitySchema', () => {
  it('takes a full edit', () => {
    const parsed = updateActivitySchema.parse(edit);
    expect(parsed).toEqual({
      id: ID,
      name: 'Dance',
      emoji: '💃',
      description: 'Group dance for all ages',
      capacity: 20,
      coordinator_id: COORDINATOR,
      practice_dates: ['2026-10-03'],
    });
  });

  it('clears what is blank or null, rather than keeping it', () => {
    const parsed = updateActivitySchema.parse({
      ...edit,
      description: '   ',
      capacity: null,
      coordinator_id: null,
      practice_dates: [],
    });
    expect(parsed.description).toBeNull();
    expect(parsed.capacity).toBeNull();
    expect(parsed.coordinator_id).toBeNull();
    expect(parsed.practice_dates).toEqual([]);
  });

  it('refuses a field left out, so a partial edit cannot clear the rest', () => {
    for (const field of ['description', 'capacity', 'coordinator_id', 'practice_dates'] as const) {
      const { [field]: _left, ...rest } = edit;
      expect(updateActivitySchema.safeParse(rest).success, field).toBe(false);
    }
  });

  it('keeps practice dates in date order, once each', () => {
    const parsed = updateActivitySchema.parse({
      ...edit,
      practice_dates: ['2026-10-08', '2026-10-03', '2026-10-05', '2026-10-03'],
    });
    expect(parsed.practice_dates).toEqual(['2026-10-03', '2026-10-05', '2026-10-08']);
  });

  it('applies the same rules as adding one', () => {
    const problems = (patch: Record<string, unknown>) =>
      updateActivitySchema.safeParse({ ...edit, ...patch }).error?.issues[0]?.message;

    expect(problems({ name: 'D' })).toBe('Name the activity');
    expect(problems({ capacity: '0' })).toBe(
      'Enter at least 1 place, or leave it blank for no limit',
    );
    expect(problems({ capacity: '2.5' })).toBe('Places must be a whole number');
    expect(problems({ coordinator_id: 'priya' })).toBe('Expected an id');
    expect(problems({ practice_dates: ['3 Oct'] })).toBe('Expected a date like 2026-09-14');
    expect(
      problems({
        practice_dates: Array.from(
          { length: 21 },
          (_, day) => `2026-10-${String(day + 1).padStart(2, '0')}`,
        ),
      }),
    ).toBe('Up to 20 practice dates');
    // Same messages when adding, because they are the same fields.
    expect(
      createActivitySchema.safeParse({ event_id: ID, name: 'Dance', capacity: '0' }).error
        ?.issues[0]?.message,
    ).toBe('Enter at least 1 place, or leave it blank for no limit');
  });

  it('needs to know which activity', () => {
    const { id: _id, ...rest } = edit;
    expect(updateActivitySchema.safeParse(rest).success).toBe(false);
  });
});

describe('placesProblem', () => {
  it('accepts no limit, whoever has registered', () => {
    expect(placesProblem(null, 40)).toBeNull();
  });

  it('accepts places at or above the people registered', () => {
    expect(placesProblem(12, 12)).toBeNull();
    expect(placesProblem(20, 12)).toBeNull();
    expect(placesProblem(1, 0)).toBeNull();
  });

  it('refuses fewer places than people, and says how many there are', () => {
    expect(placesProblem(10, 12)).toBe('12 people have registered, so places can’t go below 12.');
    expect(placesProblem(0, 1)).toBe('1 person has registered, so places can’t go below 1.');
  });
});

describe('practiceDatesLine', () => {
  it('says the month once for days in the same month', () => {
    expect(practiceDatesLine(['2026-10-03', '2026-10-05', '2026-10-08'])).toBe('3, 5 and 8 Oct');
  });

  it('reads one date on its own', () => {
    expect(practiceDatesLine(['2026-11-14'])).toBe('14 Nov');
  });

  it('sorts, and drops repeats', () => {
    expect(practiceDatesLine(['2026-10-08', '2026-10-03', '2026-10-08'])).toBe('3 and 8 Oct');
  });

  it('closes each month before the next one starts', () => {
    expect(practiceDatesLine(['2026-12-02', '2026-11-28', '2026-11-30'])).toBe(
      '28, 30 Nov and 2 Dec',
    );
  });

  it('names the year only when the dates cross into another one', () => {
    expect(practiceDatesLine(['2027-01-02', '2026-12-30'])).toBe('30 Dec 2026 and 2 Jan 2027');
  });

  it('is empty when there are none, so a screen can skip the line', () => {
    expect(practiceDatesLine([])).toBe('');
    expect(practiceDatesLine(['soon'])).toBe('');
  });
});

describe('AGE_GROUPS', () => {
  it('offers the four the web form always has', () => {
    expect(AGE_GROUPS).toEqual(['Kids (5–12)', 'Teens', 'Adults', 'Seniors']);
  });
});
