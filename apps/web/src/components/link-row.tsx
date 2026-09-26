import type { CSSProperties, ReactNode } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

/** A tappable row: an icon on its tile, a line and a detail, and an arrow. */
export function LinkRow({
  href,
  icon,
  title,
  detail,
  tone = 'accent',
  index = 0,
}: {
  href: string;
  icon: ReactNode;
  title: ReactNode;
  detail?: ReactNode;
  tone?: 'accent' | 'warning';
  index?: number;
}) {
  return (
    <Link
      href={href}
      style={{ '--i': index } as CSSProperties}
      className="rise-in pressable border-border-base bg-surface-raised shadow-card hover:border-border-strong flex items-center gap-3 rounded-2xl border p-3.5 transition-colors"
    >
      <span
        aria-hidden="true"
        className={cn(
          'grid size-10 shrink-0 place-items-center rounded-xl',
          tone === 'warning'
            ? 'bg-warning/12 text-warning'
            : 'text-accent bg-[var(--festival-wash)]',
        )}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="text-ink block text-sm font-medium">{title}</span>
        {detail ? <span className="text-ink-muted mt-0.5 block text-xs">{detail}</span> : null}
      </span>
      <ArrowRight className="text-ink-subtle size-4 shrink-0" aria-hidden="true" />
    </Link>
  );
}
