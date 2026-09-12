import { describe, expect, it } from 'vitest';
import { ROLE_RANK, can, hasRoleAtLeast, isAdmin, isGateStaff } from '../src/roles';

describe('role ranking', () => {
  it('orders roles the same way the database does', () => {
    expect(ROLE_RANK.resident).toBeLessThan(ROLE_RANK.security);
    expect(ROLE_RANK.security).toBeLessThan(ROLE_RANK.committee);
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
      'announcements:post',
      'members:manage',
      'invites:manage',
      'billing:manage',
      'gate:operate',
    ] as const) {
      expect(can('resident', capability)).toBe(false);
    }
  });

  it('lets the gate role work the gate but nothing else', () => {
    expect(can('security', 'gate:operate')).toBe(true);
    expect(can('security', 'announcements:post')).toBe(false);
    expect(can('security', 'members:manage')).toBe(false);
  });

  it('lets committee post notices and triage requests, but not manage members', () => {
    expect(can('committee', 'announcements:post')).toBe(true);
    expect(can('committee', 'requests:triage')).toBe(true);
    expect(can('committee', 'members:manage')).toBe(false);
    expect(can('committee', 'billing:manage')).toBe(false);
  });

  it('gives admins and owners everything', () => {
    for (const role of ['admin', 'owner'] as const) {
      expect(can(role, 'members:manage')).toBe(true);
      expect(can(role, 'invites:manage')).toBe(true);
      expect(can(role, 'billing:manage')).toBe(true);
      expect(can(role, 'gate:operate')).toBe(true);
      expect(isGateStaff(role)).toBe(true);
    }
  });
});
