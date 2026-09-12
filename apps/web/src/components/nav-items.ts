import {
  Bell,
  CalendarCheck,
  KeyRound,
  LayoutDashboard,
  Receipt,
  Settings,
  ShieldCheck,
  Ticket,
  Users,
  Wrench,
  Building2,
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
        { href: `${base}/notices`, label: 'Notices', icon: Bell, primary: true },
        { href: `${base}/requests`, label: 'Requests', icon: Wrench, primary: true },
        { href: `${base}/visitors`, label: 'Visitors', icon: Users, primary: true },
        { href: `${base}/amenities`, label: 'Amenities', icon: CalendarCheck },
        { href: `${base}/billing`, label: 'Dues', icon: Receipt, primary: true },
      ],
    },
    {
      section: 'Operations',
      items: [
        {
          href: `${base}/gate`,
          label: 'Gate desk',
          icon: ShieldCheck,
          capability: 'gate:operate',
        },
      ],
    },
    {
      section: 'Administration',
      items: [
        {
          href: `${base}/admin/invites`,
          label: 'Invite codes',
          icon: Ticket,
          capability: 'invites:manage',
        },
        {
          href: `${base}/admin/members`,
          label: 'Members',
          icon: Users,
          capability: 'members:manage',
        },
        {
          href: `${base}/admin/units`,
          label: 'Units',
          icon: Building2,
          capability: 'units:manage',
        },
        {
          href: `${base}/admin/api-keys`,
          label: 'API & AI access',
          icon: KeyRound,
          capability: 'apikeys:manage',
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
