import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * A section's name in small gold capitals, with a hairline running off to its
 * right: how a printed programme sets out its parts, and quieter than a bold
 * heading over every card.
 */
export function SectionLabel({
  children,
  as: Tag = 'h2',
  id,
  className,
}: {
  children: ReactNode;
  as?: 'h2' | 'h3' | 'p';
  id?: string;
  className?: string;
}) {
  return (
    <Tag
      id={id}
      className={cn(
        'text-gold flex items-center gap-3 text-[11px] font-semibold tracking-[0.14em] uppercase',
        'after:from-border-base after:h-px after:flex-1 after:bg-gradient-to-r after:to-transparent',
        className,
      )}
    >
      {children}
    </Tag>
  );
}
