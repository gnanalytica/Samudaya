import { FileText, ImageIcon } from 'lucide-react';
import { fileUrl, type StorageBucket } from '@/lib/storage';

/**
 * Opens a stored file through a short-lived signed link. Row-level security on
 * Storage decides whether the viewer may open it, so a resident sees a bill
 * only once it is approved and a payment screenshot only if it is theirs.
 */
export async function StoredFileLink({
  bucket,
  path,
  label,
}: {
  bucket: StorageBucket;
  path: string | null | undefined;
  label: string;
}) {
  if (!path) return null;
  const href = await fileUrl(bucket, path);
  const Icon = bucket === 'payment-proofs' ? ImageIcon : FileText;

  if (!href) {
    return (
      <span className="text-ink-subtle mt-1 inline-flex items-center gap-1 text-xs">
        <Icon className="size-3.5" aria-hidden="true" />
        {bucket === 'bills' ? 'Bill not available' : 'Screenshot not available'}
      </span>
    );
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="text-accent mt-1 inline-flex items-center gap-1 text-xs hover:underline"
    >
      <Icon className="size-3.5" aria-hidden="true" />
      {label}
    </a>
  );
}

/** A bill attached to an expense: an uploaded file or, in older rows, a link. */
export function BillLink({ url }: { url: string | null }) {
  return <StoredFileLink bucket="bills" path={url} label="View bill" />;
}
