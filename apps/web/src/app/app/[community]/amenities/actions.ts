'use server';

import { revalidatePath } from 'next/cache';
import { createAmenityBookingSchema } from '@samudaya/core';
import { requireCommunity } from '@/lib/auth';
import { getSupabase } from '@/lib/supabase/server';
import { EMPTY_STATE, fieldErrors, friendlyDbError, type ActionState } from '@/lib/action-state';

export async function bookAmenity(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const slug = String(formData.get('slug') ?? '');
  const context = await requireCommunity(slug);

  const startRaw = String(formData.get('starts_at') ?? '').trim();
  const hours = Number(formData.get('hours') ?? 1);
  if (!startRaw) return { fieldErrors: { starts_at: 'Pick a start time' } };

  const startsAt = new Date(startRaw);
  const endsAt = new Date(startsAt.getTime() + (Number.isFinite(hours) ? hours : 1) * 3_600_000);

  const parsed = createAmenityBookingSchema.safeParse({
    community_id: context.community.id,
    amenity_id: formData.get('amenity_id'),
    starts_at: startsAt.toISOString(),
    ends_at: endsAt.toISOString(),
    guests: formData.get('guests') || 0,
    notes: formData.get('notes') || undefined,
    channel: 'web',
  });

  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };

  const supabase = await getSupabase();
  const { data: amenity } = await supabase
    .from('amenities')
    .select('requires_approval')
    .eq('id', parsed.data.amenity_id)
    .maybeSingle();

  const { error } = await supabase.from('amenity_bookings').insert({
    ...parsed.data,
    membership_id: context.membership.id,
    unit_id: context.unitIds[0] ?? null,
    status: amenity?.requires_approval ? 'pending' : 'confirmed',
  });

  // 23P01 is the exclusion constraint: someone took the slot first. That is a
  // normal race, not a bug, and friendlyDbError already says so plainly.
  if (error) return { error: friendlyDbError(error) };

  revalidatePath(`/app/${slug}/amenities`);
  return {
    ...EMPTY_STATE,
    success: amenity?.requires_approval
      ? 'Requested. You’ll hear back once it’s approved.'
      : 'Booked.',
  };
}

export async function cancelBooking(formData: FormData): Promise<void> {
  const slug = String(formData.get('slug') ?? '');
  const id = String(formData.get('id') ?? '');
  await requireCommunity(slug);

  const supabase = await getSupabase();
  await supabase.from('amenity_bookings').update({ status: 'cancelled' }).eq('id', id);

  revalidatePath(`/app/${slug}/amenities`);
}
