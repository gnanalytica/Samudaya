import Link from 'next/link';
import { ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import {
  formatDate,
  formatMoney,
  ledgerEvidence,
  ledgerMeta,
  ledgerTitle,
  ledgerUnit,
  relativeTime,
  type LedgerEntry,
} from '@samudaya/core';
import { StoredFileLink } from '@/components/bill-link';

/** What the Money page reads off one row of society_ledger. */
export type LedgerRowData = LedgerEntry & {
  id: string | null;
  amount: number | string | null;
  happened_at: string | null;
  confirmed_by: string | null;
  confirmed_at: string | null;
  event_name: string | null;
};

/**
 * One line of the society's money: who, which flat, how, and the evidence.
 *
 * It used to say only one of the first two. The view built a single field out
 * of coalesce(name, flat, method), so which one a row showed depended on how
 * the payment happened to be recorded — a resident reporting their own payment
 * gave a name and no flat, staff recording cash gave a flat and no name, and
 * the list read as three different lists interleaved. The view emits the parts
 * separately now and this puts them back together the same way every time.
 *
 * Green for money in, ink for money out, with the sign carrying the direction
 * too: colour alone is the pair that fails exactly the people who cannot
 * separate the two.
 */
export function LedgerRow({
  row,
  slug,
  currency,
}: {
  row: LedgerRowData;
  slug: string;
  currency: string;
}) {
  const incoming = row.direction === 'in';
  const unit = ledgerUnit(row);
  const evidence = ledgerEvidence(row);

  return (
    <li className="flex items-start justify-between gap-3 px-5 py-3">
      <div className="flex min-w-0 gap-3">
        <span
          className={
            incoming
              ? 'bg-success/10 text-success mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full'
              : 'bg-warning/10 text-warning mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full'
          }
          aria-hidden="true"
        >
          {incoming ? <ArrowDownLeft className="size-4" /> : <ArrowUpRight className="size-4" />}
        </span>
        <div className="min-w-0">
          {/* Name and flat together. The flat is a chip rather than more of the
              same sentence, because "which flat" is what a neighbour scans the
              list for and a run-on line is the worst place to hide an answer. */}
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-ink text-sm font-medium break-words">
              {ledgerTitle(row)}
              <span className="sr-only">
                {incoming ? ' paid the society' : ' was paid by the society'}
              </span>
            </span>
            {unit ? (
              <span className="bg-surface-sunken text-ink-muted shrink-0 rounded-md px-1.5 py-0.5 text-xs font-medium">
                {unit}
              </span>
            ) : null}
          </p>
          <p className="text-ink-subtle mt-0.5 text-xs">
            {[ledgerMeta(row), row.happened_at ? formatDate(row.happened_at.slice(0, 10)) : null]
              .filter(Boolean)
              .join(' · ')}
            {row.event_slug ? (
              <>
                {' · '}
                <Link
                  href={`/app/${slug}/events/${row.event_slug}?tab=money`}
                  className="hover:text-ink underline underline-offset-2"
                >
                  {row.event_name}
                </Link>
              </>
            ) : null}
          </p>
          {row.confirmed_at ? (
            <p className="text-ink-subtle mt-0.5 text-xs">
              {incoming ? 'Confirmed' : 'Approved'} by {row.confirmed_by ?? 'the society'} ·{' '}
              {relativeTime(row.confirmed_at)}
            </p>
          ) : null}
          {/* Every row that has evidence offers it: the bill for money out, the
              payer's screenshot for money in. The view hands a screenshot only
              to the payer and to staff, so a neighbour gets no button rather
              than one that fails when tapped. */}
          {evidence ? (
            <StoredFileLink bucket={evidence.bucket} path={evidence.path} label={evidence.label} />
          ) : null}
        </div>
      </div>
      <span
        className={
          incoming
            ? 'text-success shrink-0 text-sm font-semibold'
            : 'text-ink shrink-0 text-sm font-semibold'
        }
      >
        {incoming ? '+' : '−'}
        {formatMoney(Math.abs(Number(row.amount)), currency)}
      </span>
    </li>
  );
}
