'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import {
  contributeSchema,
  joinActivitySchema,
  suggestActivitySchema,
  volunteerSchema,
  votePollSchema,
  voteReallocationSchema,
} from '@samudaya/core';
import { requireCommunity } from '@/lib/auth';
import { getSupabase } from '@/lib/supabase/server';
import { EMPTY_STATE, fieldErrors, friendlyDbError, type ActionState } from '@/lib/action-state';

/**
 * Everything a resident does to an event. Each action re-establishes who the
 * caller is from the session rather than trusting anything in the form, and
 * the database checks it again — these are convenience, not the boundary.
 */

export type ContributeState = ActionState & { receipt?: string; amount?: number };

export async function contribute(
  _prev: ContributeState,
  formData: FormData,
): Promise<ContributeState> {
  const slug = String(formData.get('slug') ?? '');
  const eventSlug = String(formData.get('event') ?? '');
  const context = await requireCommunity(slug);
  const supabase = await getSupabase();

  const { data: event } = await supabase
    .from('events')
    .select('id, slug, status')
    .eq('community_id', context.community.id)
    .eq('slug', eventSlug)
    .maybeSingle();

  if (!event) return { error: 'That event no longer exists.' };
  if (event.status !== 'published') {
    return { error: 'This event is not accepting contributions.' };
  }

  const parsed = contributeSchema.safeParse({
    event_id: event.id,
    amount: formData.get('amount'),
    method: formData.get('method') || 'upi',
    channel: 'web',
  });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };

  // This records the contribution. Wiring a real payment gateway means taking
  // its webhook and inserting the row with `status: 'pending'` until the
  // gateway confirms — the schema already carries `gateway_payload` for that.
  const { data, error } = await supabase
    .from('contributions')
    .insert({
      event_id: event.id,
      community_id: context.community.id,
      membership_id: context.membership.id,
      unit_id: context.unitIds[0] ?? null,
      amount: parsed.data.amount,
      method: parsed.data.method,
      status: 'succeeded',
      channel: 'web',
    })
    .select('receipt_no')
    .single();

  if (error) return { error: friendlyDbError(error) };

  revalidatePath(`/app/${slug}/events/${eventSlug}`);
  revalidatePath(`/app/${slug}`);
  return {
    ...EMPTY_STATE,
    receipt: String(data.receipt_no),
    amount: parsed.data.amount,
  };
}

export async function joinActivity(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const slug = String(formData.get('slug') ?? '');
  const eventSlug = String(formData.get('event') ?? '');
  const context = await requireCommunity(slug);

  const parsed = joinActivitySchema.safeParse({
    activity_id: formData.get('activity_id'),
    performance_type: formData.get('performance_type') || undefined,
    age_group: formData.get('age_group') || undefined,
    experience: formData.get('experience') || undefined,
    special_requirements: formData.get('special_requirements') || undefined,
    channel: 'web',
  });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };

  const supabase = await getSupabase();
  // Signing up twice is a double tap, not a second performer, so update the
  // details rather than failing on the unique constraint.
  const { error } = await supabase
    .from('activity_participants')
    .upsert(
      { ...parsed.data, membership_id: context.membership.id },
      { onConflict: 'activity_id,membership_id' },
    );

  if (error) return { error: friendlyDbError(error) };

  revalidatePath(`/app/${slug}/events/${eventSlug}`);
  return { ...EMPTY_STATE, success: 'You’re in.' };
}

export async function leaveActivity(formData: FormData): Promise<void> {
  const slug = String(formData.get('slug') ?? '');
  const eventSlug = String(formData.get('event') ?? '');
  const context = await requireCommunity(slug);

  const supabase = await getSupabase();
  await supabase
    .from('activity_participants')
    .delete()
    .eq('activity_id', String(formData.get('activity_id') ?? ''))
    .eq('membership_id', context.membership.id);

  revalidatePath(`/app/${slug}/events/${eventSlug}`);
}

export async function volunteer(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const slug = String(formData.get('slug') ?? '');
  const eventSlug = String(formData.get('event') ?? '');
  const context = await requireCommunity(slug);

  const parsed = volunteerSchema.safeParse({
    role_id: formData.get('role_id'),
    note: formData.get('note') || undefined,
    channel: 'web',
  });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };

  const supabase = await getSupabase();
  const { error } = await supabase
    .from('event_volunteers')
    .upsert(
      { ...parsed.data, membership_id: context.membership.id },
      { onConflict: 'role_id,membership_id' },
    );

  if (error) return { error: friendlyDbError(error) };

  revalidatePath(`/app/${slug}/events/${eventSlug}`);
  return { ...EMPTY_STATE, success: 'Thanks for signing up.' };
}

export async function withdrawVolunteer(formData: FormData): Promise<void> {
  const slug = String(formData.get('slug') ?? '');
  const eventSlug = String(formData.get('event') ?? '');
  const context = await requireCommunity(slug);

  const supabase = await getSupabase();
  await supabase
    .from('event_volunteers')
    .delete()
    .eq('role_id', String(formData.get('role_id') ?? ''))
    .eq('membership_id', context.membership.id);

  revalidatePath(`/app/${slug}/events/${eventSlug}`);
}

export async function suggestActivity(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const slug = String(formData.get('slug') ?? '');
  const context = await requireCommunity(slug);

  const eventId = String(formData.get('event_id') ?? '').trim();

  const parsed = suggestActivitySchema.safeParse({
    community_id: context.community.id,
    event_id: eventId || null,
    name: formData.get('name'),
    description: formData.get('description') || undefined,
    expected_participants: formData.get('expected_participants') || undefined,
    wants_to_coordinate: formData.get('wants_to_coordinate') === 'on',
  });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };

  const supabase = await getSupabase();
  const { error } = await supabase
    .from('activity_suggestions')
    .insert({ ...parsed.data, suggested_by: context.membership.id, status: 'new' });

  if (error) return { error: friendlyDbError(error) };

  revalidatePath(`/app/${slug}/feed`);
  return { ...EMPTY_STATE, success: 'Sent to the committee. Thanks for the idea.' };
}

export async function toggleSuggestionInterest(formData: FormData): Promise<void> {
  const slug = String(formData.get('slug') ?? '');
  const suggestionId = String(formData.get('suggestion_id') ?? '');
  const interested = formData.get('interested') === '1';
  const context = await requireCommunity(slug);

  const supabase = await getSupabase();
  if (interested) {
    await supabase
      .from('suggestion_interests')
      .delete()
      .eq('suggestion_id', suggestionId)
      .eq('membership_id', context.membership.id);
  } else {
    await supabase
      .from('suggestion_interests')
      .upsert({ suggestion_id: suggestionId, membership_id: context.membership.id });
  }

  revalidatePath(`/app/${slug}/feed`);
}

export async function votePoll(formData: FormData): Promise<void> {
  const slug = String(formData.get('slug') ?? '');
  const context = await requireCommunity(slug);

  const parsed = votePollSchema.safeParse({
    poll_id: formData.get('poll_id'),
    option_id: formData.get('option_id'),
    channel: 'web',
  });
  if (!parsed.success) return;

  const supabase = await getSupabase();
  // Changing your mind is allowed while a poll is open; voting twice is not,
  // which the unique constraint turns into this upsert.
  await supabase
    .from('poll_votes')
    .upsert(
      { ...parsed.data, membership_id: context.membership.id },
      { onConflict: 'poll_id,membership_id' },
    );

  revalidatePath(`/app/${slug}/feed`);
}

export type ReallocationState = ActionState & { resolved?: boolean; approved?: boolean };

export async function voteReallocation(
  _prev: ReallocationState,
  formData: FormData,
): Promise<ReallocationState> {
  const slug = String(formData.get('slug') ?? '');
  await requireCommunity(slug);

  const parsed = voteReallocationSchema.safeParse({
    reallocation_id: formData.get('reallocation_id'),
    approve: formData.get('approve') === '1',
    channel: 'web',
  });
  if (!parsed.success) return { error: 'That vote could not be recorded.' };

  const supabase = await getSupabase();
  // The tally and the threshold check happen inside the database, in the same
  // transaction as the vote — two people voting at once cannot both read a
  // pre-threshold count and neither resolve it.
  const { data, error } = await supabase.rpc('vote_on_reallocation', {
    p_reallocation_id: parsed.data.reallocation_id,
    p_approve: parsed.data.approve,
    p_channel: 'web',
  });

  if (error) return { error: friendlyDbError(error) };

  const row = data?.[0];
  revalidatePath(`/app/${slug}/feed`);
  revalidatePath(`/app/${slug}`);

  if (row?.status === 'already_resolved') {
    return { error: 'That vote has already closed.' };
  }
  return {
    ...EMPTY_STATE,
    success: row?.resolved
      ? row.approved
        ? 'Approved — the transfer is recorded in the audit log.'
        : 'The proposal did not pass.'
      : 'Your vote has been recorded.',
    resolved: row?.resolved ?? false,
    approved: row?.approved ?? false,
  };
}

export async function goToEvent(slug: string, eventSlug: string): Promise<never> {
  redirect(`/app/${slug}/events/${eventSlug}`);
}
