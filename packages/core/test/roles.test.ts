import { describe, expect, it } from 'vitest';
import {
  ROLE_RANK,
  can,
  canParticipate,
  hasRoleAtLeast,
  isCommittee,
  isStaff,
  normalizeRole,
} from '../src/roles';

describe('role ranking', () => {
  it('orders roles the same way the database does', () => {
    expect(ROLE_RANK.resident).toBeLessThan(ROLE_RANK.staff);
    expect(ROLE_RANK.staff).toBeLessThan(ROLE_RANK.committee);
    expect(ROLE_RANK.admin).toBeLessThan(ROLE_RANK.committee);
  });

  it('treats a missing role as no access', () => {
    expect(hasRoleAtLeast(null, 'resident')).toBe(false);
    expect(can(undefined, 'events:view')).toBe(false);
  });

  it('folds the retired admin label into committee', () => {
    expect(normalizeRole('admin')).toBe('committee');
    expect(can('admin', 'expenses:approve')).toBe(true);
  });
});

describe('resident', () => {
  it('takes part but runs nothing', () => {
    for (const capability of [
      'contribute',
      'vote',
      'suggest',
      'campaigns:propose',
      'activities:register',
      'analytics:view',
    ] as const) {
      expect(can('resident', capability)).toBe(true);
    }
    for (const capability of [
      'events:manage',
      'expenses:submit',
      'payments:view',
      'joinrequests:review',
      'expenses:approve',
    ] as const) {
      expect(can('resident', capability)).toBe(false);
    }
  });
});

describe('staff', () => {
  it('operates the society', () => {
    for (const capability of [
      'expenses:submit',
      'joinrequests:review',
      'residents:remove',
      'events:manage',
      'budget:manage',
      'payments:view',
      'payments:record',
    ] as const) {
      expect(can('staff', capability)).toBe(true);
    }
  });

  it('does not take part or have the final say', () => {
    expect(canParticipate('staff')).toBe(false);
    for (const capability of [
      'contribute',
      'vote',
      'suggest',
      'campaigns:propose',
      'expenses:approve',
      'campaigns:approve',
      'suggestions:approve',
      'events:close',
      'roles:manage',
    ] as const) {
      expect(can('staff', capability)).toBe(false);
    }
  });
});

describe('committee', () => {
  it('can do everything', () => {
    expect(isStaff('committee')).toBe(true);
    expect(isCommittee('committee')).toBe(true);
    for (const capability of [
      'contribute',
      'vote',
      'events:manage',
      'payments:view',
      'expenses:approve',
      'campaigns:approve',
      'suggestions:approve',
      'events:close',
      'roles:manage',
    ] as const) {
      expect(can('committee', capability)).toBe(true);
    }
  });
});
