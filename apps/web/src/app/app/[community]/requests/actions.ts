'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import {
  addRequestCommentSchema,
  can,
  createServiceRequestSchema,
  updateServiceRequestSchema,
} from '@samudaya/core';
import { requireCommunity } from '@/lib/auth';
import { getSupabase } from '@/lib/supabase/server';
import { EMPTY_STATE, fieldErrors, friendlyDbError, type ActionState } from '@/lib/action-state';

export async function createRequest(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const slug = String(formData.get('slug') ?? '');
  const context = await requireCommunity(slug);

  const unitId = String(formData.get('unit_id') ?? '').trim();

  const parsed = createServiceRequestSchema.safeParse({
    community_id: context.community.id,
    // Default to the flat they live in; staff without a unit send null.
    unit_id: unitId || context.unitIds[0] || null,
    category: formData.get('category') || 'other',
    priority: formData.get('priority') || 'normal',
    title: formData.get('title'),
    description: formData.get('description') || undefined,
    channel: 'web',
  });

  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };

  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from('service_requests')
    .insert({ ...parsed.data, raised_by: context.membership.id })
    .select('id')
    .single();

  if (error) return { error: friendlyDbError(error) };

  revalidatePath(`/app/${slug}/requests`);
  redirect(`/app/${slug}/requests/${data.id}`);
}

export async function updateRequest(formData: FormData): Promise<void> {
  const slug = String(formData.get('slug') ?? '');
  const context = await requireCommunity(slug);

  const parsed = updateServiceRequestSchema.safeParse({
    id: formData.get('id'),
    status: formData.get('status') || undefined,
    priority: formData.get('priority') || undefined,
    assigned_to: formData.get('assigned_to') || undefined,
  });
  if (!parsed.success) return;

  const { id, ...changes } = parsed.data;
  // Triage fields belong to staff. RLS would reject this anyway; checking here
  // keeps the UI honest instead of showing a control that always fails.
  if (!can(context.role, 'requests:triage')) return;

  const supabase = await getSupabase();
  await supabase.from('service_requests').update(changes).eq('id', id);

  revalidatePath(`/app/${slug}/requests/${id}`);
  revalidatePath(`/app/${slug}/requests`);
}

export async function addComment(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const slug = String(formData.get('slug') ?? '');
  const context = await requireCommunity(slug);

  const wantsInternal = formData.get('is_internal') === 'on';

  const parsed = addRequestCommentSchema.safeParse({
    request_id: formData.get('request_id'),
    body: formData.get('body'),
    is_internal: wantsInternal && can(context.role, 'requests:triage'),
  });

  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };

  const supabase = await getSupabase();
  const { error } = await supabase
    .from('service_request_comments')
    .insert({ ...parsed.data, author_id: context.membership.id, channel: 'web' });

  if (error) return { error: friendlyDbError(error) };

  revalidatePath(`/app/${slug}/requests/${parsed.data.request_id}`);
  return EMPTY_STATE;
}
