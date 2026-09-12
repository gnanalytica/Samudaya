import { NextResponse, type NextRequest } from 'next/server';
import { getSupabase } from '@/lib/supabase/server';

/**
 * POST-only: a GET would let any page sign the user out with an <img> tag.
 */
export async function POST(request: NextRequest) {
  const supabase = await getSupabase();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL('/', request.nextUrl.origin), { status: 303 });
}
