'use server';

import { redirect } from 'next/navigation';
import {
  createCommunitySchema,
  isRedeemSuccess,
  joinMessage,
  normalizeJoinCode,
  redeemMessage,
  requestToJoinSchema,
  type MemberRole,
} from '@samudaya/core';
import { getSupabase } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth';
import { fieldErrors, type ActionState } from '@/lib/action-state';

/**
 * Two ways into a community.
 *
 * The usual one: the admin shares a **Society ID**, the resident picks their
 * flat and asks to join, and the admin approves. Knowing the ID alone gets
 * nobody in, which is why it can safely be printed on a notice board.
 *
 * The quicker one: an **invite code**, which is already approved, so the
 * resident skips the waiting step.
 */

export type LookupState = ActionState & {
  community?: { id: string; name: string; slug: string; joinCode: string };
  units?: { id: string; block: string | null; number: string }[];
};

/** Step one: find the society and list its flats so the resident can pick one. */
export async function findCommunity(_prev: LookupState, formData: FormData): Promise<LookupState> {
  await requireUser();

  const code = normalizeJoinCode(String(formData.get('join_code') ?? ''));
  if (code.length < 4) {
    return { fieldErrors: { join_code: 'Enter the Society ID your admin gave you.' } };
  }

  const supabase = await getSupabase();

  // The lookup itself goes through request_to_join with no unit, which both
  // validates the code and records the attempt against the brute-force
  // throttle. It returns the society's name without exposing anything else.
  const { data, error } = await supabase.rpc('request_to_join', {
    p_join_code: code,
    p_name: 'Resident',
  });

  if (error) return { error: 'We could not check that ID. Please try again.' };

  const row = data?.[0];
  if (!row?.status) return { error: joinMessage('not_found') };

  if (row.status === 'already_member') {
    const { data: community } = await supabase
      .from('communities')
      .select('slug')
      .eq('id', row.community_id ?? '')
      .maybeSingle();
    if (community) redirect(`/app/${community.slug}`);
    return { error: joinMessage('already_member') };
  }

  if (row.status !== 'pending') return { error: joinMessage(row.status) };

  // A pending request now exists; the resident refines it by picking a flat.
  const { data: units } = await supabase
    .from('units')
    .select('id, block, number')
    .eq('community_id', row.community_id ?? '')
    .order('block', { nullsFirst: true })
    .order('number');

  return {
    community: {
      id: row.community_id ?? '',
      name: row.community_name ?? 'this community',
      slug: '',
      joinCode: code,
    },
    units: units ?? [],
  };
}

export type RequestState = ActionState & { submitted?: { communityName: string } };

/** Step two: confirm who they are and which flat. */
export async function submitJoinRequest(
  _prev: RequestState,
  formData: FormData,
): Promise<RequestState> {
  await requireUser();

  const parsed = requestToJoinSchema.safeParse({
    join_code: formData.get('join_code'),
    unit_id: String(formData.get('unit_id') ?? '') || null,
    name: formData.get('name'),
    phone: formData.get('phone') || undefined,
    relation: formData.get('relation') || 'owner',
  });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };

  const supabase = await getSupabase();
  const { data, error } = await supabase.rpc('request_to_join', {
    p_join_code: parsed.data.join_code,
    p_unit_id: parsed.data.unit_id ?? undefined,
    p_name: parsed.data.name,
    p_phone: parsed.data.phone ?? undefined,
    p_relation: parsed.data.relation,
  });

  if (error) return { error: 'We could not send that request. Please try again.' };

  const row = data?.[0];
  if (!row?.status) return { error: joinMessage('not_found') };
  if (row.status !== 'pending') return { error: joinMessage(row.status) };

  // Keep the name on the profile too, so the admin sees a real person.
  await supabase.auth.updateUser({ data: { full_name: parsed.data.name } });

  return { submitted: { communityName: row.community_name ?? 'your community' } };
}

export type InviteState = ActionState & {
  preview?: { code: string; communityName: string; role: MemberRole; unitLabel: string | null };
};

export async function checkInviteCode(
  _prev: InviteState,
  formData: FormData,
): Promise<InviteState> {
  await requireUser();

  const code = normalizeJoinCode(String(formData.get('code') ?? ''));
  if (code.length < 4) return { error: 'Enter the code your community admin gave you.' };

  const supabase = await getSupabase();
  const { data, error } = await supabase.rpc('preview_invite_code', { p_code: code });
  if (error) return { error: 'We could not check that code. Please try again.' };

  const row = data?.[0];
  if (!row?.status) return { error: redeemMessage('not_found') };
  if (row.status !== 'ok') return { error: redeemMessage(row.status) };

  return {
    preview: {
      code,
      communityName: row.community_name ?? 'this community',
      role: (row.role ?? 'resident') as MemberRole,
      unitLabel: row.unit_label,
    },
  };
}

export async function redeemInviteCode(
  _prev: InviteState,
  formData: FormData,
): Promise<InviteState> {
  await requireUser();

  const code = normalizeJoinCode(String(formData.get('code') ?? ''));
  if (!code) return { error: 'Enter the code your community admin gave you.' };

  const supabase = await getSupabase();
  const { data, error } = await supabase.rpc('redeem_invite_code', {
    p_code: code,
    p_channel: 'web',
  });

  if (error) return { error: 'We could not use that code. Please try again.' };

  const row = data?.[0];
  if (!row?.status) return { error: redeemMessage('not_found') };
  if (!isRedeemSuccess(row.status)) return { error: redeemMessage(row.status) };

  redirect(`/app/${row.community_slug}?joined=1`);
}

export type CreateState = ActionState;

/** Founding a new society. The database makes the creator its owner. */
export async function createCommunity(
  _prev: CreateState,
  formData: FormData,
): Promise<CreateState> {
  const user = await requireUser();

  const parsed = createCommunitySchema.safeParse({
    name: formData.get('name'),
    slug: formData.get('slug'),
    city: formData.get('city') || undefined,
    country: formData.get('country') || 'IN',
    timezone: formData.get('timezone') || 'Asia/Kolkata',
    currency: formData.get('currency') || 'INR',
  });

  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };

  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from('communities')
    .insert({ ...parsed.data, created_by: user.id })
    .select('slug')
    .single();

  if (error) {
    if (error.code === '23505') {
      return { fieldErrors: { slug: 'That address is already taken. Try another.' } };
    }
    return { error: 'We could not create the community. Please try again.' };
  }

  redirect(`/app/${data.slug}?welcome=1`);
}
