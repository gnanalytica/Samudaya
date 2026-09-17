import {
  CalendarCog,
  CalendarDays,
  ClipboardCheck,
  LayoutDashboard,
  Lightbulb,
  Scale,
  Settings2,
  UserRound,
  Users,
  Wallet,
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
 * Residents see Home, Events, People, Money, Ideas and Me. Staff add a Manage
 * group with their To do queue, events and the bank reconciliation; the
 * committee also gets Society settings. Notifications and personal settings
 * live in the profile menu.
 *
 * People and Money are deliberately outside Manage: everybody may see who is in
 * the society and what it did with its money, and only what they may *do* there
 * changes with the role.
 */
export function navItems(slug: string): { section: string; items: NavItem[] }[] {
  const base = `/app/${slug}`;
  return [
    {
      section: '',
      items: [
        { href: base, label: 'Home', icon: LayoutDashboard, primary: true },
        { href: `${base}/events`, label: 'Events', icon: CalendarDays, primary: true },
        { href: `${base}/people`, label: 'People', icon: Users, primary: true },
        // Not primary: the bottom bar is full, and Home already points here.
        { href: `${base}/money`, label: 'Money', icon: Wallet },
        { href: `${base}/suggest`, label: 'Ideas', icon: Lightbulb },
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
          badge: 'todo',
        },
        {
          href: `${base}/admin`,
          label: 'Events',
          shortLabel: COPY.manage,
          icon: CalendarCog,
          capability: 'events:manage',
        },
        {
          href: `${base}/admin/reconcile`,
          label: 'Reconcile',
          icon: Scale,
          capability: 'payments:record',
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

/**
 * Four tabs, the same four for everybody: Home, Events, People, Me.
 *
 * It used to be six for staff, which did not fit, so People was dropped from
 * their bar — the nav quietly telling us it was full. To do and the event
 * console are not places you navigate to; they are work waiting, and Home says
 * so at the top and links straight through. A resident and a committee member
 * now see the same shape of app, which is the whole idea: the role changes
 * what you may do, not where things live.
 */
export function bottomNavItems(slug: string, role: MemberRole) {
  return visibleNav(slug, role)
    .flatMap((group) => group.items)
    .filter((item) => item.primary);
}
