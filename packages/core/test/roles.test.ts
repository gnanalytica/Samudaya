import { describe, expect, it } from 'vitest';
import {
  ROLE_RANK,
  can,
  canApproveSpending,
  canManageSpendingApproval,
  hasRoleAtLeast,
  isAdmin,
  isCommittee,
  positionLabel,
} from '../src/roles';

describe('role ranking', () => {
  it('orders roles the same way the database does', () => {
    expect(ROLE_RANK.resident).toBeLessThan(ROLE_RANK.committee);
    expect(ROLE_RANK.committee).toBeLessThan(ROLE_RANK.admin);
    expect(ROLE_RANK.admin).toBeLessThan(ROLE_RANK.owner);
  });

  it('treats a missing role as no access', () => {
    expect(hasRoleAtLeast(null, 'resident')).toBe(false);
    expect(hasRoleAtLeast(undefined, 'resident')).toBe(false);
    expect(isAdmin(null)).toBe(false);
  });

  it('is inclusive at the boundary', () => {
    expect(hasRoleAtLeast('admin', 'admin')).toBe(true);
    expect(hasRoleAtLeast('committee', 'admin')).toBe(false);
    expect(hasRoleAtLeast('owner', 'admin')).toBe(true);
  });
});

describe('capabilities', () => {
  it('keeps residents out of every privileged action', () => {
    for (const capability of [
      'events:prepare',
      'events:publish',
      'announcements:post',
      'expenses:submit',
      'expenses:approve',
      'members:manage',
      'reallocation:propose',
    ] as const) {
      expect(can('resident', capability)).toBe(false);
    }
  });

  it('lets the committee run an event but not publish it or sign off spending', () => {
    expect(can('committee', 'events:prepare')).toBe(true);
    expect(can('committee', 'announcements:post')).toBe(true);
    expect(can('committee', 'expenses:submit')).toBe(true);
    expect(can('committee', 'polls:create')).toBe(true);

    // The two that separate running an event from controlling the society.
    expect(can('committee', 'events:publish')).toBe(false);
    expect(can('committee', 'expenses:approve')).toBe(false);
    expect(can('committee', 'reallocation:propose')).toBe(false);
    expect(can('committee', 'members:manage')).toBe(false);
    expect(isCommittee('committee')).toBe(true);
  });

  it('gives admins and owners everything', () => {
    for (const role of ['admin', 'owner'] as const) {
      expect(can(role, 'events:publish')).toBe(true);
      expect(can(role, 'expenses:approve')).toBe(true);
      expect(can(role, 'members:manage')).toBe(true);
      expect(can(role, 'joinrequests:review')).toBe(true);
      expect(can(role, 'reallocation:propose')).toBe(true);
    }
  });
});

describe('titles', () => {
  it('describes a member by title when set, role otherwise', () => {
    expect(positionLabel('committee', 'Supervisor')).toBe('Supervisor');
    expect(positionLabel('admin', '  ')).toBe('Administrator');
    expect(positionLabel('resident', null)).toBe('Resident');
  });
});

describe('spending approval', () => {
  it('lets any admin approve until the community restricts it', () => {
    expect(canApproveSpending('admin', false, false)).toBe(true);
    expect(canApproveSpending('owner', false, false)).toBe(true);
    expect(canApproveSpending('committee', true, false)).toBe(false);
  });

  it('narrows approval to designated approvers once restricted', () => {
    expect(canApproveSpending('admin', false, true)).toBe(false);
    expect(canApproveSpending('owner', false, true)).toBe(false);
    expect(canApproveSpending('admin', true, true)).toBe(true);
  });

  it('lets only owners and existing approvers change who approves', () => {
    expect(canManageSpendingApproval('owner', false)).toBe(true);
    expect(canManageSpendingApproval('admin', true)).toBe(true);
    expect(canManageSpendingApproval('admin', false)).toBe(false);
    expect(canManageSpendingApproval('committee', true)).toBe(false);
  });
});
