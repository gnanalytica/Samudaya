import { useState } from 'react';
import { ScrollView, Switch, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import {
  ASSIGNABLE_ROLES,
  ROLE_DESCRIPTION,
  ROLE_LABEL,
  SUGGESTED_TITLES,
  TITLE_MAX_LENGTH,
  canManageSpendingApproval,
  isAdmin,
  positionLabel,
  type MemberRole,
} from '@samudaya/core';
import { useAuth } from '../../../src/lib/auth';
import { supabase } from '../../../src/lib/supabase';
import { useCommunityData } from '../../../src/lib/use-community-data';
import {
  Body,
  Button,
  Caption,
  Card,
  EmptyState,
  Heading,
  Input,
  Loading,
  Screen,
  Title,
} from '../../../src/components/ui';
import { Chip, ChipRow, ErrorText } from '../../../src/components/admin-ui';
import { spacing } from '../../../src/lib/theme';
import { useTheme } from '../../../src/lib/use-theme';

/**
 * Edit one member: role, title and spending-approver flag. Guards in the
 * database stop self-promotion, owner changes by non-owners, and approver
 * changes by anyone other than an owner or an existing approver.
 */
export default function EditMember() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { role: myRole, approvesSpending: iApprove, membershipId: myMembershipId } = useAuth();

  const { data: member, loading } = useCommunityData(`admin:member:${id}`, async (communityId) => {
    const { data } = await supabase
      .from('memberships')
      .select('id, role, title, approves_spending, profiles(full_name)')
      .eq('community_id', communityId)
      .eq('id', id)
      .maybeSingle();
    return data;
  });

  if (!isAdmin(myRole)) {
    return (
      <Screen>
        <EmptyState title="Admins only" description="Only admins can change members." />
      </Screen>
    );
  }

  if (loading || !member) {
    return <Screen>{loading ? <Loading /> : <EmptyState title="Member not found" />}</Screen>;
  }

  return (
    <MemberForm
      // Remount with fresh state whenever the saved row changes.
      key={`${member.role}:${member.title ?? ''}:${member.approves_spending}`}
      member={member}
      isSelf={member.id === myMembershipId}
      managesApproval={canManageSpendingApproval(myRole, iApprove)}
    />
  );
}

function MemberForm({
  member,
  isSelf,
  managesApproval,
}: {
  member: {
    id: string;
    role: MemberRole;
    title: string | null;
    approves_spending: boolean;
    profiles: { full_name: string | null } | null;
  };
  isSelf: boolean;
  managesApproval: boolean;
}) {
  const router = useRouter();
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const { refresh: refreshAuth } = useAuth();

  const [role, setRole] = useState<MemberRole>(member.role);
  const [title, setTitle] = useState(member.title ?? '');
  const [approver, setApprover] = useState(member.approves_spending);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isOwner = member.role === 'owner';
  const roleAllowsApproval = role === 'admin' || role === 'owner';

  const save = async () => {
    setSaving(true);
    setError(null);

    const trimmed = title.trim();
    const changes: { role?: MemberRole; title: string | null; approves_spending?: boolean } = {
      title: trimmed ? trimmed.slice(0, TITLE_MAX_LENGTH) : null,
    };
    if (!isOwner && role !== member.role) changes.role = role;
    // Dropping below admin clears the approver flag, which the database requires.
    const nextApprover = roleAllowsApproval ? approver : false;
    if (nextApprover !== member.approves_spending) changes.approves_spending = nextApprover;

    const { error: updateError } = await supabase
      .from('memberships')
      .update(changes)
      .eq('id', member.id);
    setSaving(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    void queryClient.invalidateQueries({ queryKey: ['admin:members'] });
    void queryClient.invalidateQueries({ queryKey: [`admin:member:${member.id}`] });
    void queryClient.invalidateQueries({ queryKey: ['admin:approvals'] });
    if (isSelf) await refreshAuth();
    router.back();
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}>
        <View style={{ gap: 2 }}>
          <Title>{member.profiles?.full_name ?? 'Member'}</Title>
          <Caption>{positionLabel(member.role, member.title)}</Caption>
        </View>

        <Card style={{ gap: spacing.sm }}>
          <Heading>Title</Heading>
          <Caption>A label for their position. Their role decides what they can do.</Caption>
          <Input
            value={title}
            onChangeText={setTitle}
            placeholder="e.g. Treasurer"
            maxLength={TITLE_MAX_LENGTH}
          />
          <ChipRow>
            {SUGGESTED_TITLES.map((suggestion) => (
              <Chip
                key={suggestion}
                label={suggestion}
                selected={title.trim() === suggestion}
                onPress={() => setTitle(title.trim() === suggestion ? '' : suggestion)}
              />
            ))}
          </ChipRow>
        </Card>

        <Card style={{ gap: spacing.sm }}>
          <Heading>Role</Heading>
          {isOwner ? (
            <Body muted>Owners can only be changed by transferring ownership on the web.</Body>
          ) : (
            <>
              <ChipRow>
                {ASSIGNABLE_ROLES.map((option) => (
                  <Chip
                    key={option}
                    label={ROLE_LABEL[option]}
                    selected={role === option}
                    onPress={() => setRole(option)}
                  />
                ))}
              </ChipRow>
              <Caption>{ROLE_DESCRIPTION[role]}</Caption>
              {isSelf ? <Caption>You can lower your own role but not raise it.</Caption> : null}
            </>
          )}
        </Card>

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
              <Heading>Spending approver</Heading>
              <Caption>
                Can approve expenses when the society limits approval to designated approvers.
              </Caption>
            </View>
            <Switch
              value={roleAllowsApproval && approver}
              onValueChange={setApprover}
              disabled={!managesApproval || !roleAllowsApproval}
              trackColor={{ true: colors.accent, false: colors.border }}
            />
          </View>
          {!roleAllowsApproval ? (
            <Caption>Only admins and owners can be approvers.</Caption>
          ) : !managesApproval ? (
            <Caption>Only an owner or an existing approver can change this.</Caption>
          ) : null}
        </Card>

        <ErrorText message={error} />
        <Button label="Save" onPress={() => void save()} loading={saving} />
        <View style={{ height: spacing.xl }} />
      </ScrollView>
    </Screen>
  );
}
