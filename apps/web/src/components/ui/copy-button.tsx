'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { buttonClass } from '@/components/ui/button';

/** Copies a code or a link, and says so for two seconds. */
export function CopyButton({ value, label = 'Copy' }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          // Clipboard access can be refused; the value is on screen to copy by hand.
        }
      }}
      className={buttonClass('secondary', 'sm')}
    >
      {copied ? (
        <>
          <Check className="text-success size-4" aria-hidden="true" />
          Copied
        </>
      ) : (
        <>
          <Copy className="size-4" aria-hidden="true" />
          {label}
        </>
      )}
    </button>
  );
}

/** The join link as a QR code, for a printed notice or a phone held up at a meeting. */
