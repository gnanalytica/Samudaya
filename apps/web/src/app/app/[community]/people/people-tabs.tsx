import Link from 'next/link';
import { cn } from '@/lib/utils';

/**
 * Everyone in the society, and the people asking to be. Two views of the same
 * subject, so they sit under one page rather than in two corners of the app.
 * Residents only ever see the first tab — there is nothing for them to review.
 */
export function PeopleTabs({
  slug,
  active,
  pending,
  canReview,
}: {
  slug: string;
  active: 'members' | 'requests';
  /** Unreviewed join requests, shown as a count on the tab. */
  pending?: number;
  canReview: boolean;
}) {
  if (!canReview) return null;

  const tab = (href: string, label: string, on: boolean, count?: number) => (
    <Link
      href={href}
      aria-current={on ? 'page' : undefined}
      className={cn(
        'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
        on
          ? 'bg-surface-raised text-ink border-border-base border shadow-sm'
          : 'text-ink-muted hover:text-ink',
      )}
    >
      {label}
      {count ? (
        <span className="bg-accent text-accent-ink ml-2 rounded-full px-1.5 py-0.5 text-xs">
          {count}
        </span>
      ) : null}
    </Link>
  );

  return (
    <div className="bg-surface-sunken mb-5 inline-flex gap-1 rounded-xl p-1">
      {tab(`/app/${slug}/people`, 'Members', active === 'members')}
      {tab(`/app/${slug}/people/requests`, 'Requests', active === 'requests', pending)}
    </div>
  );
}
