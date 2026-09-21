import { FileText, ImageIcon } from 'lucide-react';
import { fileUrl, type StorageBucket } from '@/lib/storage';

/**
 * Opens a stored file through a short-lived signed link. Row-level security on
 * Storage decides whether the viewer may open it, so a resident sees a bill
 * only once it is approved and a payment screenshot only if it is theirs.
 *
 * A button rather than the small text link this used to be. The picture is the
 * evidence — what a committee member checks a payment against, and what a
 * resident opens to see the bill behind a line in the ledger — so it is sized
 * like the thing somebody came to the card to do. Inside a table, where the row
 * is already the unit of information, `compact` keeps it to one cell.
 */
export async function StoredFileLink({
  bucket,
  path,
  label,
  compact = false,
}: {
  bucket: StorageBucket;
  path: string | null | undefined;
  label: string;
  compact?: boolean;
}) {
  if (!path) return null;
  const href = await fileUrl(bucket, path);
  const Icon = bucket === 'payment-proofs' ? ImageIcon : FileText;

  if (!href) {
    return (
      <span
        className={
          compact
            ? 'text-ink-subtle inline-flex items-center gap-1.5 text-xs'
            : 'text-ink-subtle mt-2 inline-flex items-center gap-1.5 text-sm'
        }
      >
        <Icon className={compact ? 'size-3.5' : 'size-4'} aria-hidden="true" />
        {bucket === 'bills' ? 'Bill not available' : 'Screenshot not available'}
      </span>
    );
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className={
        compact
          ? 'border-border-base bg-surface-raised text-ink hover:bg-surface-sunken inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors pointer-coarse:min-h-11'
          : 'border-border-base bg-surface-raised text-ink hover:bg-surface-sunken mt-2 inline-flex w-full items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-semibold transition-colors sm:w-auto pointer-coarse:min-h-11'
      }
    >
      <Icon className={compact ? 'size-3.5' : 'size-4'} aria-hidden="true" />
      {label}
    </a>
  );
}

/** A bill attached to an expense: an uploaded file or, in older rows, a link. */
export function BillLink({ url }: { url: string | null }) {
  return <StoredFileLink bucket="bills" path={url} label="View bill" />;
}
