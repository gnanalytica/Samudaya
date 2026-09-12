import {
  createAnnouncementSchema,
  createServiceRequestSchema,
  createVisitorPassSchema,
  addRequestCommentSchema,
  updateServiceRequestSchema,
} from '@samudaya/core';
import type { ZodError } from 'zod';
import type { Enums } from '@samudaya/supabase';
import type { ApiPrincipal } from './auth';

/**
 * Every query the public API makes, in one file.
 *
 * The rule this module exists to enforce: **an API-key principal runs with the
 * service role, which bypasses row-level security.** Its community boundary is
 * therefore only as good as the `.eq('community_id', …)` on each query. Rather
 * than trust each route handler to remember, all of them live here and every
 * one applies the filter — including for user principals, where it is
 * redundant but harmless.
 *
 * If you add a query, add it here, and filter by `principal.communityId`.
 */

/**
 * Explicitly discriminated on `ok`. Returning bare `{ error }` / `{ data }`
 * object literals looks tidier but TypeScript merges them into one shape with
 * both keys optional, and `'error' in result` then narrows nothing.
 */
export type Outcome<T> =
  | { ok: true; data: T }
  | { ok: false; reason: 'invalid'; error: ZodError }
  | { ok: false; reason: 'not_found' };

const invalid = (error: ZodError): Outcome<never> => ({ ok: false, reason: 'invalid', error });
const notFound = (): Outcome<never> => ({ ok: false, reason: 'not_found' });

const withCommunity = (principal: ApiPrincipal) => principal.communityId;

const REQUEST_STATUSES: Enums<'request_status'>[] = [
  'open',
  'acknowledged',
  'in_progress',
  'resolved',
  'closed',
  'rejected',
];

/** Keeps an arbitrary `?status=` string from reaching the query untyped. */
function parseStatuses(value: string | null | undefined): Enums<'request_status'>[] {
  if (!value) return [];
  return value
    .split(',')
    .map((part) => part.trim())
    .filter((part): part is Enums<'request_status'> =>
      (REQUEST_STATUSES as string[]).includes(part),
    );
}

export async function whoami(principal: ApiPrincipal) {
  const { data: community } = await principal.db
    .from('communities')
    .select('id, name, slug, city, timezone, currency')
    .eq('id', withCommunity(principal))
    .maybeSingle();

  return {
    kind: principal.kind,
    community,
    role: principal.role,
    scopes: principal.scopes,
  };
}

export async function listAnnouncements(principal: ApiPrincipal, limit: number) {
  const now = new Date().toISOString();
  const { data, error } = await principal.db
    .from('announcements')
    .select('id, title, body, audience, is_pinned, published_at, expires_at')
    .eq('community_id', withCommunity(principal))
    .lte('published_at', now)
    .or(`expires_at.is.null,expires_at.gt.${now}`)
    .order('is_pinned', { ascending: false })
    .order('published_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data;
}

export async function createAnnouncement(principal: ApiPrincipal, body: unknown) {
  const parsed = createAnnouncementSchema.safeParse({
    ...(body as Record<string, unknown>),
    community_id: withCommunity(principal),
  });
  if (!parsed.success) return invalid(parsed.error);

  const { data, error } = await principal.db
    .from('announcements')
    .insert({ ...parsed.data, author_id: principal.membershipId })
    .select('id, title, body, audience, is_pinned, published_at')
    .single();

  if (error) throw error;
  return { ok: true as const, data };
}

const REQUEST_FIELDS =
  'id, ticket_no, title, description, category, status, priority, created_at, resolved_at, channel, units(block, number)';

export async function listRequests(
  principal: ApiPrincipal,
  options: { limit: number; status?: string | null },
) {
  let query = principal.db
    .from('service_requests')
    .select(REQUEST_FIELDS)
    .eq('community_id', withCommunity(principal))
    .order('created_at', { ascending: false })
    .limit(options.limit);

  const statuses = parseStatuses(options.status);
  if (statuses.length > 0) query = query.in('status', statuses);

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function getRequest(principal: ApiPrincipal, id: string) {
  const { data, error } = await principal.db
    .from('service_requests')
    .select(REQUEST_FIELDS)
    .eq('community_id', withCommunity(principal))
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function createRequest(principal: ApiPrincipal, body: unknown) {
  const parsed = createServiceRequestSchema.safeParse({
    ...(body as Record<string, unknown>),
    community_id: withCommunity(principal),
    channel: 'api',
  });
  if (!parsed.success) return invalid(parsed.error);

  const { data, error } = await principal.db
    .from('service_requests')
    .insert({ ...parsed.data, raised_by: principal.membershipId })
    .select(REQUEST_FIELDS)
    .single();

  if (error) throw error;
  return { ok: true as const, data };
}

export async function updateRequest(principal: ApiPrincipal, id: string, body: unknown) {
  const parsed = updateServiceRequestSchema.safeParse({
    ...(body as Record<string, unknown>),
    id,
  });
  if (!parsed.success) return invalid(parsed.error);

  const { id: _id, ...changes } = parsed.data;
  const { data, error } = await principal.db
    .from('service_requests')
    .update(changes)
    .eq('id', id)
    .eq('community_id', withCommunity(principal))
    .select(REQUEST_FIELDS)
    .maybeSingle();

  if (error) throw error;
  return { ok: true as const, data };
}

export async function addRequestComment(principal: ApiPrincipal, id: string, body: unknown) {
  const parsed = addRequestCommentSchema.safeParse({
    ...(body as Record<string, unknown>),
    request_id: id,
  });
  if (!parsed.success) return invalid(parsed.error);

  // The request must belong to this community before anything is written to it.
  const target = await getRequest(principal, id);
  if (!target) return notFound();

  const { data, error } = await principal.db
    .from('service_request_comments')
    .insert({ ...parsed.data, author_id: principal.membershipId, channel: 'api' })
    .select('id, body, is_internal, created_at')
    .single();

  if (error) throw error;
  return { ok: true as const, data };
}

export async function listVisitors(principal: ApiPrincipal, limit: number) {
  const { data, error } = await principal.db
    .from('visitor_passes')
    .select(
      'id, visitor_name, kind, status, pass_code, expected_at, valid_until, units(block, number)',
    )
    .eq('community_id', withCommunity(principal))
    .order('expected_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data;
}

export async function createVisitorPass(principal: ApiPrincipal, body: unknown) {
  const parsed = createVisitorPassSchema.safeParse({
    ...(body as Record<string, unknown>),
    community_id: withCommunity(principal),
    channel: 'api',
  });
  if (!parsed.success) return invalid(parsed.error);

  const { data, error } = await principal.db
    .from('visitor_passes')
    .insert({ ...parsed.data, created_by: principal.membershipId })
    .select('id, visitor_name, kind, status, pass_code, expected_at, valid_until')
    .single();

  if (error) throw error;
  return { ok: true as const, data };
}

export async function listAmenities(principal: ApiPrincipal) {
  const { data, error } = await principal.db
    .from('amenities')
    .select('id, name, description, capacity, opens_at, closes_at, booking_fee, requires_approval')
    .eq('community_id', withCommunity(principal))
    .eq('is_active', true)
    .order('name');

  if (error) throw error;
  return data;
}

export async function listBookings(principal: ApiPrincipal, limit: number) {
  const { data, error } = await principal.db
    .from('amenity_bookings')
    .select('id, starts_at, ends_at, status, guests, amenities(name)')
    .eq('community_id', withCommunity(principal))
    .gte('ends_at', new Date().toISOString())
    .in('status', ['pending', 'confirmed'])
    .order('starts_at')
    .limit(limit);

  if (error) throw error;
  return data;
}

export async function listMembers(principal: ApiPrincipal, limit: number) {
  const { data, error } = await principal.db
    .from('memberships')
    .select('id, role, status, joined_at, profiles(full_name)')
    .eq('community_id', withCommunity(principal))
    .eq('status', 'active')
    .order('joined_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data;
}

export async function listInvoices(principal: ApiPrincipal, limit: number) {
  const { data, error } = await principal.db
    .from('invoices')
    .select(
      'id, number, title, total, amount_paid, balance_due, due_date, status, units(block, number)',
    )
    .eq('community_id', withCommunity(principal))
    .order('due_date', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data;
}
