'use client';

import { useRef, useState } from 'react';
import { ExternalLink, FileText, ImageIcon, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export type PreviewKind = 'image' | 'pdf' | 'other';

/**
 * The bill or the screenshot, in a window over the page rather than a new tab:
 * somebody checking a payment or reading the ledger looks at the evidence and
 * carries on where they were. The file is only fetched when the window opens.
 *
 * A native <dialog>, so Escape closes it, focus stays inside while it is open
 * and goes back to the button after, and the page behind cannot be clicked.
 * Opening it in a new tab is still one tap away, for a PDF a phone will not
 * draw inline or a file somebody wants to download.
 */
export function FilePreviewButton({
  href,
  label,
  title,
  kind,
  icon,
  compact = false,
}: {
  href: string;
  label: string;
  /** What the window is called: "Bill", "Payment screenshot". */
  title: string;
  kind: PreviewKind;
  icon: 'image' | 'file';
  compact?: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const [failed, setFailed] = useState(false);
  const Icon = icon === 'image' ? ImageIcon : FileText;

  const show = () => {
    setFailed(false);
    setOpen(true);
    dialog.current?.showModal();
  };

  return (
    <>
      <button
        type="button"
        onClick={show}
        aria-haspopup="dialog"
        className={
          compact
            ? 'border-border-base bg-surface-raised text-ink hover:bg-surface-sunken inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors pointer-coarse:min-h-11'
            : 'border-border-base bg-surface-raised text-ink hover:bg-surface-sunken mt-2 inline-flex w-full items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-semibold transition-colors sm:w-auto pointer-coarse:min-h-11'
        }
      >
        <Icon className={compact ? 'size-3.5' : 'size-4'} aria-hidden="true" />
        {label}
      </button>
      <dialog
        ref={dialog}
        aria-label={title}
        onClose={() => setOpen(false)}
        // A click on the dimmed backdrop lands on the dialog element itself.
        onClick={(event) => {
          if (event.target === dialog.current) dialog.current?.close();
        }}
        className="bg-surface-raised text-ink border-border-base m-auto w-[calc(100%-2rem)] max-w-3xl overflow-hidden rounded-2xl border p-0 shadow-xl backdrop:bg-black/60 backdrop:backdrop-blur-sm"
      >
        <div className="border-border-base flex items-center justify-between gap-3 border-b px-4 py-3">
          <p className="text-sm font-semibold">{title}</p>
          <div className="flex items-center gap-1">
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              className="text-ink-muted hover:text-ink hover:bg-surface-sunken inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium"
            >
              <ExternalLink className="size-3.5" aria-hidden="true" />
              Open in a new tab
            </a>
            <button
              type="button"
              onClick={() => dialog.current?.close()}
              aria-label="Close"
              className="text-ink-muted hover:text-ink hover:bg-surface-sunken rounded-lg p-1.5"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          </div>
        </div>
        <div className="bg-surface-sunken flex min-h-48 items-center justify-center">
          {!open ? null : failed ? (
            <p className="text-ink-muted p-6 text-center text-sm">
              This could not be shown here. The link may have expired: reload the page, or open it
              in a new tab.
            </p>
          ) : kind === 'image' ? (
            // A signed, short-lived link to a private file: next/image would
            // try to cache and resize it, which is the opposite of what it is.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={href}
              alt={title}
              onError={() => setFailed(true)}
              className="max-h-[75vh] w-auto max-w-full object-contain"
            />
          ) : (
            <iframe src={href} title={title} className={cn('h-[75vh] w-full border-0 bg-white')} />
          )}
        </div>
      </dialog>
    </>
  );
}
