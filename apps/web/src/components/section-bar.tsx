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
  className,
}: {
  sections: PageSection[];
  links?: { href: string; label: string; count?: number }[];
  className?: string;
}) {
  const bar = useRef<HTMLElement>(null);
  const [current, setCurrent] = useState(sections[0]?.id ?? '');
  // The ink pill under the section being read, measured so it can slide from
  // one to the next. Until it is measured the lit link paints its own.
  const [pill, setPill] = useState<{ left: number; width: number } | null>(null);
  // Pinned just under the phone header, whatever height a touch screen gives
  // it; the header is hidden on a desktop, and the bar sits near the top.
  const [top, setTop] = useState<number | null>(null);
  const ids = sections.map((section) => section.id).join(' ');

  useEffect(() => {
    const header = document.getElementById('app-header');
    if (!header) return;
    const observer = new ResizeObserver(() => setTop(header.offsetHeight || 8));
    observer.observe(header);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const order = ids.split(' ');
    let frame = 0;
    const update = () => {
      frame = 0;
      // Whichever section has scrolled up to the bar's lower edge is the one
      // being read; at the very bottom a short last section can never get
      // there, so it wins outright.
      // A jump leaves a section a little under the bar, and a link from
      // another page (#money) leaves it at its scroll-margin; either counts.
      const first = order[0] ? document.getElementById(order[0]) : null;
      const margin = first ? parseFloat(getComputedStyle(first).scrollMarginTop) || 0 : 0;
      const edge = Math.max((bar.current?.getBoundingClientRect().bottom ?? 0) + 32, margin + 8);
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

  // Keep the lit section visible in a strip that scrolls sideways on a phone,
  // and move the pill under it.
  useEffect(() => {
    const lit = bar.current?.querySelector<HTMLElement>('[aria-current="location"]');
    if (!lit) return;
    lit.scrollIntoView({ inline: 'nearest', block: 'nearest' });
    const measure = () => setPill({ left: lit.offsetLeft, width: lit.offsetWidth });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(lit);
    return () => observer.disconnect();
  }, [current]);

  const jump = (event: MouseEvent<HTMLAnchorElement>, id: string) => {
    const target = document.getElementById(id);
    if (!target) return;
    event.preventDefault();
    // Measured rather than left to scroll-margin, so the section starts just
    // under the bar however tall it and the header above it are. Where the bar
    // will be once pinned, not where it is: from the top of the page it has
    // not pinned yet.
    const pinned = bar.current;
    const under = pinned
      ? (parseFloat(getComputedStyle(pinned).top) || 0) + pinned.offsetHeight + 12
      : 12;
    window.scrollTo({
      top: target.getBoundingClientRect().top + window.scrollY - under,
      behavior: 'smooth',
    });
    history.replaceState(null, '', `#${id}`);
  };

  return (
    <nav
      ref={bar}
      aria-label="Event sections"
      style={top === null ? undefined : { top }}
      className={cn(
        'border-border-base bg-surface-raised/95 shadow-float sticky top-16 z-20 mb-6 flex gap-0.5 overflow-x-auto rounded-2xl border p-1 text-sm backdrop-blur-xl md:top-2',
        '[scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
        className,
      )}
    >
      {pill ? (
        <span
          aria-hidden="true"
          className="bg-ink absolute top-1 bottom-1 rounded-xl transition-[left,width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
          style={{ left: pill.left, width: pill.width }}
        />
      ) : null}
      {sections.map((section) => {
        const lit = current === section.id;
        return (
          <a
            key={section.id}
            href={`#${section.id}`}
            onClick={(event) => jump(event, section.id)}
            aria-current={lit ? 'location' : undefined}
            className={cn(
              'relative flex-1 rounded-xl px-3.5 py-2 text-center whitespace-nowrap transition-colors duration-300',
              lit ? 'text-surface font-medium' : 'text-ink-muted hover:text-ink',
              lit && !pill && 'bg-ink',
            )}
          >
            {section.label}
            {section.count ? (
              <span
                className={cn(
                  'ml-1.5 rounded-full px-1.5 text-xs',
                  lit ? 'bg-surface/20 text-surface' : 'bg-accent/15 text-accent',
                )}
              >
                {section.count}
              </span>
            ) : null}
          </a>
        );
      })}
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
