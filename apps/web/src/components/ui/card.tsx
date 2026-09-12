import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function Card({
  className,
  children,
  id,
}: {
  className?: string;
  children: ReactNode;
  /** For anchor links, e.g. jumping to #suggest from the dashboard. */
  id?: string;
}) {
  return (
    <div
      id={id}
      className={cn('border-border-base bg-surface-raised rounded-xl border shadow-sm', className)}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  description,
  action,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'border-border-base flex items-start justify-between gap-4 border-b px-5 py-4',
        className,
      )}
    >
      <div className="min-w-0">
        <h2 className="text-ink text-sm font-semibold tracking-tight">{title}</h2>
        {description ? <p className="text-ink-muted mt-1 text-sm">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function CardBody({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('px-5 py-4', className)}>{children}</div>;
}
