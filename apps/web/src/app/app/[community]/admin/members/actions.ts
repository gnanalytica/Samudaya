'use server';

import { revalidatePath } from 'next/cache';
import { updateMemberRoleSchema } from '@samudaya/core';
import { requireCapability } from '@/lib/auth';
import { getSupabase } from '@/lib/supabase/server';

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
