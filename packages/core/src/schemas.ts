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

/**
 * What a resident actually types: a ten-digit Indian mobile, often with spaces
 * or dashes, sometimes already international. Normalised to E.164 before it
 * goes anywhere. `app.e164()` in the database applies the same rule, so a
 * client that forgets cannot write something the check constraint refuses.
 */
export const residentPhoneSchema = z
  .string()
  .trim()
  .transform((value) => value.replace(/[\s()-]/g, ''))
  .transform((value) => (/^[6-9]\d{9}$/.test(value) ? `+91${value}` : value))
  .pipe(phoneSchema);

/**
 * A WhatsApp group invite link, and nothing else.
 *
 * Societies run on WhatsApp and every festival spawns another group; the app
 * holds the link rather than trying to replace the group. It is rendered as
 * something people tap, so it must not be a place to park an arbitrary URL —
 * the same shape is enforced by a check constraint where it lands.
 */
export const whatsappGroupSchema = z
  .string()
  .trim()
  .regex(
    /^https:\/\/chat\.whatsapp\.com\/[A-Za-z0-9]{10,40}$/,
    'Paste the invite link from WhatsApp → Group info → Invite via link',
  );

/** Empty means "no group", which is different from a link that is wrong. */
export const optionalWhatsappGroup = whatsappGroupSchema
  .optional()
  .or(z.literal('').transform(() => null));

export const memberRoleSchema = z.enum(['resident', 'staff', 'committee']);
/** Every role can be assigned; the database keeps at least one committee member. */
export const assignableRoleSchema = z.enum(['resident', 'staff', 'committee']);
export const occupantRelationSchema = z.enum(['owner', 'tenant', 'family', 'other']);
export const audienceSchema = z.enum(['all', 'residents', 'committee']);
export const taskStatusSchema = z.enum(['todo', 'in_progress', 'done', 'blocked']);
export const eventStatusSchema = z.enum([
  'proposed',
  'draft',
  'published',
  'completed',
  'cancelled',
]);
export const eventKindSchema = z.enum(['event', 'campaign']);
export const suggestionKindSchema = z.enum(['activity', 'idea']);
export const fundRuleSchema = z.enum([
  'carry_next_edition',
  'carry_related',
  'general_fund',
  'refund',
  'donate',
]);
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
export const expenseDecisionSchema = z.enum(['approved', 'rejected', 'changes_requested']);

const slug = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9][a-z0-9-]{1,60}$/, 'Use lowercase letters, numbers and hyphens');

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected a date like 2026-09-14');

// ---------------------------------------------------------------------------
// Society
// ---------------------------------------------------------------------------

/** Matches communities_pincode_format: a six-digit Indian PIN code. */
export const pincodeSchema = z
  .string()
  .trim()
  .regex(/^[1-9][0-9]{5}$/, 'Enter a 6-digit PIN code');

const optionalText = (max: number, message?: string) =>
  z
    .string()
    .trim()
    .max(max, message ?? `Keep it under ${max} characters`)
    .optional()
    .transform((value) => value || undefined);

/**
 * Founding a society from the app. The web address, the Society ID and the
 * founder are all decided by public.create_society(), so they are deliberately
 * not accepted here: a client that could pick its own `created_by` could hand
 * itself a committee seat in someone else's society.
 *
 * Only the name, city and the founder's phone are asked for up front. The
 * flats, the UPI ID and everything else come later, on the committee's setup
 * checklist.
 */
export const foundSocietySchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Give your society a name')
    .max(120, 'Keep the name under 120 characters'),
  city: z.string().trim().min(2, 'Which city is it in?').max(80),
  address: optionalText(300, 'Keep the address under 300 characters'),
  pincode: pincodeSchema.optional().or(z.literal('').transform(() => undefined)),
  // Asked for here rather than left to the checklist: the founder is the
  // committee, and was the one member nobody could reach.
  phone: residentPhoneSchema,
});
export type FoundSocietyInput = z.infer<typeof foundSocietySchema>;

export const createUnitSchema = z.object({
  community_id: uuid,
  block: z.string().trim().max(20).optional(),
  number: z.string().trim().min(1, 'Unit number is required').max(20),
  floor: z.coerce.number().int().min(-5).max(200).optional(),
  bedrooms: z.coerce.number().int().min(0).max(20).optional(),
});
export type CreateUnitInput = z.infer<typeof createUnitSchema>;

export const requestToJoinSchema = z.object({
  join_code: z.string().trim().min(4, 'Enter the Society ID your admin gave you').max(20),
  unit_id: uuid.nullable().optional(),
  name: z.string().trim().min(2, 'Tell us your name').max(120),
  phone: z.string().trim().max(20).optional(),
  relation: occupantRelationSchema.default('owner'),
});
export type RequestToJoinInput = z.infer<typeof requestToJoinSchema>;

export const reviewJoinRequestSchema = z.object({
  request_id: uuid,
  approve: z.boolean(),
  role: assignableRoleSchema.default('resident'),
  reason: z.string().trim().max(300).optional(),
});

export const updateMemberRoleSchema = z.object({
  membership_id: uuid,
  role: assignableRoleSchema,
});

// ---------------------------------------------------------------------------
// Invite codes (the pre-approved way in)
// ---------------------------------------------------------------------------

export const createInviteCodeSchema = z
  .object({
    community_id: uuid,
    role: assignableRoleSchema.default('resident'),
    unit_id: uuid.optional().nullable(),
    relation: occupantRelationSchema.default('owner'),
    max_uses: z.coerce.number().int().min(1).max(10000).nullable().default(1),
    expires_at: z.string().datetime({ offset: true }).nullable().optional(),
    label: z.string().trim().max(120).optional(),
  })
  .refine((v) => !v.expires_at || new Date(v.expires_at).getTime() > Date.now(), {
    message: 'The expiry date has to be in the future',
    path: ['expires_at'],
  });
export type CreateInviteCodeInput = z.infer<typeof createInviteCodeSchema>;

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

export const createEventSchema = z
  .object({
    community_id: uuid,
    slug: slug,
    emoji: z.string().trim().min(1).max(8).default('🎉'),
    name: z.string().trim().min(3, 'Give the event a name').max(140),
    starts_on: isoDate,
    ends_on: isoDate.nullable().optional(),
    venue: z.string().trim().max(140).optional(),
    organizer: z.string().trim().max(140).optional(),
    description: z.string().trim().max(5000).optional(),
    expected_attendance: z.coerce.number().int().min(0).max(100000).optional(),
    fund_target: z.coerce.number().min(0).max(100_000_000).default(0),
    // What each flat is asked for. Empty is a real answer — plenty of events
    // take whatever people give — so a blank field is null, not zero, and the
    // database refuses a zero outright.
    suggested_amount: z.coerce
      .number()
      .positive('A suggested amount has to be more than nothing')
      .max(10_000_000)
      .nullable()
      .optional(),
    fund_rule: fundRuleSchema.default('general_fund'),
    fund_rule_note: z.string().trim().max(300).optional(),
    // A group for this event specifically — "Deepavali volunteers" — as
    // opposed to the society's own.
    whatsapp_group_url: optionalWhatsappGroup,
  })
  .refine((v) => !v.ends_on || v.ends_on >= v.starts_on, {
    message: 'The event cannot end before it starts',
    path: ['ends_on'],
  });
export type CreateEventInput = z.infer<typeof createEventSchema>;

/** One line of the budget. Their sum becomes the event's fund target. */
export const budgetLineSchema = z.object({
  name: z.string().trim().min(1, 'Name the line item').max(80),
  amount: z.coerce.number().min(0).max(100_000_000),
});
export type BudgetLine = z.infer<typeof budgetLineSchema>;

export const createTaskSchema = z.object({
  event_id: uuid,
  name: z.string().trim().min(2, 'Describe the task').max(200),
  notes: z.string().trim().max(2000).optional(),
  status: taskStatusSchema.default('todo'),
  assignee_id: uuid.nullable().optional(),
  due_on: isoDate.nullable().optional(),
});

export const updateTaskSchema = z.object({
  id: uuid,
  status: taskStatusSchema.optional(),
  assignee_id: uuid.nullable().optional(),
  due_on: isoDate.nullable().optional(),
});

// ---------------------------------------------------------------------------
// Fund
// ---------------------------------------------------------------------------

export const contributeSchema = z.object({
  event_id: uuid,
  amount: z.coerce
    .number()
    .positive('Enter an amount greater than zero')
    .max(10_000_000, 'That is larger than this app will accept'),
  method: paymentMethodSchema.default('upi'),
  channel: originChannelSchema.default('web'),
});
export type ContributeInput = z.infer<typeof contributeSchema>;

export const createExpenseSchema = z.object({
  event_id: uuid,
  name: z.string().trim().min(2, 'Name the expense').max(140),
  category: z.string().trim().max(60).optional(),
  amount: z.coerce.number().positive('Enter an amount greater than zero').max(10_000_000),
  vendor: z.string().trim().max(140).optional(),
  paid_by: z.string().trim().max(140).optional(),
  method: paymentMethodSchema.default('upi'),
  bill_url: z.string().trim().max(500).optional(),
  spent_on: isoDate.optional(),
});
export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;

export const reviewExpenseSchema = z.object({
  expense_id: uuid,
  decision: expenseDecisionSchema,
  note: z.string().trim().max(500).optional(),
});

export const closeEventSchema = z.object({
  event_id: uuid,
  // Typing the event's name is a deliberate speed bump: closing publishes a
  // report and freezes the ledger.
  confirm_name: z.string().trim().min(1),
});

// ---------------------------------------------------------------------------
// Taking part
// ---------------------------------------------------------------------------

export const createActivitySchema = z.object({
  event_id: uuid,
  name: z.string().trim().min(2, 'Name the activity').max(80),
  emoji: z.string().trim().min(1).max(8).default('🎭'),
  description: z.string().trim().max(2000).optional(),
  coordinator_id: uuid.nullable().optional(),
  capacity: z.coerce.number().int().min(1).max(10000).nullable().optional(),
  practice_dates: z.array(isoDate).max(20).default([]),
});
export type CreateActivityInput = z.infer<typeof createActivitySchema>;

export const joinActivitySchema = z.object({
  activity_id: uuid,
  performance_type: z.string().trim().max(80).optional(),
  age_group: z.string().trim().max(40).optional(),
  experience: z.string().trim().max(80).optional(),
  special_requirements: z.string().trim().max(500).optional(),
  channel: originChannelSchema.default('web'),
});

export const createVolunteerRoleSchema = z.object({
  event_id: uuid,
  name: z.string().trim().min(2, 'Name the role').max(80),
  emoji: z.string().trim().min(1).max(8).default('🙋'),
  description: z.string().trim().max(1000).optional(),
  target_count: z.coerce.number().int().min(1).max(500).default(1),
  coordinator_id: uuid.nullable().optional(),
});

export const volunteerSchema = z.object({
  role_id: uuid,
  note: z.string().trim().max(300).optional(),
  channel: originChannelSchema.default('web'),
});

export const suggestActivitySchema = z.object({
  community_id: uuid,
  event_id: uuid.nullable().optional(),
  name: z.string().trim().min(3, 'Give your idea a name').max(120),
  description: z.string().trim().max(2000).optional(),
  expected_participants: z.coerce.number().int().min(0).max(10000).optional(),
  wants_to_coordinate: z.boolean().default(false),
});
export type SuggestActivityInput = z.infer<typeof suggestActivitySchema>;

// ---------------------------------------------------------------------------
// Community voice
// ---------------------------------------------------------------------------

export const createAnnouncementSchema = z.object({
  community_id: uuid,
  event_id: uuid.nullable().optional(),
  title: z.string().trim().min(3, 'Give the notice a title').max(160),
  body: z.string().trim().min(1, 'Write the notice').max(10_000),
  audience: audienceSchema.default('all'),
  is_pinned: z.boolean().default(false),
  expires_at: z.string().datetime({ offset: true }).nullable().optional(),
});
export type CreateAnnouncementInput = z.infer<typeof createAnnouncementSchema>;

export const createPollSchema = z.object({
  community_id: uuid,
  event_id: uuid.nullable().optional(),
  question: z.string().trim().min(5, 'Ask a question').max(300),
  detail: z.string().trim().max(2000).optional(),
  options: z
    .array(z.string().trim().min(1).max(80))
    .min(2, 'A poll needs at least two options')
    .max(10),
  closes_at: z.string().datetime({ offset: true }).nullable().optional(),
});
export type CreatePollInput = z.infer<typeof createPollSchema>;

export const votePollSchema = z.object({
  poll_id: uuid,
  option_id: uuid,
  channel: originChannelSchema.default('web'),
});

// ---------------------------------------------------------------------------
// API keys
// ---------------------------------------------------------------------------

export const API_SCOPES = [
  'events:read',
  'events:write',
  'expenses:read',
  'expenses:write',
  'activities:read',
  'activities:write',
  'announcements:read',
  'announcements:write',
  'members:read',
  'polls:read',
] as const;
export type ApiScope = (typeof API_SCOPES)[number];

export const createApiKeySchema = z.object({
  community_id: uuid,
  name: z.string().trim().min(2, 'Name the key so you can recognise it later').max(80),
  scopes: z.array(z.enum(API_SCOPES)).min(1, 'Pick at least one scope'),
  expires_at: z.string().datetime({ offset: true }).nullable().optional(),
});
export type CreateApiKeyInput = z.infer<typeof createApiKeySchema>;
