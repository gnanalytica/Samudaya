import {
  CalendarDays,
  ClipboardCheck,
  ClipboardList,
  LayoutDashboard,
  Settings,
  UserPlus,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { can, type Capability, type MemberRole } from '@samudaya/core';

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Omitted when everyone in a community may see the page. */
  capability?: Capability;
  /** Shown in the compact bottom bar on small screens. */
  primary?: boolean;
};

export function navItems(slug: string): { section: string; items: NavItem[] }[] {
  const base = `/app/${slug}`;
  return [
    {
      section: 'Community',
      items: [
        { href: base, label: 'Home', icon: LayoutDashboard, primary: true },
        { href: `${base}/events`, label: 'Events', icon: CalendarDays, primary: true },
        { href: `${base}/me`, label: 'My activity', icon: ClipboardList, primary: true },
      ],
    },
    {
      section: 'Run the society',
      items: [
        {
          href: `${base}/admin`,
          label: 'Console',
          icon: ClipboardList,
          capability: 'events:manage',
          primary: true,
        },
        {
          href: `${base}/admin/approvals`,
          label: 'Committee approvals',
          icon: ClipboardCheck,
          capability: 'expenses:approve',
        },
        {
          href: `${base}/admin/requests`,
          label: 'Join requests',
          icon: UserPlus,
          capability: 'joinrequests:review',
        },
        {
          href: `${base}/admin/members`,
          label: 'Residents',
          icon: Users,
          capability: 'residents:remove',
        },
      ],
    },
    {
      section: '',
      items: [{ href: `${base}/settings`, label: 'Settings', icon: Settings }],
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
