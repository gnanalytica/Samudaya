'use server';

import { revalidatePath } from 'next/cache';
import { updateMemberRoleSchema, uuid } from '@samudaya/core';
import { requireCapability } from '@/lib/auth';
import { getSupabase } from '@/lib/supabase/server';
import { EMPTY_STATE, friendlyDbError, type ActionState } from '@/lib/action-state';

/**
 * The committee assigns roles. The database refuses self-promotion and keeps
 * at least one committee member; this scopes the change to the community.
 */
export async function changeMemberRole(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const slug = String(formData.get('slug') ?? '');
  const context = await requireCapability(slug, 'roles:manage');

  const parsed = updateMemberRoleSchema.safeParse({
    membership_id: formData.get('membership_id'),
    role: formData.get('role'),
  });
  if (!parsed.success) return { error: 'Pick a role.' };

  const supabase = await getSupabase();
  const { error } = await supabase
    .from('memberships')
    .update({ role: parsed.data.role })
    .eq('id', parsed.data.membership_id)
    .eq('community_id', context.community.id);
  if (error) return { error: friendlyDbError(error) };

  revalidatePath(`/app/${slug}/people`);
  return { ...EMPTY_STATE, success: 'Role updated.' };
}

/**
 * Removes someone from the society. Staff can remove residents; only the
 * committee can remove staff or committee members, and never the last one.
 */
export async function removeMember(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const slug = String(formData.get('slug') ?? '');
  const context = await requireCapability(slug, 'residents:remove');

  const id = uuid.safeParse(formData.get('membership_id'));
  if (!id.success) return { error: 'That member no longer exists.' };
  if (id.data === context.membership.id) return { error: 'You cannot remove yourself.' };

  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from('memberships')
    .delete()
    .eq('id', id.data)
    .eq('community_id', context.community.id)
    .select('id');
  if (error) return { error: friendlyDbError(error) };
  if (!data?.length) return { error: 'Staff can remove residents only.' };

  revalidatePath(`/app/${slug}/people`);
  return { ...EMPTY_STATE, success: 'Removed.' };
}
