import { describe, expect, it } from 'vitest';
import {
  LEDGER_FILTERS,
  SOCIETY_BALANCE_LEDGER,
  filterLedger,
  isSocietyBalanceRow,
  isSocietySpending,
  ledgerEvidence,
  ledgerFilterFrom,
  ledgerMeta,
  ledgerScopes,
  ledgerTitle,
  ledgerTotals,
  ledgerFlat,
  type LedgerEntry,
  type LedgerRow,
} from '../src/ledger';

/**
 * The ledger filters moved here from the web app when the native app grew a
 * Money screen of its own. Both now narrow the same 500 rows through these
 * functions, which is the point: two surfaces quietly disagreeing about what
 * "money in" means is the sort of thing a resident finds by holding their phone
 * next to somebody's laptop, long after anyone would think to check.
 */
const rows: (LedgerRow & { id: string })[] = [
  { id: 'in-deepavali', direction: 'in', event_slug: 'deepavali' },
  { id: 'out-deepavali', direction: 'out', event_slug: 'deepavali' },
  { id: 'in-ganesh', direction: 'in', event_slug: 'ganesh' },
  { id: 'out-society', direction: 'out', event_slug: null },
];

const ids = (list: { id: string }[]) => list.map((row) => row.id);

describe('ledgerFilterFrom', () => {
  it('accepts every value the filter list offers', () => {
    for (const option of LEDGER_FILTERS) {
      expect(ledgerFilterFrom(option.value)).toBe(option.value);
    }
  });

  it('falls back to everything for anything it does not recognise', () => {
    // A hand-edited URL on the web and a stale stored value on the phone both
    // arrive here; neither should empty the ledger.
    for (const value of [undefined, null, '', 'IN', 'incoming', 0, {}, []]) {
      expect(ledgerFilterFrom(value)).toBe('all');
    }
  });
});

describe('filterLedger', () => {
  it('returns everything when nothing is being narrowed', () => {
    expect(ids(filterLedger(rows, 'all', ''))).toEqual([
      'in-deepavali',
      'out-deepavali',
      'in-ganesh',
      'out-society',
    ]);
  });

  it('narrows by direction', () => {
    expect(ids(filterLedger(rows, 'in', ''))).toEqual(['in-deepavali', 'in-ganesh']);
    expect(ids(filterLedger(rows, 'out', ''))).toEqual(['out-deepavali', 'out-society']);
  });

  it('narrows by event', () => {
    expect(ids(filterLedger(rows, 'all', 'deepavali'))).toEqual(['in-deepavali', 'out-deepavali']);
  });

  it('applies both at once', () => {
    expect(ids(filterLedger(rows, 'out', 'deepavali'))).toEqual(['out-deepavali']);
  });

  it('keeps society-wide rows out of an event filter rather than treating null as a match', () => {
    expect(ids(filterLedger(rows, 'all', 'ganesh'))).toEqual(['in-ganesh']);
  });

  it('leaves the caller their own array', () => {
    const before = ids(rows);
    filterLedger(rows, 'in', 'deepavali');
    expect(ids(rows)).toEqual(before);
  });
});

/**
 * Reading one row. The view used to build a single "who" out of
 * coalesce(name, flat, method), so three rows in a row on the Money page said
 * three different things — a name with no flat, both, and a flat with no name
 * — depending only on how each payment happened to be recorded. These compose
 * the parts instead, in one place, so the laptop and the phone cannot drift.
 */
const entry = (over: Partial<LedgerEntry> = {}): LedgerEntry => ({
  direction: 'in',
  event_slug: 'ganesh',
  counterpart: 'Pranav Aditya',
  detail: null,
  payer_name: 'Pranav Aditya',
  unit_label: 'A 703',
  method: 'Upi',
  document_url: null,
  ...over,
});

describe('reading one ledger row', () => {
  it('says the name and the flat, not one or the other', () => {
    const row = entry();
    expect(ledgerTitle(row)).toBe('Pranav Aditya');
    expect(ledgerFlat(row)).toEqual({ label: 'A 703', known: true });
    expect(ledgerMeta(row)).toBe('Upi');
  });

  it('titles a bill by its vendor and explains it by its category', () => {
    const bill = entry({
      direction: 'out',
      counterpart: 'Paper Glow',
      detail: 'Decoration',
      payer_name: null,
      unit_label: null,
      method: null,
    });
    expect(ledgerTitle(bill)).toBe('Paper Glow');
    expect(ledgerFlat(bill)).toBeNull();
    expect(ledgerMeta(bill)).toBe('Decoration');
  });

  it('does not print the flat twice when it is already the title', () => {
    // Cash collected against a door nobody is registered against: the flat is
    // all the row knows, so it becomes the name rather than repeating.
    const row = entry({ counterpart: 'A 703', payer_name: null });
    expect(ledgerTitle(row)).toBe('A 703');
    expect(ledgerFlat(row)).toBeNull();
  });

  it('says so when it names a person and no flat', () => {
    // A member nobody has listed at a door yet. Blank reads as a dropped
    // field; this reads as the gap it is, and tells the committee to close it.
    const row = entry({ unit_label: null });
    expect(ledgerTitle(row)).toBe('Pranav Aditya');
    expect(ledgerFlat(row)).toEqual({ label: 'Flat not recorded', known: false });
  });

  it('but not on a payment with nobody behind it either', () => {
    // A sponsor's cash, titled by how it arrived. There is no door for the
    // row to be missing, so claiming one is missing would be a lie.
    const row = entry({ counterpart: 'Cash', payer_name: null, unit_label: null, method: 'Cash' });
    expect(ledgerTitle(row)).toBe('Cash');
    expect(ledgerFlat(row)).toBeNull();
  });

  it('still reads a row from a view that has not been widened yet', () => {
    // A deployed app meeting an older database, or the other way round: the
    // three new fields are optional and the row falls back to counterpart.
    const row: LedgerEntry = {
      direction: 'in',
      event_slug: 'ganesh',
      counterpart: 'Surya Pratap',
      detail: 'E 802 · Upi',
    };
    expect(ledgerTitle(row)).toBe('Surya Pratap');
    expect(ledgerFlat(row)).toBeNull();
    expect(ledgerMeta(row)).toBeNull();
  });

  it('never renders an empty headline', () => {
    expect(ledgerTitle(entry({ counterpart: null, payer_name: null }))).toBe('Not recorded');
  });
});

describe('the evidence behind a row', () => {
  it('sends a bill to the bills bucket and a payment to the screenshots', () => {
    expect(ledgerEvidence(entry({ document_url: 'proofs/a.jpg' }))).toEqual({
      bucket: 'payment-proofs',
      label: 'View screenshot',
      path: 'proofs/a.jpg',
    });
    expect(ledgerEvidence(entry({ direction: 'out', document_url: 'bills/b.pdf' }))).toEqual({
      bucket: 'bills',
      label: 'View bill',
      path: 'bills/b.pdf',
    });
  });

  it('offers nothing when the viewer is not the one entitled to it', () => {
    // The view hands a payment screenshot only to the payer and to staff, so a
    // neighbour gets null here — no button, rather than a button that fails.
    expect(ledgerEvidence(entry({ document_url: null }))).toBeNull();
    expect(ledgerEvidence(entry({ document_url: '' }))).toBeNull();
  });
});

/**
 * Money the committee moved: each movement is two rows in the ledger, one on
 * the side it left and one on the side it arrived. An event's ledger needs
 * both of its own to add up to what it holds; the society-wide list needs
 * neither, because they cancel and say nothing about money collected or spent.
 */
describe('money moved between events and the society balance', () => {
  // Challenge handed ₹6,990 to Velocity Vipers; Vipers kept ₹44,490 for the
  // society when it closed; the society balance paid a repair.
  const moved: (LedgerRow & { id: string; amount: number; event_name?: string | null })[] = [
    {
      id: 'pay-vipers',
      direction: 'in',
      event_slug: 'vipers',
      event_id: 'v',
      kind: 'payment',
      amount: 237500,
      event_name: 'Velocity Vipers',
    },
    {
      id: 'bill-vipers',
      direction: 'out',
      event_slug: 'vipers',
      event_id: 'v',
      kind: 'bill',
      amount: -200000,
      event_name: 'Velocity Vipers',
    },
    {
      id: 'from-challenge',
      direction: 'out',
      event_slug: 'challenge',
      event_id: 'c',
      kind: 'transfer',
      amount: -6990,
      event_name: 'Challenge',
    },
    {
      id: 'into-vipers',
      direction: 'in',
      event_slug: 'vipers',
      event_id: 'v',
      kind: 'transfer',
      amount: 6990,
      event_name: 'Velocity Vipers',
    },
    {
      id: 'from-vipers',
      direction: 'out',
      event_slug: 'vipers',
      event_id: 'v',
      kind: 'transfer',
      amount: -44490,
      event_name: 'Velocity Vipers',
    },
    {
      id: 'into-society',
      direction: 'in',
      event_slug: null,
      event_id: null,
      kind: 'transfer',
      amount: 44490,
    },
    {
      id: 'repair',
      direction: 'out',
      event_slug: null,
      event_id: null,
      kind: 'society_spending',
      amount: -500,
    },
    // Carried into a draft the reader may not see: no slug, but an event all the same.
    {
      id: 'into-draft',
      direction: 'in',
      event_slug: null,
      event_id: 'd',
      kind: 'transfer',
      amount: 100,
    },
  ];

  it('leaves them out of the society-wide list, where the two sides cancel', () => {
    expect(ids(filterLedger(moved, 'all', ''))).toEqual(['pay-vipers', 'bill-vipers', 'repair']);
  });

  it('keeps both of an event’s own in its ledger, so the ledger adds up to what it holds', () => {
    const vipers = filterLedger(moved, 'all', 'vipers');
    expect(ids(vipers)).toEqual(['pay-vipers', 'bill-vipers', 'into-vipers', 'from-vipers']);
    expect(ledgerTotals(vipers)).toEqual({ in: 244490, out: 244490, left: 0 });
  });

  it('gives the society balance a ledger of its own: what it kept and what it spent', () => {
    const society = filterLedger(moved, 'all', SOCIETY_BALANCE_LEDGER);
    expect(ids(society)).toEqual(['into-society', 'repair']);
    expect(ledgerTotals(society).left).toBe(43990);
  });

  it('never mistakes a row withheld from a draft for one of the society balance’s', () => {
    expect(isSocietyBalanceRow({ direction: 'in', event_slug: null, event_id: 'd' })).toBe(false);
    // Read without event_id at all, a row with no event is the society's.
    expect(isSocietyBalanceRow({ direction: 'out', event_slug: null })).toBe(true);
  });

  it('offers the society balance first, then each event by name', () => {
    expect(ledgerScopes(moved)).toEqual([
      { value: SOCIETY_BALANCE_LEDGER, label: 'Society balance' },
      { value: 'challenge', label: 'Challenge' },
      { value: 'vipers', label: 'Velocity Vipers' },
    ]);
  });

  it('can never collide with an event’s slug', () => {
    expect(SOCIETY_BALANCE_LEDGER).not.toMatch(/^[a-z0-9-]+$/);
  });

  it('reads a movement by what the committee did, with the transfer screenshot', () => {
    const payBack: LedgerEntry = {
      direction: 'in',
      event_slug: 'pongal',
      kind: 'transfer',
      counterpart: 'Society balance',
      detail: 'Overspend paid back to Esha Patil',
      payer_name: null,
      unit_label: null,
      method: 'Overspend paid back to Esha Patil',
      document_url: 'c/society/esha.png',
    };
    expect(ledgerTitle(payBack)).toBe('Society balance');
    expect(ledgerMeta(payBack)).toBe('Overspend paid back to Esha Patil');
    expect(ledgerFlat(payBack)).toBeNull();
    expect(ledgerEvidence(payBack)).toEqual({
      bucket: 'bills',
      label: 'View screenshot',
      path: 'c/society/esha.png',
    });
    expect(isSocietySpending({ ...payBack, direction: 'out', event_slug: null })).toBe(false);
  });

  it('still knows the society’s own spending when the read carries no kind', () => {
    expect(
      isSocietySpending({
        direction: 'out',
        event_slug: null,
        counterpart: 'Plumber',
        detail: 'Leak',
      }),
    ).toBe(true);
  });
});
