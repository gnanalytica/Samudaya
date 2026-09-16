import {
  CalendarCog,
  CalendarDays,
  ClipboardCheck,
  LayoutDashboard,
  Lightbulb,
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
 * Residents see Home, Events, People, Ideas and Me. Staff add a Manage group with
 * their To do queue and events; the committee also gets Society settings.
 * Notifications and personal settings live in the profile menu.
 *
 * People is deliberately outside Manage: everybody may see who is in the
 * society, and only what they may *do* there changes with the role.
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
 * Bottom bar order: the resident's screens, with To do and Manage before Me.
 * Staff and the committee already carry two extra tabs, so People drops out of
 * their bar rather than squeezing six across a phone — the sidebar and the
 * console both still link it.
 */
export function bottomNavItems(slug: string, role: MemberRole) {
  const groups = visibleNav(slug, role);
  const manages = groups.some((group) => group.section === COPY.manage);
  const items = groups
    .flatMap((group) => group.items)
    .filter((item) => item.primary)
    .filter((item) => !(manages && item.href === `/app/${slug}/people`));
  const me = items.filter((item) => item.href === `/app/${slug}/me`);
  return [...items.filter((item) => item.href !== `/app/${slug}/me`), ...me];
}
