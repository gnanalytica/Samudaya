import type { ReactNode } from 'react';

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="border-border-base flex flex-wrap items-start justify-between gap-3 border-b px-4 py-5 md:px-6">
      <div className="min-w-0">
        <h1 className="text-ink text-xl font-semibold tracking-tight">{title}</h1>
        {description ? <p className="text-ink-muted mt-1 text-sm">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function PageBody({ children }: { children: ReactNode }) {
  return <div className="px-4 py-5 md:px-6">{children}</div>;
}
