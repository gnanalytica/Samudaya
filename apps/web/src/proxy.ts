import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * Runs before every matched request.
 *
 * In Next.js 16 this file replaces `middleware.ts` and always runs on the
 * Node.js runtime. Its one job is to refresh the Supabase session cookie so
 * Server Components downstream see a valid user — plus a cheap redirect for
 * signed-out visitors.
 *
 * This is an optimistic check only. Every page and API route re-checks the
 * session itself, and RLS is the real boundary: a forged cookie gets nowhere.
 */

/** Routes reachable without a session. Everything else requires one. */
const PUBLIC_PATHS = [
  '/',
  '/login',
  '/privacy',
  '/terms',
  '/auth',
  '/api/webhooks',
  '/api/v1',
  '/api/mcp',
  '/api/health',
];

const isPublic = (pathname: string) =>
  PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Without configuration there is no session to refresh. Letting the request
  // through means the page itself renders the "not configured" message, which
  // is far easier to debug than a blank 500 from the proxy.
  if (!url || !anonKey) return response;

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet, headers) => {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
        // A response that sets an auth cookie must never be cached by a CDN,
        // or one user's session could be handed to the next visitor.
        for (const [key, headerValue] of Object.entries(headers)) {
          response.headers.set(key, headerValue);
        }
      },
    },
  });

  // getUser() revalidates the token with Supabase. getSession() would only read
  // the cookie, which the client controls, so it must not gate anything.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  if (!user && !isPublic(pathname)) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = '/login';
    // Remember where they were headed so login can send them back.
    redirectUrl.searchParams.set('next', pathname + request.nextUrl.search);
    return NextResponse.redirect(redirectUrl);
  }

  if (user && pathname === '/login') {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = '/app';
    redirectUrl.search = '';
    return NextResponse.redirect(redirectUrl);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Everything except static assets, image files and crawler metadata —
     * matching those would burn a Node invocation per asset for no benefit,
     * and robots.txt must answer crawlers directly rather than redirect them
     * to /login.
     */
    '/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)',
  ],
};
