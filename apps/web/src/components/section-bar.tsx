'use client';

import { useEffect, useRef, useState, type MouseEvent } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

export type PageSection = { id: string; label: string; count?: number };

/**
 * The event page reads top to bottom, and this bar stays pinned while it does:
 * a tap jumps to a section, and the section being read stays lit. As tabs,
 * About was all most residents ever saw; Activities and Money sat behind taps
 * they never made.
 *
 * Links with `?tab=money` still land on their section, because the WhatsApp
 * bot has sent a great many of them. Organisers' pages follow the sections as
 * plain links, after a hairline, as they did in the tab strip.
 */
export function SectionBar({
  sections,
  links = [],
}: {
  sections: PageSection[];
  links?: { href: string; label: string; count?: number }[];
}) {
  const bar = useRef<HTMLElement>(null);
  const [current, setCurrent] = useState(sections[0]?.id ?? '');
  const ids = sections.map((section) => section.id).join(' ');

  useEffect(() => {
    const order = ids.split(' ');
    let frame = 0;
    const update = () => {
      frame = 0;
      // Whichever section has scrolled up to the bar's lower edge is the one
      // being read; at the very bottom a short last section can never get
      // there, so it wins outright.
      // A jump leaves the section a scroll-margin below the bar, so allow that.
      const edge = (bar.current?.getBoundingClientRect().bottom ?? 0) + 32;
      const atBottom =
        window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;
      let next = order[0] ?? '';
      for (const id of order) {
        const top = document.getElementById(id)?.getBoundingClientRect().top;
        if (top !== undefined && top <= edge) next = id;
      }
      setCurrent(atBottom ? (order.at(-1) ?? next) : next);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };

    const asked = new URLSearchParams(window.location.search).get('tab');
    if (asked && !window.location.hash && order.includes(asked)) {
      document.getElementById(asked)?.scrollIntoView();
    }
    schedule();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    return () => {
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      cancelAnimationFrame(frame);
    };
  }, [ids]);

  // Keep the lit section visible in a strip that scrolls sideways on a phone.
  useEffect(() => {
    bar.current
      ?.querySelector('[aria-current="location"]')
      ?.scrollIntoView({ inline: 'nearest', block: 'nearest' });
  }, [current]);

  const jump = (event: MouseEvent<HTMLAnchorElement>, id: string) => {
    const target = document.getElementById(id);
    if (!target) return;
    event.preventDefault();
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    history.replaceState(null, '', `#${id}`);
  };

  return (
    <nav
      ref={bar}
      aria-label="Event sections"
      // Under the phone header, which is itself pinned; at the top on a desktop.
      className="border-border-base bg-surface-raised sticky top-14 z-20 mb-5 flex gap-1 overflow-x-auto rounded-lg border p-1 text-sm shadow-sm md:top-2"
    >
      {sections.map((section) => (
        <a
          key={section.id}
          href={`#${section.id}`}
          onClick={(event) => jump(event, section.id)}
          aria-current={current === section.id ? 'location' : undefined}
          className={cn(
            'rounded-md px-3 py-1.5 whitespace-nowrap',
            current === section.id
              ? 'bg-surface-sunken text-ink font-medium'
              : 'text-ink-muted hover:text-ink',
          )}
        >
          {section.label}
          {section.count ? (
            <span className="bg-accent/15 text-accent ml-1.5 rounded-full px-1.5 text-xs">
              {section.count}
            </span>
          ) : null}
        </a>
      ))}
      {links.length ? (
        <>
          <span className="bg-border-base mx-1 h-5 w-px shrink-0 self-center" aria-hidden="true" />
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-ink-muted hover:text-ink rounded-md px-3 py-1.5 whitespace-nowrap"
            >
              {link.label}
              {link.count ? (
                <span className="bg-warning/20 text-warning ml-1.5 rounded-full px-1.5 text-xs">
                  {link.count}
                </span>
              ) : null}
            </Link>
          ))}
        </>
      ) : null}
    </nav>
  );
}
