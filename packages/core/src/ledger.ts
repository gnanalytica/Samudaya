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
  /**
   * Null for the society balance's own rows. Kept when an event's name is
   * withheld from the reader (a draft), so such a row is never mistaken for
   * one of the society balance's.
   */
  event_id?: string | null;
  /** payment, bill, society_spending or transfer. Absent on older reads. */
  kind?: string | null;
};

/**
 * The event filter's value for the society balance's own ledger: its spending,
 * and money moved into or out of it. Event slugs are lowercase letters, digits
 * and hyphens, so this can never be one.
 */
export const SOCIETY_BALANCE_LEDGER = '_society';

/** The direction filter from a query string. Anything unknown means everything. */
export function ledgerFilterFrom(value: unknown): LedgerFilter {
  return LEDGER_FILTERS.find((option) => option.value === value)?.value ?? 'all';
}

/**
 * One side of money the committee moved: out of a closed event or the society
 * balance, into another event or the society balance.
 */
export function isTransfer(row: Pick<LedgerRow, 'kind'>): boolean {
  return row.kind === 'transfer';
}

/** A row of the society balance's own ledger rather than an event's. */
export function isSocietyBalanceRow(row: LedgerRow): boolean {
  return !row.event_slug && (row.event_id ?? null) === null;
}

/**
 * The ledger narrowed by direction and by whose money it is.
 *
 * An event's ledger is everything that moved in or out of that event — the
 * money the committee carried in or handed on when it closed as well as
 * payments and bills — so its rows add up to what the event holds. The same
 * goes for the society balance's. Society-wide, the two sides of a movement
 * cancel and say nothing about money collected or spent, so they are left to
 * the ledgers they belong to (and the Money page's list of where money moved).
 */
export function filterLedger<T extends LedgerRow>(
  rows: T[],
  direction: LedgerFilter,
  eventSlug: string,
): T[] {
  return rows.filter((row) => {
    if (direction !== 'all' && row.direction !== direction) return false;
    if (eventSlug === SOCIETY_BALANCE_LEDGER) return isSocietyBalanceRow(row);
    if (eventSlug) return row.event_slug === eventSlug;
    return !isTransfer(row);
  });
}

/**
 * Whose ledger the filter can show: the society balance's when it has any rows,
 * then every event that has, by name.
 */
export function ledgerScopes(
  rows: (LedgerRow & { event_name?: string | null })[],
): { value: string; label: string }[] {
  const events = new Map<string, string>();
  let society = false;
  for (const row of rows) {
    if (row.event_slug) events.set(row.event_slug, row.event_name ?? row.event_slug);
    else if (isSocietyBalanceRow(row)) society = true;
  }
  return [
    ...(society ? [{ value: SOCIETY_BALANCE_LEDGER, label: 'Society balance' }] : []),
    ...[...events.entries()]
      .sort((a, b) => a[1].localeCompare(b[1]))
      .map(([value, label]) => ({ value, label })),
  ];
}

/**
 * What a narrowed ledger adds up to. For one event, `left` is what the event
 * holds; for the society balance, what the society is keeping.
 */
export function ledgerTotals(rows: { amount: number | string | null }[]): {
  in: number;
  out: number;
  left: number;
} {
  let moneyIn = 0;
  let moneyOut = 0;
  for (const row of rows) {
    const amount = Number(row.amount ?? 0);
    if (amount >= 0) moneyIn += amount;
    else moneyOut -= amount;
  }
  return { in: moneyIn, out: moneyOut, left: moneyIn - moneyOut };
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
  if (row.direction !== 'in' || isTransfer(row)) return null;
  const unit = row.unit_label ?? null;
  if (unit) return unit === ledgerTitle(row) ? null : { label: unit, known: true };
  // Only worth saying beside a name. A sponsor's payment is titled by how the
  // money arrived and has no door behind it to be missing.
  return row.payer_name ? { label: 'Flat not recorded', known: false } : null;
}

/**
 * Money the society spent from its own balance rather than an event's: a
 * repair, damage. It has no event, and says so instead of leaving a gap.
 */
export function isSocietySpending(row: LedgerEntry): boolean {
  if (row.kind) return row.kind === 'society_spending';
  return row.direction === 'out' && !row.event_slug;
}

/**
 * What goes under the name. How the money arrived for a payment, what the
 * money was for on a bill — `detail` carries the category out, and the flat
 * and method it used to carry in are their own fields now. A movement says
 * what the committee did: carried forward, kept for the society, paid back.
 */
export function ledgerMeta(row: LedgerEntry): string | null {
  if (isTransfer(row)) return row.detail ?? null;
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
  // A pay-back's screenshot of the transfer, which every member may open.
  if (isTransfer(row)) {
    return { bucket: 'bills', label: 'View screenshot', path: row.document_url };
  }
  return row.direction === 'in'
    ? { bucket: 'payment-proofs', label: 'View screenshot', path: row.document_url }
    : { bucket: 'bills', label: 'View bill', path: row.document_url };
}
