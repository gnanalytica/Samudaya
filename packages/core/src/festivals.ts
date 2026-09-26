import { formatOklch, parseOklch } from './colour';
import type { MotifId } from './motifs';

/**
 * How each event is dressed.
 *
 * A society's year is not one colour. Deepavali is marigold and crimson,
 * Holi is every colour at once, Onam is gold on leaf green — and an app that
 * paints all of them the same corporate green feels like a form to fill in
 * rather than somewhere the street's celebrations live.
 *
 * So each event picks a look from its own name and type, and the screens that
 * belong to it take it: the festival's colours, the thing it is decorated with
 * (a lamp for Deepavali, a crescent and lanterns for Eid, a star for
 * Christmas, three bands of colour for Independence Day — see motifs.ts), and
 * how much it moves. Nothing here changes what anything *means*: success is
 * still green and danger still red. This is the festival's colour, not the
 * interface's state.
 *
 * Every faith a society is likely to hold, the national days, and the plain
 * occasions — a cricket match, a clean-up, a potluck — each have their own.
 * So does grief: a condolence meeting or Muharram is not a celebration, and
 * its look has no decoration and no movement at all.
 *
 * Values are oklch so they sit in the same space as the rest of the tokens,
 * and each one is given twice — once for a light screen, once for a dark one.
 */

export type FestivalId =
  // How a day of mourning looks: checked first, so it never wears a party.
  | 'remembrance'
  // Festivals.
  | 'deepavali'
  | 'holi'
  | 'dasara'
  | 'ganesh'
  | 'onam'
  | 'pongal'
  | 'sankranti'
  | 'lohri'
  | 'harvest'
  | 'krishna'
  | 'rakhi'
  | 'shivratri'
  | 'chhath'
  | 'bathukamma'
  | 'ugadi'
  | 'puja'
  | 'eid'
  | 'christmas'
  | 'easter'
  | 'gurpurab'
  | 'buddha'
  | 'mahavir'
  | 'newyear'
  // The nation.
  | 'national'
  | 'gandhi'
  // Occasions that are not festivals.
  | 'sports'
  | 'culture'
  | 'kids'
  | 'care'
  | 'green'
  | 'food'
  | 'wellness'
  | 'celebration'
  // Everything else: the society's own.
  | 'community';

/** Light and dark, in that order. */
type Pair = readonly [light: string, dark: string];

/**
 * What an event is, as far as dressing it goes. A festival's name is worth
 * saying out loud ("Arkala · Diwali next"); a sports day's look is not.
 */
export type LookKind = 'festival' | 'national' | 'occasion' | 'solemn' | 'society';

/**
 * How much it celebrates. `festive` moves and sparkles; `calm` is drawn but
 * barely moves — a vigil, a fast, a day of reflection; `solemn` is neither.
 */
export type Mood = 'festive' | 'calm' | 'solemn';

export type Festival = {
  id: FestivalId;
  label: string;
  kind: LookKind;
  mood: Mood;
  /** What the event is decorated with (motifs.ts). */
  motif: MotifId;
  /** The event's own colour: headings, the rangoli, the emphasis. */
  accent: Pair;
  /** A second colour, for the far side of a gradient and the outer petals. */
  ribbon: Pair;
  /** A wash faint enough to read body text on. */
  wash: Pair;
  /**
   * The banner behind the event's title, glow to deepest. Worked out from the
   * accent unless given — as it is for the national days, whose three bands
   * need a ground that is none of them.
   */
  hero?: readonly [glow: string, middle: string, deep: string];
  /** Petals in the rangoli drawn behind the header. */
  petals: number;
  /**
   * Lower-case words in an event's name or type that choose this look. Matched
   * as whole words, so "Reid Hall" is not Eid and "Greenfield AGM" is not a
   * tree-planting day.
   */
  match: readonly string[];
};

export const FESTIVALS: readonly Festival[] = [
  {
    id: 'remembrance',
    label: 'Remembrance',
    kind: 'solemn',
    mood: 'solemn',
    motif: 'none',
    accent: ['oklch(0.45 0.02 250)', 'oklch(0.8 0.02 250)'],
    ribbon: ['oklch(0.55 0.02 250)', 'oklch(0.7 0.02 250)'],
    wash: ['oklch(0.975 0.004 250)', 'oklch(0.235 0.008 250)'],
    hero: ['oklch(0.5 0.02 250)', 'oklch(0.38 0.018 250)', 'oklch(0.26 0.014 250)'],
    petals: 8,
    match: [
      'condolence',
      'condolences',
      'memorial',
      'shraddhanjali',
      'homage',
      'tribute',
      'remembrance',
      'prayer meet',
      'prayer meeting',
      'muharram',
      'ashura',
      'good friday',
      'martyrs',
      'martyr',
      'shaheed',
      'mourning',
      'funeral',
      'passed away',
      'obituary',
      'uthala',
      'chautha',
      'tehravi',
    ],
  },
  {
    id: 'deepavali',
    label: 'Deepavali',
    kind: 'festival',
    mood: 'festive',
    motif: 'diya',
    accent: ['oklch(0.57 0.17 55)', 'oklch(0.79 0.15 68)'],
    ribbon: ['oklch(0.51 0.19 25)', 'oklch(0.71 0.16 30)'],
    wash: ['oklch(0.975 0.028 68)', 'oklch(0.235 0.035 58)'],
    petals: 12,
    match: ['deepavali', 'diwali', 'divali', 'dipavali', 'lakshmi puja', 'bhai dooj', 'dhanteras'],
  },
  {
    id: 'holi',
    label: 'Holi',
    kind: 'festival',
    mood: 'festive',
    motif: 'gulal',
    accent: ['oklch(0.56 0.21 350)', 'oklch(0.77 0.16 347)'],
    ribbon: ['oklch(0.62 0.14 195)', 'oklch(0.78 0.12 195)'],
    wash: ['oklch(0.975 0.03 340)', 'oklch(0.235 0.04 335)'],
    petals: 16,
    match: ['holi', 'rangpanchami', 'rang panchami', 'dhulandi', 'dhuleti', 'holika'],
  },
  {
    id: 'dasara',
    label: 'Dasara',
    kind: 'festival',
    mood: 'festive',
    motif: 'garland',
    accent: ['oklch(0.55 0.2 35)', 'oklch(0.76 0.16 42)'],
    ribbon: ['oklch(0.5 0.16 268)', 'oklch(0.73 0.13 268)'],
    wash: ['oklch(0.975 0.028 40)', 'oklch(0.235 0.036 36)'],
    petals: 10,
    match: [
      'dasara',
      'dussehra',
      'dasahra',
      'dashain',
      'vijayadashami',
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
    kind: 'festival',
    mood: 'festive',
    motif: 'modak',
    accent: ['oklch(0.6 0.17 62)', 'oklch(0.81 0.15 68)'],
    ribbon: ['oklch(0.52 0.19 20)', 'oklch(0.72 0.16 25)'],
    wash: ['oklch(0.975 0.028 64)', 'oklch(0.235 0.035 58)'],
    petals: 11,
    match: ['ganesh', 'ganesha', 'ganpati', 'ganapati', 'vinayaka', 'chaturthi', 'visarjan'],
  },
  {
    id: 'onam',
    label: 'Onam',
    kind: 'festival',
    mood: 'festive',
    motif: 'pookalam',
    accent: ['oklch(0.58 0.15 96)', 'oklch(0.81 0.14 100)'],
    ribbon: ['oklch(0.54 0.14 150)', 'oklch(0.75 0.13 150)'],
    wash: ['oklch(0.975 0.028 100)', 'oklch(0.235 0.034 105)'],
    petals: 14,
    match: ['onam', 'pookalam', 'thiruvonam', 'vishu'],
  },
  {
    id: 'pongal',
    label: 'Pongal',
    kind: 'festival',
    mood: 'festive',
    motif: 'pot',
    accent: ['oklch(0.63 0.15 86)', 'oklch(0.83 0.14 92)'],
    ribbon: ['oklch(0.57 0.13 142)', 'oklch(0.77 0.12 142)'],
    wash: ['oklch(0.975 0.028 90)', 'oklch(0.235 0.034 95)'],
    petals: 8,
    match: ['pongal', 'thai pongal', 'mattu pongal'],
  },
  {
    id: 'sankranti',
    label: 'Makar Sankranti',
    kind: 'festival',
    mood: 'festive',
    motif: 'kite',
    accent: ['oklch(0.55 0.14 240)', 'oklch(0.77 0.12 238)'],
    ribbon: ['oklch(0.62 0.18 5)', 'oklch(0.77 0.14 5)'],
    wash: ['oklch(0.975 0.02 240)', 'oklch(0.235 0.03 240)'],
    petals: 10,
    match: ['sankranti', 'sankranthi', 'makar', 'uttarayan', 'uttarayani', 'kite', 'patang'],
  },
  {
    id: 'lohri',
    label: 'Lohri',
    kind: 'festival',
    mood: 'festive',
    motif: 'bonfire',
    accent: ['oklch(0.58 0.18 45)', 'oklch(0.79 0.15 55)'],
    ribbon: ['oklch(0.5 0.18 28)', 'oklch(0.71 0.16 30)'],
    wash: ['oklch(0.975 0.028 50)', 'oklch(0.235 0.035 45)'],
    petals: 9,
    match: ['lohri', 'bhogi', 'bonfire'],
  },
  {
    id: 'harvest',
    label: 'Harvest festival',
    kind: 'festival',
    mood: 'festive',
    motif: 'sheaf',
    accent: ['oklch(0.6 0.13 85)', 'oklch(0.82 0.13 88)'],
    ribbon: ['oklch(0.55 0.13 135)', 'oklch(0.76 0.12 135)'],
    wash: ['oklch(0.975 0.028 88)', 'oklch(0.235 0.032 90)'],
    petals: 10,
    match: ['baisakhi', 'vaisakhi', 'bihu', 'harvest', 'nuakhai', 'wangala'],
  },
  {
    id: 'krishna',
    label: 'Janmashtami',
    kind: 'festival',
    mood: 'festive',
    motif: 'feather',
    accent: ['oklch(0.52 0.15 235)', 'oklch(0.75 0.13 232)'],
    ribbon: ['oklch(0.66 0.14 88)', 'oklch(0.84 0.12 92)'],
    wash: ['oklch(0.975 0.026 235)', 'oklch(0.235 0.034 235)'],
    petals: 12,
    match: [
      'janmashtami',
      'krishnashtami',
      'gokulashtami',
      'krishna jayanti',
      'dahi handi',
      'radhashtami',
    ],
  },
  {
    id: 'rakhi',
    label: 'Raksha Bandhan',
    kind: 'festival',
    mood: 'festive',
    motif: 'rakhi',
    accent: ['oklch(0.55 0.19 18)', 'oklch(0.76 0.15 20)'],
    ribbon: ['oklch(0.66 0.13 85)', 'oklch(0.83 0.12 88)'],
    wash: ['oklch(0.975 0.022 18)', 'oklch(0.235 0.034 18)'],
    petals: 12,
    match: ['raksha bandhan', 'rakhi', 'rakshabandhan'],
  },
  {
    id: 'shivratri',
    label: 'Maha Shivratri',
    kind: 'festival',
    mood: 'calm',
    motif: 'diya',
    accent: ['oklch(0.47 0.13 275)', 'oklch(0.76 0.11 275)'],
    ribbon: ['oklch(0.62 0.05 240)', 'oklch(0.8 0.05 240)'],
    wash: ['oklch(0.975 0.018 275)', 'oklch(0.235 0.03 275)'],
    petals: 10,
    match: ['shivratri', 'shivaratri', 'maha shivaratri'],
  },
  {
    id: 'chhath',
    label: 'Chhath Puja',
    kind: 'festival',
    mood: 'festive',
    motif: 'sun',
    accent: ['oklch(0.6 0.16 55)', 'oklch(0.8 0.14 62)'],
    ribbon: ['oklch(0.55 0.1 220)', 'oklch(0.75 0.09 220)'],
    wash: ['oklch(0.975 0.026 60)', 'oklch(0.235 0.03 60)'],
    petals: 12,
    match: ['chhath', 'chhat', 'surya shashti'],
  },
  {
    id: 'bathukamma',
    label: 'Bathukamma',
    kind: 'festival',
    mood: 'festive',
    motif: 'bathukamma',
    accent: ['oklch(0.55 0.18 355)', 'oklch(0.77 0.14 355)'],
    ribbon: ['oklch(0.7 0.14 95)', 'oklch(0.85 0.13 95)'],
    wash: ['oklch(0.975 0.022 355)', 'oklch(0.235 0.034 355)'],
    petals: 14,
    match: ['bathukamma', 'batukamma', 'bonalu'],
  },
  {
    id: 'ugadi',
    label: 'Ugadi',
    kind: 'festival',
    mood: 'festive',
    motif: 'toran',
    accent: ['oklch(0.52 0.13 140)', 'oklch(0.77 0.13 138)'],
    ribbon: ['oklch(0.66 0.14 85)', 'oklch(0.83 0.13 88)'],
    wash: ['oklch(0.975 0.024 135)', 'oklch(0.235 0.03 135)'],
    petals: 12,
    match: [
      'ugadi',
      'yugadi',
      'gudi padwa',
      'gudhi padwa',
      'puthandu',
      'cheti chand',
      'navreh',
      'navroz',
      'nowruz',
      'parsi new year',
      'telugu new year',
      'kannada new year',
      'tamil new year',
      'marathi new year',
    ],
  },
  {
    // The days in between: Rama Navami, Hanuman Jayanti, a Satyanarayan puja.
    id: 'puja',
    label: 'Puja',
    kind: 'festival',
    mood: 'festive',
    motif: 'kolam',
    accent: ['oklch(0.6 0.16 50)', 'oklch(0.79 0.14 60)'],
    ribbon: ['oklch(0.52 0.19 28)', 'oklch(0.72 0.16 30)'],
    wash: ['oklch(0.975 0.028 55)', 'oklch(0.235 0.034 52)'],
    petals: 12,
    match: [
      'rama navami',
      'ram navami',
      'ramanavami',
      'hanuman jayanti',
      'vasant panchami',
      'saraswati puja',
      'akshaya tritiya',
      'teej',
      'karva chauth',
      'karwa chauth',
      'guru purnima',
      'satyanarayan',
      'satyanarayana',
      'puja',
      'pooja',
    ],
  },
  {
    id: 'eid',
    label: 'Eid',
    kind: 'festival',
    mood: 'festive',
    motif: 'crescent',
    accent: ['oklch(0.52 0.13 166)', 'oklch(0.76 0.12 166)'],
    ribbon: ['oklch(0.66 0.12 92)', 'oklch(0.84 0.11 96)'],
    wash: ['oklch(0.975 0.024 168)', 'oklch(0.235 0.03 168)'],
    petals: 8,
    match: [
      'eid',
      'id ul fitr',
      'ramzan',
      'ramadan',
      'iftar',
      'roza',
      'bakrid',
      'bakri eid',
      'qurbani',
      'milad',
      'shab e barat',
    ],
  },
  {
    id: 'christmas',
    label: 'Christmas',
    kind: 'festival',
    mood: 'festive',
    motif: 'star',
    accent: ['oklch(0.45 0.12 156)', 'oklch(0.73 0.13 156)'],
    ribbon: ['oklch(0.5 0.19 25)', 'oklch(0.71 0.17 25)'],
    wash: ['oklch(0.975 0.024 156)', 'oklch(0.235 0.03 156)'],
    petals: 8,
    match: ['christmas', 'xmas', 'carol', 'carols', 'santa', 'nativity'],
  },
  {
    id: 'easter',
    label: 'Easter',
    kind: 'festival',
    mood: 'festive',
    motif: 'lily',
    accent: ['oklch(0.52 0.12 300)', 'oklch(0.77 0.1 300)'],
    ribbon: ['oklch(0.6 0.12 140)', 'oklch(0.78 0.11 140)'],
    wash: ['oklch(0.975 0.018 300)', 'oklch(0.235 0.028 300)'],
    petals: 6,
    match: ['easter'],
  },
  {
    id: 'gurpurab',
    label: 'Gurpurab',
    kind: 'festival',
    mood: 'festive',
    motif: 'lights',
    accent: ['oklch(0.6 0.16 58)', 'oklch(0.8 0.14 65)'],
    ribbon: ['oklch(0.42 0.12 265)', 'oklch(0.72 0.1 265)'],
    wash: ['oklch(0.975 0.026 62)', 'oklch(0.235 0.03 62)'],
    hero: ['oklch(0.62 0.15 60)', 'oklch(0.45 0.1 280)', 'oklch(0.25 0.08 268)'],
    petals: 12,
    match: [
      'gurpurab',
      'gurpurb',
      'guru nanak',
      'prakash parv',
      'prakash utsav',
      'guru gobind',
      'guru purab',
    ],
  },
  {
    id: 'buddha',
    label: 'Buddha Purnima',
    kind: 'festival',
    mood: 'calm',
    motif: 'lotus',
    accent: ['oklch(0.5 0.1 255)', 'oklch(0.77 0.09 255)'],
    ribbon: ['oklch(0.7 0.12 85)', 'oklch(0.85 0.11 88)'],
    wash: ['oklch(0.975 0.016 255)', 'oklch(0.235 0.026 255)'],
    petals: 8,
    match: ['buddha purnima', 'buddha jayanti', 'vesak', 'vesak day'],
  },
  {
    id: 'mahavir',
    label: 'Mahavir Jayanti',
    kind: 'festival',
    mood: 'calm',
    motif: 'lotus',
    accent: ['oklch(0.58 0.12 75)', 'oklch(0.8 0.11 80)'],
    ribbon: ['oklch(0.55 0.12 30)', 'oklch(0.74 0.12 32)'],
    wash: ['oklch(0.975 0.022 80)', 'oklch(0.235 0.028 78)'],
    petals: 8,
    match: ['mahavir', 'mahaveer', 'paryushan', 'paryushana', 'samvatsari'],
  },
  {
    id: 'newyear',
    label: 'New Year',
    kind: 'festival',
    mood: 'festive',
    motif: 'fireworks',
    accent: ['oklch(0.48 0.16 278)', 'oklch(0.75 0.14 276)'],
    ribbon: ['oklch(0.66 0.13 86)', 'oklch(0.84 0.12 90)'],
    wash: ['oklch(0.975 0.026 278)', 'oklch(0.235 0.034 278)'],
    petals: 16,
    match: ['new year', 'new years', 'new years eve', 'nye'],
  },
  {
    id: 'national',
    label: 'National day',
    kind: 'national',
    mood: 'festive',
    motif: 'tricolour',
    accent: ['oklch(0.63 0.16 56)', 'oklch(0.81 0.14 62)'],
    ribbon: ['oklch(0.5 0.13 150)', 'oklch(0.73 0.12 150)'],
    wash: ['oklch(0.975 0.026 58)', 'oklch(0.235 0.032 56)'],
    // Navy, the chakra's colour, so all three bands show against it.
    hero: ['oklch(0.5 0.11 262)', 'oklch(0.36 0.1 264)', 'oklch(0.22 0.06 266)'],
    petals: 12,
    match: [
      'independence',
      'republic day',
      'tiranga',
      'flag hoisting',
      'har ghar tiranga',
      'swatantrata',
      'azadi',
      'constitution day',
      'samvidhan',
    ],
  },
  {
    id: 'gandhi',
    label: 'Gandhi Jayanti',
    kind: 'national',
    mood: 'calm',
    motif: 'charkha',
    accent: ['oklch(0.5 0.04 90)', 'oklch(0.8 0.04 90)'],
    ribbon: ['oklch(0.55 0.08 150)', 'oklch(0.75 0.08 150)'],
    wash: ['oklch(0.975 0.01 90)', 'oklch(0.235 0.012 90)'],
    petals: 8,
    match: ['gandhi jayanti', 'gandhi', 'bapu', 'shastri jayanti'],
  },
  {
    id: 'sports',
    label: 'Sports',
    kind: 'occasion',
    mood: 'festive',
    motif: 'trophy',
    accent: ['oklch(0.52 0.14 230)', 'oklch(0.77 0.12 225)'],
    ribbon: ['oklch(0.7 0.17 130)', 'oklch(0.82 0.16 130)'],
    wash: ['oklch(0.975 0.018 230)', 'oklch(0.235 0.03 230)'],
    petals: 10,
    match: [
      'sports',
      'sport',
      'cricket',
      'football',
      'tournament',
      'match',
      'league',
      'marathon',
      'cup',
      'games',
      'badminton',
      'kabaddi',
      'volleyball',
      'tennis',
      'table tennis',
      'chess',
      'carrom',
      'olympics',
      'relay',
      'cyclothon',
      'walkathon',
      'run',
      'race',
      'swimming',
      'throwball',
      'kho kho',
    ],
  },
  {
    id: 'culture',
    label: 'Culture',
    kind: 'occasion',
    mood: 'festive',
    motif: 'music',
    accent: ['oklch(0.48 0.15 320)', 'oklch(0.77 0.12 320)'],
    ribbon: ['oklch(0.62 0.15 20)', 'oklch(0.77 0.13 20)'],
    wash: ['oklch(0.975 0.02 320)', 'oklch(0.235 0.032 320)'],
    petals: 12,
    match: [
      'music',
      'musical',
      'concert',
      'dance',
      'cultural',
      'culture',
      'drama',
      'talent show',
      'talent',
      'karaoke',
      'antakshari',
      'movie',
      'movies',
      'film',
      'singing',
      'annual day',
      'fashion show',
      'mehfil',
      'qawwali',
      'comedy',
      'open mic',
      'poetry',
      'mushaira',
      'dj',
    ],
  },
  {
    id: 'kids',
    label: 'Children',
    kind: 'occasion',
    mood: 'festive',
    motif: 'balloons',
    accent: ['oklch(0.62 0.15 70)', 'oklch(0.82 0.14 80)'],
    ribbon: ['oklch(0.6 0.13 235)', 'oklch(0.77 0.11 235)'],
    wash: ['oklch(0.975 0.026 80)', 'oklch(0.235 0.03 80)'],
    petals: 10,
    match: [
      'kids',
      'kid',
      'children',
      'childrens',
      'childrens day',
      'bal diwas',
      'summer camp',
      'fancy dress',
      'drawing',
      'colouring',
      'coloring',
      'storytelling',
      'magic show',
      'puppet',
      'treasure hunt',
    ],
  },
  {
    id: 'care',
    label: 'Giving',
    kind: 'occasion',
    mood: 'calm',
    motif: 'heart',
    accent: ['oklch(0.55 0.15 12)', 'oklch(0.77 0.12 12)'],
    ribbon: ['oklch(0.58 0.09 190)', 'oklch(0.76 0.08 190)'],
    wash: ['oklch(0.975 0.018 12)', 'oklch(0.235 0.028 12)'],
    petals: 8,
    match: [
      'donation',
      'donate',
      'charity',
      'relief',
      'blood',
      'seva',
      'orphanage',
      'old age home',
      'health camp',
      'medical camp',
      'eye camp',
      'dental camp',
      'vaccination',
      'volunteer',
      'volunteering',
      'awareness',
    ],
  },
  {
    id: 'green',
    label: 'Green drive',
    kind: 'occasion',
    mood: 'calm',
    motif: 'leaf',
    accent: ['oklch(0.52 0.13 145)', 'oklch(0.77 0.13 145)'],
    ribbon: ['oklch(0.52 0.08 60)', 'oklch(0.74 0.08 60)'],
    wash: ['oklch(0.975 0.022 145)', 'oklch(0.235 0.03 145)'],
    petals: 10,
    match: [
      'clean',
      'cleanup',
      'clean up',
      'cleaning',
      'cleanliness',
      'swachh',
      'tree',
      'trees',
      'plantation',
      'planting',
      'sapling',
      'saplings',
      'garden',
      'gardening',
      'environment',
      'earth day',
      'recycle',
      'recycling',
      'compost',
      'composting',
      'eco',
    ],
  },
  {
    id: 'food',
    label: 'Food',
    kind: 'occasion',
    mood: 'festive',
    motif: 'thali',
    accent: ['oklch(0.58 0.17 38)', 'oklch(0.78 0.14 45)'],
    ribbon: ['oklch(0.66 0.14 85)', 'oklch(0.83 0.13 88)'],
    wash: ['oklch(0.975 0.024 45)', 'oklch(0.235 0.032 45)'],
    petals: 10,
    match: [
      'food',
      'potluck',
      'feast',
      'bbq',
      'barbecue',
      'picnic',
      'dinner',
      'lunch',
      'brunch',
      'breakfast',
      'buffet',
      'cook off',
      'cooking',
    ],
  },
  {
    id: 'wellness',
    label: 'Wellness',
    kind: 'occasion',
    mood: 'calm',
    motif: 'lotus',
    accent: ['oklch(0.52 0.08 165)', 'oklch(0.78 0.08 165)'],
    ribbon: ['oklch(0.68 0.12 70)', 'oklch(0.82 0.11 72)'],
    wash: ['oklch(0.975 0.016 165)', 'oklch(0.235 0.024 165)'],
    petals: 8,
    match: ['yoga', 'yoga day', 'meditation', 'fitness', 'zumba', 'wellness', 'health', 'aerobics'],
  },
  {
    id: 'celebration',
    label: 'Celebration',
    kind: 'occasion',
    mood: 'festive',
    motif: 'confetti',
    accent: ['oklch(0.6 0.12 80)', 'oklch(0.82 0.11 84)'],
    ribbon: ['oklch(0.55 0.16 350)', 'oklch(0.75 0.13 350)'],
    wash: ['oklch(0.975 0.022 84)', 'oklch(0.235 0.028 84)'],
    petals: 12,
    match: [
      'anniversary',
      'birthday',
      'celebration',
      'celebrations',
      'party',
      'get together',
      'foundation day',
      'society day',
      'housewarming',
      'house warming',
      'gala',
      'jubilee',
      'fest',
      'mela',
      'carnival',
    ],
  },
  {
    // Everything that is not a festival: a meeting, a fundraiser, a repair.
    id: 'community',
    label: 'Society',
    kind: 'society',
    mood: 'calm',
    motif: 'dots',
    accent: ['oklch(0.48 0.09 165)', 'oklch(0.76 0.1 165)'],
    ribbon: ['oklch(0.62 0.09 80)', 'oklch(0.8 0.09 82)'],
    wash: ['oklch(0.975 0.012 150)', 'oklch(0.235 0.018 160)'],
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
 * Text reduced to lower-case words with single spaces and a space at each end,
 * so a keyword can be looked for as whole words. Apostrophes go (New Year’s),
 * everything else that is not a letter or digit becomes a space, and digits
 * are split from letters, so "Diwali2026" reads as "diwali 2026".
 */
export function normaliseWords(text: string) {
  const words = text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’']/g, '')
    .replace(/([a-z])(\d)/g, '$1 $2')
    .replace(/(\d)([a-z])/g, '$1 $2')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
  return ` ${words} `;
}

/** Whether `words` (from normaliseWords) mentions `keyword`, or its plural. */
export function mentions(words: string, keyword: string) {
  const key = normaliseWords(keyword).trim();
  return words.includes(` ${key} `) || words.includes(` ${key}s `);
}

/**
 * Picks a look from what the event calls itself. The type is checked first —
 * a society that files its events under "Deepavali" means it — and the name
 * second, which is what catches "Dandiya night" under a generic type.
 *
 * The first look that matches wins, so the order of FESTIVALS is the order of
 * precedence: mourning before anything, festivals before the occasions they
 * are often held as ("Diwali cricket match" is Deepavali), and the society's
 * own look when nothing matches — plenty of events are simply the society's.
 */
export function festivalFor(...text: (string | null | undefined)[]): Festival {
  const parts = text.filter((part): part is string => Boolean(part?.trim())).map(normaliseWords);
  const said = (festival: Festival, words: string) =>
    festival.match.some((keyword) => mentions(words, keyword));
  // Grief outranks even the type: a condolence meeting filed under Cultural is
  // still a condolence meeting.
  for (const festival of FESTIVALS) {
    if (festival.mood === 'solemn' && parts.some((words) => said(festival, words))) {
      return festival;
    }
  }
  for (const words of parts) {
    const found = FESTIVALS.find((festival) => said(festival, words));
    if (found) return found;
  }
  return DEFAULT_FESTIVAL;
}

/**
 * The looks a marigold garland and a kolam belong to: the Hindu, Sikh and
 * Jain festivals and the harvest days, where both are what a doorway and a
 * courtyard are actually dressed in. Eid, Christmas, Easter, Buddha Purnima,
 * New Year and the national days are not, and on those the front page hangs
 * the look's own motif instead.
 */
const GARLANDED = new Set<FestivalId>([
  'deepavali',
  'holi',
  'dasara',
  'ganesh',
  'onam',
  'pongal',
  'sankranti',
  'lohri',
  'harvest',
  'krishna',
  'rakhi',
  'shivratri',
  'chhath',
  'bathukamma',
  'ugadi',
  'puja',
  'gurpurab',
  'mahavir',
]);

export function wearsGarland(festival: Festival): boolean {
  return GARLANDED.has(festival.id);
}

/**
 * The banner behind an event's title, glow to deepest: the festival's own hue,
 * from a lit corner down to a colour dark enough that white text on it reads.
 * The same in both themes, like a printed banner. Calm looks are quieter.
 */
export function heroGradient(festival: Festival): readonly [string, string, string] {
  if (festival.hero) return festival.hero;
  const [, chroma, hue] = parseOklch(festival.accent[0]);
  const quiet = festival.mood === 'festive' ? 1 : 0.7;
  const c = Math.min(chroma, 0.16) * quiet;
  return [
    formatOklch([0.7, c, hue + 8]),
    formatOklch([0.5, c, hue]),
    formatOklch([0.3, c * 0.7, hue - 8]),
  ];
}
