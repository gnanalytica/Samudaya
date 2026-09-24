/* eslint-disable */
// Generated set for the demo video. Copied into apps/web/src/app/zz-demo/ by
// video/capture/capture.mjs and deleted again when the capture finishes.
//
// One invented society, in one file, so every page in the demo agrees with
// every other: the total on Home is the total on Money, and the event the
// ledger credits is the event the Events page lists. A video where the
// numbers disagree between two shots is a video about a broken app.
import type { LedgerRowData } from '@/components/ledger-row';

export const SOCIETY = {
  name: 'Shanti Nivas',
  slug: 'shanti-nivas',
  currency: 'INR' as const,
  upi: 'shantinivas@okaxis',
};

export const YOU = {
  name: 'Chitra Rao',
  email: 'chitra@shantinivas.example',
  role: 'committee' as const,
  flat: 'A 402',
};

/** Collected, spent, and what that leaves. Home and Money both read these. */
export const TOTALS = { collected: 46500, spent: 31200, balance: 15300, society: 4200 };

export const LEDGER: LedgerRowData[] = [
  {
    id: '1',
    direction: 'in',
    counterpart: 'Asha Menon',
    detail: 'A 402 · Upi',
    payer_name: 'Asha Menon',
    unit_label: 'A 402',
    method: 'Upi',
    amount: 2001,
    happened_at: '2026-09-14T09:12:00Z',
    confirmed_by: 'Chitra Rao',
    confirmed_at: '2026-09-14T18:00:00Z',
    event_slug: 'ganesh-chaturthi-2026',
    event_name: 'Ganesh Chaturthi 2026',
    document_url: null,
  },
  {
    id: '2',
    direction: 'out',
    counterpart: 'Paper Glow Decorators',
    detail: 'Decoration',
    payer_name: null,
    unit_label: null,
    method: null,
    amount: -8400,
    happened_at: '2026-09-13T11:00:00Z',
    confirmed_by: 'Bala Krishnan',
    confirmed_at: '2026-09-13T15:30:00Z',
    event_slug: 'ganesh-chaturthi-2026',
    event_name: 'Ganesh Chaturthi 2026',
    document_url: null,
  },
  {
    id: '3',
    direction: 'in',
    counterpart: 'Dev Sharma',
    detail: 'B 1104 · Upi',
    payer_name: 'Dev Sharma',
    unit_label: 'B 1104',
    method: 'Upi',
    amount: 1001,
    happened_at: '2026-09-13T08:40:00Z',
    confirmed_by: 'Chitra Rao',
    confirmed_at: '2026-09-13T19:05:00Z',
    event_slug: 'ganesh-chaturthi-2026',
    event_name: 'Ganesh Chaturthi 2026',
    document_url: null,
  },
  {
    id: '4',
    direction: 'in',
    counterpart: 'A 703',
    detail: 'Cash',
    payer_name: null,
    unit_label: 'A 703',
    method: 'Cash',
    amount: 500,
    happened_at: '2026-09-12T17:20:00Z',
    confirmed_by: 'Bala Krishnan',
    confirmed_at: '2026-09-12T20:00:00Z',
    event_slug: 'ganesh-chaturthi-2026',
    event_name: 'Ganesh Chaturthi 2026',
    document_url: null,
  },
  {
    id: '5',
    direction: 'out',
    counterpart: 'Sri Ganesh Sound Service',
    detail: 'Sound and lights',
    payer_name: null,
    unit_label: null,
    method: null,
    amount: -6500,
    happened_at: '2026-09-11T14:00:00Z',
    confirmed_by: 'Bala Krishnan',
    confirmed_at: '2026-09-11T16:10:00Z',
    event_slug: 'ganesh-chaturthi-2026',
    event_name: 'Ganesh Chaturthi 2026',
    document_url: null,
  },
  {
    id: '6',
    direction: 'in',
    counterpart: 'Esha Patil',
    detail: 'B 306 · Upi',
    payer_name: 'Esha Patil',
    unit_label: 'B 306',
    method: 'Upi',
    amount: 3001,
    happened_at: '2026-09-11T07:55:00Z',
    confirmed_by: 'Chitra Rao',
    confirmed_at: '2026-09-11T18:30:00Z',
    event_slug: 'ganesh-chaturthi-2026',
    event_name: 'Ganesh Chaturthi 2026',
    document_url: null,
  },
  {
    // The row the whole "which flat?" change exists for: a neighbour nobody
    // had listed at a door. It reads "Flat not recorded" rather than blank.
    id: '7',
    direction: 'in',
    counterpart: 'Pranav Aditya',
    detail: 'Upi',
    payer_name: 'Pranav Aditya',
    unit_label: null,
    method: 'Upi',
    amount: 1001,
    happened_at: '2026-09-10T19:30:00Z',
    confirmed_by: 'Bala Krishnan',
    confirmed_at: '2026-09-10T21:00:00Z',
    event_slug: 'ganesh-chaturthi-2026',
    event_name: 'Ganesh Chaturthi 2026',
    document_url: null,
  },
  {
    id: '8',
    direction: 'out',
    counterpart: 'Anand Caterers',
    detail: 'Prasadam for 180',
    payer_name: null,
    unit_label: null,
    method: null,
    amount: -16300,
    happened_at: '2026-09-10T12:00:00Z',
    confirmed_by: 'Chitra Rao',
    confirmed_at: '2026-09-10T14:25:00Z',
    event_slug: 'ganesh-chaturthi-2026',
    event_name: 'Ganesh Chaturthi 2026',
    document_url: null,
  },
];

export const MOVEMENTS = [
  {
    id: 'm1',
    kind: 'society_balance' as const,
    amount: 4200,
    from_event: { name: 'Independence Day 2026' },
    to_event: null,
    decided_at: '2026-08-20T10:00:00Z',
    note: 'Nothing else running at the time.',
    decider: { profiles: { full_name: 'Bala Krishnan' } },
  },
  {
    id: 'm2',
    kind: 'next_event' as const,
    amount: 7800,
    from_event: { name: 'Summer Camp 2026' },
    to_event: { name: 'Ganesh Chaturthi 2026' },
    decided_at: '2026-07-02T10:00:00Z',
    note: null,
    decider: { profiles: { full_name: 'Chitra Rao' } },
  },
];

export const EVENTS = [
  {
    slug: 'ganesh-chaturthi-2026',
    name: 'Ganesh Chaturthi 2026',
    starts_on: '2026-09-15',
    status: 'Collecting',
    tone: 'success' as const,
    collected: 24500,
    target: 35000,
    carried: 7800,
    note: '18 of 24 flats have paid',
  },
  {
    slug: 'deepavali-2026',
    name: 'Deepavali 2026',
    starts_on: '2026-11-08',
    status: 'Planned',
    tone: 'neutral' as const,
    collected: 0,
    target: 40000,
    carried: 0,
    note: 'Collection opens in October',
  },
  {
    slug: 'independence-day-2026',
    name: 'Independence Day 2026',
    starts_on: '2026-08-15',
    status: 'Closed',
    tone: 'neutral' as const,
    collected: 14200,
    target: 12000,
    carried: 0,
    note: '₹4,200 left over, kept for the society',
  },
];

// ---------------------------------------------------------------------------
// What actually hangs off an event
// ---------------------------------------------------------------------------
// The product spec puts it plainly: the organising unit is the event, and it
// carries a checklist, a fund, activities, volunteer roles, expenses and a
// closure rule. The first cut of this video showed the fund and nothing else,
// which made a co-ordination product look like a payments app.

/** Readiness % is completed ÷ total. Computed here for the same reason. */
export const CHECKLIST = [
  { id: 'c1', title: 'Book the idol', owner: 'Bala Krishnan', due: '2026-08-28', done: true },
  { id: 'c2', title: 'Confirm the priest', owner: 'Chitra Rao', due: '2026-09-01', done: true },
  { id: 'c3', title: 'Sound and lights', owner: 'Bala Krishnan', due: '2026-09-05', done: true },
  { id: 'c4', title: 'Order prasadam for 180', owner: 'Chitra Rao', due: '2026-09-09', done: true },
  { id: 'c5', title: 'Print the programme', owner: 'Asha Menon', due: '2026-09-12', done: false },
  { id: 'c6', title: 'Arrange parking marshals', owner: null, due: '2026-09-14', done: false },
];

export const ACTIVITIES = [
  { id: 'a1', name: 'Classical dance', slot: '15 Sept · 6:30 pm', signed: 7, cap: 10 },
  { id: 'a2', name: 'Children’s fancy dress', slot: '15 Sept · 5:00 pm', signed: 12, cap: 12 },
  { id: 'a3', name: 'Bhajan group', slot: '16 Sept · 7:00 pm', signed: 4, cap: 8 },
];

export const VOLUNTEER_ROLES = [
  { id: 'v1', name: 'Kitchen help', needed: 6, signed: 6 },
  { id: 'v2', name: 'Parking marshal', needed: 4, signed: 1 },
  { id: 'v3', name: 'Stage and sound', needed: 3, signed: 2 },
];

/** Approved spending: what a resident sees, with the bill and who signed it. */
export const APPROVED_EXPENSES = [
  {
    id: 'e1',
    name: 'Prasadam for 180',
    category: 'Food',
    vendor: 'Anand Caterers',
    spent_on: '2026-09-10',
    amount: 16300,
    approved_by: 'Chitra Rao',
    approved_at: '2026-09-10T14:25:00Z',
  },
  {
    id: 'e2',
    name: 'Decoration',
    category: 'Decor',
    vendor: 'Paper Glow Decorators',
    spent_on: '2026-09-13',
    amount: 8400,
    approved_by: 'Bala Krishnan',
    approved_at: '2026-09-13T15:30:00Z',
  },
  {
    id: 'e3',
    name: 'Sound and lights',
    category: 'Production',
    vendor: 'Sri Ganesh Sound Service',
    spent_on: '2026-09-11',
    amount: 6500,
    approved_by: 'Bala Krishnan',
    approved_at: '2026-09-11T16:10:00Z',
  },
];

/**
 * The one waiting, filed by the person looking at it.
 *
 * "Nobody signs off their own money" is a rule the database enforces, and the
 * only way to show it is a bill whose Approve button is not there.
 */
export const AWAITING_EXPENSE = {
  id: 'e4',
  name: 'Idol and puja items',
  vendor: 'Sri Vinayaka Stores',
  amount: 9200,
  filed_by: 'Chitra Rao',
};

export const BUDGET = [
  { id: 'b1', category: 'Food', planned: 18000, spent: 16300 },
  { id: 'b2', category: 'Decor', planned: 9000, spent: 8400 },
  { id: 'b3', category: 'Production', planned: 6000, spent: 6500 },
  { id: 'b4', category: 'Printing', planned: 2000, spent: 0 },
];

export const FUND = {
  target: 35000,
  raised: 24500,
  pending: 2002,
  carried: 7800,
  contributors: 18,
  spent: 31200,
};
