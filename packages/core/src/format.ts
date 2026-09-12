import type { Enums } from '@samudaya/supabase';

/** `{ block: 'A', number: '101' }` → `A-101`; blockless communities → `101`. */
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
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    // An unknown currency code should not take a page down.
    return `${currency} ${value.toFixed(2)}`;
  }
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

export const REQUEST_STATUS_LABEL: Record<Enums<'request_status'>, string> = {
  open: 'Open',
  acknowledged: 'Acknowledged',
  in_progress: 'In progress',
  resolved: 'Resolved',
  closed: 'Closed',
  rejected: 'Rejected',
};

export const REQUEST_CATEGORY_LABEL: Record<Enums<'request_category'>, string> = {
  plumbing: 'Plumbing',
  electrical: 'Electrical',
  housekeeping: 'Housekeeping',
  security: 'Security',
  common_area: 'Common area',
  parking: 'Parking',
  billing: 'Billing',
  other: 'Other',
};

export const REQUEST_PRIORITY_LABEL: Record<Enums<'request_priority'>, string> = {
  low: 'Low',
  normal: 'Normal',
  high: 'High',
  urgent: 'Urgent',
};

export const VISITOR_KIND_LABEL: Record<Enums<'visitor_kind'>, string> = {
  guest: 'Guest',
  delivery: 'Delivery',
  cab: 'Cab / taxi',
  service: 'Service visit',
  staff: 'Domestic staff',
};

export const VISITOR_STATUS_LABEL: Record<Enums<'visitor_status'>, string> = {
  expected: 'Expected',
  arrived: 'Inside',
  departed: 'Left',
  denied: 'Denied',
  expired: 'Expired',
  cancelled: 'Cancelled',
};

export const INVOICE_STATUS_LABEL: Record<Enums<'invoice_status'>, string> = {
  draft: 'Draft',
  issued: 'Issued',
  partly_paid: 'Partly paid',
  paid: 'Paid',
  overdue: 'Overdue',
  void: 'Void',
};

export const AUDIENCE_LABEL: Record<Enums<'announcement_audience'>, string> = {
  all: 'Everyone',
  residents: 'Residents',
  owners: 'Owners',
  committee: 'Committee only',
  staff: 'Staff only',
};

/** Formats a ticket number the way residents see it: `SR-000123`. */
export function ticketRef(ticketNo: number | string | null | undefined): string {
  if (ticketNo === null || ticketNo === undefined) return '—';
  return `SR-${String(ticketNo).padStart(6, '0')}`;
}

export function invoiceRef(number: number | string | null | undefined): string {
  if (number === null || number === undefined) return '—';
  return `INV-${String(number).padStart(6, '0')}`;
}
