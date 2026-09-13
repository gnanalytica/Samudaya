'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { upiVpaSchema } from '@samudaya/core';
import { requireCapability } from '@/lib/auth';
import { getSupabase } from '@/lib/supabase/server';
import { EMPTY_STATE, fieldErrors, friendlyDbError, type ActionState } from '@/lib/action-state';

const societyUpiSchema = z.object({
  upi_vpa: upiVpaSchema,
  upi_payee_name: z
    .string()
    .trim()
    .min(1, 'Name the account holder, as UPI apps will show it')
    .max(80, 'Keep it under 80 characters'),
});

/**
 * The UPI ID residents pay into. Committee only: pointing payments at a
 * different account is exactly the kind of change that needs the final say.
 */
export async function updateSocietyUpi(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const slug = String(formData.get('slug') ?? '');
  const context = await requireCapability(slug, 'roles:manage');

  const parsed = societyUpiSchema.safeParse({
    upi_vpa: formData.get('upi_vpa'),
    upi_payee_name: formData.get('upi_payee_name'),
  });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };

  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from('communities')
    .update(parsed.data)
    .eq('id', context.community.id)
    .select('id');
  if (error) return { error: friendlyDbError(error) };
  if (!data?.length) return { error: 'Only the committee can change the society’s UPI ID.' };

  revalidatePath(`/app/${slug}`, 'layout');
  return { ...EMPTY_STATE, success: 'Saved. Residents now pay to this UPI ID.' };
}
