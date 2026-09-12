import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { makeRedirectUri } from 'expo-auth-session';
import type { Session, User } from '@supabase/supabase-js';
import type { Tables } from '@samudaya/supabase';
import type { MemberRole } from '@samudaya/core';
import { supabase } from './supabase';

/**
 * Session and community context for the whole app.
 *
 * Google sign-in runs through the system's in-app browser rather than a native
 * SDK: it needs no per-platform client IDs, works identically on iOS, Android
 * and web, and the PKCE exchange happens here when the browser hands back a
 * code. `detectSessionInUrl` is off in the client, so nothing else will pick
 * that code up.
 */

// Lets the auth browser close itself when it redirects back.
WebBrowser.maybeCompleteAuthSession();

export type Membership = Tables<'memberships'> & { communities: Tables<'communities'> | null };

type AuthValue = {
  session: Session | null;
  user: User | null;
  profile: Tables<'profiles'> | null;
  memberships: Membership[];
  activeCommunity: Tables<'communities'> | null;
  role: MemberRole | null;
  membershipId: string | null;
  /** False once the stored session has been read from disk. */
  loading: boolean;
  signInWithGoogle: () => Promise<{ error?: string }>;
  signInWithEmail: (email: string) => Promise<{ error?: string; sent?: boolean }>;
  signOut: () => Promise<void>;
  setActiveCommunity: (communityId: string) => void;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Tables<'profiles'> | null>(null);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadMemberships = useCallback(async (userId: string) => {
    const [{ data: profileRow }, { data: membershipRows }] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
      supabase
        .from('memberships')
        .select('*, communities(*)')
        .eq('user_id', userId)
        .eq('status', 'active')
        .order('joined_at', { ascending: false }),
    ]);

    setProfile(profileRow ?? null);
    const rows = (membershipRows ?? []) as Membership[];
    setMemberships(rows);
    // Keep whatever the user had selected if it is still valid.
    setActiveId((current) =>
      current && rows.some((row) => row.community_id === current)
        ? current
        : (rows[0]?.community_id ?? null),
    );
  }, []);

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      setSession(data.session);
      if (data.session?.user) await loadMemberships(data.session.user.id);
      if (active) setLoading(false);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      if (next?.user) {
        void loadMemberships(next.user.id);
      } else {
        setProfile(null);
        setMemberships([]);
        setActiveId(null);
      }
    });

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, [loadMemberships]);

  const signInWithGoogle = useCallback(async () => {
    const redirectTo = makeRedirectUri({ scheme: 'samudaya', path: 'auth-callback' });

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo, skipBrowserRedirect: true },
    });

    if (error || !data.url) return { error: error?.message ?? 'Could not start Google sign-in.' };

    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);

    // "cancel" and "dismiss" both mean the user backed out; that is not an error.
    if (result.type !== 'success') return {};

    const { queryParams } = Linking.parse(result.url);
    const code = typeof queryParams?.code === 'string' ? queryParams.code : null;
    if (!code) return { error: 'Google did not return a sign-in code.' };

    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
    return exchangeError ? { error: exchangeError.message } : {};
  }, []);

  const signInWithEmail = useCallback(async (email: string) => {
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: {
        emailRedirectTo: makeRedirectUri({ scheme: 'samudaya', path: 'auth-callback' }),
      },
    });
    return error ? { error: error.message } : { sent: true };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  // Pulled out so the declared dependency matches what the compiler infers:
  // depending on `session?.user` while reading `session.user.id` reads as a
  // narrower dependency than it really is.
  const userId = session?.user?.id ?? null;

  const refresh = useCallback(async () => {
    if (userId) await loadMemberships(userId);
  }, [userId, loadMemberships]);

  const value = useMemo<AuthValue>(() => {
    const active = memberships.find((row) => row.community_id === activeId) ?? null;
    return {
      session,
      user: session?.user ?? null,
      profile,
      memberships,
      activeCommunity: active?.communities ?? null,
      role: active?.role ?? null,
      membershipId: active?.id ?? null,
      loading,
      signInWithGoogle,
      signInWithEmail,
      signOut,
      setActiveCommunity: setActiveId,
      refresh,
    };
  }, [
    session,
    profile,
    memberships,
    activeId,
    loading,
    signInWithGoogle,
    signInWithEmail,
    signOut,
    refresh,
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside <AuthProvider>');
  return value;
}
