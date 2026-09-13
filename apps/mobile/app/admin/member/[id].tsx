import { useState } from 'react';
import { Alert, ScrollView, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import {
  ASSIGNABLE_ROLES,
  ROLE_DESCRIPTION,
  ROLE_LABEL,
  can,
  normalizeRole,
  unitLabel,
  type Role,
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
  Loading,
  Screen,
  Title,
} from '../../../src/components/ui';
import { Chip, ChipRow, ErrorText } from '../../../src/components/admin-ui';
import { spacing } from '../../../src/lib/theme';

/**
 * One member. Staff can remove a resident who has left; the committee can also
 * change anyone's role. The database enforces both, and keeps at least one
 * committee member in every society.
 */
export default function EditMember() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { role, membershipId, refresh: refreshAuth } = useAuth();

  const { data, loading } = useCommunityData(`admin:member:${id}`, async (communityId) => {
    const { data: row } = await supabase
      .from('memberships')
      .select(
        'id, role, joined_at, profiles(full_name, email), unit_occupants(relation, units(block, number))',
      )
      .eq('community_id', communityId)
      .eq('id', String(id))
      .maybeSingle();
    return row;
  });

  if (!can(role, 'residents:remove')) {
    return (
      <Screen>
        <EmptyState title="Staff and committee only" />
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

  if (!data) {
    return (
      <Screen>
        <EmptyState title="Member not found" description="They may already have been removed." />
      </Screen>
    );
  }

  return (
    <MemberEditor
      key={data.role}
      member={data}
      isSelf={data.id === membershipId}
      mayManageRoles={can(role, 'roles:manage')}
      onSelfChanged={refreshAuth}
    />
  );
}

type MemberRow = {
  id: string;
  role: Parameters<typeof normalizeRole>[0];
  joined_at: string;
  profiles: { full_name: string | null; email: string | null } | null;
  unit_occupants: { relation: string; units: { block: string | null; number: string } | null }[];
};

function MemberEditor({
  member,
  isSelf,
  mayManageRoles,
  onSelfChanged,
}: {
  member: MemberRow;
  isSelf: boolean;
  mayManageRoles: boolean;
  onSelfChanged: () => Promise<void>;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const current = normalizeRole(member.role) ?? 'resident';
  const [nextRole, setNextRole] = useState<Role>(current);
  const [busy, setBusy] = useState<'save' | 'remove' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const name = member.profiles?.full_name ?? member.profiles?.email ?? 'This member';
  const flats = member.unit_occupants
    .filter((row) => row.units)
    .map((row) => `Flat ${unitLabel(row.units)} · ${row.relation}`);
  const mayRemove = !isSelf && (current === 'resident' || mayManageRoles);

  const afterChange = async () => {
    await queryClient.invalidateQueries({ queryKey: ['admin:members'] });
    await queryClient.invalidateQueries({ queryKey: [`admin:member:${member.id}`] });
    if (isSelf) await onSelfChanged();
  };

  const saveRole = async () => {
    setBusy('save');
    setError(null);
    const { error: updateError } = await supabase
      .from('memberships')
      .update({ role: nextRole })
      .eq('id', member.id);
    setBusy(null);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    await afterChange();
    router.back();
  };

  const remove = async () => {
    setBusy('remove');
    setError(null);
    const { error: deleteError, count } = await supabase
      .from('memberships')
      .delete({ count: 'exact' })
      .eq('id', member.id);
    setBusy(null);
    if (deleteError || count === 0) {
      setError(deleteError?.message ?? 'You can’t remove this member.');
      return;
    }
    await afterChange();
    router.back();
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}>
        <View style={{ gap: 2 }}>
          <Title>{name}</Title>
          <Caption>
            {ROLE_LABEL[current]}
            {member.profiles?.email ? ` · ${member.profiles.email}` : ''}
          </Caption>
          {flats.map((flat) => (
            <Caption key={flat}>{flat}</Caption>
          ))}
        </View>

        {mayManageRoles ? (
          <Card style={{ gap: spacing.md }}>
            <Heading>Role</Heading>
            <ChipRow>
              {ASSIGNABLE_ROLES.map((option) => (
                <Chip
                  key={option}
                  label={ROLE_LABEL[option]}
                  selected={nextRole === option}
                  onPress={() => setNextRole(option)}
                  disabled={busy !== null}
                />
              ))}
            </ChipRow>
            <Caption>{ROLE_DESCRIPTION[nextRole]}</Caption>
            {isSelf ? <Caption>You can lower your own role but not raise it.</Caption> : null}
            <Button
              label="Save role"
              onPress={() => void saveRole()}
              loading={busy === 'save'}
              disabled={nextRole === current}
            />
          </Card>
        ) : null}

        {mayRemove ? (
          <Card style={{ gap: spacing.sm }}>
            <Heading>Remove from the society</Heading>
            <Body muted>
              For someone who has moved out. Their past contributions stay in the accounts; they
              lose access straight away and would need to ask to join again.
            </Body>
            <Button
              label={`Remove ${name}`}
              variant="secondary"
              loading={busy === 'remove'}
              onPress={() =>
                Alert.alert(`Remove ${name}?`, 'They lose access immediately.', [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Remove', style: 'destructive', onPress: () => void remove() },
                ])
              }
            />
          </Card>
        ) : null}

        <ErrorText message={error} />
      </ScrollView>
    </Screen>
  );
}
