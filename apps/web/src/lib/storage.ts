import { getSupabase } from '@/lib/supabase/server';

export type StorageBucket = 'bills' | 'payment-proofs';

/** How long a link to a bill or payment screenshot stays valid. */
const SIGNED_URL_SECONDS = 300;

/**
 * A short-lived link to a stored file, signed with the viewer's own session so
 * row-level security on storage.objects decides who may open it: residents get
 * a bill only once it is approved, a payment screenshot only if it is theirs.
 *
 * Older rows may hold a plain http(s) link; those pass through unchanged.
 * Returns null when there is nothing to link to or the viewer may not see it.
 */
export async function fileUrl(
  bucket: StorageBucket,
  path: string | null | undefined,
): Promise<string | null> {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  const supabase = await getSupabase();
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, SIGNED_URL_SECONDS);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

/**
 * Deletes a stored file that nothing points at any more, e.g. the previous copy
 * of a corrected bill. Best effort, with the caller's own session: storage
 * policies still decide (an approved bill's file can never be removed), and a
 * failure only leaves a stray file behind, so it is logged rather than thrown.
 * Plain http(s) links from older rows are not ours to delete.
 */
export async function removeStoredFile(
  bucket: StorageBucket,
  path: string | null | undefined,
): Promise<void> {
  if (!path || /^https?:\/\//i.test(path)) return;
  const supabase = await getSupabase();
  const { error } = await supabase.storage.from(bucket).remove([path]);
  if (error) console.error(`[storage] could not remove ${bucket}/${path}`, error);
}
