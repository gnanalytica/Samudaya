import { useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { can, formatDate, formatMoney } from '@samudaya/core';
import { useAuth } from '../../src/lib/auth';
import { supabase } from '../../src/lib/supabase';
import { useCommunityData } from '../../src/lib/use-community-data';
import {
  Badge,
  Body,
  Button,
  Caption,
  Card,
  EmptyState,
  Heading,
  Loading,
  Screen,
} from '../../src/components/ui';
import { ErrorText } from '../../src/components/admin-ui';
import { spacing } from '../../src/lib/theme';

/**
 * The committee's decisions: fundraising campaigns residents proposed, and new
 * suggestions. Approving a suggestion opens it for residents to vote on.
 */
export default function CommitteeQueue() {
  const queryClient = useQueryClient();
  const { activeCommunity, role } = useAuth();
  const currency = activeCommunity?.currency ?? 'INR';

  const { data, loading, refreshing, refresh } = useCommunityData(
    'admin:queue',
    async (communityId) => {
      const [campaigns, suggestions] = await Promise.all([
        supabase
          .from('events')
          .select('id, name, emoji, description, fund_target, starts_on, created_at')
          .eq('community_id', communityId)
          .eq('status', 'proposed')
          .order('created_at', { ascending: true }),
        supabase
          .from('activity_suggestions')
          .select(
            'id, kind, name, description, status, created_at, events(name, emoji), memberships(profiles(full_name))',
          )
          .eq('community_id', communityId)
          .in('status', ['new', 'reviewing'])
          .order('created_at', { ascending: true }),
      ]);
      return { campaigns: campaigns.data ?? [], suggestions: suggestions.data ?? [] };
    },
  );

  if (!can(role, 'campaigns:approve')) {
    return (
      <Screen>
        <EmptyState title="Committee only" />
      </Screen>
    );
  }

  if (loading && !data) {
    return (
      <Screen>
        <Loading />
      </Screen>
    );
  }

  const afterChange = () => {
    void queryClient.invalidateQueries({ queryKey: ['admin:queue'] });
    void queryClient.invalidateQueries({ queryKey: ['events'] });
    void queryClient.invalidateQueries({ queryKey: [`home:${role}`] });
  };

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
      >
        <Heading>Proposed campaigns ({data?.campaigns.length ?? 0})</Heading>
        {data?.campaigns.length ? (
          data.campaigns.map((campaign) => (
            <Decision
              key={campaign.id}
              title={`${campaign.emoji} ${campaign.name}`}
              lines={[
                `Target ${formatMoney(campaign.fund_target, currency)} · for ${formatDate(campaign.starts_on)}`,
                `Proposed ${formatDate(campaign.created_at.slice(0, 10))}`,
              ]}
              body={campaign.description}
              approveLabel="Approve campaign"
              onDecide={async (approve) =>
                supabase
                  .from('events')
                  .update({ status: approve ? 'published' : 'cancelled' })
                  .eq('id', campaign.id)
              }
              onDone={afterChange}
            />
          ))
        ) : (
          <Card>
            <Caption>No campaigns are waiting.</Caption>
          </Card>
        )}

        <Heading>New suggestions ({data?.suggestions.length ?? 0})</Heading>
        {data?.suggestions.length ? (
          data.suggestions.map((suggestion) => (
            <Decision
              key={suggestion.id}
              title={suggestion.name}
              badge={suggestion.kind === 'idea' ? 'Idea' : 'Activity'}
              lines={[
                `${suggestion.events?.emoji ?? ''} ${suggestion.events?.name ?? 'Society-wide'}`,
                `From ${suggestion.memberships?.profiles?.full_name ?? 'a resident'} · ${formatDate(
                  suggestion.created_at.slice(0, 10),
                )}`,
              ]}
              body={suggestion.description}
              approveLabel="Open for voting"
              onDecide={async (approve) =>
                supabase
                  .from('activity_suggestions')
                  .update({ status: approve ? 'accepted' : 'declined' })
                  .eq('id', suggestion.id)
              }
              onDone={afterChange}
            />
          ))
        ) : (
          <Card>
            <Caption>No suggestions are waiting.</Caption>
          </Card>
        )}
      </ScrollView>
    </Screen>
  );
}

function Decision({
  title,
  badge,
  lines,
  body,
  approveLabel,
  onDecide,
  onDone,
}: {
  title: string;
  badge?: string;
  lines: string[];
  body: string | null;
  approveLabel: string;
  onDecide: (approve: boolean) => PromiseLike<{ error: { message: string } | null }>;
  onDone: () => void;
}) {
  const [busy, setBusy] = useState<'approve' | 'decline' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const decide = async (approve: boolean) => {
    setBusy(approve ? 'approve' : 'decline');
    setError(null);
    const { error: updateError } = await onDecide(approve);
    setBusy(null);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    onDone();
  };

  return (
    <Card style={{ gap: spacing.sm }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md }}>
        <View style={{ flex: 1 }}>
          <Body>{title}</Body>
        </View>
        {badge ? <Badge label={badge} /> : null}
      </View>
      {lines.map((line) => (
        <Caption key={line}>{line}</Caption>
      ))}
      {body ? <Body muted>{body}</Body> : null}
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <View style={{ flex: 1 }}>
          <Button
            label="Decline"
            variant="secondary"
            onPress={() => void decide(false)}
            loading={busy === 'decline'}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Button
            label={approveLabel}
            onPress={() => void decide(true)}
            loading={busy === 'approve'}
          />
        </View>
      </View>
      <ErrorText message={error} />
    </Card>
  );
}
