import { FESTIVALS, type FestivalId } from './festivals';

/**
 * The year a residential society actually plans around.
 *
 * Somebody starting a Ganesh Chaturthi event should not have to look up when
 * Ganesh Chaturthi is, type the name themselves and pick a colour. They type
 * three letters and the app fills in the rest.
 *
 * ## About the dates
 *
 * Read this before trusting anything below. Indian festivals run on at least
 * three different calendars and only one of them lines up with the one on the
 * wall:
 *
 *   `fixed`   A Gregorian date that does not move: Republic Day, Christmas,
 *             New Year. Also the solar harvest days — Sankranti, Pongal, Lohri,
 *             Magh Bihu — which drift by a day a century and are 14 January for
 *             every purpose this app has.
 *
 *   `moves`   The Hindu lunisolar festivals. Diwali fell on 20 October in 2017
 *             and 12 November in 2023, so there is no formula here worth the
 *             name — what is stored is the middle of the window it usually
 *             falls in, and `window` says how wide that is in plain words.
 *
 *   `hijri`   The Islamic calendar is purely lunar, so its dates come about
 *             eleven days earlier each Gregorian year. That part *is*
 *             computable, and the drift from a recent occurrence is good to a
 *             day or two — but the month still opens on a sighting of the moon,
 *             which no table can promise.
 *
 * So: `fixed` dates are right, and everything else is a starting point the
 * committee corrects. `exact` on the result says which you are holding, and
 * every screen that fills a date in from here has to say so too. An app that
 * quietly writes the wrong date for Eid is worse than one that never offered.
 */

/** How a festival's date is worked out, and how much to trust the answer. */
export type DateRule =
  | { on: 'fixed'; month: number; day: number }
  | { on: 'moves'; month: number; day: number; window: string }
  | {
      on: 'hijri';
      /** A recent occurrence to count back from. */
      year: number;
      month: number;
      day: number;
      window: string;
    };

export type CalendarFestival = {
  id: string;
  name: string;
  /** Other names people type. Matched, never displayed. */
  aka?: readonly string[];
  emoji: string;
  /** Which palette in FESTIVALS this takes. */
  palette: FestivalId;
  date: DateRule;
};

/**
 * Not a complete almanac, and not trying to be: the days a society is likely
 * to put money and a stage behind. Anything missing is still one typed name
 * away — the box suggests, it does not restrict.
 */
export const FESTIVAL_CALENDAR: readonly CalendarFestival[] = [
  // --- Fixed, and right -----------------------------------------------------
  {
    id: 'new-year',
    name: 'New Year',
    aka: ['nye', 'new years', '1 january'],
    emoji: '🎆',
    palette: 'newyear',
    date: { on: 'fixed', month: 1, day: 1 },
  },
  {
    id: 'lohri',
    name: 'Lohri',
    emoji: '🔥',
    palette: 'pongal',
    date: { on: 'fixed', month: 1, day: 13 },
  },
  {
    id: 'sankranti',
    name: 'Makar Sankranti',
    aka: ['sankranthi', 'uttarayan', 'kite festival'],
    emoji: '🪁',
    palette: 'pongal',
    date: { on: 'fixed', month: 1, day: 14 },
  },
  {
    id: 'pongal',
    name: 'Pongal',
    aka: ['thai pongal'],
    emoji: '🍚',
    palette: 'pongal',
    date: { on: 'fixed', month: 1, day: 14 },
  },
  {
    id: 'magh-bihu',
    name: 'Magh Bihu',
    aka: ['bhogali bihu'],
    emoji: '🌾',
    palette: 'pongal',
    date: { on: 'fixed', month: 1, day: 14 },
  },
  {
    id: 'republic-day',
    name: 'Republic Day',
    aka: ['26 january', 'tiranga'],
    emoji: '🇮🇳',
    palette: 'national',
    date: { on: 'fixed', month: 1, day: 26 },
  },
  {
    id: 'bohag-bihu',
    name: 'Bohag Bihu',
    aka: ['rongali bihu', 'assamese new year'],
    emoji: '🌾',
    palette: 'newyear',
    date: { on: 'fixed', month: 4, day: 14 },
  },
  {
    id: 'baisakhi',
    name: 'Baisakhi',
    aka: ['vaisakhi'],
    emoji: '🌾',
    palette: 'newyear',
    date: { on: 'fixed', month: 4, day: 14 },
  },
  {
    id: 'independence-day',
    name: 'Independence Day',
    aka: ['15 august', 'tiranga'],
    emoji: '🇮🇳',
    palette: 'national',
    date: { on: 'fixed', month: 8, day: 15 },
  },
  {
    id: 'gandhi-jayanti',
    name: 'Gandhi Jayanti',
    aka: ['2 october', 'bapu'],
    emoji: '🕊️',
    palette: 'national',
    date: { on: 'fixed', month: 10, day: 2 },
  },
  {
    id: 'childrens-day',
    name: 'Children’s Day',
    aka: ['bal diwas', 'childrens day'],
    emoji: '🧒',
    palette: 'community',
    date: { on: 'fixed', month: 11, day: 14 },
  },
  {
    id: 'christmas',
    name: 'Christmas',
    aka: ['xmas', 'nativity', 'carols'],
    emoji: '🎄',
    palette: 'christmas',
    date: { on: 'fixed', month: 12, day: 25 },
  },

  // --- Hindu lunisolar: a starting point, not an answer ---------------------
  {
    id: 'maha-shivratri',
    name: 'Maha Shivratri',
    aka: ['shivaratri', 'shivratri'],
    emoji: '🔱',
    palette: 'community',
    date: { on: 'moves', month: 2, day: 26, window: 'late February or early March' },
  },
  {
    id: 'holi',
    name: 'Holi',
    aka: ['dhulandi', 'rang panchami', 'colours'],
    emoji: '🎨',
    palette: 'holi',
    date: { on: 'moves', month: 3, day: 14, window: 'March' },
  },
  {
    id: 'ugadi',
    name: 'Ugadi',
    aka: ['yugadi', 'gudi padwa', 'telugu new year', 'kannada new year'],
    emoji: '🌿',
    palette: 'newyear',
    date: { on: 'moves', month: 3, day: 30, window: 'late March or early April' },
  },
  {
    id: 'rama-navami',
    name: 'Rama Navami',
    aka: ['ramanavami', 'ram navami'],
    emoji: '🏹',
    palette: 'community',
    date: { on: 'moves', month: 4, day: 6, window: 'late March or April' },
  },
  {
    id: 'raksha-bandhan',
    name: 'Raksha Bandhan',
    aka: ['rakhi'],
    emoji: '🪢',
    palette: 'community',
    date: { on: 'moves', month: 8, day: 19, window: 'August' },
  },
  {
    id: 'janmashtami',
    name: 'Krishna Janmashtami',
    aka: ['krishnashtami', 'gokulashtami', 'dahi handi', 'krishna jayanti'],
    emoji: '🪈',
    palette: 'krishna',
    date: { on: 'moves', month: 8, day: 26, window: 'August or early September' },
  },
  {
    id: 'ganesh-chaturthi',
    name: 'Ganesh Chaturthi',
    aka: ['ganpati', 'vinayaka chaturthi', 'visarjan'],
    emoji: '🐘',
    palette: 'ganesh',
    date: { on: 'moves', month: 9, day: 5, window: 'late August or September' },
  },
  {
    id: 'onam',
    name: 'Onam',
    aka: ['thiruvonam', 'pookalam'],
    emoji: '🌺',
    palette: 'onam',
    date: { on: 'moves', month: 9, day: 5, window: 'late August or September' },
  },
  {
    id: 'navratri',
    name: 'Navratri',
    aka: ['navaratri', 'garba', 'dandiya', 'durga puja'],
    emoji: '🪩',
    palette: 'dasara',
    date: { on: 'moves', month: 10, day: 3, window: 'late September or October' },
  },
  {
    id: 'dussehra',
    name: 'Dussehra',
    aka: ['dasara', 'vijayadashami', 'ayudha puja'],
    emoji: '🏹',
    palette: 'dasara',
    date: { on: 'moves', month: 10, day: 12, window: 'late September or October' },
  },
  {
    id: 'diwali',
    name: 'Diwali',
    aka: ['deepavali', 'divali', 'lakshmi puja', 'bhai dooj', 'lamps'],
    emoji: '🪔',
    palette: 'deepavali',
    date: { on: 'moves', month: 11, day: 1, window: 'late October or November' },
  },
  {
    id: 'guru-nanak-jayanti',
    name: 'Guru Nanak Jayanti',
    aka: ['gurpurab', 'gurpurb'],
    emoji: '🪯',
    palette: 'community',
    date: { on: 'moves', month: 11, day: 15, window: 'November' },
  },

  // --- Islamic: drifts, and opens on a sighting -----------------------------
  {
    id: 'ramzan',
    name: 'Ramzan begins',
    aka: ['ramadan', 'roza', 'iftar'],
    emoji: '🌙',
    palette: 'eid',
    date: { on: 'hijri', year: 2025, month: 3, day: 1, window: 'set by the sighting of the moon' },
  },
  {
    id: 'eid-ul-fitr',
    name: 'Eid-ul-Fitr',
    aka: ['eid', 'ramzan eid', 'meethi eid'],
    emoji: '🌙',
    palette: 'eid',
    date: { on: 'hijri', year: 2025, month: 3, day: 31, window: 'set by the sighting of the moon' },
  },
  {
    id: 'eid-ul-adha',
    name: 'Bakrid',
    aka: ['eid ul adha', 'eid-ul-zuha', 'bakra eid', 'qurbani'],
    emoji: '🌙',
    palette: 'eid',
    date: { on: 'hijri', year: 2025, month: 6, day: 7, window: 'set by the sighting of the moon' },
  },
] as const;

/**
 * An Islamic year is twelve lunar months — about 354.367 days, some eleven
 * short of a Gregorian one, which is why these dates walk backwards through
 * the seasons. Counting forward in whole Islamic years from a known occurrence
 * is the arithmetic; counting backwards by the difference is not, and lands a
 * year out.
 */
const HIJRI_YEAR_DAYS = 354.367;

const iso = (date: Date) => date.toISOString().slice(0, 10);

const utc = (year: number, month: number, day: number) => new Date(Date.UTC(year, month - 1, day));

export type FestivalDate = {
  /** YYYY-MM-DD, ready for a date input. */
  startsOn: string;
  /** True only when the festival does not move. False means "check it". */
  exact: boolean;
  /** How it moves, for the sentence beside the field. Absent when exact. */
  window?: string;
};

/**
 * When this festival falls in a given year — or the nearest honest guess.
 *
 * The caller is expected to show `window` whenever `exact` is false. It is not
 * a disclaimer for the lawyers; it is the difference between an app that saved
 * somebody a search and an app that put the wrong day on sixty notice boards.
 */
export function festivalOn(entry: CalendarFestival, year: number): FestivalDate {
  const rule = entry.date;
  if (rule.on === 'fixed') {
    return { startsOn: iso(utc(year, rule.month, rule.day)), exact: true };
  }
  if (rule.on === 'moves') {
    return { startsOn: iso(utc(year, rule.month, rule.day)), exact: false, window: rule.window };
  }
  const from = utc(rule.year, rule.month, rule.day);
  from.setUTCDate(from.getUTCDate() + Math.round((year - rule.year) * HIJRI_YEAR_DAYS));
  return { startsOn: iso(from), exact: false, window: rule.window };
}

/**
 * The next time this festival comes round, counting from `today`.
 *
 * A wizard opened in December offering last January's Sankranti would be
 * useless, so a date already past rolls to next year.
 */
export function nextFestivalDate(entry: CalendarFestival, today: string): FestivalDate {
  const year = Number(today.slice(0, 4));
  const thisYear = festivalOn(entry, year);
  return thisYear.startsOn >= today ? thisYear : festivalOn(entry, year + 1);
}

const normalise = (text: string) =>
  text
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/**
 * Festivals matching what somebody has typed, best first.
 *
 * A name that starts with the query beats one that merely contains it, so
 * typing "on" offers Onam before Raksha Bandhan. An empty query is not no
 * answer: it is the next handful coming up, which is what somebody opening the
 * box without typing is looking for.
 */
export function searchFestivals(query: string, today: string, limit = 8): CalendarFestival[] {
  const q = normalise(query);
  const upcoming = [...FESTIVAL_CALENDAR].sort((a, b) =>
    nextFestivalDate(a, today).startsOn.localeCompare(nextFestivalDate(b, today).startsOn),
  );
  if (!q) return upcoming.slice(0, limit);

  const scored = upcoming
    .map((entry) => {
      const names = [entry.name, ...(entry.aka ?? [])].map(normalise);
      const starts = names.some((name) => name.startsWith(q));
      const has = names.some((name) => name.includes(q));
      return { entry, rank: starts ? 0 : has ? 1 : 2 };
    })
    .filter((row) => row.rank < 2)
    .sort((a, b) => a.rank - b.rank);

  return scored.slice(0, limit).map((row) => row.entry);
}

/** The palette a calendar entry carries, for tinting the event it creates. */
export function paletteFor(entry: CalendarFestival) {
  return FESTIVALS.find((festival) => festival.id === entry.palette) ?? null;
}

/**
 * What the wizard fills in when somebody picks a festival.
 *
 * The year goes in the name because a society runs Diwali every year and two
 * events called "Diwali" are two events nobody can tell apart in a list of
 * eight. It is taken from the date rather than from today, so a December
 * wizard picking next January's Sankranti names it for the right year.
 */
export function festivalEventDraft(entry: CalendarFestival, today: string) {
  const when = nextFestivalDate(entry, today);
  return {
    name: `${entry.name} ${when.startsOn.slice(0, 4)}`,
    startsOn: when.startsOn,
    emoji: entry.emoji,
    exact: when.exact,
    window: when.window,
  };
}
