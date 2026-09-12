'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { MemberRole } from '@samudaya/core';
import { cn } from '@/lib/utils';
import { visibleNav } from './nav-items';

/** A nav link is active on its exact route, or on any child of a section root. */
function useIsActive() {
  const pathname = usePathname();
  return (href: string, isHome: boolean) =>
    isHome ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

export function SidebarNav({ slug, role }: { slug: string; role: MemberRole }) {
  const isActive = useIsActive();
  const groups = visibleNav(slug, role);
  const home = `/app/${slug}`;

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
            {group.items.map(({ href, label, icon: Icon }) => {
              const active = isActive(href, href === home);
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

/** Compact bar for phones — the handful of things a resident opens daily. */
export function BottomNav({ slug, role }: { slug: string; role: MemberRole }) {
  const isActive = useIsActive();
  const home = `/app/${slug}`;
  const items = visibleNav(slug, role)
    .flatMap((group) => group.items)
    .filter((item) => item.primary);

  return (
    <nav
      aria-label="Main"
      className="border-border-base bg-surface-raised/95 fixed inset-x-0 bottom-0 z-40 border-t backdrop-blur md:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <ul className="grid grid-cols-5">
        {items.map(({ href, label, icon: Icon }) => {
          const active = isActive(href, href === home);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex flex-col items-center gap-0.5 py-2.5 text-[11px]',
                  active ? 'text-accent' : 'text-ink-subtle',
                )}
              >
                <Icon className="size-5" aria-hidden="true" />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
