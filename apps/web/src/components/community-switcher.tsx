import Link from 'next/link';
import { ChevronsUpDown, Plus } from 'lucide-react';
import { ROLE_LABEL, type MemberRole } from '@samudaya/core';
import type { MembershipWithCommunity } from '@/lib/auth';

/**
 * Shows the current community and, for people who belong to several, lets them
 * switch. Uses <details> so it works without client JavaScript.
 */
export function CommunitySwitcher({
  current,
  role,
  memberships,
}: {
  current: { name: string; slug: string };
  role: MemberRole;
  memberships: MembershipWithCommunity[];
}) {
  const others = memberships.filter((m) => m.communities && m.communities.slug !== current.slug);

  const summary = (
    <>
      <span className="bg-accent text-accent-ink grid size-8 shrink-0 place-items-center rounded-lg text-sm font-bold">
        {current.name.charAt(0).toUpperCase()}
      </span>
      <span className="min-w-0 flex-1 text-left">
        <span className="text-ink block truncate text-sm font-medium">{current.name}</span>
        <span className="text-ink-subtle block truncate text-xs">{ROLE_LABEL[role]}</span>
      </span>
    </>
  );

  if (others.length === 0) {
    return <div className="flex items-center gap-2.5 px-2 py-1.5">{summary}</div>;
  }

  return (
    <details className="group relative">
      <summary className="hover:bg-surface-sunken flex cursor-pointer list-none items-center gap-2.5 rounded-lg px-2 py-1.5">
        {summary}
        <ChevronsUpDown className="text-ink-subtle size-4 shrink-0" aria-hidden="true" />
      </summary>
      <div className="border-border-base bg-surface-raised absolute inset-x-0 top-full z-30 mt-1 overflow-hidden rounded-lg border shadow-lg">
        <ul className="py-1">
          {others.map((membership) => (
            <li key={membership.id}>
              <Link
                href={`/app/${membership.communities!.slug}`}
                className="text-ink-muted hover:bg-surface-sunken hover:text-ink block px-3 py-2 text-sm"
              >
                {membership.communities!.name}
              </Link>
            </li>
          ))}
          <li className="border-border-base border-t">
            <Link
              href="/onboarding?mode=join"
              className="text-ink-muted hover:bg-surface-sunken hover:text-ink flex items-center gap-2 px-3 py-2 text-sm"
            >
              <Plus className="size-3.5" aria-hidden="true" />
              Join another
            </Link>
          </li>
        </ul>
      </div>
    </details>
  );
}
