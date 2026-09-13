import {
  CalendarCog,
  CalendarDays,
  ClipboardCheck,
  LayoutDashboard,
  Settings2,
  UserRound,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { COPY, can, type Capability, type MemberRole } from '@samudaya/core';

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Omitted when everyone in a community may see the page. */
  capability?: Capability;
  /** Shown in the compact bottom bar on small screens. */
  primary?: boolean;
  /** A shorter name for the bottom bar, where two "Events" would be confusing. */
  shortLabel?: string;
  /** Shows a count next to the label. */
  badge?: 'todo';
};

/**
 * Residents see Home, Events and Me. Staff add a Manage group with their To do
 * queue, events and residents; the committee also gets Society settings.
 * Notifications and personal settings live in the profile menu.
 */
export function navItems(slug: string): { section: string; items: NavItem[] }[] {
  const base = `/app/${slug}`;
  return [
    {
      section: '',
      items: [
        { href: base, label: 'Home', icon: LayoutDashboard, primary: true },
        { href: `${base}/events`, label: 'Events', icon: CalendarDays, primary: true },
        { href: `${base}/me`, label: 'Me', icon: UserRound, primary: true },
      ],
    },
    {
      section: COPY.manage,
      items: [
        {
          href: `${base}/todo`,
          label: COPY.todo,
          icon: ClipboardCheck,
          capability: 'events:manage',
          primary: true,
          badge: 'todo',
        },
        {
          href: `${base}/admin`,
          label: 'Events',
          shortLabel: COPY.manage,
          icon: CalendarCog,
          capability: 'events:manage',
          primary: true,
        },
        {
          href: `${base}/admin/members`,
          label: 'Residents',
          icon: Users,
          capability: 'residents:remove',
        },
        {
          href: `${base}/admin/settings`,
          label: COPY.societySettings,
          icon: Settings2,
          capability: 'roles:manage',
        },
      ],
    },
  ];
}

/** Drops sections the role cannot see anything in. */
export function visibleNav(slug: string, role: MemberRole) {
  return navItems(slug)
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => !item.capability || can(role, item.capability)),
    }))
    .filter((group) => group.items.length > 0);
}

/** Bottom bar order: the resident's three, with To do and Manage before Me. */
export function bottomNavItems(slug: string, role: MemberRole) {
  const items = visibleNav(slug, role)
    .flatMap((group) => group.items)
    .filter((item) => item.primary);
  const me = items.filter((item) => item.href === `/app/${slug}/me`);
  return [...items.filter((item) => item.href !== `/app/${slug}/me`), ...me];
}
