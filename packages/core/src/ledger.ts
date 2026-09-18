/**
 * Narrowing the society ledger, in one place and without a database round trip.
 *
 * The ledger is bounded (500 rows, newest first) and already in memory, so
 * filtering it here keeps the screen a single read. On the web that lets the
 * filters live in a GET form, which means a filtered ledger is a URL somebody
 * can send to the neighbour asking where the money went; the native app holds
 * the same values in state and reads them through the same functions.
 *
 * Shared rather than copied: the two apps disagreeing about what "money in"
 * means is the kind of difference nobody notices until a resident compares
 * their phone with somebody's laptop and the totals do not match.
 */

export const LEDGER_FILTERS = [
  { value: 'all', label: 'Everything' },
  { value: 'in', label: 'Money in' },
  { value: 'out', label: 'Money out' },
] as const;

export type LedgerFilter = (typeof LEDGER_FILTERS)[number]['value'];

/** A row of society_ledger, narrowed to what a filter reads. */
export type LedgerRow = {
  direction: string | null;
  event_slug: string | null;
};

/** The direction filter from a query string. Anything unknown means everything. */
export function ledgerFilterFrom(value: unknown): LedgerFilter {
  return LEDGER_FILTERS.find((option) => option.value === value)?.value ?? 'all';
}

export function filterLedger<T extends LedgerRow>(
  rows: T[],
  direction: LedgerFilter,
  eventSlug: string,
): T[] {
  return rows.filter((row) => {
    if (direction !== 'all' && row.direction !== direction) return false;
    if (eventSlug && row.event_slug !== eventSlug) return false;
    return true;
  });
}
