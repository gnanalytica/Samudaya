'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import {
  closeEventSchema,
  createActivitySchema,
  createEventSchema,
  createExpenseSchema,
  paymentMethodSchema,
  reviewExpenseSchema,
  uuid,
} from '@samudaya/core';
import { requireCapability } from '@/lib/auth';
import { getSupabase } from '@/lib/supabase/server';
import { EMPTY_STATE, fieldErrors, friendlyDbError, type ActionState } from '@/lib/action-state';

/**
 * Staff and committee actions on events.
 *
 * The line that matters: staff run events (create, edit, publish, budgets,
 * activities, bills, payments, join requests); the committee has the final say
 * (approving bills, campaigns and suggestions, closing an event). Each action
 * asks for the capability it needs, and the database enforces the same line.
 */

/** Paths that show an event's numbers; refreshed after anything changes them. */
function refreshEvent(communitySlug: string, eventSlug: string) {
  revalidatePath(`/app/${communitySlug}/admin/events/${eventSlug}`);
  revalidatePath(`/app/${communitySlug}/events/${eventSlug}`);
  revalidatePath(`/app/${communitySlug}/events/${eventSlug}/accounts`);
  revalidatePath(`/app/${communitySlug}/events`);
  revalidatePath(`/app/${communitySlug}/admin`);
}

async function findEvent(communityId: string, eventSlug: string) {
  const supabase = await getSupabase();
  const { data } = await supabase
    .from('events')
    .select('id, name, status, kind, slug')
    .eq('community_id', communityId)
    .eq('slug', eventSlug)
    .maybeSingle();
  return data;
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

export type EventFormState = ActionState;

function eventFields(formData: FormData) {
  return {
    slug: formData.get('event_slug'),
    emoji: formData.get('emoji') || '🎉',
    name: formData.get('name'),
    starts_on: formData.get('starts_on'),
    ends_on: formData.get('ends_on') || null,
    venue: formData.get('venue') || undefined,
    organizer: formData.get('organizer') || undefined,
    description: formData.get('description') || undefined,
    fund_rule: formData.get('fund_rule') || 'general_fund',
    fund_rule_note: formData.get('fund_rule_note') || undefined,
  };
}

/** Creates an event as a draft with its first budget lines; budget sum = fund target. */
export async function createEvent(
  _prev: EventFormState,
  formData: FormData,
): Promise<EventFormState> {
  const communitySlug = String(formData.get('slug') ?? '');
  const context = await requireCapability(communitySlug, 'events:manage');

  const categories = formData.getAll('budget_category').map((value) => String(value).trim());
  const amounts = formData.getAll('budget_amount').map((value) => Number(value || 0));
  const lines = categories
    .map((category, index) => ({ category, amount: amounts[index] ?? 0 }))
    .filter((line) => line.category && line.amount >= 0);
  if (lines.some((line) => !Number.isFinite(line.amount))) {
    return { error: 'Budget amounts must be numbers.' };
  }
  const fundTarget = lines.reduce((sum, line) => sum + line.amount, 0);

  const parsed = createEventSchema.safeParse({
    community_id: context.community.id,
    ...eventFields(formData),
    fund_target: fundTarget,
  });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };

  const supabase = await getSupabase();
  const { data: event, error } = await supabase
    .from('events')
    .insert({ ...parsed.data, kind: 'event', status: 'draft', created_by: context.user.id })
    .select('id, slug')
    .single();

  if (error) {
    if (error.code === '23505') {
      return { fieldErrors: { slug: 'An event with that web address already exists.' } };
    }
    return { error: friendlyDbError(error) };
  }

  if (lines.length) {
    await supabase.from('budget_lines').insert(
      lines.map((line, position) => ({
        event_id: event.id,
        community_id: context.community.id,
        category: line.category,
        amount: line.amount,
        position,
      })),
    );
  }

  revalidatePath(`/app/${communitySlug}/events`);
  redirect(`/app/${communitySlug}/admin/events/${event.slug}`);
}

const updateEventSchema = z.object({
  emoji: z.string().trim().min(1).max(8),
  name: z.string().trim().min(3, 'Give the event a name').max(140),
  starts_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Pick a date'),
  ends_on: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable(),
  venue: z.string().trim().max(140).nullable(),
  organizer: z.string().trim().max(140).nullable(),
  description: z.string().trim().max(5000).nullable(),
});

export async function updateEventDetails(
  _prev: EventFormState,
  formData: FormData,
): Promise<EventFormState> {
  const communitySlug = String(formData.get('slug') ?? '');
  const eventSlug = String(formData.get('event') ?? '');
  const context = await requireCapability(communitySlug, 'events:manage');

  const parsed = updateEventSchema.safeParse({
    emoji: formData.get('emoji') || '🎉',
    name: formData.get('name'),
    starts_on: formData.get('starts_on'),
    ends_on: String(formData.get('ends_on') ?? '') || null,
    venue: String(formData.get('venue') ?? '').trim() || null,
    organizer: String(formData.get('organizer') ?? '').trim() || null,
    description: String(formData.get('description') ?? '').trim() || null,
  });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };
  if (parsed.data.ends_on && parsed.data.ends_on < parsed.data.starts_on) {
    return { fieldErrors: { ends_on: 'The event cannot end before it starts' } };
  }

  const supabase = await getSupabase();
  const { error } = await supabase
    .from('events')
    .update(parsed.data)
    .eq('community_id', context.community.id)
    .eq('slug', eventSlug);
  if (error) return { error: friendlyDbError(error) };

  refreshEvent(communitySlug, eventSlug);
  return { ...EMPTY_STATE, success: 'Saved.' };
}

/** Staff publish, cancel or return an event to draft. Closing is separate. */
export async function setEventStatus(formData: FormData): Promise<void> {
  const communitySlug = String(formData.get('slug') ?? '');
  const eventSlug = String(formData.get('event') ?? '');
  const status = String(formData.get('status') ?? '');
  const context = await requireCapability(communitySlug, 'events:manage');

  if (!['draft', 'published', 'cancelled'].includes(status)) return;

  const supabase = await getSupabase();
  await supabase
    .from('events')
    .update({ status: status as 'draft' | 'published' | 'cancelled' })
    .eq('community_id', context.community.id)
    .eq('slug', eventSlug)
    .neq('status', 'proposed');

  refreshEvent(communitySlug, eventSlug);
}

// ---------------------------------------------------------------------------
// Budget
// ---------------------------------------------------------------------------

/** Keeps the event's fund target equal to the sum of its budget lines. */
async function syncFundTarget(eventId: string) {
  const supabase = await getSupabase();
  const { data } = await supabase.from('budget_lines').select('amount').eq('event_id', eventId);
  const total = (data ?? []).reduce((sum, line) => sum + Number(line.amount), 0);
  await supabase.from('events').update({ fund_target: total }).eq('id', eventId);
}

const budgetLineInput = z.object({
  category: z.string().trim().min(1, 'Name the category').max(80),
  amount: z.coerce.number().min(0, 'Enter an amount').max(100_000_000),
  notes: z.string().trim().max(300).optional(),
});

export async function addBudgetLine(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const communitySlug = String(formData.get('slug') ?? '');
  const eventSlug = String(formData.get('event') ?? '');
  const context = await requireCapability(communitySlug, 'budget:manage');
  const event = await findEvent(context.community.id, eventSlug);
  if (!event) return { error: 'That event no longer exists.' };
  if (event.kind === 'campaign') return { error: 'Campaigns have a single target, not a budget.' };

  const parsed = budgetLineInput.safeParse({
    category: formData.get('category'),
    amount: formData.get('amount'),
    notes: formData.get('notes') || undefined,
  });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };

  const supabase = await getSupabase();
  const { count } = await supabase
    .from('budget_lines')
    .select('id', { count: 'exact', head: true })
    .eq('event_id', event.id);
  const { error } = await supabase.from('budget_lines').insert({
    ...parsed.data,
    event_id: event.id,
    community_id: context.community.id,
    position: count ?? 0,
  });
  if (error) return { error: friendlyDbError(error) };

  await syncFundTarget(event.id);
  refreshEvent(communitySlug, eventSlug);
  return { ...EMPTY_STATE, success: 'Budget line added.' };
}

export async function updateBudgetLine(formData: FormData): Promise<void> {
  const communitySlug = String(formData.get('slug') ?? '');
  const eventSlug = String(formData.get('event') ?? '');
  const context = await requireCapability(communitySlug, 'budget:manage');
  const event = await findEvent(context.community.id, eventSlug);
  if (!event) return;

  const id = uuid.safeParse(formData.get('line_id'));
  const parsed = budgetLineInput.safeParse({
    category: formData.get('category'),
    amount: formData.get('amount'),
  });
  if (!id.success || !parsed.success) return;

  const supabase = await getSupabase();
  await supabase
    .from('budget_lines')
    .update({ category: parsed.data.category, amount: parsed.data.amount })
    .eq('id', id.data)
    .eq('event_id', event.id);

  await syncFundTarget(event.id);
  refreshEvent(communitySlug, eventSlug);
}

export async function removeBudgetLine(formData: FormData): Promise<void> {
  const communitySlug = String(formData.get('slug') ?? '');
  const eventSlug = String(formData.get('event') ?? '');
  const context = await requireCapability(communitySlug, 'budget:manage');
  const event = await findEvent(context.community.id, eventSlug);
  if (!event) return;

  const supabase = await getSupabase();
  await supabase
    .from('budget_lines')
    .delete()
    .eq('id', String(formData.get('line_id') ?? ''))
    .eq('event_id', event.id);

  await syncFundTarget(event.id);
  refreshEvent(communitySlug, eventSlug);
}

// ---------------------------------------------------------------------------
// Activities
// ---------------------------------------------------------------------------

export async function addActivity(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const communitySlug = String(formData.get('slug') ?? '');
  const eventSlug = String(formData.get('event') ?? '');
  const context = await requireCapability(communitySlug, 'activities:manage');
  const event = await findEvent(context.community.id, eventSlug);
  if (!event) return { error: 'That event no longer exists.' };

  const parsed = createActivitySchema.safeParse({
    event_id: event.id,
    name: formData.get('name'),
    emoji: formData.get('emoji') || '🎭',
    description: formData.get('description') || undefined,
    capacity: String(formData.get('capacity') ?? '') || null,
  });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };

  const supabase = await getSupabase();
  const { error } = await supabase
    .from('event_activities')
    .insert({ ...parsed.data, community_id: context.community.id });
  if (error) {
    return {
      error:
        error.code === '23505'
          ? 'This event already has an activity with that name.'
          : friendlyDbError(error),
    };
  }

  refreshEvent(communitySlug, eventSlug);
  return { ...EMPTY_STATE, success: 'Activity added.' };
}

/** Opens or closes registrations, or removes an activity with no registrations. */
export async function updateActivity(formData: FormData): Promise<void> {
  const communitySlug = String(formData.get('slug') ?? '');
  const eventSlug = String(formData.get('event') ?? '');
  const context = await requireCapability(communitySlug, 'activities:manage');
  const activityId = String(formData.get('activity_id') ?? '');
  const intent = String(formData.get('intent') ?? '');

  const supabase = await getSupabase();
  if (intent === 'open' || intent === 'close') {
    await supabase
      .from('event_activities')
      .update({ is_open: intent === 'open' })
      .eq('id', activityId)
      .eq('community_id', context.community.id);
  } else if (intent === 'remove') {
    await supabase
      .from('event_activities')
      .delete()
      .eq('id', activityId)
      .eq('community_id', context.community.id);
  }

  refreshEvent(communitySlug, eventSlug);
}

// ---------------------------------------------------------------------------
// Bills
// ---------------------------------------------------------------------------

function expenseFields(formData: FormData) {
  return {
    name: formData.get('name'),
    category: formData.get('category') || undefined,
    amount: formData.get('amount'),
    vendor: formData.get('vendor') || undefined,
    paid_by: formData.get('paid_by') || undefined,
    method: formData.get('method') || 'upi',
    bill_url: formData.get('bill_url') || undefined,
    spent_on: formData.get('spent_on') || undefined,
  };
}

/** Staff upload a bill; it waits for the committee before residents see it. */
export async function submitExpense(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const communitySlug = String(formData.get('slug') ?? '');
  const eventSlug = String(formData.get('event') ?? '');
  const context = await requireCapability(communitySlug, 'expenses:submit');
  const event = await findEvent(context.community.id, eventSlug);
  if (!event) return { error: 'That event no longer exists.' };
  if (event.status === 'completed') {
    return { error: 'This event is closed; its ledger cannot be changed.' };
  }

  const parsed = createExpenseSchema.safeParse({ event_id: event.id, ...expenseFields(formData) });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };

  const supabase = await getSupabase();
  const { error } = await supabase.from('expenses').insert({
    ...parsed.data,
    community_id: context.community.id,
    requested_by: context.membership.id,
    status: 'pending',
  });
  if (error) return { error: friendlyDbError(error) };

  refreshEvent(communitySlug, eventSlug);
  revalidatePath(`/app/${communitySlug}/admin/approvals`);
  return { ...EMPTY_STATE, success: 'Bill uploaded. It now waits for the committee.' };
}

/**
 * Corrects a bill that is still pending or was sent back, including attaching
 * a new copy. A corrected bill goes back to the committee as pending.
 */
export async function correctExpense(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const communitySlug = String(formData.get('slug') ?? '');
  const eventSlug = String(formData.get('event') ?? '');
  const context = await requireCapability(communitySlug, 'expenses:submit');
  const event = await findEvent(context.community.id, eventSlug);
  if (!event) return { error: 'That event no longer exists.' };

  const expenseId = uuid.safeParse(formData.get('expense_id'));
  if (!expenseId.success) return { error: 'That bill no longer exists.' };

  const parsed = createExpenseSchema.safeParse({ event_id: event.id, ...expenseFields(formData) });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };

  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from('expenses')
    .update({
      name: parsed.data.name,
      category: parsed.data.category ?? null,
      amount: parsed.data.amount,
      vendor: parsed.data.vendor ?? null,
      paid_by: parsed.data.paid_by ?? null,
      method: parsed.data.method,
      bill_url: parsed.data.bill_url ?? null,
      spent_on: parsed.data.spent_on,
      status: 'pending',
      review_note: null,
    })
    .eq('id', expenseId.data)
    .eq('event_id', event.id)
    .in('status', ['pending', 'changes_requested'])
    .select('id');
  if (error) return { error: friendlyDbError(error) };
  if (!data?.length) {
    return { error: 'Only bills that are pending or sent back for changes can be corrected.' };
  }

  refreshEvent(communitySlug, eventSlug);
  revalidatePath(`/app/${communitySlug}/admin/approvals`);
  return { ...EMPTY_STATE, success: 'Corrected and sent back to the committee.' };
}

/** The committee approves, rejects or sends back a bill. */
export async function reviewExpense(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const communitySlug = String(formData.get('slug') ?? '');
  const eventSlug = String(formData.get('event') ?? '');
  await requireCapability(communitySlug, 'expenses:approve');

  const parsed = reviewExpenseSchema.safeParse({
    expense_id: formData.get('expense_id'),
    decision: formData.get('decision'),
    note: formData.get('note') || undefined,
  });
  if (!parsed.success) return { error: 'That decision could not be recorded.' };

  const supabase = await getSupabase();
  const { error } = await supabase.rpc('review_expense', {
    p_expense_id: parsed.data.expense_id,
    p_decision: parsed.data.decision,
    p_note: parsed.data.note ?? undefined,
  });
  if (error) return { error: friendlyDbError(error) };

  if (eventSlug) refreshEvent(communitySlug, eventSlug);
  revalidatePath(`/app/${communitySlug}/admin/approvals`);
  return {
    ...EMPTY_STATE,
    success:
      parsed.data.decision === 'approved'
        ? 'Approved. Residents can see it now.'
        : parsed.data.decision === 'rejected'
          ? 'Rejected.'
          : 'Sent back for changes.',
  };
}

// ---------------------------------------------------------------------------
// Payments
// ---------------------------------------------------------------------------

const recordPaymentSchema = z.object({
  unit_id: uuid,
  amount: z.coerce
    .number()
    .positive('Enter an amount greater than zero')
    .max(10_000_000, 'That is larger than this app will accept'),
  method: paymentMethodSchema,
  reference: z.string().trim().max(120).optional(),
  paid_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Pick a date'),
});

/** Staff record money collected from a flat (cash, UPI to the society, cheque). */
export async function recordPayment(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const communitySlug = String(formData.get('slug') ?? '');
  const eventSlug = String(formData.get('event') ?? '');
  const context = await requireCapability(communitySlug, 'payments:record');
  const event = await findEvent(context.community.id, eventSlug);
  if (!event) return { error: 'That event no longer exists.' };
  if (event.status !== 'published') {
    return { error: 'Payments can only be recorded while the event is open.' };
  }

  const parsed = recordPaymentSchema.safeParse({
    unit_id: formData.get('unit_id'),
    amount: formData.get('amount'),
    method: formData.get('method') || 'cash',
    reference: formData.get('reference') || undefined,
    paid_on: formData.get('paid_on'),
  });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };

  const supabase = await getSupabase();
  const { error } = await supabase.from('contributions').insert({
    event_id: event.id,
    community_id: context.community.id,
    unit_id: parsed.data.unit_id,
    amount: parsed.data.amount,
    method: parsed.data.method,
    reference: parsed.data.reference ?? null,
    status: 'succeeded',
    channel: 'system',
    paid_at: new Date(`${parsed.data.paid_on}T12:00:00+05:30`).toISOString(),
  });
  if (error) return { error: friendlyDbError(error) };

  refreshEvent(communitySlug, eventSlug);
  return { ...EMPTY_STATE, success: 'Payment recorded.' };
}

// ---------------------------------------------------------------------------
// Join requests
// ---------------------------------------------------------------------------

export async function reviewJoinRequest(formData: FormData): Promise<void> {
  const communitySlug = String(formData.get('slug') ?? '');
  const context = await requireCapability(communitySlug, 'joinrequests:review');

  const requested = String(formData.get('role') ?? 'resident');
  // Staff admit residents; only the committee can admit someone as staff.
  const role = requested === 'staff' && context.role === 'committee' ? 'staff' : 'resident';

  const supabase = await getSupabase();
  await supabase.rpc('review_join_request', {
    p_request_id: String(formData.get('request_id') ?? ''),
    p_approve: formData.get('approve') === '1',
    p_role: role,
    p_reason: String(formData.get('reason') ?? '').trim() || undefined,
  });

  revalidatePath(`/app/${communitySlug}/admin/requests`);
  revalidatePath(`/app/${communitySlug}/admin`);
}

// ---------------------------------------------------------------------------
// Committee decisions
// ---------------------------------------------------------------------------

/** Approves a proposed campaign (it goes live) or turns it down. */
export async function decideCampaign(formData: FormData): Promise<void> {
  const communitySlug = String(formData.get('slug') ?? '');
  const context = await requireCapability(communitySlug, 'campaigns:approve');
  const approve = formData.get('approve') === '1';

  const supabase = await getSupabase();
  await supabase
    .from('events')
    .update({ status: approve ? 'published' : 'cancelled' })
    .eq('id', String(formData.get('event_id') ?? ''))
    .eq('community_id', context.community.id)
    .eq('status', 'proposed');

  revalidatePath(`/app/${communitySlug}/admin/approvals`);
  revalidatePath(`/app/${communitySlug}/events`);
  revalidatePath(`/app/${communitySlug}`);
}

/** Opens a suggestion for voting, or declines it with an optional note. */
export async function decideSuggestion(formData: FormData): Promise<void> {
  const communitySlug = String(formData.get('slug') ?? '');
  const context = await requireCapability(communitySlug, 'suggestions:approve');
  const approve = formData.get('approve') === '1';
  const note = String(formData.get('note') ?? '').trim();

  const supabase = await getSupabase();
  const { data } = await supabase
    .from('activity_suggestions')
    .update({ status: approve ? 'accepted' : 'declined', review_note: note || null })
    .eq('id', String(formData.get('suggestion_id') ?? ''))
    .eq('community_id', context.community.id)
    .select('events(slug)')
    .maybeSingle();

  revalidatePath(`/app/${communitySlug}/admin/approvals`);
  if (data?.events?.slug) revalidatePath(`/app/${communitySlug}/events/${data.events.slug}`);
}

export type CloseState = ActionState & { closed?: boolean };

/**
 * Closing an event publishes its final accounts and freezes the ledger. The
 * summary is written into the event row so the report cannot drift later.
 */
export async function closeEvent(_prev: CloseState, formData: FormData): Promise<CloseState> {
  const communitySlug = String(formData.get('slug') ?? '');
  const eventSlug = String(formData.get('event') ?? '');
  const context = await requireCapability(communitySlug, 'events:close');
  const event = await findEvent(context.community.id, eventSlug);
  if (!event) return { error: 'That event no longer exists.' };

  const parsed = closeEventSchema.safeParse({
    event_id: event.id,
    confirm_name: formData.get('confirm_name'),
  });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };
  if (parsed.data.confirm_name.trim().toLowerCase() !== event.name.trim().toLowerCase()) {
    return { fieldErrors: { confirm_name: 'That does not match the event name.' } };
  }

  const supabase = await getSupabase();
  const [{ data: stats }, { data: open }] = await Promise.all([
    supabase.from('event_stats').select('*').eq('event_id', event.id).maybeSingle(),
    supabase
      .from('expenses')
      .select('id')
      .eq('event_id', event.id)
      .in('status', ['pending', 'changes_requested']),
  ]);

  if (open?.length) {
    return {
      error: `${open.length} bill${open.length === 1 ? '' : 's'} still awaiting a decision. Decide on them before closing.`,
    };
  }

  const { error } = await supabase
    .from('events')
    .update({
      status: 'completed',
      closing_summary: {
        closed_at: new Date().toISOString(),
        closed_by: context.membership.id,
        raised: stats?.fund_raised ?? 0,
        spent: stats?.spent ?? 0,
        surplus: Number(stats?.fund_raised ?? 0) - Number(stats?.spent ?? 0),
        contributors: stats?.contributors ?? 0,
        participants: stats?.participants ?? 0,
      },
    })
    .eq('id', event.id);
  if (error) return { error: friendlyDbError(error) };

  refreshEvent(communitySlug, eventSlug);
  return { ...EMPTY_STATE, closed: true, success: 'Event closed and its accounts published.' };
}
