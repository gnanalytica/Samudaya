import { useQuery } from '@tanstack/react-query';
import { useAuth } from './auth';

/**
 * Fetches something scoped to the active community.
 *
 * Wraps TanStack Query rather than hand-rolling an effect: fetching in a
 * `useEffect` and calling setState from it causes the cascading renders the
 * React Compiler lint rules (correctly) reject, and reimplementing caching,
 * de-duplication and refetch-on-focus by hand is how those bugs get in.
 *
 * RLS does the access control — a query that returns nothing here is the
 * database saying no, not a bug to work around client-side.
 */
export function useCommunityData<T>(key: string, load: (communityId: string) => Promise<T>) {
  const { activeCommunity } = useAuth();
  const communityId = activeCommunity?.id ?? null;

  const query = useQuery({
    // Keying on the community means switching societies swaps the cache
    // rather than showing the previous one's data while the new load runs.
    queryKey: [key, communityId],
    queryFn: () => load(communityId as string),
    enabled: communityId !== null,
  });

  return {
    data: query.data ?? null,
    loading: query.isPending && communityId !== null,
    refreshing: query.isRefetching,
    error: query.isError ? 'Could not load that. Pull down to try again.' : null,
    refresh: () => {
      void query.refetch();
    },
    communityId,
  };
}
