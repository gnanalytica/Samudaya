import { listSentence } from './format';

/**
 * Activities residents register for. The choices and sentences both apps show,
 * kept here so a phone and a browser ask the same things in the same words.
 */

/**
 * What registering a family member asks about their age. Stored as the words
 * themselves, so this list is the one both forms offer.
 */
export const AGE_GROUPS = ['Kids (5–12)', 'Teens', 'Adults', 'Seniors'] as const;

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** `2026-10-03` → `Oct`, in the words formatDate uses for the same month. */
function monthOf(day: string): string {
  // Built from its parts for the same reason formatDate is: a bare ISO date
  // parses as UTC midnight, which is the previous month on the 1st in the
  // Americas.
  return new Date(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1, 1).toLocaleDateString(
    'en-IN',
    { month: 'short' },
  );
}

/**
 * Practice dates as a resident reads them: "3, 5 and 8 Oct". The month is said
 * once per run of days in it ("28, 30 Nov and 2 Dec"), and the year only when
 * the dates cross into another one. Sorted and without repeats, whatever order
 * they were saved in; empty when there are none.
 */
export function practiceDatesLine(dates: readonly string[]): string {
  const days = [...new Set(dates.filter((date) => DAY.test(date)))].sort();
  const years = new Set(days.map((day) => day.slice(0, 4))).size;
  return listSentence(
    days.map((day, index) => {
      const date = String(Number(day.slice(8, 10)));
      if (days[index + 1]?.slice(0, 7) === day.slice(0, 7)) return date;
      const month = monthOf(day);
      return years > 1 ? `${date} ${month} ${day.slice(0, 4)}` : `${date} ${month}`;
    }),
  );
}

/**
 * Why an activity can't have this few places, or null when it can. Blank is no
 * limit. A number below the people already registered would turn some of them
 * away after they signed up, so it is refused rather than guessed at.
 */
export function placesProblem(capacity: number | null, registered: number): string | null {
  if (capacity === null || capacity >= registered) return null;
  return registered === 1
    ? '1 person has registered, so places can’t go below 1.'
    : `${registered} people have registered, so places can’t go below ${registered}.`;
}
