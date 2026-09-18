import { describe, expect, it } from 'vitest';
import { LEDGER_FILTERS, filterLedger, ledgerFilterFrom, type LedgerRow } from '../src/ledger';

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
