'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireCommunity, requireUser } from '@/lib/auth';
import { getSupabase } from '@/lib/supabase/server';
import { EMPTY_STATE, fieldErrors, friendlyDbError, type ActionState } from '@/lib/action-state';

const profileSchema = z.object({
  full_name: z.string().trim().min(1, 'Tell us your name').max(120),
});

export async function updateProfile(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const slug = String(formData.get('slug') ?? '');

  const parsed = profileSchema.safeParse({ full_name: formData.get('full_name') });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };

  const supabase = await getSupabase();
  const { error } = await supabase.from('profiles').update(parsed.data).eq('id', user.id);

  if (error) return { error: friendlyDbError(error) };

  revalidatePath(`/app/${slug}/settings`);
  return { ...EMPTY_STATE, success: 'Saved.' };
}

export type LinkCodeState = ActionState & { code?: string; expiresAt?: string };

/**
 * Issues the short code a resident sends to the bot as `link ABC123`.
 * Generating a new one retires any previous code.
 */
export async function createWhatsAppLinkCode(
  _prev: LinkCodeState,
  formData: FormData,
): Promise<LinkCodeState> {
  const slug = String(formData.get('slug') ?? '');
  const context = await requireCommunity(slug);

  const supabase = await getSupabase();
  const { data, error } = await supabase.rpc('create_whatsapp_link_code', {
    p_community_id: context.community.id,
  });

  if (error || !data) return { error: 'Could not create a link code. Please try again.' };

  revalidatePath(`/app/${slug}/settings`);
  return { code: data.code, expiresAt: data.expires_at };
}

export async function unlinkWhatsApp(formData: FormData): Promise<void> {
  const slug = String(formData.get('slug') ?? '');
  const user = await requireUser();

  const supabase = await getSupabase();
  await supabase.from('whatsapp_links').delete().eq('user_id', user.id);

  revalidatePath(`/app/${slug}/settings`);
}
