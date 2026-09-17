import { describe, expect, it } from 'vitest';
import { filterPeople, roleFilterFrom, type SearchablePerson } from '../src/lib/people-filter';

const person = (over: Partial<SearchablePerson>): SearchablePerson => ({
  full_name: 'Asha Rao',
  flat: 'B-204',
  relation: null,
  phone: null,
  email: null,
  role: 'resident',
  ...over,
});

const PEOPLE: SearchablePerson[] = [
  person({
    full_name: 'Asha Rao',
    flat: 'B-204',
    phone: '+919876543210',
    email: 'asha@example.com',
  }),
  person({ full_name: 'Bhavana Iyer', flat: 'A-101', role: 'committee' }),
  person({ full_name: 'Chandran Nair', flat: 'C-003', role: 'staff' }),
  person({ full_name: 'Deepa Rao', flat: 'B-205', relation: 'tenant' }),
];

const all = { query: '', role: null, canSeeContact: true } as const;

describe('roleFilterFrom', () => {
  it('accepts the three real roles', () => {
    expect(roleFilterFrom('resident')).toBe('resident');
    expect(roleFilterFrom('staff')).toBe('staff');
    expect(roleFilterFrom('committee')).toBe('committee');
  });

  it('refuses anything else, so a junk query string means everyone', () => {
    for (const junk of ['admin', 'Resident', '', 'owner', null, undefined, 42]) {
      expect(roleFilterFrom(junk)).toBeNull();
    }
  });
});

describe('filterPeople', () => {
  it('returns everyone when nothing is asked for', () => {
    expect(filterPeople(PEOPLE, all)).toHaveLength(4);
  });

  it('matches a name regardless of case', () => {
    expect(filterPeople(PEOPLE, { ...all, query: 'bhavana' })).toHaveLength(1);
    expect(filterPeople(PEOPLE, { ...all, query: 'BHAVANA' })).toHaveLength(1);
  });

  it('matches a surname shared by two people', () => {
    expect(filterPeople(PEOPLE, { ...all, query: 'rao' }).map((p) => p.flat)).toEqual([
      'B-204',
      'B-205',
    ]);
  });

  it('matches a flat', () => {
    expect(filterPeople(PEOPLE, { ...all, query: 'c-003' })).toHaveLength(1);
  });

  it('matches the relation, so tenants can be found', () => {
    expect(filterPeople(PEOPLE, { ...all, query: 'tenant' })).toHaveLength(1);
  });

  it('ignores surrounding whitespace', () => {
    expect(filterPeople(PEOPLE, { ...all, query: '   iyer  ' })).toHaveLength(1);
  });

  it('narrows by role', () => {
    expect(filterPeople(PEOPLE, { ...all, role: 'committee' })).toHaveLength(1);
    expect(filterPeople(PEOPLE, { ...all, role: 'resident' })).toHaveLength(2);
  });

  it('applies role and text together', () => {
    expect(filterPeople(PEOPLE, { ...all, query: 'rao', role: 'committee' })).toHaveLength(0);
  });

  // The boundary, not a convenience. society_people() withholds contact from
  // residents; searching it would hand the same fact back a character at a time.
  it('lets staff find somebody by phone or email', () => {
    expect(filterPeople(PEOPLE, { ...all, query: '9876543210' })).toHaveLength(1);
    expect(filterPeople(PEOPLE, { ...all, query: 'asha@example.com' })).toHaveLength(1);
  });

  it('refuses to match contact for anyone who may not see it', () => {
    const asResident = { query: '9876543210', role: null, canSeeContact: false } as const;
    expect(filterPeople(PEOPLE, asResident)).toHaveLength(0);
    expect(filterPeople(PEOPLE, { ...asResident, query: 'asha@example.com' })).toHaveLength(0);
  });

  it('still finds that person by name for a resident', () => {
    expect(filterPeople(PEOPLE, { query: 'asha', role: null, canSeeContact: false })).toHaveLength(
      1,
    );
  });
});
