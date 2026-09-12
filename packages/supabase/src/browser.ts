import { createBrowserClient } from '@supabase/ssr';
import type { Database } from './database.types';
import { readSupabaseEnv } from './env';

let cached: ReturnType<typeof createBrowserClient<Database>> | undefined;

/**
 * Browser-side client. Memoised because every call would otherwise register a
 * fresh auth listener and the tab would end up with several of them.
 */
export function createClient() {
  if (cached) return cached;
  const { url, anonKey } = readSupabaseEnv();
  cached = createBrowserClient<Database>(url, anonKey);
  return cached;
}
