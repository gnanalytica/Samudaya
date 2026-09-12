import { NextResponse, type NextRequest } from 'next/server';
import { getSupabase } from '@/lib/supabase/server';

/**
 * Where Supabase sends the user back after Google sign-in or a magic link.
 * Exchanges the one-time code for a session cookie, then forwards them on.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/app';

  // Supabase reports a refused or cancelled sign-in this way.
  const error = searchParams.get('error_description') ?? searchParams.get('error');
  if (error) {
    return NextResponse.redirect(`${origin}/auth/error?reason=${encodeURIComponent(error)}`);
  }

  if (!code) {
    return NextResponse.redirect(`${origin}/auth/error?reason=missing_code`);
  }

  const supabase = await getSupabase();
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError) {
    return NextResponse.redirect(
      `${origin}/auth/error?reason=${encodeURIComponent(exchangeError.message)}`,
    );
  }

  // Only ever redirect within this app: an attacker-supplied absolute URL in
  // `next` would turn the callback into an open redirect.
  const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/app';
  return NextResponse.redirect(`${origin}${safeNext}`);
}
