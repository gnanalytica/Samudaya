import { describe, expect, it } from 'vitest';
import { ROLE_RANK, can, hasRoleAtLeast, isAdmin, isCommittee } from '../src/roles';

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
