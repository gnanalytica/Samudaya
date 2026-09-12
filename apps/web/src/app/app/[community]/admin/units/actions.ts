'use server';

import { revalidatePath } from 'next/cache';
import { createUnitSchema } from '@samudaya/core';
import { requireCapability } from '@/lib/auth';
import { getSupabase } from '@/lib/supabase/server';
import { EMPTY_STATE, fieldErrors, friendlyDbError, type ActionState } from '@/lib/action-state';

export async function addUnit(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const slug = String(formData.get('slug') ?? '');
  const context = await requireCapability(slug, 'units:manage');

  const parsed = createUnitSchema.safeParse({
    community_id: context.community.id,
    block: formData.get('block') || undefined,
    number: formData.get('number'),
    floor: formData.get('floor') || undefined,
    bedrooms: formData.get('bedrooms') || undefined,
    monthly_dues: formData.get('monthly_dues') || 0,
  });

  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };

  const supabase = await getSupabase();
  const { error } = await supabase.from('units').insert(parsed.data);

  if (error) {
    if (error.code === '23505') {
      return { fieldErrors: { number: 'That unit already exists in this community.' } };
    }
    return { error: friendlyDbError(error) };
  }

  revalidatePath(`/app/${slug}/admin/units`);
  return { ...EMPTY_STATE, success: 'Unit added.' };
}

/**
 * Bulk entry, because nobody wants to add 120 flats one at a time.
 * Accepts one unit per line as `block,number` or just `number`.
 */
export async function addUnitsBulk(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const slug = String(formData.get('slug') ?? '');
  const context = await requireCapability(slug, 'units:manage');

  const raw = String(formData.get('units') ?? '');
  const dues = Number(formData.get('monthly_dues') ?? 0);

  const rows = raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [first, second] = line.split(',').map((part) => part.trim());
      return second
        ? { block: first || null, number: second }
        : { block: null, number: first ?? '' };
    })
    .filter((row) => row.number.length > 0)
    .map((row) => ({
      ...row,
      community_id: context.community.id,
      monthly_dues: Number.isFinite(dues) ? dues : 0,
    }));

  if (rows.length === 0) return { fieldErrors: { units: 'Add at least one unit.' } };
  if (rows.length > 2000) return { fieldErrors: { units: 'That is more than 2000 units.' } };

  const supabase = await getSupabase();
  // Re-running the same list should be harmless, so skip anything that already
  // exists rather than failing the whole batch.
  const { error, count } = await supabase.from('units').upsert(rows, {
    onConflict: 'community_id,block,number',
    ignoreDuplicates: true,
    count: 'exact',
  });

  if (error) return { error: friendlyDbError(error) };

  revalidatePath(`/app/${slug}/admin/units`);
  return { ...EMPTY_STATE, success: `Added ${count ?? rows.length} units.` };
}

export async function deleteUnit(formData: FormData): Promise<void> {
  const slug = String(formData.get('slug') ?? '');
  const id = String(formData.get('id') ?? '');
  const context = await requireCapability(slug, 'units:manage');

  const supabase = await getSupabase();
  await supabase.from('units').delete().eq('id', id).eq('community_id', context.community.id);

  revalidatePath(`/app/${slug}/admin/units`);
}
