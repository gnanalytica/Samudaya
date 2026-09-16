'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { MemberRole } from '@samudaya/core';
import { cn } from '@/lib/utils';
import { bottomNavItems, visibleNav, type NavItem } from './nav-items';

export type NavCounts = { todo?: number };

/** A nav link is active on its exact route, or on any child of a section root. */
function useIsActive(slug: string) {
  const pathname = usePathname();
  const roots = new Set([`/app/${slug}`, `/app/${slug}/admin`]);
  return (href: string) => {
    if (pathname === href) return true;
    if (!pathname.startsWith(`${href}/`)) return false;
    // Home and the events console own their exact page, not everything below
    // them, so /admin/units does not light up "Events" as well. People is not a
    // root, so its Requests tab keeps the People item lit.
    if (!roots.has(href)) return true;
    return href === `/app/${slug}/admin` && pathname.startsWith(`${href}/events`);
  };
}

function Count({ item, counts }: { item: NavItem; counts: NavCounts }) {
  const value = item.badge ? (counts[item.badge] ?? 0) : 0;
  if (!value) return null;
  return (
    <span className="bg-warning/20 text-warning ml-auto rounded-full px-1.5 text-xs font-semibold">
      {value > 99 ? '99+' : value}
      <span className="sr-only"> waiting</span>
    </span>
  );
}

export function SidebarNav({
  slug,
  role,
  counts = {},
}: {
  slug: string;
  role: MemberRole;
  counts?: NavCounts;
}) {
  const isActive = useIsActive(slug);
  const groups = visibleNav(slug, role);

  return (
    <nav aria-label="Main" className="space-y-6">
      {groups.map((group, index) => (
        <div key={group.section || `group-${index}`}>
          {group.section ? (
            <p className="text-ink-subtle mb-1.5 px-3 text-xs font-medium tracking-wide uppercase">
              {group.section}
            </p>
          ) : null}
          <ul className="space-y-0.5">
            {group.items.map((item) => {
              const { href, label, icon: Icon } = item;
              const active = isActive(href);
              return (
                <li key={href}>
                  <Link
                    href={href}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors',
                      active
                        ? 'bg-surface-sunken text-ink font-medium'
                        : 'text-ink-muted hover:bg-surface-sunken hover:text-ink',
                    )}
                  >
                    <Icon className="size-4 shrink-0" aria-hidden="true" />
                    {label}
                    <Count item={item} counts={counts} />
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

/** Compact bar for phones — the handful of things a member opens daily. */
export function BottomNav({
  slug,
  role,
  counts = {},
}: {
  slug: string;
  role: MemberRole;
  counts?: NavCounts;
}) {
  const isActive = useIsActive(slug);
  const items = bottomNavItems(slug, role);

  return (
    <nav
      aria-label="Main"
      className="border-border-base bg-surface-raised/95 fixed inset-x-0 bottom-0 z-40 border-t backdrop-blur md:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <ul className="grid auto-cols-fr grid-flow-col">
        {items.map((item) => {
          const { href, label, shortLabel, icon: Icon } = item;
          const active = isActive(href);
          const count = item.badge ? (counts[item.badge] ?? 0) : 0;
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'relative flex flex-col items-center gap-0.5 py-2.5 text-[11px]',
                  active ? 'text-accent' : 'text-ink-subtle',
                )}
              >
                <span className="relative">
                  <Icon className="size-5" aria-hidden="true" />
                  {count ? (
                    <span className="bg-warning absolute -top-1.5 -right-2.5 min-w-4 rounded-full px-1 text-center text-[10px] leading-4 font-semibold text-white">
                      {count > 99 ? '99+' : count}
                      <span className="sr-only"> waiting</span>
                    </span>
                  ) : null}
                </span>
                {shortLabel ?? label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
