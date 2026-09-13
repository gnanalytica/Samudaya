'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { joinMessage, normalizeJoinCode, phoneSchema, uuid } from '@samudaya/core';
import { getSupabase } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth';
import { fieldErrors, type ActionState } from '@/lib/action-state';

/**
 * Joining a society: one society code for everyone, one request.
 *
 * The code step only looks the code up and lists the society's flats; nothing
 * is filed. The details step then sends name, phone, flat and relation to
 * request_to_join once, which checks the code again under its brute-force
 * throttle. Staff or the committee admit the resident; until then they see
 * nothing but a pending screen.
 */

export type Unit = { id: string; block: string | null; number: string };

/** Accepts a 10-digit Indian mobile number or the full international form. */
const residentPhone = z
  .string()
  .trim()
  .transform((value) => value.replace(/[\s-]/g, ''))
  .transform((value) => (/^[6-9]\d{9}$/.test(value) ? `+91${value}` : value))
  .pipe(phoneSchema);

export type CodeState = ActionState & {
  code?: string;
  units?: Unit[];
};

export type JoinState = ActionState & {
  /** The code that turned out to be wrong when the request was sent. */
  badCode?: string;
};

/**
 * Checks the society code and lists its flats, without filing anything.
 * society_units returns flat labels only for a valid code, and wrong codes
 * spend the same throttle as joining. A society with no flats listed yet looks
 * the same as a wrong code here, so the details step still opens and the
 * request itself gives the final word.
 */
export async function checkJoinCode(_prev: CodeState, formData: FormData): Promise<CodeState> {
  await requireUser();

  const raw = String(formData.get('join_code') ?? '').trim();
  if (raw.length < 4) {
    return { fieldErrors: { join_code: 'Enter the society code your committee shared' } };
  }
  const code = normalizeJoinCode(raw);

  const supabase = await getSupabase();
  const { data, error } = await supabase.rpc('society_units', { p_join_code: code });
  if (error) {
    return error.code === '54000'
      ? { fieldErrors: { join_code: joinMessage('rate_limited') } }
      : { error: 'We could not check that code. Please try again.' };
  }

  const units = (data ?? []).flatMap((unit) =>
    unit.id && unit.number ? [{ id: unit.id, block: unit.block, number: unit.number }] : [],
  );
  return { code, units };
}

const joinSchema = z.object({
  join_code: z.string().trim().min(4, 'Enter the society code your committee shared'),
  name: z.string().trim().min(2, 'Tell us your name').max(120),
  phone: residentPhone,
  unit_id: uuid.nullable(),
  // 'other' is someone who works for the society (a supervisor, a manager):
  // they have no flat, and staff decide their role when admitting them.
  relation: z.enum(['owner', 'tenant', 'family', 'other']),
});

/** Files the join request, once, with everything staff need to admit the person. */
export async function submitJoin(_prev: JoinState, formData: FormData): Promise<JoinState> {
  await requireUser();

  const parsed = joinSchema.safeParse({
    join_code: formData.get('join_code'),
    name: formData.get('name'),
    phone: formData.get('phone'),
    unit_id: String(formData.get('unit_id') ?? '') || null,
    relation: formData.get('relation') || 'owner',
  });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };
  parsed.data.join_code = normalizeJoinCode(parsed.data.join_code);
  const unitId = parsed.data.relation === 'other' ? null : parsed.data.unit_id;

  const supabase = await getSupabase();
  const { data, error } = await supabase.rpc('request_to_join', {
    p_join_code: parsed.data.join_code,
    p_unit_id: unitId ?? undefined,
    p_name: parsed.data.name,
    p_phone: parsed.data.phone,
    p_relation: parsed.data.relation,
  });
  if (error) return { error: 'We could not send your request. Please try again.' };

  const row = data?.[0];
  if (row?.status === 'already_member') {
    const { data: community } = await supabase
      .from('communities')
      .select('slug')
      .eq('id', row.community_id ?? '')
      .maybeSingle();
    if (community) redirect(`/app/${community.slug}`);
    return { error: joinMessage('already_member') };
  }
  if (!row?.status || row.status === 'not_found') {
    return { badCode: parsed.data.join_code, error: joinMessage('not_found') };
  }
  if (row.status !== 'pending') return { error: joinMessage(row.status) };

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
