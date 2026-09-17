import { MessageCircle } from 'lucide-react';

/**
 * The way into the group people are already talking in.
 *
 * The app deliberately does not host the conversation — every society runs on
 * WhatsApp, and a second chat app is a dead tab by the second week. It holds
 * the invite link so somebody who joins in October can still find the Deepavali
 * group without anyone having to remember to forward it.
 *
 * The URL's shape is checked by the database and again by the form, because
 * this renders as something people tap.
 */
export function WhatsappGroupLink({
  url,
  label = 'Join the WhatsApp group',
  className,
}: {
  url: string | null;
  label?: string;
  className?: string;
}) {
  if (!url) return null;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={
        className ??
        'border-border-base bg-surface-raised hover:bg-surface-sunken text-ink inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors'
      }
    >
      <MessageCircle className="text-accent size-4" aria-hidden="true" />
      {label}
    </a>
  );
}
