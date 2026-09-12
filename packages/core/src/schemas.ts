import { z } from 'zod';

/**
 * Input validation shared by the server actions, the REST API, the mobile app
 * and the WhatsApp bot. Anything that reaches the database passes through here
 * first, so a malformed payload fails the same way whichever door it came in.
 */

export const uuid = z.string().uuid('Expected an id');

// Stored in E.164 so WhatsApp, SMS and the database agree on one shape.
export const phoneSchema = z
  .string()
  .trim()
  .regex(/^\+[1-9]\d{7,14}$/, 'Use the international format, e.g. +919876543210');

export const memberRoleSchema = z.enum(['resident', 'security', 'committee', 'admin', 'owner']);
export const assignableRoleSchema = z.enum(['resident', 'security', 'committee', 'admin']);
export const occupantRelationSchema = z.enum(['owner', 'tenant', 'family', 'other']);
export const audienceSchema = z.enum(['all', 'residents', 'owners', 'committee', 'staff']);
export const requestCategorySchema = z.enum([
  'plumbing',
  'electrical',
  'housekeeping',
  'security',
  'common_area',
  'parking',
  'billing',
  'other',
]);
export const requestPrioritySchema = z.enum(['low', 'normal', 'high', 'urgent']);
export const requestStatusSchema = z.enum([
  'open',
  'acknowledged',
  'in_progress',
  'resolved',
  'closed',
  'rejected',
]);
export const visitorKindSchema = z.enum(['guest', 'delivery', 'cab', 'service', 'staff']);
export const originChannelSchema = z.enum(['web', 'mobile', 'whatsapp', 'api', 'system']);
export const paymentMethodSchema = z.enum([
  'upi',
  'card',
  'netbanking',
  'bank_transfer',
  'cash',
  'cheque',
  'other',
]);

// ---------------------------------------------------------------------------
// Community & membership
// ---------------------------------------------------------------------------

export const createCommunitySchema = z.object({
  name: z.string().trim().min(2, 'Give the community a name').max(120),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(
      /^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$/,
      'Use lowercase letters, numbers and hyphens (3–50 characters)',
    ),
  city: z.string().trim().max(80).optional(),
  state: z.string().trim().max(80).optional(),
  country: z.string().trim().length(2).default('IN'),
  timezone: z.string().trim().default('Asia/Kolkata'),
  currency: z.string().trim().length(3).default('INR'),
});
export type CreateCommunityInput = z.infer<typeof createCommunitySchema>;

export const createUnitSchema = z.object({
  community_id: uuid,
  block: z.string().trim().max(20).optional(),
  number: z.string().trim().min(1, 'Unit number is required').max(20),
  floor: z.coerce.number().int().min(-5).max(200).optional(),
  bedrooms: z.coerce.number().int().min(0).max(20).optional(),
  area_sqft: z.coerce.number().positive().max(100000).optional(),
  monthly_dues: z.coerce.number().min(0).max(10_000_000).default(0),
});
export type CreateUnitInput = z.infer<typeof createUnitSchema>;

export const updateMemberRoleSchema = z.object({
  membership_id: uuid,
  role: assignableRoleSchema,
});

// ---------------------------------------------------------------------------
// Invite codes
// ---------------------------------------------------------------------------

export const createInviteCodeSchema = z
  .object({
    community_id: uuid,
    role: assignableRoleSchema.default('resident'),
    unit_id: uuid.optional().nullable(),
    relation: occupantRelationSchema.default('owner'),
    // Null means unlimited; the form sends an explicit null for that.
    max_uses: z.coerce.number().int().min(1).max(10000).nullable().default(1),
    expires_at: z.string().datetime({ offset: true }).nullable().optional(),
    label: z.string().trim().max(120).optional(),
  })
  .refine((v) => !v.expires_at || new Date(v.expires_at).getTime() > Date.now(), {
    message: 'The expiry date has to be in the future',
    path: ['expires_at'],
  });
export type CreateInviteCodeInput = z.infer<typeof createInviteCodeSchema>;

export const redeemInviteCodeSchema = z.object({
  code: z.string().trim().min(4, 'Enter the code you were given').max(32),
  channel: originChannelSchema.default('web'),
});

// ---------------------------------------------------------------------------
// Announcements
// ---------------------------------------------------------------------------

export const createAnnouncementSchema = z.object({
  community_id: uuid,
  title: z.string().trim().min(3, 'Give the notice a title').max(160),
  body: z.string().trim().min(1, 'Write the notice').max(10_000),
  audience: audienceSchema.default('all'),
  is_pinned: z.boolean().default(false),
  expires_at: z.string().datetime({ offset: true }).nullable().optional(),
});
export type CreateAnnouncementInput = z.infer<typeof createAnnouncementSchema>;

// ---------------------------------------------------------------------------
// Service requests
// ---------------------------------------------------------------------------

export const createServiceRequestSchema = z.object({
  community_id: uuid,
  unit_id: uuid.nullable().optional(),
  category: requestCategorySchema.default('other'),
  priority: requestPrioritySchema.default('normal'),
  title: z.string().trim().min(3, 'Describe the problem in a few words').max(160),
  description: z.string().trim().max(10_000).optional(),
  channel: originChannelSchema.default('web'),
});
export type CreateServiceRequestInput = z.infer<typeof createServiceRequestSchema>;

export const updateServiceRequestSchema = z.object({
  id: uuid,
  status: requestStatusSchema.optional(),
  priority: requestPrioritySchema.optional(),
  assigned_to: uuid.nullable().optional(),
});

export const addRequestCommentSchema = z.object({
  request_id: uuid,
  body: z.string().trim().min(1, 'Write a reply').max(5000),
  is_internal: z.boolean().default(false),
});

// ---------------------------------------------------------------------------
// Visitors
// ---------------------------------------------------------------------------

export const createVisitorPassSchema = z
  .object({
    community_id: uuid,
    unit_id: uuid.nullable().optional(),
    visitor_name: z.string().trim().min(2, 'Who is visiting?').max(120),
    visitor_phone: phoneSchema
      .optional()
      .or(z.literal(''))
      .transform((v) => v || undefined),
    kind: visitorKindSchema.default('guest'),
    purpose: z.string().trim().max(200).optional(),
    vehicle_number: z.string().trim().max(20).optional(),
    party_size: z.coerce.number().int().min(1).max(50).default(1),
    expected_at: z.string().datetime({ offset: true }),
    valid_until: z.string().datetime({ offset: true }),
    channel: originChannelSchema.default('web'),
  })
  .refine((v) => new Date(v.valid_until) > new Date(v.expected_at), {
    message: 'The pass has to stay valid past the expected arrival',
    path: ['valid_until'],
  });
export type CreateVisitorPassInput = z.infer<typeof createVisitorPassSchema>;

// ---------------------------------------------------------------------------
// Amenities
// ---------------------------------------------------------------------------

export const createAmenityBookingSchema = z
  .object({
    community_id: uuid,
    amenity_id: uuid,
    starts_at: z.string().datetime({ offset: true }),
    ends_at: z.string().datetime({ offset: true }),
    guests: z.coerce.number().int().min(0).max(500).default(0),
    notes: z.string().trim().max(500).optional(),
    channel: originChannelSchema.default('web'),
  })
  .refine((v) => new Date(v.ends_at) > new Date(v.starts_at), {
    message: 'The booking has to end after it starts',
    path: ['ends_at'],
  })
  .refine((v) => new Date(v.starts_at).getTime() > Date.now() - 60_000, {
    message: 'You cannot book a slot in the past',
    path: ['starts_at'],
  });
export type CreateAmenityBookingInput = z.infer<typeof createAmenityBookingSchema>;

// ---------------------------------------------------------------------------
// Billing
// ---------------------------------------------------------------------------

export const recordPaymentSchema = z.object({
  community_id: uuid,
  invoice_id: uuid.nullable().optional(),
  unit_id: uuid.nullable().optional(),
  amount: z.coerce.number().positive('Enter an amount greater than zero').max(10_000_000),
  method: paymentMethodSchema.default('upi'),
  reference: z.string().trim().max(120).optional(),
});

// ---------------------------------------------------------------------------
// API keys
// ---------------------------------------------------------------------------

export const API_SCOPES = [
  'announcements:read',
  'announcements:write',
  'requests:read',
  'requests:write',
  'visitors:read',
  'visitors:write',
  'amenities:read',
  'amenities:write',
  'members:read',
  'billing:read',
] as const;
export type ApiScope = (typeof API_SCOPES)[number];

export const createApiKeySchema = z.object({
  community_id: uuid,
  name: z.string().trim().min(2, 'Name the key so you can recognise it later').max(80),
  scopes: z.array(z.enum(API_SCOPES)).min(1, 'Pick at least one scope'),
  expires_at: z.string().datetime({ offset: true }).nullable().optional(),
});
export type CreateApiKeyInput = z.infer<typeof createApiKeySchema>;
