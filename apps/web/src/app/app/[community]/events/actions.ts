'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import {
  joinActivitySchema,
  reportPaymentSchema,
  suggestActivitySchema,
  suggestionKindSchema,
  uuid,
  volunteerSchema,
  votePollSchema,
  voteReallocationSchema,
} from '@samudaya/core';
import { requireCapability, requireCommunity } from '@/lib/auth';
import { getSupabase } from '@/lib/supabase/server';
import { EMPTY_STATE, fieldErrors, friendlyDbError, type ActionState } from '@/lib/action-state';

/**
 * Everything a resident does to an event. Each action re-establishes who the
 * caller is from the session rather than trusting anything in the form, and
 * the database checks it again — these are convenience, not the boundary.
 */

export type ContributeState = ActionState & { reported?: { amount: number; reference: string } };

/**
 * A resident reports a UPI payment they made to the society's UPI ID. It is
 * saved as pending and counts towards the fund only once staff confirm the
 * reference against the bank statement.
 */
export async function contribute(
  _prev: ContributeState,
  formData: FormData,
): Promise<ContributeState> {
  const slug = String(formData.get('slug') ?? '');
  const eventSlug = String(formData.get('event') ?? '');
  const context = await requireCapability(slug, 'contribute');
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
  if (!context.community.upi_vpa) {
    return { error: 'Your society has not set up UPI payments yet. Ask the committee.' };
  }

  const parsed = reportPaymentSchema.safeParse({
    event_id: event.id,
    amount: formData.get('amount'),
    reference: formData.get('reference'),
  });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };

  // Screenshots live under this resident's own folder; storage policies refuse
  // anything else, so only accept a path that points there.
  const proof = String(formData.get('proof_path') ?? '').trim();
  const proofFolder = `${context.community.id}/${context.membership.id}/`;
  if (proof && !proof.startsWith(proofFolder)) {
    return { error: 'That screenshot could not be attached. Please upload it again.' };
  }

  const { error } = await supabase.from('contributions').insert({
    event_id: event.id,
    community_id: context.community.id,
    membership_id: context.membership.id,
    unit_id: context.unitIds[0] ?? null,
    amount: parsed.data.amount,
    method: 'upi',
    reference: parsed.data.reference,
    proof_path: proof || null,
    status: 'pending',
    channel: 'web',
  });

  if (error) {
    const message = friendlyDbError(error);
    return message.startsWith('That UPI reference')
      ? { fieldErrors: { reference: message } }
      : { error: message };
  }

  revalidatePath(`/app/${slug}/events/${eventSlug}`);
  revalidatePath(`/app/${slug}/events/${eventSlug}/contribute`);
  revalidatePath(`/app/${slug}/admin/events/${eventSlug}`);
  revalidatePath(`/app/${slug}/me`);
  return {
    ...EMPTY_STATE,
    reported: { amount: parsed.data.amount, reference: parsed.data.reference },
  };
}

/**
 * Registers the signed-in resident, or a family member by name, for an
 * activity. Several people from one flat can take part: each account registers
 * separately, and a resident can add children or relatives who have no account.
 */
export async function registerForActivity(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const slug = String(formData.get('slug') ?? '');
  const eventSlug = String(formData.get('event') ?? '');
  const context = await requireCapability(slug, 'activities:register');

  const parsed = joinActivitySchema.safeParse({
    activity_id: formData.get('activity_id'),
    age_group: formData.get('age_group') || undefined,
    special_requirements: formData.get('special_requirements') || undefined,
    channel: 'web',
  });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };

  const who = String(formData.get('participant_name') ?? '').trim();
  if (who.length > 80) return { fieldErrors: { participant_name: 'Keep the name short' } };

  const supabase = await getSupabase();
  const { error } = await supabase.from('activity_participants').insert({
    ...parsed.data,
    membership_id: context.membership.id,
    participant_name: who || null,
  });

  if (error) {
    return {
      error:
        error.code === '23505'
          ? who
            ? `${who} is already registered.`
            : 'You’re already registered.'
          : friendlyDbError(error),
    };
  }

  revalidatePath(`/app/${slug}/events/${eventSlug}`);
  return { ...EMPTY_STATE, success: who ? `${who} is registered.` : 'You’re registered.' };
}

/** Removes one of the caller's own registrations (theirs or a family member's). */
export async function cancelRegistration(formData: FormData): Promise<void> {
  const slug = String(formData.get('slug') ?? '');
  const eventSlug = String(formData.get('event') ?? '');
  const context = await requireCommunity(slug);

  const supabase = await getSupabase();
  await supabase
    .from('activity_participants')
    .delete()
    .eq('id', String(formData.get('registration_id') ?? ''))
    .eq('membership_id', context.membership.id);

  revalidatePath(`/app/${slug}/events/${eventSlug}`);
}

/** Kept for the hidden community feed. */
export async function joinActivity(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return registerForActivity(_prev, formData);
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
    .eq('membership_id', context.membership.id)
    .is('participant_name', null);

  revalidatePath(`/app/${slug}/events/${eventSlug}`);
}

const eventSuggestionSchema = z.object({
  event_id: uuid,
  kind: suggestionKindSchema,
  name: z.string().trim().min(3, 'Give your suggestion a short title').max(120),
  description: z.string().trim().max(2000).optional(),
});

/** A resident suggests an idea or an activity for an event; the committee reviews it. */
export async function suggestForEvent(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const slug = String(formData.get('slug') ?? '');
  const eventSlug = String(formData.get('event') ?? '');
  const context = await requireCapability(slug, 'suggest');

  const parsed = eventSuggestionSchema.safeParse({
    event_id: formData.get('event_id'),
    kind: formData.get('kind') || 'activity',
    name: formData.get('name'),
    description: formData.get('description') || undefined,
  });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };

  const supabase = await getSupabase();
  const { error } = await supabase.from('activity_suggestions').insert({
    ...parsed.data,
    community_id: context.community.id,
    suggested_by: context.membership.id,
    status: 'new',
  });
  if (error) return { error: friendlyDbError(error) };

  revalidatePath(`/app/${slug}/events/${eventSlug}`);
  revalidatePath(`/app/${slug}/todo`);
  return {
    ...EMPTY_STATE,
    success: 'Sent to the committee. Once they approve it, residents can vote on it.',
  };
}

/** One vote per person, for or against; voting again changes the vote. */
export async function voteOnSuggestion(formData: FormData): Promise<void> {
  const slug = String(formData.get('slug') ?? '');
  const eventSlug = String(formData.get('event') ?? '');
  const context = await requireCapability(slug, 'vote');

  const suggestionId = String(formData.get('suggestion_id') ?? '');
  const support = formData.get('support') === '1';
  const supabase = await getSupabase();

  if (formData.get('withdraw') === '1') {
    await supabase
      .from('suggestion_votes')
      .delete()
      .eq('suggestion_id', suggestionId)
      .eq('membership_id', context.membership.id);
  } else {
    await supabase.from('suggestion_votes').upsert(
      {
        suggestion_id: suggestionId,
        membership_id: context.membership.id,
        support,
        voted_at: new Date().toISOString(),
      },
      { onConflict: 'suggestion_id,membership_id' },
    );
  }

  revalidatePath(`/app/${slug}/events/${eventSlug}`);
}

const campaignSchema = z.object({
  name: z.string().trim().min(3, 'Name the campaign').max(140),
  description: z.string().trim().min(10, 'Say what the money is for').max(2000),
  fund_target: z.coerce
    .number()
    .positive('Enter a target amount')
    .max(100_000_000, 'That is larger than this app will accept'),
  starts_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Pick a date'),
});

/** Turns a campaign name into a unique-enough web address. */
function campaignSlug(name: string) {
  const base = name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);
  return `${base || 'campaign'}-${Math.random().toString(36).slice(2, 6)}`;
}

export type CampaignState = ActionState;

/**
 * A resident proposes a fundraising campaign. It stays 'proposed', visible only
 * to them and to staff, until the committee approves it.
 */
export async function proposeCampaign(
  _prev: CampaignState,
  formData: FormData,
): Promise<CampaignState> {
  const slug = String(formData.get('slug') ?? '');
  const context = await requireCapability(slug, 'campaigns:propose');

  const parsed = campaignSchema.safeParse({
    name: formData.get('name'),
    description: formData.get('description'),
    fund_target: formData.get('fund_target'),
    starts_on: formData.get('starts_on'),
  });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };

  const supabase = await getSupabase();
  const eventSlug = campaignSlug(parsed.data.name);
  const { error } = await supabase.from('events').insert({
    community_id: context.community.id,
    slug: eventSlug,
    kind: 'campaign',
    status: 'proposed',
    emoji: '🤝',
    name: parsed.data.name,
    description: parsed.data.description,
    fund_target: parsed.data.fund_target,
    starts_on: parsed.data.starts_on,
    fund_rule: 'general_fund',
    organizer: context.profile?.full_name ?? undefined,
    created_by: context.user.id,
  });
  if (error) return { error: friendlyDbError(error) };

  revalidatePath(`/app/${slug}/events`);
  revalidatePath(`/app/${slug}/todo`);
  redirect(`/app/${slug}/events?proposed=1`);
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
