/**
 * Festival colours.
 *
 * A society's year is not one colour. Deepavali is marigold and crimson,
 * Holi is every colour at once, Onam is gold on leaf green — and an app that
 * paints all of them the same corporate green feels like a form to fill in
 * rather than somewhere the street's celebrations live.
 *
 * So each event picks a palette from its own name and type, and the screens
 * that belong to it are tinted accordingly. Nothing here changes what anything
 * *means*: success is still green and danger still red. This is the festival's
 * colour, not the interface's state.
 *
 * Values are oklch so they sit in the same space as the rest of the tokens,
 * and each one is given twice — once for a light screen, once for a dark one.
 */

export type FestivalId =
  | 'deepavali'
  | 'holi'
  | 'dasara'
  | 'ganesh'
  | 'onam'
  | 'pongal'
  | 'krishna'
  | 'eid'
  | 'christmas'
  | 'newyear'
  | 'national'
  | 'community';

/** Light and dark, in that order. */
type Pair = readonly [light: string, dark: string];

export type Festival = {
  id: FestivalId;
  label: string;
  /** The event's own colour: headings, the rangoli, the emphasis. */
  accent: Pair;
  /** A second colour, for the far side of a gradient and the outer petals. */
  ribbon: Pair;
  /** A wash faint enough to read body text on. */
  wash: Pair;
  /** Petals in the rangoli drawn behind the header. */
  petals: number;
  /** Lower-case words in an event's name or type that choose this palette. */
  match: readonly string[];
};

export const FESTIVALS: readonly Festival[] = [
  {
    id: 'deepavali',
    label: 'Deepavali',
    accent: ['oklch(0.57 0.17 55)', 'oklch(0.79 0.15 68)'],
    ribbon: ['oklch(0.51 0.19 25)', 'oklch(0.71 0.16 30)'],
    wash: ['oklch(0.975 0.028 68)', 'oklch(0.235 0.035 58)'],
    petals: 12,
    match: ['deepavali', 'diwali', 'divali', 'dipavali', 'lakshmi puja', 'bhai dooj', 'lamp'],
  },
  {
    id: 'holi',
    label: 'Holi',
    accent: ['oklch(0.56 0.21 350)', 'oklch(0.77 0.16 347)'],
    ribbon: ['oklch(0.62 0.14 195)', 'oklch(0.78 0.12 195)'],
    wash: ['oklch(0.975 0.03 340)', 'oklch(0.235 0.04 335)'],
    petals: 16,
    match: ['holi', 'rangpanchami', 'dhulandi', 'colour', 'color'],
  },
  {
    id: 'dasara',
    label: 'Dasara',
    accent: ['oklch(0.55 0.2 35)', 'oklch(0.76 0.16 42)'],
    ribbon: ['oklch(0.5 0.16 268)', 'oklch(0.73 0.13 268)'],
    wash: ['oklch(0.975 0.028 40)', 'oklch(0.235 0.036 36)'],
    petals: 10,
    match: [
      'dasara',
      'dussehra',
      'dasahra',
      'dashain',
      'navratri',
      'navaratri',
      'golu',
      'ayudha',
      'durga',
      'garba',
      'dandiya',
    ],
  },
  {
    id: 'ganesh',
    label: 'Ganesh Chaturthi',
    accent: ['oklch(0.6 0.17 62)', 'oklch(0.81 0.15 68)'],
    ribbon: ['oklch(0.52 0.19 20)', 'oklch(0.72 0.16 25)'],
    wash: ['oklch(0.975 0.028 64)', 'oklch(0.235 0.035 58)'],
    petals: 11,
    match: ['ganesh', 'ganpati', 'vinayaka', 'chaturthi', 'visarjan'],
  },
  {
    id: 'onam',
    label: 'Onam',
    accent: ['oklch(0.58 0.15 96)', 'oklch(0.81 0.14 100)'],
    ribbon: ['oklch(0.54 0.14 150)', 'oklch(0.75 0.13 150)'],
    wash: ['oklch(0.975 0.028 100)', 'oklch(0.235 0.034 105)'],
    petals: 14,
    match: ['onam', 'pookalam', 'thiruvonam', 'vishu', 'harvest'],
  },
  {
    id: 'pongal',
    label: 'Pongal',
    accent: ['oklch(0.63 0.15 86)', 'oklch(0.83 0.14 92)'],
    ribbon: ['oklch(0.57 0.13 142)', 'oklch(0.77 0.12 142)'],
    wash: ['oklch(0.975 0.028 90)', 'oklch(0.235 0.034 95)'],
    petals: 8,
    match: ['pongal', 'sankranti', 'sankranthi', 'makar', 'lohri', 'bihu', 'kite'],
  },
  {
    id: 'krishna',
    label: 'Janmashtami',
    accent: ['oklch(0.52 0.15 235)', 'oklch(0.75 0.13 232)'],
    ribbon: ['oklch(0.66 0.14 88)', 'oklch(0.84 0.12 92)'],
    wash: ['oklch(0.975 0.026 235)', 'oklch(0.235 0.034 235)'],
    petals: 12,
    match: ['janmashtami', 'krishna', 'gokulashtami', 'dahi handi', 'radha'],
  },
  {
    id: 'eid',
    label: 'Eid',
    accent: ['oklch(0.52 0.13 166)', 'oklch(0.76 0.12 166)'],
    ribbon: ['oklch(0.66 0.12 92)', 'oklch(0.84 0.11 96)'],
    wash: ['oklch(0.975 0.024 168)', 'oklch(0.235 0.03 168)'],
    petals: 8,
    match: ['eid', 'ramzan', 'ramadan', 'iftar', 'bakrid', 'milad', 'muharram'],
  },
  {
    id: 'christmas',
    label: 'Christmas',
    accent: ['oklch(0.45 0.12 156)', 'oklch(0.73 0.13 156)'],
    ribbon: ['oklch(0.5 0.19 25)', 'oklch(0.71 0.17 25)'],
    wash: ['oklch(0.975 0.024 156)', 'oklch(0.235 0.03 156)'],
    petals: 8,
    match: ['christmas', 'xmas', 'carol', 'santa', 'nativity', 'easter'],
  },
  {
    id: 'newyear',
    label: 'New Year',
    accent: ['oklch(0.48 0.16 278)', 'oklch(0.75 0.14 276)'],
    ribbon: ['oklch(0.66 0.13 86)', 'oklch(0.84 0.12 90)'],
    wash: ['oklch(0.975 0.026 278)', 'oklch(0.235 0.034 278)'],
    petals: 16,
    match: ['new year', 'new year’s', "new year's", 'nye', 'ugadi', 'gudi', 'baisakhi', 'puthandu'],
  },
  {
    id: 'national',
    label: 'National day',
    accent: ['oklch(0.63 0.16 56)', 'oklch(0.81 0.14 62)'],
    ribbon: ['oklch(0.5 0.13 150)', 'oklch(0.73 0.12 150)'],
    wash: ['oklch(0.975 0.026 58)', 'oklch(0.235 0.032 56)'],
    petals: 12,
    match: ['independence', 'republic day', 'gandhi jayanti', 'tiranga', 'flag'],
  },
  {
    // Everything that is not a festival: a meeting, a fundraiser, a clean-up.
    id: 'community',
    label: 'Society',
    accent: ['oklch(0.53 0.13 166)', 'oklch(0.72 0.14 164)'],
    ribbon: ['oklch(0.6 0.13 250)', 'oklch(0.74 0.12 250)'],
    wash: ['oklch(0.975 0.02 166)', 'oklch(0.235 0.026 166)'],
    petals: 10,
    match: [],
  },
];

const BY_ID = new Map(FESTIVALS.map((festival) => [festival.id, festival]));

/** The fallback: a society's own colour, for everything that is not a festival. */
export const DEFAULT_FESTIVAL = BY_ID.get('community')!;

export function festivalById(id: string | null | undefined): Festival {
  return (id && BY_ID.get(id as FestivalId)) || DEFAULT_FESTIVAL;
}

/**
 * Picks a palette from what the event calls itself. The type is checked first —
 * a society that files its events under "Deepavali" means it — and the name
 * second, which is what catches "Dandiya night" under a generic type.
 *
 * Unmatched is not a failure: plenty of events are simply the society's own.
 */
export function festivalFor(...text: (string | null | undefined)[]): Festival {
  const haystack = text
    .filter((part): part is string => Boolean(part))
    .join(' ')
    .toLowerCase();
  if (!haystack.trim()) return DEFAULT_FESTIVAL;

  for (const festival of FESTIVALS) {
    if (festival.match.some((word) => haystack.includes(word))) return festival;
  }
  return DEFAULT_FESTIVAL;
}
