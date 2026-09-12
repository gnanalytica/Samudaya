'use server';

import { redirect } from 'next/navigation';
import {
  createCommunitySchema,
  isRedeemSuccess,
  normalizeInviteCode,
  redeemMessage,
  type MemberRole,
} from '@samudaya/core';
import { getSupabase } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth';

export type JoinState = {
  error?: string;
  /** Set once a code has been checked, so the user can confirm before joining. */
  preview?: {
    code: string;
    communityName: string;
    role: MemberRole;
    unitLabel: string | null;
    expiresAt: string | null;
  };
};

/**
 * Step one: look the code up and describe what accepting it will do.
 *
 * Redeeming is not reversible by the resident — an admin has to undo a wrong
 * join — so it is worth one extra click to show "you are about to join Green
 * Valley Apartments as a Resident" first.
 */
export async function checkInviteCode(_prev: JoinState, formData: FormData): Promise<JoinState> {
  await requireUser();

  const raw = String(formData.get('code') ?? '');
  const code = normalizeInviteCode(raw);
  if (code.length < 4) return { error: 'Enter the code your community admin gave you.' };

  const supabase = await getSupabase();
  const { data, error } = await supabase.rpc('preview_invite_code', { p_code: code });

  if (error) return { error: 'We could not check that code. Please try again.' };

  const row = data?.[0];
  if (!row || !row.status) return { error: redeemMessage('not_found') };
  if (row.status !== 'ok') return { error: redeemMessage(row.status) };

  return {
    preview: {
      code,
      communityName: row.community_name ?? 'this community',
      role: (row.role ?? 'resident') as MemberRole,
      unitLabel: row.unit_label,
      expiresAt: row.expires_at,
    },
  };
}

/** Step two: actually redeem. The database enforces limits, expiry and races. */
export async function redeemInviteCode(_prev: JoinState, formData: FormData): Promise<JoinState> {
  await requireUser();

  const code = normalizeInviteCode(String(formData.get('code') ?? ''));
  if (!code) return { error: 'Enter the code your community admin gave you.' };

  const supabase = await getSupabase();
  const { data, error } = await supabase.rpc('redeem_invite_code', {
    p_code: code,
    p_channel: 'web',
  });

  if (error) return { error: 'We could not use that code. Please try again.' };

  const row = data?.[0];
  if (!row?.status) return { error: redeemMessage('not_found') };

  if (!isRedeemSuccess(row.status)) return { error: redeemMessage(row.status) };

  redirect(`/app/${row.community_slug}?joined=1`);
}

export type CreateState = { error?: string; fieldErrors?: Record<string, string> };

/** Founding a new community. The database makes the creator its owner. */
export async function createCommunity(
  _prev: CreateState,
  formData: FormData,
): Promise<CreateState> {
  const user = await requireUser();

  const parsed = createCommunitySchema.safeParse({
    name: formData.get('name'),
    slug: formData.get('slug'),
    city: formData.get('city') || undefined,
    country: formData.get('country') || 'IN',
    timezone: formData.get('timezone') || 'Asia/Kolkata',
    currency: formData.get('currency') || 'INR',
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (typeof key === 'string' && !fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { fieldErrors };
  }

  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from('communities')
    .insert({ ...parsed.data, created_by: user.id })
    .select('slug')
    .single();

  if (error) {
    // 23505 is a unique violation, which here can only be the slug.
    if (error.code === '23505') {
      return { fieldErrors: { slug: 'That address is already taken. Try another.' } };
    }
    return { error: 'We could not create the community. Please try again.' };
  }

  redirect(`/app/${data.slug}?welcome=1`);
}
