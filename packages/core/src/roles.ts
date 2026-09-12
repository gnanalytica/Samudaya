import type { Enums } from '@samudaya/supabase';

export type MemberRole = Enums<'member_role'>;

/**
 * Mirrors app.role_rank() in the database. The database is the authority —
 * these constants exist so the UI can hide what the user cannot do, not so it
 * can decide what they may do.
 */
export const ROLE_RANK: Record<MemberRole, number> = {
  resident: 10,
  committee: 20,
  admin: 30,
  owner: 40,
};

export const ROLE_LABEL: Record<MemberRole, string> = {
  resident: 'Resident',
  committee: 'Committee member',
  admin: 'Administrator',
  owner: 'Owner',
};

export const ROLE_DESCRIPTION: Record<MemberRole, string> = {
  resident:
    'Contribute to events, join activities, volunteer, and see exactly where the money goes.',
  committee: 'Runs events: the checklist, activities, volunteers, and submitting expenses.',
  admin: 'Publishes events, approves spending, admits residents, and closes events.',
  owner: 'Full control, including transferring ownership.',
};

/** Roles an admin can hand out. Ownership is transferred, never granted. */
export const ASSIGNABLE_ROLES: MemberRole[] = ['resident', 'committee', 'admin'];

export function hasRoleAtLeast(role: MemberRole | null | undefined, min: MemberRole): boolean {
  if (!role) return false;
  return ROLE_RANK[role] >= ROLE_RANK[min];
}

export const isAdmin = (role: MemberRole | null | undefined) => hasRoleAtLeast(role, 'admin');
export const isCommittee = (role: MemberRole | null | undefined) =>
  hasRoleAtLeast(role, 'committee');

/**
 * What each role may do, for driving navigation and disabling controls.
 * Every one of these is independently enforced by RLS.
 */
export type Capability =
  | 'events:prepare'
  | 'events:publish'
  | 'announcements:post'
  | 'expenses:submit'
  | 'expenses:approve'
  | 'polls:create'
  | 'reallocation:propose'
  | 'members:manage'
  | 'joinrequests:review'
  | 'invites:manage'
  | 'units:manage'
  | 'apikeys:manage'
  | 'settings:manage';

const CAPABILITIES: Record<Capability, MemberRole> = {
  // Committee prepares an event and works it…
  'events:prepare': 'committee',
  'announcements:post': 'committee',
  'expenses:submit': 'committee',
  'polls:create': 'committee',
  // …but only an admin puts it in front of the society, signs off spending,
  // or proposes moving money between funds.
  'events:publish': 'admin',
  'expenses:approve': 'admin',
  'reallocation:propose': 'admin',
  'members:manage': 'admin',
  'joinrequests:review': 'admin',
  'invites:manage': 'admin',
  'units:manage': 'admin',
  'apikeys:manage': 'admin',
  'settings:manage': 'admin',
};

export function can(role: MemberRole | null | undefined, capability: Capability): boolean {
  if (!role) return false;
  return hasRoleAtLeast(role, CAPABILITIES[capability]);
}
