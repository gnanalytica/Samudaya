import { redirect } from 'next/navigation';
import { cache } from 'react';
import type { User } from '@supabase/supabase-js';
import type { Tables } from '@samudaya/supabase';
import { can, type Capability, type MemberRole } from '@samudaya/core';
import { getSupabase } from './supabase/server';

/**
 * Server-side session and membership helpers.
 *
 * These are the *convenience* layer — they decide what to render and where to
 * redirect. They are not the security boundary: every table is protected by
 * row-level security, so a user who gets past a check here still cannot read
 * or write anything the database does not allow.
 *
 * Wrapped in React's `cache()` so a page that asks for the current user in
 * three places still makes one round trip per request.
 */

export type Community = Tables<'communities'>;
export type Membership = Tables<'memberships'>;
export type Profile = Tables<'profiles'>;

export type MembershipWithCommunity = Membership & { communities: Community | null };

export const getCurrentUser = cache(async (): Promise<User | null> => {
  const supabase = await getSupabase();
  // getUser() verifies the JWT with Supabase. getSession() only decodes the
  // cookie, which the client controls, so it must never gate access.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  return user;
}

export const getProfile = cache(async (): Promise<Profile | null> => {
  const user = await getCurrentUser();
  if (!user) return null;
  const supabase = await getSupabase();
  const { data } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
  return data;
});

/** Every community the signed-in user belongs to, newest membership first. */
export const getMemberships = cache(async (): Promise<MembershipWithCommunity[]> => {
  const user = await getCurrentUser();
  if (!user) return [];
  const supabase = await getSupabase();
  const { data } = await supabase
    .from('memberships')
    .select('*, communities(*)')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .order('joined_at', { ascending: false });
  return (data ?? []) as MembershipWithCommunity[];
});

export type CommunityContext = {
  user: User;
  profile: Profile | null;
  community: Community;
  membership: Membership;
  role: MemberRole;
  /** Units the user currently occupies here. Empty for staff and admins. */
  unitIds: string[];
};

/**
 * Resolves the community in the URL and the caller's standing in it.
 *
 * Returns null rather than redirecting so callers can choose between "send
 * them to onboarding" and "render a 404".
 */
export const getCommunityContext = cache(async (slug: string): Promise<CommunityContext | null> => {
  const user = await getCurrentUser();
  if (!user) return null;

  const supabase = await getSupabase();

  // RLS already restricts `communities` to ones the caller belongs to, so an
  // unknown slug and a slug they have no business seeing look identical here.
  const { data: community } = await supabase
    .from('communities')
    .select('*')
    .eq('slug', slug)
    .maybeSingle();
  if (!community) return null;

  const { data: membership } = await supabase
    .from('memberships')
    .select('*')
    .eq('community_id', community.id)
    .eq('user_id', user.id)
    .eq('status', 'active')
    .maybeSingle();
  if (!membership) return null;

  const { data: occupancies } = await supabase
    .from('unit_occupants')
    .select('unit_id, units!inner(community_id)')
    .eq('membership_id', membership.id)
    .is('moved_out_on', null);

  const unitIds = (occupancies ?? [])
    .filter((row) => row.units?.community_id === community.id)
    .map((row) => row.unit_id);

  return {
    user,
    profile: await getProfile(),
    community,
    membership,
    role: membership.role,
    unitIds,
  };
});

/**
 * Like getCommunityContext, but sends the user somewhere sensible instead of
 * returning null: to onboarding if they belong to nothing, to their first
 * community if they simply took a wrong turn.
 */
export async function requireCommunity(slug: string): Promise<CommunityContext> {
  await requireUser();
  const context = await getCommunityContext(slug);
  if (context) return context;

  const memberships = await getMemberships();
  const fallback = memberships[0]?.communities?.slug;
  redirect(fallback ? `/app/${fallback}` : '/onboarding');
}

/** Guards a page behind a capability. Redirects rather than showing an error. */
export async function requireCapability(
  slug: string,
  capability: Capability,
): Promise<CommunityContext> {
  const context = await requireCommunity(slug);
  if (!can(context.role, capability)) redirect(`/app/${slug}`);
  return context;
}
