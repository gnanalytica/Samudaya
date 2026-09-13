import { FileText } from 'lucide-react';

/** Opens the bill when it is a link; says one is attached when it is a stored path. */
export function BillLink({ url }: { url: string | null }) {
  if (!url) return null;
  return /^https?:\/\//.test(url) ? (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="text-accent mt-1 inline-flex items-center gap-1 text-xs hover:underline"
    >
      <FileText className="size-3.5" aria-hidden="true" />
      View bill
    </a>
  ) : (
    <span className="text-ink-muted mt-1 inline-flex items-center gap-1 text-xs">
      <FileText className="size-3.5" aria-hidden="true" />
      Bill attached
    </span>
  );
}
