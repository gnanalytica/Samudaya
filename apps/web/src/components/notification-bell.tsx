import Link from 'next/link';
import { Bell } from 'lucide-react';
import { cn } from '@/lib/utils';

/** The bell with an unread badge; the count comes from the community layout. */
export function NotificationBell({
  slug,
  unread,
  className,
  showLabel = false,
}: {
  slug: string;
  unread: number;
  className?: string;
  showLabel?: boolean;
}) {
  const label = unread ? `Notifications, ${unread} unread` : 'Notifications';
  return (
    <Link
      href={`/app/${slug}/notifications`}
      aria-label={showLabel ? undefined : label}
      className={cn(
        'text-ink-muted hover:bg-surface-sunken hover:text-ink relative flex items-center gap-2.5 rounded-lg',
        className,
      )}
    >
      <span className="relative">
        <Bell className="size-4" aria-hidden="true" />
        {unread ? (
          <span className="bg-danger absolute -top-1.5 -right-2 min-w-4 rounded-full px-1 text-center text-[10px] leading-4 font-semibold text-white">
            {unread > 99 ? '99+' : unread}
          </span>
        ) : null}
      </span>
      {showLabel ? (
        <span className="text-sm">
          Notifications
          {unread ? <span className="sr-only">, {unread} unread</span> : null}
        </span>
      ) : null}
    </Link>
  );
}
