import { FileText, ImageIcon } from 'lucide-react';
import { fileUrl, type StorageBucket } from '@/lib/storage';
import { FilePreviewButton, type PreviewKind } from './file-preview';

/** What a stored file is, from its name: a photo, a PDF, or something else. */
export function previewKindOf(path: string): PreviewKind {
  const name = path.split('?')[0] ?? path;
  if (/\.(png|jpe?g|webp|gif|avif|heic|heif)$/i.test(name)) return 'image';
  if (/\.pdf$/i.test(name)) return 'pdf';
  return 'other';
}

/**
 * Opens a stored file through a short-lived signed link. Row-level security on
 * Storage decides whether the viewer may open it, so a resident sees a bill
 * only once it is approved and a payment screenshot only if it is theirs.
 *
 * In a window over the page (FilePreviewButton), not a new tab, so whoever is
 * checking it carries on where they were.
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
    <FilePreviewButton
      href={href}
      label={label}
      title={
        bucket === 'payment-proofs'
          ? 'Payment screenshot'
          : label.replace(/^View (\w)/, (_, first: string) => first.toUpperCase())
      }
      kind={previewKindOf(path)}
      icon={bucket === 'payment-proofs' ? 'image' : 'file'}
      compact={compact}
    />
  );
}

/** A bill attached to an expense: an uploaded file or, in older rows, a link. */
export function BillLink({ url }: { url: string | null }) {
  return <StoredFileLink bucket="bills" path={url} label="View bill" />;
}
