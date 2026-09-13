'use server';

import { redirect } from 'next/navigation';
import { requireCommunity } from '@/lib/auth';
import { getSupabase } from '@/lib/supabase/server';

/**
 * Marks the member's welcome as seen and takes them where its button pointed.
 * The target must stay inside this society, so the form cannot be used to
 * bounce someone elsewhere.
 */
export async function dismissWelcome(formData: FormData): Promise<void> {
  const slug = String(formData.get('slug') ?? '');
  const context = await requireCommunity(slug);

  const supabase = await getSupabase();
  await supabase.rpc('mark_welcomed', { p_community_id: context.community.id });

  const base = `/app/${context.community.slug}`;
  const target = String(formData.get('next') ?? '');
  redirect(target === base || target.startsWith(`${base}/`) ? target : base);
}
