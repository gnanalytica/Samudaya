/**
 * Display helpers. Shared so a rupee total, a date or a receipt number reads
 * identically on the web, on a phone and in a WhatsApp reply.
 */

/** `{ block: 'A', number: '101' }` → `A-101`; blockless societies → `101`. */
export function unitLabel(
  unit: { block?: string | null; number?: string | null } | null | undefined,
): string {
  if (!unit?.number) return '—';
  return unit.block ? `${unit.block}-${unit.number}` : unit.number;
}

export function formatMoney(amount: number | string | null | undefined, currency = 'INR'): string {
  const value = typeof amount === 'string' ? Number.parseFloat(amount) : (amount ?? 0);
  if (Number.isNaN(value)) return '—';
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    // An unknown currency code should not take a page down.
    return `${currency} ${value.toFixed(0)}`;
  }
}

/** `2026-09-14` → `14 Sep 2026`. Accepts a date-only string without shifting it. */
export function formatDate(input: string | Date | null | undefined): string {
  if (!input) return '—';
  // A bare `2026-09-14` parses as UTC midnight, which is the previous evening
  // in the Americas. Building the date from its parts keeps it on the day the
  // committee actually picked.
  const date =
    typeof input === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input)
      ? new Date(
          Number(input.slice(0, 4)),
          Number(input.slice(5, 7)) - 1,
          Number(input.slice(8, 10)),
        )
      : new Date(input);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** "in 3 days" / "tomorrow" / "today" — for an event that has not happened yet. */
export function countdown(input: string | null | undefined, now = new Date()): string {
  if (!input) return '';
  const target = new Date(`${input}T00:00:00`);
  if (Number.isNaN(target.getTime())) return '';
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const days = Math.round((target.getTime() - startOfToday.getTime()) / 86_400_000);
  if (days === 0) return 'today';
  if (days === 1) return 'tomorrow';
  if (days === -1) return 'yesterday';
  if (days > 1 && days <= 60) return `in ${days} days`;
  if (days < -1 && days >= -60) return `${Math.abs(days)} days ago`;
  return '';
}

/** "just now" / "3 h ago" / "12 Mar" — compact enough for a list row. */
export function relativeTime(input: string | Date | null | undefined, now = new Date()): string {
  if (!input) return '';
  const date = typeof input === 'string' ? new Date(input) : input;
  if (Number.isNaN(date.getTime())) return '';

  const seconds = Math.round((now.getTime() - date.getTime()) / 1000);
  if (seconds < 45) return 'just now';
  if (seconds < 90) return 'a minute ago';

  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;

  const days = Math.round(hours / 24);
  if (days < 7) return `${days} d ago`;

  const sameYear = date.getFullYear() === now.getFullYear();
  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
}

/** The receipt number a contributor quotes: `GAN-2026-00042`. */
export function receiptRef(
  eventSlug: string | null | undefined,
  receiptNo: number | string | null | undefined,
): string {
  if (receiptNo === null || receiptNo === undefined) return '—';
  const prefix = (eventSlug ?? 'evt')
    .replace(/[^a-z0-9]+/gi, '-')
    .toUpperCase()
    .slice(0, 12);
  return `${prefix}-${String(receiptNo).padStart(5, '0')}`;
}

/** Formats a list the way a sentence would: "A, B and C". */
export function listSentence(items: string[]): string {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0]!;
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

/**
 * Today's date as `YYYY-MM-DD` in a society's time zone. Servers run on UTC,
 * where "today" is still yesterday in India until 05:30, so date comparisons
 * (upcoming vs past, default bill dates) must use the society's clock.
 */
export function todayIn(
  timeZone: string | null | undefined = 'Asia/Kolkata',
  now = new Date(),
): string {
  try {
    // en-CA formats as YYYY-MM-DD.
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: timeZone || 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(now);
  } catch {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(now);
  }
}
