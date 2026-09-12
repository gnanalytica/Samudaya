'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import {
  budgetLineSchema,
  closeEventSchema,
  createActivitySchema,
  createEventSchema,
  createExpenseSchema,
  createVolunteerRoleSchema,
  proposeReallocationSchema,
  reviewExpenseSchema,
  updateTaskSchema,
} from '@samudaya/core';
import { requireCapability, requireCommunity } from '@/lib/auth';
import { getSupabase } from '@/lib/supabase/server';
import { EMPTY_STATE, fieldErrors, friendlyDbError, type ActionState } from '@/lib/action-state';

/**
 * Admin and committee actions on an event.
 *
 * The split that matters: a committee member can prepare an event and work it;
 * only an admin can publish it, approve spending, or close it. Each action
 * asks for the capability it needs, and the database enforces the same line.
 */

const wizardSchema = z.object({
  slug: z.string(),
  emoji: z.string(),
  name: z.string(),
  starts_on: z.string(),
  ends_on: z.string().nullable().optional(),
  venue: z.string().optional(),
  organizer: z.string().optional(),
  description: z.string().optional(),
  expected_attendance: z.coerce.number().int().min(0).optional(),
  fund_rule: z.string(),
  fund_rule_note: z.string().optional(),
  budget: z.array(budgetLineSchema),
  tasks: z.array(z.string().trim().min(1)),
  activities: z.array(z.object({ name: z.string().trim().min(1), emoji: z.string() })),
  volunteer_roles: z.array(
    z.object({
      name: z.string().trim().min(1),
      emoji: z.string(),
      target: z.coerce.number().int().min(1),
    }),
  ),
});

export type WizardState = ActionState & { slug?: string };

/**
 * Creates the whole event in one go: the event itself, its checklist, its
 * activities and its volunteer roles. It lands as a DRAFT — publishing is a
 * separate, deliberate admin action.
 */
export async function createEventFromWizard(
  _prev: WizardState,
  formData: FormData,
): Promise<WizardState> {
  const communitySlug = String(formData.get('slug') ?? '');
  const context = await requireCapability(communitySlug, 'events:prepare');

  let payload: z.infer<typeof wizardSchema>;
  try {
    payload = wizardSchema.parse(JSON.parse(String(formData.get('payload') ?? '{}')));
  } catch {
    return { error: 'Those details could not be read. Please check the form and try again.' };
  }

  // The budget lines are the fund target: the number residents are asked to
  // reach is the sum of what the committee actually planned to spend.
  const fundTarget = payload.budget.reduce((sum, line) => sum + Number(line.amount || 0), 0);

  const parsed = createEventSchema.safeParse({
    community_id: context.community.id,
    slug: payload.slug,
    emoji: payload.emoji,
    name: payload.name,
    starts_on: payload.starts_on,
    ends_on: payload.ends_on || null,
    venue: payload.venue || undefined,
    organizer: payload.organizer || undefined,
    description: payload.description || undefined,
    expected_attendance: payload.expected_attendance,
    fund_target: fundTarget,
    fund_rule: payload.fund_rule,
    fund_rule_note: payload.fund_rule_note || undefined,
  });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };

  const supabase = await getSupabase();
  const { data: event, error } = await supabase
    .from('events')
    .insert({
      ...parsed.data,
      status: 'draft',
      created_by: context.user.id,
      // Keep the budget with the event so the closing report can compare
      // what was planned against what was actually spent.
      closing_summary: null,
    })
    .select('id, slug')
    .single();

  if (error) {
    if (error.code === '23505') {
      return { fieldErrors: { slug: 'An event with that web address already exists.' } };
    }
    return { error: friendlyDbError(error) };
  }

  // Children are inserted separately rather than in one transaction: if any
  // fails the event still exists as a draft the committee can finish by hand,
  // which is far better than losing everything they just typed.
  // PostgrestFilterBuilder is thenable but not a Promise, so this is typed
  // as PromiseLike rather than Promise.
  const children: PromiseLike<unknown>[] = [];

  if (payload.tasks.length) {
    children.push(
      supabase.from('event_tasks').insert(
        payload.tasks.map((name, index) => ({
          event_id: event.id,
          community_id: context.community.id,
          name,
          position: index,
        })),
      ),
    );
  }

  if (payload.activities.length) {
    children.push(
      supabase.from('event_activities').insert(
        payload.activities.map((activity, index) => ({
          event_id: event.id,
          community_id: context.community.id,
          name: activity.name,
          emoji: activity.emoji,
          position: index,
        })),
      ),
    );
  }

  if (payload.volunteer_roles.length) {
    children.push(
      supabase.from('volunteer_roles').insert(
        payload.volunteer_roles.map((role, index) => ({
          event_id: event.id,
          community_id: context.community.id,
          name: role.name,
          emoji: role.emoji,
          target_count: role.target,
          position: index,
        })),
      ),
    );
  }

  await Promise.all(children);

  revalidatePath(`/app/${communitySlug}/events`);
  redirect(`/app/${communitySlug}/admin/events/${event.slug}`);
}

export async function setEventStatus(formData: FormData): Promise<void> {
  const communitySlug = String(formData.get('slug') ?? '');
  const eventSlug = String(formData.get('event') ?? '');
  const status = String(formData.get('status') ?? '');
  const context = await requireCapability(communitySlug, 'events:publish');

  if (!['draft', 'published', 'cancelled'].includes(status)) return;

  const supabase = await getSupabase();
  await supabase
    .from('events')
    .update({ status: status as 'draft' | 'published' | 'cancelled' })
    .eq('community_id', context.community.id)
    .eq('slug', eventSlug);

  revalidatePath(`/app/${communitySlug}/admin/events/${eventSlug}`);
  revalidatePath(`/app/${communitySlug}/events`);
}

export async function updateTask(formData: FormData): Promise<void> {
  const communitySlug = String(formData.get('slug') ?? '');
  const eventSlug = String(formData.get('event') ?? '');
  await requireCapability(communitySlug, 'events:prepare');

  const parsed = updateTaskSchema.safeParse({
    id: formData.get('id'),
    status: formData.get('status') || undefined,
    assignee_id: formData.get('assignee_id') || undefined,
  });
  if (!parsed.success) return;

  const { id, ...changes } = parsed.data;
  const supabase = await getSupabase();
  await supabase.from('event_tasks').update(changes).eq('id', id);

  revalidatePath(`/app/${communitySlug}/admin/events/${eventSlug}`);
  revalidatePath(`/app/${communitySlug}/events/${eventSlug}`);
}

export async function addTask(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const communitySlug = String(formData.get('slug') ?? '');
  const eventSlug = String(formData.get('event') ?? '');
  const context = await requireCapability(communitySlug, 'events:prepare');

  const name = String(formData.get('name') ?? '').trim();
  if (name.length < 2) return { fieldErrors: { name: 'Describe the task' } };

  const supabase = await getSupabase();
  const { data: event } = await supabase
    .from('events')
    .select('id')
    .eq('community_id', context.community.id)
    .eq('slug', eventSlug)
    .maybeSingle();
  if (!event) return { error: 'That event no longer exists.' };

  const { error } = await supabase.from('event_tasks').insert({
    event_id: event.id,
    community_id: context.community.id,
    name,
    due_on: String(formData.get('due_on') ?? '') || null,
  });

  if (error) return { error: friendlyDbError(error) };

  revalidatePath(`/app/${communitySlug}/admin/events/${eventSlug}`);
  return { ...EMPTY_STATE, success: 'Task added.' };
}

export async function submitExpense(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const communitySlug = String(formData.get('slug') ?? '');
  const eventSlug = String(formData.get('event') ?? '');
  const context = await requireCapability(communitySlug, 'expenses:submit');

  const supabase = await getSupabase();
  const { data: event } = await supabase
    .from('events')
    .select('id, status')
    .eq('community_id', context.community.id)
    .eq('slug', eventSlug)
    .maybeSingle();
  if (!event) return { error: 'That event no longer exists.' };
  if (event.status === 'completed') {
    return { error: 'This event is closed; its ledger cannot be changed.' };
  }

  const parsed = createExpenseSchema.safeParse({
    event_id: event.id,
    name: formData.get('name'),
    category: formData.get('category') || undefined,
    amount: formData.get('amount'),
    vendor: formData.get('vendor') || undefined,
    paid_by: formData.get('paid_by') || undefined,
    method: formData.get('method') || 'upi',
    bill_url: formData.get('bill_url') || undefined,
    spent_on: formData.get('spent_on') || undefined,
  });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };

  const { error } = await supabase.from('expenses').insert({
    ...parsed.data,
    community_id: context.community.id,
    requested_by: context.membership.id,
    status: 'pending',
  });

  if (error) return { error: friendlyDbError(error) };

  revalidatePath(`/app/${communitySlug}/admin/events/${eventSlug}`);
  return { ...EMPTY_STATE, success: 'Submitted for approval.' };
}

export async function reviewExpense(formData: FormData): Promise<void> {
  const communitySlug = String(formData.get('slug') ?? '');
  const eventSlug = String(formData.get('event') ?? '');
  await requireCapability(communitySlug, 'expenses:approve');

  const parsed = reviewExpenseSchema.safeParse({
    expense_id: formData.get('expense_id'),
    decision: formData.get('decision'),
    note: formData.get('note') || undefined,
  });
  if (!parsed.success) return;

  const supabase = await getSupabase();
  // The database refuses self-approval and refuses to touch a closed ledger.
  await supabase.rpc('review_expense', {
    p_expense_id: parsed.data.expense_id,
    p_decision: parsed.data.decision,
    p_note: parsed.data.note ?? undefined,
  });

  revalidatePath(`/app/${communitySlug}/admin/events/${eventSlug}`);
  revalidatePath(`/app/${communitySlug}/events/${eventSlug}/accounts`);
}

export async function reviewJoinRequest(formData: FormData): Promise<void> {
  const communitySlug = String(formData.get('slug') ?? '');
  await requireCapability(communitySlug, 'joinrequests:review');

  const supabase = await getSupabase();
  await supabase.rpc('review_join_request', {
    p_request_id: String(formData.get('request_id') ?? ''),
    p_approve: formData.get('approve') === '1',
    p_role: String(formData.get('role') ?? 'resident') as 'resident' | 'committee' | 'admin',
  });

  revalidatePath(`/app/${communitySlug}/admin/requests`);
}

export type CloseState = ActionState & { closed?: boolean };

/**
 * Closing an event publishes its transparency report and freezes the ledger.
 * The summary is written into the event row so the report cannot drift if rows
 * change later.
 */
export async function closeEvent(_prev: CloseState, formData: FormData): Promise<CloseState> {
  const communitySlug = String(formData.get('slug') ?? '');
  const eventSlug = String(formData.get('event') ?? '');
  const context = await requireCapability(communitySlug, 'events:publish');

  const supabase = await getSupabase();
  const { data: event } = await supabase
    .from('events')
    .select('id, name, status')
    .eq('community_id', context.community.id)
    .eq('slug', eventSlug)
    .maybeSingle();
  if (!event) return { error: 'That event no longer exists.' };

  const parsed = closeEventSchema.safeParse({
    event_id: event.id,
    confirm_name: formData.get('confirm_name'),
  });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };

  // Typing the name is a deliberate speed bump — closing cannot be undone.
  if (parsed.data.confirm_name.trim().toLowerCase() !== event.name.trim().toLowerCase()) {
    return { fieldErrors: { confirm_name: 'That does not match the event name.' } };
  }

  const { data: stats } = await supabase
    .from('event_stats')
    .select('*')
    .eq('event_id', event.id)
    .maybeSingle();

  const { data: pending } = await supabase
    .from('expenses')
    .select('id')
    .eq('event_id', event.id)
    .eq('status', 'pending');

  if (pending?.length) {
    return {
      error: `${pending.length} expense${pending.length === 1 ? '' : 's'} still awaiting approval. Decide on them before closing.`,
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
        volunteers: stats?.volunteers ?? 0,
        tasks_done: stats?.tasks_done ?? 0,
        tasks_total: stats?.tasks_total ?? 0,
      },
    })
    .eq('id', event.id);

  if (error) return { error: friendlyDbError(error) };

  revalidatePath(`/app/${communitySlug}/events/${eventSlug}`);
  revalidatePath(`/app/${communitySlug}/admin/events/${eventSlug}`);
  return { ...EMPTY_STATE, closed: true, success: 'Event closed and the report published.' };
}

export async function proposeReallocation(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const communitySlug = String(formData.get('slug') ?? '');
  const context = await requireCapability(communitySlug, 'reallocation:propose');

  const toEvent = String(formData.get('to_event_id') ?? '').trim();

  const parsed = proposeReallocationSchema.safeParse({
    community_id: context.community.id,
    from_event_id: formData.get('from_event_id'),
    to_event_id: toEvent || null,
    to_label: toEvent ? null : String(formData.get('to_label') ?? '').trim() || null,
    amount: formData.get('amount'),
    reason: formData.get('reason'),
    threshold_pct: formData.get('threshold_pct') || 60,
  });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };

  const supabase = await getSupabase();
  const { error } = await supabase.from('fund_reallocations').insert({
    ...parsed.data,
    status: 'voting',
    created_by: context.membership.id,
  });

  if (error) return { error: friendlyDbError(error) };

  revalidatePath(`/app/${communitySlug}/feed`);
  return { ...EMPTY_STATE, success: 'Put to the community for a vote.' };
}

export async function addActivity(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const communitySlug = String(formData.get('slug') ?? '');
  const eventSlug = String(formData.get('event') ?? '');
  const context = await requireCommunity(communitySlug);

  const supabase = await getSupabase();
  const { data: event } = await supabase
    .from('events')
    .select('id')
    .eq('community_id', context.community.id)
    .eq('slug', eventSlug)
    .maybeSingle();
  if (!event) return { error: 'That event no longer exists.' };

  const parsed = createActivitySchema.safeParse({
    event_id: event.id,
    name: formData.get('name'),
    emoji: formData.get('emoji') || '🎭',
    description: formData.get('description') || undefined,
  });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };

  const { error } = await supabase
    .from('event_activities')
    .insert({ ...parsed.data, community_id: context.community.id });

  if (error) return { error: friendlyDbError(error) };

  revalidatePath(`/app/${communitySlug}/admin/events/${eventSlug}`);
  return { ...EMPTY_STATE, success: 'Activity added.' };
}

export async function addVolunteerRole(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const communitySlug = String(formData.get('slug') ?? '');
  const eventSlug = String(formData.get('event') ?? '');
  const context = await requireCommunity(communitySlug);

  const supabase = await getSupabase();
  const { data: event } = await supabase
    .from('events')
    .select('id')
    .eq('community_id', context.community.id)
    .eq('slug', eventSlug)
    .maybeSingle();
  if (!event) return { error: 'That event no longer exists.' };

  const parsed = createVolunteerRoleSchema.safeParse({
    event_id: event.id,
    name: formData.get('name'),
    emoji: formData.get('emoji') || '🙋',
    target_count: formData.get('target_count') || 1,
  });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };

  const { error } = await supabase
    .from('volunteer_roles')
    .insert({ ...parsed.data, community_id: context.community.id });

  if (error) return { error: friendlyDbError(error) };

  revalidatePath(`/app/${communitySlug}/admin/events/${eventSlug}`);
  return { ...EMPTY_STATE, success: 'Role added.' };
}
