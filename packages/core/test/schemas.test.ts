import { describe, expect, it } from 'vitest';
import {
  createAmenityBookingSchema,
  createAnnouncementSchema,
  createInviteCodeSchema,
  createCommunitySchema,
  createServiceRequestSchema,
  createVisitorPassSchema,
  phoneSchema,
} from '../src/schemas';

// Zod 4's .uuid() enforces the RFC 9562 version and variant nibbles, not just
// the 8-4-4-4-12 shape. Postgres gen_random_uuid() produces v4, so real ids
// always pass; a hand-written `1111-...-1111` would not.
const COMMUNITY = '11111111-1111-4111-8111-111111111111';
const AMENITY = '22222222-2222-4222-8222-222222222222';
const inFuture = (hours: number) => new Date(Date.now() + hours * 3_600_000).toISOString();

describe('phoneSchema', () => {
  it('accepts E.164 and rejects everything looser', () => {
    expect(phoneSchema.safeParse('+919876543210').success).toBe(true);
    for (const bad of ['9876543210', '+0123456789', '+91 98765 43210', 'not a phone', '+9']) {
      expect(phoneSchema.safeParse(bad).success).toBe(false);
    }
  });
});

describe('createCommunitySchema', () => {
  it('constrains the slug to what the database check allows', () => {
    const base = { name: 'Green Valley' };
    for (const slug of ['green-valley', 'gv-2', 'a1b']) {
      expect(createCommunitySchema.safeParse({ ...base, slug }).success).toBe(true);
    }
    for (const slug of ['-green', 'green-', 'green valley', 'ab', 'a'.repeat(60)]) {
      expect(createCommunitySchema.safeParse({ ...base, slug }).success).toBe(false);
    }
  });

  it('lowercases the slug rather than rejecting mixed case', () => {
    const parsed = createCommunitySchema.parse({ name: 'Green Valley', slug: 'Green-Valley' });
    expect(parsed.slug).toBe('green-valley');
  });

  it('defaults country, timezone and currency', () => {
    const parsed = createCommunitySchema.parse({ name: 'Lake View', slug: 'lake-view' });
    expect(parsed).toMatchObject({ country: 'IN', timezone: 'Asia/Kolkata', currency: 'INR' });
  });
});

describe('createInviteCodeSchema', () => {
  it('refuses to grant owner, which the database also refuses', () => {
    const result = createInviteCodeSchema.safeParse({
      community_id: COMMUNITY,
      role: 'owner',
    });
    expect(result.success).toBe(false);
  });

  it('treats a null max_uses as unlimited rather than invalid', () => {
    const parsed = createInviteCodeSchema.parse({ community_id: COMMUNITY, max_uses: null });
    expect(parsed.max_uses).toBeNull();
  });

  it('rejects an expiry in the past', () => {
    const result = createInviteCodeSchema.safeParse({
      community_id: COMMUNITY,
      expires_at: new Date(Date.now() - 60_000).toISOString(),
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(['expires_at']);
  });

  it('defaults to a single-use resident code', () => {
    const parsed = createInviteCodeSchema.parse({ community_id: COMMUNITY });
    expect(parsed).toMatchObject({ role: 'resident', max_uses: 1, relation: 'owner' });
  });
});

describe('createAnnouncementSchema', () => {
  it('needs a real title and body', () => {
    expect(
      createAnnouncementSchema.safeParse({ community_id: COMMUNITY, title: 'ab', body: 'x' })
        .success,
    ).toBe(false);
    expect(
      createAnnouncementSchema.safeParse({
        community_id: COMMUNITY,
        title: 'Water supply',
        body: 'Off 10-2 on Saturday.',
      }).success,
    ).toBe(true);
  });

  it('trims whitespace so a space-only title cannot slip through', () => {
    const result = createAnnouncementSchema.safeParse({
      community_id: COMMUNITY,
      title: '    ',
      body: 'something',
    });
    expect(result.success).toBe(false);
  });
});

describe('createServiceRequestSchema', () => {
  it('defaults category, priority and channel', () => {
    const parsed = createServiceRequestSchema.parse({
      community_id: COMMUNITY,
      title: 'Leaking tap',
    });
    expect(parsed).toMatchObject({ category: 'other', priority: 'normal', channel: 'web' });
  });

  it('rejects a category the database has no enum value for', () => {
    expect(
      createServiceRequestSchema.safeParse({
        community_id: COMMUNITY,
        title: 'Leaking tap',
        category: 'teleportation',
      }).success,
    ).toBe(false);
  });
});

describe('createVisitorPassSchema', () => {
  const base = {
    community_id: COMMUNITY,
    visitor_name: 'Ravi Kumar',
    expected_at: inFuture(1),
    valid_until: inFuture(7),
  };

  it('accepts a well-formed pass', () => {
    expect(createVisitorPassSchema.safeParse(base).success).toBe(true);
  });

  it('rejects a window that closes before the visitor arrives', () => {
    const result = createVisitorPassSchema.safeParse({
      ...base,
      expected_at: inFuture(8),
      valid_until: inFuture(2),
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(['valid_until']);
  });

  it('turns an empty phone string into nothing, rather than failing', () => {
    const parsed = createVisitorPassSchema.parse({ ...base, visitor_phone: '' });
    expect(parsed.visitor_phone).toBeUndefined();
  });
});

describe('createAmenityBookingSchema', () => {
  const base = {
    community_id: COMMUNITY,
    amenity_id: AMENITY,
    starts_at: inFuture(2),
    ends_at: inFuture(4),
  };

  it('accepts a future slot', () => {
    expect(createAmenityBookingSchema.safeParse(base).success).toBe(true);
  });

  it('rejects a slot that ends before it starts', () => {
    const result = createAmenityBookingSchema.safeParse({
      ...base,
      starts_at: inFuture(4),
      ends_at: inFuture(2),
    });
    expect(result.success).toBe(false);
  });

  it('rejects a slot in the past', () => {
    const result = createAmenityBookingSchema.safeParse({
      ...base,
      starts_at: new Date(Date.now() - 7_200_000).toISOString(),
      ends_at: new Date(Date.now() - 3_600_000).toISOString(),
    });
    expect(result.success).toBe(false);
  });
});
