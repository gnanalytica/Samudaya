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

// ---------------------------------------------------------------------------
// Reading one row
// ---------------------------------------------------------------------------
/**
 * A ledger row's parts, as the view now hands them over.
 *
 * The view used to compose a sentence: one `counterpart` built out of
 * coalesce(name, flat, method), and a `detail` that carefully avoided
 * repeating whichever of those the headline had used. So a row could say the
 * name or the flat, never both, and which one you got depended on how the
 * payment happened to be recorded. It emits facts now and the screens put
 * them together — here, once, rather than twice and differently.
 */
export type LedgerEntry = LedgerRow & {
  counterpart: string | null;
  detail: string | null;
  payer_name?: string | null;
  unit_label?: string | null;
  method?: string | null;
  document_url?: string | null;
};

/** Who the row is about: the payer where there is one, the vendor otherwise. */
export function ledgerTitle(row: LedgerEntry): string {
  return row.payer_name ?? row.counterpart ?? 'Not recorded';
}

/** The flat beside the name, and whether the society actually knows it. */
export type LedgerFlat = { label: string; known: boolean };

/**
 * The flat, for the chip beside the name — and only when it is telling you
 * something the name did not. A cash payment against a door with nobody
 * living there is titled by its flat already, and printing it twice reads
 * like a bug.
 *
 * A row that names a person and no flat gets a chip too, saying so. That gap
 * is real: a member nobody has listed at a door pays, and the payment carries
 * a name and nothing else. Left blank it is indistinguishable from the app
 * having dropped the flat — which is exactly how it was read the first time
 * somebody scrolled past one — so the row admits it instead, and the
 * committee can see from the ledger which flats are still missing.
 *
 * Money out is paid to a vendor, not by a flat, so it gets nothing.
 */
export function ledgerFlat(row: LedgerEntry): LedgerFlat | null {
  if (row.direction !== 'in') return null;
  const unit = row.unit_label ?? null;
  if (unit) return unit === ledgerTitle(row) ? null : { label: unit, known: true };
  // Only worth saying beside a name. A sponsor's payment is titled by how the
  // money arrived and has no door behind it to be missing.
  return row.payer_name ? { label: 'Flat not recorded', known: false } : null;
}

/**
 * What goes under the name. How the money arrived for a payment, what the
 * money was for on a bill — `detail` carries the category out, and the flat
 * and method it used to carry in are their own fields now.
 */
export function ledgerMeta(row: LedgerEntry): string | null {
  return (row.direction === 'in' ? (row.method ?? null) : row.detail) ?? null;
}

/**
 * The evidence behind the row, and which bucket it lives in.
 *
 * Money out is a bill the whole society may open: it is the society's money,
 * spent by people the society elected. Money in is the payer's screenshot,
 * which the view hands only to them and to staff — so a null here is a row
 * whose evidence is not this viewer's to see, and the button simply does not
 * appear rather than appearing and failing.
 */
export function ledgerEvidence(
  row: LedgerEntry,
): { bucket: 'bills' | 'payment-proofs'; label: string; path: string } | null {
  if (!row.document_url) return null;
  return row.direction === 'in'
    ? { bucket: 'payment-proofs', label: 'View screenshot', path: row.document_url }
    : { bucket: 'bills', label: 'View bill', path: row.document_url };
}
