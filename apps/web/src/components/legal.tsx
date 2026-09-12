import type { ReactNode } from 'react';
import { LEGAL } from '@/lib/legal';

/**
 * Building blocks for the long-form legal pages. The app has no typography
 * plugin, so spacing and list styles are set here once rather than repeated
 * on every paragraph.
 */

export function LegalDocument({
  title,
  intro,
  sections,
  children,
}: {
  title: string;
  intro: ReactNode;
  sections: { id: string; title: string }[];
  children: ReactNode;
}) {
  return (
    <article>
      <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">{title}</h1>
      <p className="text-ink-subtle mt-2 text-sm">Last updated {LEGAL.effectiveDate}</p>
      <div className="text-ink-muted mt-6 space-y-4 text-base text-pretty">{intro}</div>

      <nav
        aria-label="On this page"
        className="border-border-base bg-surface-sunken mt-8 rounded-xl border p-5"
      >
        <p className="text-sm font-semibold tracking-tight">On this page</p>
        <ol className="text-ink-muted mt-3 grid list-decimal gap-x-8 gap-y-1.5 pl-5 text-sm sm:grid-cols-2">
          {sections.map((section) => (
            <li key={section.id}>
              <a
                href={`#${section.id}`}
                className="hover:text-ink underline-offset-4 hover:underline"
              >
                {section.title}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <div className="mt-10 space-y-10">{children}</div>
    </article>
  );
}

export function LegalSection({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-6">
      <h2 className="text-xl font-semibold tracking-tight">
        <a href={`#${id}`} className="hover:underline hover:underline-offset-4">
          {title}
        </a>
      </h2>
      <div className="text-ink-muted mt-3 space-y-3 text-base text-pretty">{children}</div>
    </section>
  );
}

export function LegalList({ children }: { children: ReactNode }) {
  return <ul className="list-disc space-y-1.5 pl-5">{children}</ul>;
}

export function Strong({ children }: { children: ReactNode }) {
  return <strong className="text-ink font-medium">{children}</strong>;
}

export function ContactLink() {
  return (
    <a href={`mailto:${LEGAL.contactEmail}`} className="text-accent underline underline-offset-4">
      {LEGAL.contactEmail}
    </a>
  );
}
