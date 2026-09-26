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
    <div className="flex flex-wrap items-end justify-between gap-3 px-4 pt-6 pb-2 md:px-6 md:pt-8">
      <div className="min-w-0">
        <h1 className="text-ink font-serif text-[28px] leading-tight font-medium tracking-tight md:text-3xl">
          {title}
        </h1>
        {description ? <p className="text-ink-muted mt-1 text-sm">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function PageBody({ children }: { children: ReactNode }) {
  return <div className="px-4 py-5 md:px-6">{children}</div>;
}
