import {
  CalendarCog,
  CalendarDays,
  ClipboardCheck,
  LayoutDashboard,
  Lightbulb,
  Scale,
  Settings2,
  SquareMenu,
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
  /** Shows a count next to the label. */
  badge?: 'todo';
  /** Other section roots this item stands for, so it stays lit inside them. */
  covers?: string[];
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
 * The Manage hub, for the bottom bar only.
 *
 * It is deliberately not in navItems(): a desktop sidebar already lists the
 * Manage section row by row, and a link above those rows to a page listing the
 * same rows is the sidebar pointing at a copy of itself.
 */
function manageTab(slug: string): NavItem {
  const base = `/app/${slug}`;
  return {
    href: `${base}/manage`,
    label: COPY.manage,
    icon: SquareMenu,
    capability: 'events:manage',
    badge: 'todo',
    // Where the hub leads. Without these, walking from Manage into Reconcile
    // puts out every light on the bar and the app reads as nowhere.
    covers: [`${base}/todo`, `${base}/admin`, `${base}/people`],
  };
}

/**
 * Four tabs — and which four depends on whether you run the society.
 *
 * Residents keep Home, Events, People, Me. Staff and the committee trade
 * People for Manage: the To do count rides on the tab, and the hub behind it
 * leads to the event console, Reconcile, Society settings and People itself.
 *
 * This is the shape the phone app has always had, and it was the better answer
 * all along. The sheet behind the society name came first and did fix the real
 * problem — on a phone there was no route to Manage at all — and it still
 * carries Money and Ideas. But a sheet is a drawer you have to know about, and
 * a committee member approving a bill from their phone should not have to find
 * one. So the work that is waiting gets a tab, and People gives up its place
 * to it: Home links to People, and so does the first row of the hub.
 */
export function bottomNavItems(slug: string, role: MemberRole): NavItem[] {
  const primary = visibleNav(slug, role)
    .flatMap((group) => group.items)
    .filter((item) => item.primary);
  if (!can(role, 'events:manage')) return primary;

  // In People's place rather than a fifth tab: five labels across a 360px
  // phone is where they start wrapping, and four is what the phone app fits.
  const rest = primary.filter((item) => item.href !== `/app/${slug}/people`);
  return [...rest.slice(0, 2), manageTab(slug), ...rest.slice(2)];
}
