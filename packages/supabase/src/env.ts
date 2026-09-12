/**
 * Environment resolution shared by every Supabase client factory.
 *
 * The web app and the Expo app use different prefixes for the same two values
 * (`NEXT_PUBLIC_*` vs `EXPO_PUBLIC_*`), because each bundler only inlines its
 * own. Reading both here keeps the rest of the codebase from caring.
 */

export type SupabaseEnv = {
  url: string;
  anonKey: string;
};

const firstDefined = (...keys: string[]): string | undefined => {
  for (const key of keys) {
    const value = process.env[key];
    if (value && value.length > 0) return value;
  }
  return undefined;
};

export function readSupabaseEnv(): SupabaseEnv {
  const url = firstDefined('NEXT_PUBLIC_SUPABASE_URL', 'EXPO_PUBLIC_SUPABASE_URL', 'SUPABASE_URL');
  const anonKey = firstDefined(
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'EXPO_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_ANON_KEY',
  );

  if (!url || !anonKey) {
    throw new Error(
      'Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and ' +
        'NEXT_PUBLIC_SUPABASE_ANON_KEY (or the EXPO_PUBLIC_ equivalents). ' +
        'See .env.example.',
    );
  }
  return { url, anonKey };
}

/**
 * The service-role key bypasses RLS entirely. It must never reach a browser or
 * a phone, so it is read separately and only ever from server code.
 */
export function readServiceRoleKey(): string {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY is not set. It is required for webhook and ' +
        'API-key request handling, and must only ever be set on the server.',
    );
  }
  return key;
}
