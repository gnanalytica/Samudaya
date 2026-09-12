'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { getSupabase } from '@/lib/supabase/server';

export type LoginState = { error?: string; sent?: string };

/**
 * Where Supabase should send the user back to. Uses the configured site URL in
 * production and falls back to the request's own origin in development, so a
 * local run works without extra configuration.
 */
async function callbackUrl(next: string): Promise<string> {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  const origin =
    configured ??
    (await headers()).get('origin') ??
    `https://${(await headers()).get('host') ?? 'localhost:3000'}`;
  const url = new URL('/auth/callback', origin);
  if (next) url.searchParams.set('next', next);
  return url.toString();
}

const safeNext = (value: FormDataEntryValue | null): string => {
  const next = typeof value === 'string' ? value : '';
  // Never follow an absolute URL from the query string.
  return next.startsWith('/') && !next.startsWith('//') ? next : '/app';
};

export async function signInWithGoogle(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const supabase = await getSupabase();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: await callbackUrl(safeNext(formData.get('next'))),
      queryParams: {
        // Ask for a refresh token and let the user pick an account rather than
        // silently reusing whichever one the browser remembers.
        access_type: 'offline',
        prompt: 'select_account',
      },
    },
  });

  if (error || !data.url) {
    return { error: error?.message ?? 'Could not start Google sign-in.' };
  }
  redirect(data.url);
}

const emailSchema = z.string().trim().toLowerCase().email('Enter a valid email address');

export async function signInWithEmail(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = emailSchema.safeParse(formData.get('email'));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Enter a valid email address' };
  }

  const supabase = await getSupabase();
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data,
    options: { emailRedirectTo: await callbackUrl(safeNext(formData.get('next'))) },
  });

  if (error) return { error: error.message };
  return { sent: parsed.data };
}
