'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { can, createVisitorPassSchema } from '@samudaya/core';
import { requireCommunity } from '@/lib/auth';
import { getSupabase } from '@/lib/supabase/server';
import { fieldErrors, friendlyDbError, type ActionState } from '@/lib/action-state';

export async function createVisitorPass(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const slug = String(formData.get('slug') ?? '');
  const context = await requireCommunity(slug);

  const expectedRaw = String(formData.get('expected_at') ?? '').trim();
  const hours = Number(formData.get('valid_hours') ?? 6);

  // A datetime-local value carries no zone; treat it as the browser's local
  // time, which is what the resident meant when they typed it.
  const expectedAt = expectedRaw ? new Date(expectedRaw) : new Date();
  const validUntil = new Date(
    expectedAt.getTime() + (Number.isFinite(hours) ? hours : 6) * 3_600_000,
  );

  const unitId = String(formData.get('unit_id') ?? '').trim();

  const parsed = createVisitorPassSchema.safeParse({
    community_id: context.community.id,
    unit_id: unitId || context.unitIds[0] || null,
    visitor_name: formData.get('visitor_name'),
    visitor_phone: formData.get('visitor_phone') || '',
    kind: formData.get('kind') || 'guest',
    purpose: formData.get('purpose') || undefined,
    vehicle_number: formData.get('vehicle_number') || undefined,
    party_size: formData.get('party_size') || 1,
    expected_at: expectedAt.toISOString(),
    valid_until: validUntil.toISOString(),
    channel: 'web',
  });

  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };

  const supabase = await getSupabase();
  const { error } = await supabase
    .from('visitor_passes')
    .insert({ ...parsed.data, created_by: context.membership.id });

  if (error) return { error: friendlyDbError(error) };

  revalidatePath(`/app/${slug}/visitors`);
  redirect(`/app/${slug}/visitors`);
}

export async function cancelVisitorPass(formData: FormData): Promise<void> {
  const slug = String(formData.get('slug') ?? '');
  const id = String(formData.get('id') ?? '');
  await requireCommunity(slug);

  const supabase = await getSupabase();
  await supabase.from('visitor_passes').update({ status: 'cancelled' }).eq('id', id);

  revalidatePath(`/app/${slug}/visitors`);
}

/**
 * Gate desk: record an arrival or departure. Writes both the pass status and
 * an immutable event row, so the log survives later edits to the pass.
 */
export async function recordGateEvent(formData: FormData): Promise<void> {
  const slug = String(formData.get('slug') ?? '');
  const id = String(formData.get('id') ?? '');
  const status = String(formData.get('status') ?? '');
  const context = await requireCommunity(slug);

  if (!can(context.role, 'gate:operate')) return;
  if (status !== 'arrived' && status !== 'departed' && status !== 'denied') return;

  const supabase = await getSupabase();

  const stamp =
    status === 'arrived'
      ? { checked_in_at: new Date().toISOString() }
      : status === 'departed'
        ? { checked_out_at: new Date().toISOString() }
        : {};

  const { error } = await supabase
    .from('visitor_passes')
    .update({ status, ...stamp })
    .eq('id', id)
    .eq('community_id', context.community.id);

  // Only log the event if the pass actually changed, so the log cannot claim
  // an arrival that RLS refused.
  if (!error) {
    await supabase.from('visitor_events').insert({
      pass_id: id,
      community_id: context.community.id,
      status,
      recorded_by: context.membership.id,
    });
  }

  revalidatePath(`/app/${slug}/gate`);
  revalidatePath(`/app/${slug}/visitors`);
}
