'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { joinMessage, normalizeJoinCode, phoneSchema, uuid } from '@samudaya/core';
import { getSupabase } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth';
import { fieldErrors, type ActionState } from '@/lib/action-state';

/**
 * Joining a society: one society code for everyone.
 *
 * Step one takes the code, name and phone and files the join request through
 * request_to_join, which checks the code against a brute-force throttle. Step
 * two adds the flat and how they live there. Staff or the committee then admit
 * the resident; until that happens they see nothing but a pending screen.
 */

export type Unit = { id: string; block: string | null; number: string };

/** Accepts a 10-digit Indian mobile number or the full international form. */
const residentPhone = z
  .string()
  .trim()
  .transform((value) => value.replace(/[\s-]/g, ''))
  .transform((value) => (/^[6-9]\d{9}$/.test(value) ? `+91${value}` : value))
  .pipe(phoneSchema);

export type JoinState = ActionState & {
  step?: 'details' | 'submitted';
  society?: { name: string; code: string };
  units?: Unit[];
  name?: string;
  phone?: string;
};

const startSchema = z.object({
  join_code: z.string().trim().min(4, 'Enter the society code your committee shared'),
  name: z.string().trim().min(2, 'Tell us your name').max(120),
  phone: residentPhone,
});

/**
 * Flats a society has, for someone who knows its code. Applicants are not
 * members yet, so row-level security hides `units`; society_units returns the
 * flat labels only for a valid code, under the same throttle as joining.
 */
async function societyUnits(code: string): Promise<Unit[]> {
  const supabase = await getSupabase();
  const { data } = await supabase.rpc('society_units', { p_join_code: code });
  return (data ?? []).flatMap((unit) =>
    unit.id && unit.number ? [{ id: unit.id, block: unit.block, number: unit.number }] : [],
  );
}

export async function startJoin(_prev: JoinState, formData: FormData): Promise<JoinState> {
  await requireUser();

  const parsed = startSchema.safeParse({
    join_code: formData.get('join_code'),
    name: formData.get('name'),
    phone: formData.get('phone'),
  });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };

  const code = normalizeJoinCode(parsed.data.join_code);
  const supabase = await getSupabase();
  const { data, error } = await supabase.rpc('request_to_join', {
    p_join_code: code,
    p_name: parsed.data.name,
    p_phone: parsed.data.phone,
  });
  if (error) return { error: 'We could not check that code. Please try again.' };

  const row = data?.[0];
  if (!row?.status) return { fieldErrors: { join_code: joinMessage('not_found') } };

  if (row.status === 'already_member') {
    const { data: community } = await supabase
      .from('communities')
      .select('slug')
      .eq('id', row.community_id ?? '')
      .maybeSingle();
    if (community) redirect(`/app/${community.slug}`);
    return { error: joinMessage('already_member') };
  }
  if (row.status !== 'pending') {
    return row.status === 'not_found'
      ? { fieldErrors: { join_code: joinMessage('not_found') } }
      : { error: joinMessage(row.status) };
  }

  return {
    step: 'details',
    society: { name: row.community_name ?? 'your society', code },
    units: await societyUnits(code),
    name: parsed.data.name,
    phone: parsed.data.phone,
  };
}

const detailsSchema = z.object({
  join_code: z.string().trim().min(4),
  name: z.string().trim().min(2, 'Tell us your name').max(120),
  phone: residentPhone,
  unit_id: uuid.nullable(),
  relation: z.enum(['owner', 'tenant', 'family']),
});

export async function submitJoinDetails(_prev: JoinState, formData: FormData): Promise<JoinState> {
  await requireUser();

  const parsed = detailsSchema.safeParse({
    join_code: formData.get('join_code'),
    name: formData.get('name'),
    phone: formData.get('phone'),
    unit_id: String(formData.get('unit_id') ?? '') || null,
    relation: formData.get('relation') || 'owner',
  });
  if (!parsed.success) return { error: 'Please pick your flat and try again.' };

  const supabase = await getSupabase();
  const { data, error } = await supabase.rpc('request_to_join', {
    p_join_code: normalizeJoinCode(parsed.data.join_code),
    p_unit_id: parsed.data.unit_id ?? undefined,
    p_name: parsed.data.name,
    p_phone: parsed.data.phone,
    p_relation: parsed.data.relation,
  });
  if (error) return { error: 'We could not send your details. Please try again.' };

  const row = data?.[0];
  if (row?.status !== 'pending') return { error: joinMessage(row?.status ?? 'not_found') };

  // The pending screen on /onboarding reads the request back from the server.
  redirect('/onboarding');
}

export async function withdrawJoinRequest(formData: FormData): Promise<void> {
  const user = await requireUser();
  const supabase = await getSupabase();
  await supabase
    .from('join_requests')
    .delete()
    .eq('id', String(formData.get('request_id') ?? ''))
    .eq('user_id', user.id)
    .eq('status', 'pending');
  redirect('/onboarding?mode=join');
}
