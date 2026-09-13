import { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Switch, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import {
  ROLE_LABEL,
  canManageSpendingApproval,
  isAdmin,
  isCommittee,
  positionLabel,
  type MemberRole,
} from '@samudaya/core';
import { useAuth } from '../../src/lib/auth';
import { supabase } from '../../src/lib/supabase';
import { useCommunityData } from '../../src/lib/use-community-data';
import {
  Badge,
  Body,
  Caption,
  Card,
  EmptyState,
  Heading,
  Loading,
  Screen,
} from '../../src/components/ui';
import { ErrorText } from '../../src/components/admin-ui';
import { spacing } from '../../src/lib/theme';
import { useTheme } from '../../src/lib/use-theme';

const ROLE_ORDER: Record<MemberRole, number> = { owner: 0, admin: 1, committee: 2, resident: 3 };

/** Everyone in the society with their position. Admins can open a member to edit them. */
export default function Members() {
  const router = useRouter();
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const { activeCommunity, role, approvesSpending, refresh: refreshAuth } = useAuth();

  const [savingRestriction, setSavingRestriction] = useState(false);
  const [restrictionError, setRestrictionError] = useState<string | null>(null);

  const { data, loading, refreshing, refresh } = useCommunityData(
    'admin:members',
    async (communityId) => {
      const { data: rows } = await supabase
        .from('memberships')
        .select('id, role, title, approves_spending, joined_at, profiles(full_name)')
        .eq('community_id', communityId)
        .eq('status', 'active');
      return (rows ?? []).sort(
        (a, b) =>
          ROLE_ORDER[a.role] - ROLE_ORDER[b.role] ||
          (a.profiles?.full_name ?? '').localeCompare(b.profiles?.full_name ?? ''),
      );
    },
  );

  if (!isCommittee(role)) {
    return (
      <Screen>
        <EmptyState title="Committee only" description="The member list is for the committee." />
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

  const admin = isAdmin(role);
  const managesApproval = canManageSpendingApproval(role, approvesSpending);
  const restricted = Boolean(activeCommunity?.restrict_spending_approval);
  const approverCount = (data ?? []).filter((member) => member.approves_spending).length;

  const toggleRestriction = async (next: boolean) => {
    if (!activeCommunity) return;
    setSavingRestriction(true);
    setRestrictionError(null);
    const { error } = await supabase
      .from('communities')
      .update({ restrict_spending_approval: next })
      .eq('id', activeCommunity.id);
    setSavingRestriction(false);
    if (error) {
      setRestrictionError(error.message);
      return;
    }
    // The flag lives on the community loaded into auth context.
    await refreshAuth();
    void queryClient.invalidateQueries({ queryKey: ['admin:approvals'] });
  };

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
      >
        <Card style={{ gap: spacing.sm }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: spacing.md,
            }}
          >
            <View style={{ flex: 1, gap: 2 }}>
              <Heading>Only designated approvers can approve spending</Heading>
              <Caption>
                {approverCount === 0
                  ? 'No approvers yet. Mark one (e.g. the Treasurer) before switching this on.'
                  : `${approverCount} designated approver${approverCount === 1 ? '' : 's'}.`}
              </Caption>
            </View>
            <Switch
              value={restricted}
              onValueChange={(next) => void toggleRestriction(next)}
              disabled={!managesApproval || savingRestriction}
              trackColor={{ true: colors.accent, false: colors.border }}
            />
          </View>
          {!managesApproval ? (
            <Caption>Only an owner or an existing spending approver can change this.</Caption>
          ) : null}
          <ErrorText message={restrictionError} />
        </Card>

        <Heading>Members ({data?.length ?? 0})</Heading>
        <Card style={{ gap: 0, paddingVertical: spacing.sm }}>
          {(data ?? []).map((member, index) => {
            const label = positionLabel(member.role, member.title);
            return (
              <Pressable
                key={member.id}
                accessibilityRole={admin ? 'button' : undefined}
                onPress={admin ? () => router.push(`/admin/member/${member.id}`) : undefined}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.md,
                  paddingVertical: spacing.md,
                  borderTopWidth: index === 0 ? 0 : 0.5,
                  borderTopColor: colors.border,
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <View style={{ flex: 1, gap: 2 }}>
                  <Body>{member.profiles?.full_name ?? 'Member'}</Body>
                  <Caption>
                    {label}
                    {member.title ? ` · ${ROLE_LABEL[member.role]}` : ''}
                  </Caption>
                </View>
                {member.approves_spending ? <Badge label="Approver" tone="success" /> : null}
                {admin ? <Caption>›</Caption> : null}
              </Pressable>
            );
          })}
        </Card>
        <View style={{ height: spacing.xl }} />
      </ScrollView>
    </Screen>
  );
}
