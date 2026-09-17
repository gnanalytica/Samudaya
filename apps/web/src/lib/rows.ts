import type { PostgrestError } from '@supabase/supabase-js';

/**
 * Rows from a PostgREST read, or an empty list — but never silently.
 *
 * `const { data } = await supabase.from(…)` throws the error away, so a query
 * that fails reads as a page with nothing on it. The suggestion board spent two
 * days telling every society "Nothing to vote on yet" while PostgREST answered
 * 300 Multiple Choices a hundred times a day: `memberships(profiles(full_name))`
 * was ambiguous, because suggestion_votes, suggestion_interests and comments all
 * look like junction tables between activity_suggestions and memberships. An
 * empty board and a broken one looked exactly alike, and nothing was logged.
 *
 * So the rows still come back empty — a half-rendered page helps nobody — but
 * the failure goes to the runtime error dashboard with the query that caused it.
 * PGRST200/201 in that log means an embed needs naming: `memberships!fk_name(…)`.
 */
export function rowsOf<T>(
  result: { data: T[] | null; error: PostgrestError | null },
  where: string,
): T[] {
  if (result.error) {
    console.error(
      `[samudaya] read failed: ${where}`,
      result.error.code,
      result.error.message,
      result.error.details ?? '',
    );
    return [];
  }
  return result.data ?? [];
}
