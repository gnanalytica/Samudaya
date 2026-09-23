import type { ReactNode } from 'react';
import { Easing, interpolate } from 'remotion';
import {
  BalanceScreen,
  BillsScreen,
  BudgetScreen,
  COMMITTEE,
  ClosureScreen,
  ConfirmScreen,
  EventScreen,
  HomeScreen,
  MoneyScreen,
  PayScreen,
  ReconcileScreen,
  TodoScreen,
} from './screens';
import { sec } from './theme';

/**
 * The script, once, for both shapes it is cut into.
 *
 * `Phone` is portrait and `Explain` is landscape, and they are the same
 * fourteen beats in the same order carrying the same captions — only the
 * layout around the handset differs. Keeping the list here rather than in
 * either composition is what stops the two drifting into two different
 * arguments about the same product, which is what happened when the portrait
 * and landscape cuts each owned their own scene list.
 *
 * The cut follows one rupee rather than touring the app. Asha in A 402 pays
 * ₹2,001; it lands on the committee's list; somebody who is not Asha confirms
 * it; it appears on a ledger every resident can read; it is spent against a
 * bill somebody else approved; the bank statement agrees; and what is left at
 * the end is a decision with a name on it. Each screen is one step of that,
 * which is why the same ₹2,001 turns up on four of them.
 */

// ---------------------------------------------------------------------------
// Chapters
// ---------------------------------------------------------------------------
/**
 * Four of them, because the product is a sequence and a tour is not.
 *
 * The rail under the phone says which one is running. Without it a viewer
 * eleven screens in has no idea whether they are near the end, and every
 * screen looks like another feature rather than the next step.
 */
export const CHAPTERS = ['Plan', 'Collect', 'Spend', 'Prove'] as const;
export type Chapter = (typeof CHAPTERS)[number];

export type Shot = {
  id: string;
  hold: number;
  chapter?: Chapter;
  caption?: string;
  screen?: ReactNode;
  bookend?: { headline: string; sub: string; opening?: boolean };
  statement?: { lines: string[]; sub?: string };
  /** `zoom` runs from its first value to its second; `origin` is what it pushes towards. */
  zoom?: [number, number];
  origin?: number;
  tabs?: string[];
  active?: string;
  /**
   * The landscape cut has room beside the phone and the portrait one does not,
   * so these are the two sentences that would otherwise be lost. Every one has
   * to be true of the product as shipped — they are the part of the video most
   * likely to age into a lie.
   */
  points?: string[];
};

export const SHOTS: Shot[] = [
  {
    id: 'open',
    hold: sec(2.2),
    bookend: {
      headline: 'Samudaya',
      sub: 'Your society’s festivals — and its money — in the open.',
      opening: true,
    },
  },
  {
    id: 'problem',
    hold: sec(2.8),
    statement: {
      lines: ['Every society collects.', 'Few can show where it went.'],
      sub: 'Follow one ₹2,001.',
    },
  },
  {
    id: 'home',
    points: [
      'Every event the society is running, in one place',
      'What the fund holds, and what it still needs',
    ],
    hold: sec(3.2),
    chapter: 'Plan',
    caption: 'September, and the whole festival is on one screen.',
    screen: <HomeScreen />,
    active: 'Home',
    zoom: [1.0, 1.05],
    origin: 0.34,
  },
  {
    id: 'event',
    points: [
      'A checklist with an owner against each line',
      'Volunteer slots that show what is short',
    ],
    hold: sec(3.4),
    chapter: 'Plan',
    caption: 'Six jobs, four done — and one with nobody on it.',
    screen: <EventScreen />,
    active: 'Events',
    zoom: [1.02, 1.09],
    origin: 0.5,
  },
  {
    id: 'pay',
    points: [
      'UPI, or cash handed to a committee member',
      'The reference is filled in, so the payment can be told apart',
    ],
    hold: sec(3.4),
    chapter: 'Collect',
    caption: 'Asha in A 402 pays. The note fills itself in.',
    screen: <PayScreen />,
    active: 'Events',
    zoom: [1.02, 1.08],
    origin: 0.34,
  },
  {
    id: 'todo',
    points: [
      'Payments, bills, new residents, suggestions',
      'One queue, ordered by what a delay costs',
    ],
    hold: sec(3.2),
    chapter: 'Collect',
    caption: 'It lands on the committee’s list, not in a memory.',
    screen: <TodoScreen />,
    tabs: COMMITTEE,
    active: 'Manage',
    zoom: [1.0, 1.07],
    origin: 0.34,
  },
  {
    id: 'confirm',
    points: [
      'Checked against the screenshot the resident sent',
      'Correctable, if the screenshot says something else',
    ],
    hold: sec(3.4),
    chapter: 'Collect',
    caption: 'Somebody else checks it. Never your own payment.',
    screen: <ConfirmScreen />,
    tabs: COMMITTEE,
    active: 'Manage',
    zoom: [1.02, 1.1],
    origin: 0.42,
  },
  {
    id: 'money',
    points: [
      'A name, a flat and a method on every row',
      'Open to every resident, not only the committee',
    ],
    hold: sec(3.4),
    chapter: 'Collect',
    caption: 'Now it is on a ledger every resident can read.',
    screen: <MoneyScreen />,
    active: 'Money',
    zoom: [1.0, 1.09],
    origin: 0.4,
  },
  {
    id: 'bills',
    points: [
      'A bill attached to every rupee that leaves',
      'Whoever filed it cannot be the one to approve it',
    ],
    hold: sec(3.4),
    chapter: 'Spend',
    caption: 'Money out carries a bill — and a second signature.',
    screen: <BillsScreen />,
    tabs: COMMITTEE,
    active: 'Events',
    zoom: [1.0, 1.1],
    origin: 0.68,
  },
  {
    id: 'budget',
    points: ['Planned against spent, category by category', 'A line that goes over stays visible'],
    hold: sec(3.0),
    chapter: 'Spend',
    caption: 'Against the plan, line by line. Over still shows.',
    screen: <BudgetScreen />,
    tabs: COMMITTEE,
    active: 'Events',
    zoom: [1.02, 1.09],
    origin: 0.46,
  },
  {
    id: 'reconcile',
    points: [
      'Upload the bank statement and it matches itself',
      'Anything with no ledger row behind it is flagged',
    ],
    hold: sec(3.2),
    chapter: 'Prove',
    caption: 'Upload the bank statement. It matches itself.',
    screen: <ReconcileScreen />,
    tabs: COMMITTEE,
    active: 'Manage',
    zoom: [1.03, 1.09],
    origin: 0.42,
  },
  {
    id: 'closure',
    points: [
      'Two answers, and the app offers only two',
      'The decision keeps the name of whoever made it',
    ],
    hold: sec(3.6),
    chapter: 'Prove',
    caption: 'What is left is still theirs. The decision gets a name.',
    screen: <ClosureScreen />,
    tabs: COMMITTEE,
    active: 'Events',
    zoom: [1.0, 1.08],
    origin: 0.46,
  },
  {
    id: 'balance',
    points: [
      'What the society holds between events',
      'Every movement, with its reason and its author',
    ],
    hold: sec(3.0),
    chapter: 'Prove',
    caption: 'It sits on everybody’s home screen until it is spent.',
    screen: <BalanceScreen />,
    active: 'Home',
    zoom: [1.02, 1.08],
    origin: 0.3,
  },
  {
    id: 'close',
    hold: sec(2.4),
    bookend: { headline: 'samudaya.app', sub: 'Nothing hidden. Nothing to chase.' },
  },
];

/** Shots overlap by this much, which is what makes the push a push. */
export const OVERLAP = sec(0.28);

/** Where each shot starts on the timeline. */
export function starts() {
  let at = 0;
  return SHOTS.map((shot) => {
    const from = at;
    at += shot.hold - OVERLAP;
    return from;
  });
}

export function storyLength() {
  return SHOTS.reduce((total, shot) => total + shot.hold - OVERLAP, OVERLAP);
}

/** Which shot is on screen, and how far through it we are. */
export function at(frame: number) {
  const marks = starts();
  let index = 0;
  for (let i = 0; i < SHOTS.length; i += 1) if (frame >= marks[i]) index = i;
  const shot = SHOTS[index];
  const through = interpolate(frame, [marks[index], marks[index] + shot.hold], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return { shot, index, through };
}

/**
 * The camera, for the whole video.
 *
 * It lives out here rather than inside a shot because the bezel and the page
 * have to move together — a zoom applied to the page alone is a phone whose
 * display grows out of its case.
 */
export function camera(frame: number) {
  const { shot, through } = at(frame);
  const [from, to] = shot.zoom ?? [1, 1.04];
  const eased = interpolate(through, [0, 1], [0, 1], { easing: Easing.inOut(Easing.quad) });
  return { zoom: from + (to - from) * eased, origin: (shot.origin ?? 0.45) * 100 };
}

/** The rail needs the chapter of whichever shot has one, and its progress. */
export function chapterNow(frame: number) {
  const { shot, index, through } = at(frame);
  if (!shot.chapter) return null;
  const within = SHOTS.filter((entry) => entry.chapter === shot.chapter);
  const place = within.indexOf(SHOTS[index]);
  return { chapter: shot.chapter, progress: (place + through) / within.length };
}
