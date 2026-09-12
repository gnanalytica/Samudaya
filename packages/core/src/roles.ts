import type { Enums } from '@samudaya/supabase';

export type MemberRole = Enums<'member_role'>;

/**
 * Mirrors app.role_rank() in the database. The database is the authority —
 * these constants exist so the UI can hide what the user cannot do, not so it
 * can decide what they may do.
 */
export const ROLE_RANK: Record<MemberRole, number> = {
  resident: 10,
  security: 20,
  committee: 30,
  admin: 40,
  owner: 50,
};

export const ROLE_LABEL: Record<MemberRole, string> = {
  resident: 'Resident',
  security: 'Security / gate',
  committee: 'Committee member',
  admin: 'Administrator',
  owner: 'Owner',
};

export const ROLE_DESCRIPTION: Record<MemberRole, string> = {
  resident: 'Can raise requests, book amenities, and invite their own visitors.',
  security: 'Works the gate: sees expected visitors and records arrivals.',
  committee: 'Posts announcements and works service requests.',
  admin: 'Manages members, units, invite codes, and billing.',
  owner: 'Full control, including transferring ownership.',
};

/** Roles an admin is allowed to hand out via an invite code. */
export const ASSIGNABLE_ROLES: MemberRole[] = ['resident', 'security', 'committee', 'admin'];

export function hasRoleAtLeast(role: MemberRole | null | undefined, min: MemberRole): boolean {
  if (!role) return false;
  return ROLE_RANK[role] >= ROLE_RANK[min];
}

export const isAdmin = (role: MemberRole | null | undefined) => hasRoleAtLeast(role, 'admin');
export const isCommittee = (role: MemberRole | null | undefined) =>
  hasRoleAtLeast(role, 'committee');
export const isGateStaff = (role: MemberRole | null | undefined) =>
  role === 'security' || isAdmin(role);

/**
 * What each role may do, for driving navigation and disabling controls.
 * Every one of these is independently enforced by RLS.
 */
export type Capability =
  | 'announcements:post'
  | 'members:manage'
  | 'invites:manage'
  | 'units:manage'
  | 'billing:manage'
  | 'requests:triage'
  | 'gate:operate'
  | 'apikeys:manage'
  | 'settings:manage';

const CAPABILITIES: Record<Capability, MemberRole> = {
  'announcements:post': 'committee',
  'requests:triage': 'committee',
  'gate:operate': 'security',
  'members:manage': 'admin',
  'invites:manage': 'admin',
  'units:manage': 'admin',
  'billing:manage': 'admin',
  'apikeys:manage': 'admin',
  'settings:manage': 'admin',
};

export function can(role: MemberRole | null | undefined, capability: Capability): boolean {
  if (!role) return false;
  // The gate role sits below committee in rank but is the only one that should
  // work the gate desk, so it gets an explicit carve-out.
  if (capability === 'gate:operate') return isGateStaff(role);
  return hasRoleAtLeast(role, CAPABILITIES[capability]);
}
