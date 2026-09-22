import { describe, expect, it } from 'vitest';
import {
  FESTIVAL_CALENDAR,
  FESTIVALS,
  festivalEventDraft,
  festivalOn,
  nextFestivalDate,
  paletteFor,
  searchFestivals,
} from '../src';

const TODAY = '2026-09-22';

const find = (id: string) => {
  const entry = FESTIVAL_CALENDAR.find((row) => row.id === id);
  if (!entry) throw new Error(`no calendar entry ${id}`);
  return entry;
};

describe('what the calendar claims to know', () => {
  it('is certain about the days that do not move', () => {
    expect(festivalOn(find('republic-day'), 2027)).toEqual({
      startsOn: '2027-01-26',
      exact: true,
    });
    expect(festivalOn(find('christmas'), 2030).startsOn).toBe('2030-12-25');
  });

  it('is never certain about a festival that moves', () => {
    // Diwali fell on 20 October in 2017 and 12 November in 2023. Anything that
    // reads this has to say so rather than print a date and look sure.
    for (const entry of FESTIVAL_CALENDAR) {
      const when = festivalOn(entry, 2027);
      expect(when.exact, entry.id).toBe(entry.date.on === 'fixed');
      expect(Boolean(when.window), entry.id).toBe(!when.exact);
    }
  });

  it('walks the Islamic dates back about eleven days a year', () => {
    // The drift is the computable part. The sighting of the moon is not, which
    // is what the window says.
    const bakrid = find('eid-ul-adha');
    expect(festivalOn(bakrid, 2025).startsOn).toBe('2025-06-07');
    expect(festivalOn(bakrid, 2026).startsOn).toBe('2026-05-27');
    expect(festivalOn(bakrid, 2030).startsOn).toBe('2030-04-14');
    expect(festivalOn(bakrid, 2025).window).toMatch(/sighting/);
  });

  it('covers every festival the committee asked for', () => {
    const named = FESTIVAL_CALENDAR.flatMap((entry) => [entry.name, ...(entry.aka ?? [])])
      .join(' ')
      .toLowerCase();
    for (const festival of [
      'new year',
      'sankranti',
      'lohri',
      'holi',
      'ugadi',
      'eid',
      'bakrid',
      'rama navami',
      'janmashtami',
      'republic day',
      'independence day',
      'gandhi jayanti',
      'diwali',
      'dussehra',
      'ganesh chaturthi',
      'christmas',
      'ramzan',
      'pongal',
      'onam',
      'bihu',
    ]) {
      expect(named, festival).toContain(festival);
    }
  });

  it('gives every entry a palette that exists', () => {
    for (const entry of FESTIVAL_CALENDAR) {
      expect(paletteFor(entry), entry.id).not.toBeNull();
      expect(FESTIVALS.map((f) => f.id)).toContain(entry.palette);
    }
  });
});

describe('rolling to the next one', () => {
  it('offers next year once this year has gone', () => {
    // A wizard opened in December offering last January's Sankranti is worse
    // than offering nothing.
    expect(nextFestivalDate(find('sankranti'), '2026-12-20').startsOn).toBe('2027-01-14');
    expect(nextFestivalDate(find('sankranti'), '2026-01-02').startsOn).toBe('2026-01-14');
  });

  it('counts today itself as still to come', () => {
    expect(nextFestivalDate(find('christmas'), '2026-12-25').startsOn).toBe('2026-12-25');
  });
});

describe('typing a few letters', () => {
  it('puts a name that starts with what you typed first', () => {
    expect(searchFestivals('on', TODAY)[0].id).toBe('onam');
    expect(searchFestivals('christ', TODAY)[0].id).toBe('christmas');
  });

  it('and when two start the same way, the one coming up sooner', () => {
    // Typed on 22 September, "gan" is far more likely to be Gandhi Jayanti ten
    // days away than Ganesh Chaturthi eleven months out.
    expect(searchFestivals('gan', TODAY).map((entry) => entry.id)).toEqual([
      'gandhi-jayanti',
      'ganesh-chaturthi',
    ]);
    expect(searchFestivals('gan', '2026-10-05')[0].id).toBe('ganesh-chaturthi');
  });

  it('finds the name somebody actually types, not the one we chose', () => {
    expect(searchFestivals('deepavali', TODAY)[0].id).toBe('diwali');
    expect(searchFestivals('ganpati', TODAY)[0].id).toBe('ganesh-chaturthi');
    expect(searchFestivals('krishnashtami', TODAY)[0].id).toBe('janmashtami');
    expect(searchFestivals('vaisakhi', TODAY)[0].id).toBe('baisakhi');
  });

  it('ignores punctuation and case, because people type in a hurry', () => {
    expect(searchFestivals("CHILDREN'S DAY", TODAY)[0].id).toBe('childrens-day');
    expect(searchFestivals('eid-ul-adha', TODAY)[0].id).toBe('eid-ul-adha');
  });

  it('answers an empty box with what is coming up, soonest first', () => {
    const upcoming = searchFestivals('', TODAY, 3);
    expect(upcoming).toHaveLength(3);
    const dates = upcoming.map((entry) => nextFestivalDate(entry, TODAY).startsOn);
    expect([...dates].sort()).toEqual(dates);
    expect(dates[0] >= TODAY).toBe(true);
  });

  it('says nothing rather than something wrong', () => {
    expect(searchFestivals('quarterly budget review', TODAY)).toEqual([]);
  });
});

describe('what it fills into the wizard', () => {
  it('names the event for the year the date lands in', () => {
    // Two events called "Diwali" are two events nobody can tell apart.
    const draft = festivalEventDraft(find('sankranti'), '2026-12-20');
    expect(draft.name).toBe('Makar Sankranti 2027');
    expect(draft.startsOn).toBe('2027-01-14');
    expect(draft.exact).toBe(true);
  });

  it('hands the screen the warning along with the date', () => {
    const draft = festivalEventDraft(find('diwali'), TODAY);
    expect(draft.exact).toBe(false);
    expect(draft.window).toBe('late October or November');
    expect(draft.emoji).toBe('🪔');
  });
});
