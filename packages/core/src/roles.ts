import type { Enums } from '@samudaya/supabase';

/**
 * The database enum still carries the retired 'admin' label (Postgres cannot
 * drop enum values); a check constraint keeps it off every membership, and
 * {@link normalizeRole} folds it into committee should one ever appear.
 */
export type MemberRole = Enums<'member_role'>;
export type Role = Exclude<MemberRole, 'admin'>;

/** Mirrors app.role_rank() in the database, which is the authority. */
export const ROLE_RANK: Record<MemberRole, number> = {
  resident: 10,
  staff: 20,
  admin: 30,
  committee: 40,
};

export const ROLES: Role[] = ['resident', 'staff', 'committee'];

export const ROLE_LABEL: Record<Role, string> = {
  resident: 'Resident',
  staff: 'Staff',
  committee: 'Committee',
};

export const ROLE_DESCRIPTION: Record<Role, string> = {
  resident:
    'Views events, contributes, suggests activities and ideas, votes, sees where the money goes, and proposes fundraising campaigns.',
  staff:
    'Runs the society day to day: uploads and corrects bills, admits and removes residents, creates and manages events, and tracks which flat paid for what.',
  committee:
    'Everything staff can do, plus the final say: approves or rejects bills, fundraising campaigns and suggestions, closes events, and assigns roles.',
};

/** Roles the committee can hand out. */
export const ASSIGNABLE_ROLES: Role[] = ['resident', 'staff', 'committee'];

export function normalizeRole(role: MemberRole | null | undefined): Role | null {
  if (!role) return null;
  return role === 'admin' ? 'committee' : role;
}

export function hasRoleAtLeast(role: MemberRole | null | undefined, min: MemberRole): boolean {
  const normalized = normalizeRole(role);
  if (!normalized) return false;
  return ROLE_RANK[normalized] >= ROLE_RANK[min];
}

export const isStaff = (role: MemberRole | null | undefined) => hasRoleAtLeast(role, 'staff');
export const isCommittee = (role: MemberRole | null | undefined) =>
  hasRoleAtLeast(role, 'committee');

/** Residents and committee take part; staff are operators and do not. */
export const canParticipate = (role: MemberRole | null | undefined) => {
  const normalized = normalizeRole(role);
  return normalized === 'resident' || normalized === 'committee';
};

/**
 * What each role may do, for driving navigation and disabling controls. Every
 * one of these is independently enforced by row-level security.
 */
export type Capability =
  // Everyone admitted
  | 'events:view'
  | 'analytics:view'
  // Residents and committee (not staff)
  | 'contribute'
  | 'vote'
  | 'suggest'
  | 'campaigns:propose'
  | 'activities:register'
  // Staff and committee
  | 'events:manage'
  | 'budget:manage'
  | 'activities:manage'
  | 'expenses:submit'
  | 'payments:view'
  | 'payments:record'
  | 'joinrequests:review'
  | 'residents:remove'
  // Committee only
  | 'expenses:approve'
  | 'campaigns:approve'
  | 'suggestions:approve'
  | 'events:close'
  | 'roles:manage';

type Rule = 'member' | 'participant' | 'staff' | 'committee';

const CAPABILITIES: Record<Capability, Rule> = {
  'events:view': 'member',
  'analytics:view': 'member',

  contribute: 'participant',
  vote: 'participant',
  suggest: 'participant',
  'campaigns:propose': 'participant',
  'activities:register': 'participant',

  'events:manage': 'staff',
  'budget:manage': 'staff',
  'activities:manage': 'staff',
  'expenses:submit': 'staff',
  'payments:view': 'staff',
  'payments:record': 'staff',
  'joinrequests:review': 'staff',
  'residents:remove': 'staff',

  'expenses:approve': 'committee',
  'campaigns:approve': 'committee',
  'suggestions:approve': 'committee',
  'events:close': 'committee',
  'roles:manage': 'committee',
};

export function can(role: MemberRole | null | undefined, capability: Capability): boolean {
  if (!role) return false;
  switch (CAPABILITIES[capability]) {
    case 'member':
      return true;
    case 'participant':
      return canParticipate(role);
    case 'staff':
      return isStaff(role);
    case 'committee':
      return isCommittee(role);
  }
}
