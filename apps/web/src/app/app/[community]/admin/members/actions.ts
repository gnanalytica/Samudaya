'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { TITLE_MAX_LENGTH, updateMemberRoleSchema, uuid } from '@samudaya/core';
import { requireCapability } from '@/lib/auth';
import { getSupabase } from '@/lib/supabase/server';
import { EMPTY_STATE, fieldErrors, friendlyDbError, type ActionState } from '@/lib/action-state';

export async function changeMemberRole(formData: FormData): Promise<void> {
  const slug = String(formData.get('slug') ?? '');
  const context = await requireCapability(slug, 'members:manage');

  const parsed = updateMemberRoleSchema.safeParse({
    membership_id: formData.get('membership_id'),
    role: formData.get('role'),
  });
  if (!parsed.success) return;

  const supabase = await getSupabase();
  // The database refuses self-promotion and demoting the last owner; this only
  // needs to scope the update to the right community.
  await supabase
    .from('memberships')
    .update({ role: parsed.data.role })
    .eq('id', parsed.data.membership_id)
    .eq('community_id', context.community.id);

  revalidatePath(`/app/${slug}/admin/members`);
}

export async function setMemberStatus(formData: FormData): Promise<void> {
  const slug = String(formData.get('slug') ?? '');
  const id = String(formData.get('membership_id') ?? '');
  const status = String(formData.get('status') ?? '');
  const context = await requireCapability(slug, 'members:manage');

  if (status !== 'active' && status !== 'suspended') return;

  const supabase = await getSupabase();
  await supabase
    .from('memberships')
    .update({ status })
    .eq('id', id)
    .eq('community_id', context.community.id);

  revalidatePath(`/app/${slug}/admin/members`);
}

const titleSchema = z.object({
  membership_id: uuid,
  // Blank clears the title; the member is then described by their role.
  title: z
    .string()
    .trim()
    .max(TITLE_MAX_LENGTH, `Keep it to ${TITLE_MAX_LENGTH} characters`)
    .transform((value) => value || null),
});

/** A title is a label ("Treasurer", "Supervisor"); the role still decides access. */
export async function updateMemberTitle(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const slug = String(formData.get('slug') ?? '');
  const context = await requireCapability(slug, 'members:manage');

  const parsed = titleSchema.safeParse({
    membership_id: formData.get('membership_id'),
    title: formData.get('title') ?? '',
  });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };

  const supabase = await getSupabase();
  const { error } = await supabase
    .from('memberships')
    .update({ title: parsed.data.title })
    .eq('id', parsed.data.membership_id)
    .eq('community_id', context.community.id);

  if (error) return { error: friendlyDbError(error) };

  revalidatePath(`/app/${slug}/admin/members`);
  return { ...EMPTY_STATE, success: 'Saved.' };
}

const approverSchema = z.object({
  membership_id: uuid,
  approves_spending: z.enum(['true', 'false']).transform((value) => value === 'true'),
});

/**
 * Marks or unmarks a spending approver. The database lets only an owner or an
 * existing approver do this, and only for admins and owners.
 */
export async function setSpendingApprover(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const slug = String(formData.get('slug') ?? '');
  const context = await requireCapability(slug, 'members:manage');

  const parsed = approverSchema.safeParse({
    membership_id: formData.get('membership_id'),
    approves_spending: formData.get('approves_spending'),
  });
  if (!parsed.success) return { error: 'Something went wrong. Please try again.' };

  const supabase = await getSupabase();
  const { error } = await supabase
    .from('memberships')
    .update({ approves_spending: parsed.data.approves_spending })
    .eq('id', parsed.data.membership_id)
    .eq('community_id', context.community.id);

  if (error) return { error: friendlyDbError(error) };

  // Approve buttons across the admin console depend on this.
  revalidatePath('/app/[community]', 'layout');
  return {
    ...EMPTY_STATE,
    success: parsed.data.approves_spending ? 'Now a spending approver.' : 'No longer an approver.',
  };
}

const restrictionSchema = z.object({
  restrict: z.enum(['true', 'false']).transform((value) => value === 'true'),
});

/** Switches approval between "any admin" and "designated approvers only". */
export async function setSpendingRestriction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const slug = String(formData.get('slug') ?? '');
  const context = await requireCapability(slug, 'members:manage');

  const parsed = restrictionSchema.safeParse({ restrict: formData.get('restrict') });
  if (!parsed.success) return { error: 'Something went wrong. Please try again.' };

  const supabase = await getSupabase();
  const { error } = await supabase
    .from('communities')
    .update({ restrict_spending_approval: parsed.data.restrict })
    .eq('id', context.community.id);

  if (error) return { error: friendlyDbError(error) };

  // Approve buttons across the admin console depend on this.
  revalidatePath('/app/[community]', 'layout');
  return {
    ...EMPTY_STATE,
    success: parsed.data.restrict
      ? 'Only designated approvers can approve spending now.'
      : 'Any admin can approve spending again.',
  };
}
