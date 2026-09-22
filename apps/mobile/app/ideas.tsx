import { RefreshControl, ScrollView, View } from 'react-native';
import { useAuth } from '../src/lib/auth';
import { fetchEvents, fetchIdeas } from '../src/lib/events';
import { useCommunityData } from '../src/lib/use-community-data';
import { Caption, Loading, Screen, Title } from '../src/components/ui';
import { Suggestions } from '../src/components/suggestions';
import { spacing } from '../src/lib/theme';

/**
 * Everything the society has been asked for, in one place.
 *
 * The web has had this since suggestions stopped being only about events. The
 * phone app never did — not by choice: the screen that held it also held
 * Polls, Polls were switched off for the pilot, and the suggestions went down
 * with them. A resident could suggest something about Dasara from the Dasara
 * page and had nowhere at all to say "the terrace light is out".
 *
 * It shows both kinds rather than only the society's own. A resident thinking
 * "didn't somebody already suggest that?" does not know which kind theirs was,
 * and the event ones are one tap away on their own page anyway.
 */
export default function Ideas() {
  const { membershipId } = useAuth();

  const { data, loading, refreshing, refresh } = useCommunityData(
    `ideas:${membershipId}`,
    async (communityId) => {
      const [rows, events] = await Promise.all([
        fetchIdeas(communityId, membershipId ?? ''),
        fetchEvents(communityId),
      ]);
      return { rows, events };
    },
  );

  if (loading && !data) {
    return (
      <Screen>
        <Loading />
      </Screen>
    );
  }

  const rows = data?.rows ?? [];
  // The society first, then whatever is still being run. A draft event is not
  // offered: nobody outside the committee can see it to vote on it.
  const targets = [
    { id: null, label: 'The society' },
    ...(data?.events ?? [])
      .filter((event) => event.status === 'published')
      .map((event) => ({ id: event.id, label: `${event.emoji} ${event.name}` })),
  ];

  const voting = rows.filter((row) => row.status === 'accepted').length;

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ gap: 2 }}>
          <Title>Ideas</Title>
          <Caption>
            {voting
              ? `${voting} open for voting`
              : 'Anything worth doing — an activity, or something for the committee.'}
          </Caption>
        </View>

        <Suggestions
          rows={rows}
          targets={targets}
          open
          onChange={refresh}
          showEvent
          emptyDescription="Suggest something below, and the committee will put it to a vote."
        />

        <View style={{ height: spacing.xl }} />
      </ScrollView>
    </Screen>
  );
}
