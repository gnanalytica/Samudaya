/**
 * Narrowing the society ledger, in one place and without a database round trip.
 *
 * The ledger is bounded (500 rows, newest first) and already in memory, so
 * filtering it here keeps the page a single read and lets the filters live in a
 * GET form — which means a filtered ledger is a URL somebody can send to the
 * neighbour who is asking where the money went.
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
