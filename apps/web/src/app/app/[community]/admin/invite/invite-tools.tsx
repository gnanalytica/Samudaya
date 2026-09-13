'use client';

import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Check, Copy, MessageCircle } from 'lucide-react';
import { residentInviteMessage, whatsappShareUrl } from '@samudaya/core';
import { buttonClass } from '@/components/ui/button';

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
export function JoinQr({ link, societyName }: { link: string; societyName: string }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    QRCode.toDataURL(link, { margin: 1, width: 240, errorCorrectionLevel: 'M' })
      .then((url) => {
        if (active) setSrc(url);
      })
      .catch(() => {
        if (active) setSrc(null);
      });
    return () => {
      active = false;
    };
  }, [link]);

  return src ? (
    // A data URL generated in the browser; next/image adds nothing for it.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={`QR code to join ${societyName} on Samudaya`}
      width={240}
      height={240}
      className="border-border-base rounded-lg border bg-white p-2"
    />
  ) : (
    <div className="border-border-base bg-surface-sunken grid size-60 place-items-center rounded-lg border">
      <span className="text-ink-subtle text-xs">Making QR code…</span>
    </div>
  );
}

export function InviteMessage({
  societyName,
  code,
  link,
}: {
  societyName: string;
  code: string;
  link: string;
}) {
  const message = residentInviteMessage({ societyName, code, link });
  return (
    <div className="space-y-3">
      <pre className="border-border-base bg-surface-sunken text-ink rounded-lg border p-4 font-sans text-sm whitespace-pre-wrap">
        {message}
      </pre>
      <div className="flex flex-wrap gap-2">
        <a
          href={whatsappShareUrl(message)}
          target="_blank"
          rel="noopener noreferrer"
          className={buttonClass('primary', 'sm')}
        >
          <MessageCircle className="size-4" aria-hidden="true" />
          Share on WhatsApp
        </a>
        <CopyButton value={message} label="Copy message" />
      </div>
    </div>
  );
}
