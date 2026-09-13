import { useState } from 'react';
import { Pressable, RefreshControl, SectionList, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ROLE_LABEL, ROLES, can, normalizeRole, unitLabel, type Role } from '@samudaya/core';
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
  Input,
  Loading,
  Screen,
} from '../../src/components/ui';
import { spacing } from '../../src/lib/theme';

/**
 * Everyone admitted to the society, grouped by role, with their flat. Staff can
 * open a resident to remove them; the committee can also change roles.
 */
export default function Members() {
  const router = useRouter();
  const { role } = useAuth();
  const [search, setSearch] = useState('');

  const { data, loading, refreshing, refresh } = useCommunityData(
    'admin:members',
    async (communityId) => {
      const { data: rows } = await supabase
        .from('memberships')
        .select(
          'id, role, joined_at, profiles(full_name, email), unit_occupants(relation, units(block, number))',
        )
        .eq('community_id', communityId)
        .eq('status', 'active');
      return rows ?? [];
    },
  );

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

  const query = search.trim().toLowerCase();
  const rows = (data ?? [])
    .map((row) => {
      const occupancy = row.unit_occupants[0];
      return {
        id: row.id,
        role: normalizeRole(row.role) ?? 'resident',
        name: row.profiles?.full_name ?? row.profiles?.email ?? 'Unnamed',
        flat: occupancy?.units ? unitLabel(occupancy.units) : null,
        relation: occupancy?.relation ?? null,
      };
    })
    .filter(
      (row) =>
        !query ||
        row.name.toLowerCase().includes(query) ||
        (row.flat ?? '').toLowerCase().includes(query),
    )
    .sort((a, b) => (a.flat ?? '~').localeCompare(b.flat ?? '~') || a.name.localeCompare(b.name));

  const order: Role[] = [...ROLES].reverse();
  const sections = order
    .map((value) => ({
      title: `${ROLE_LABEL[value]} (${rows.filter((row) => row.role === value).length})`,
      data: rows.filter((row) => row.role === value),
    }))
    .filter((section) => section.data.length > 0);

  return (
    <Screen>
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
        stickySectionHeadersEnabled={false}
        ListHeaderComponent={
          <Input value={search} onChangeText={setSearch} placeholder="Search by name or flat" />
        }
        ListEmptyComponent={<EmptyState title="Nobody matches" />}
        renderSectionHeader={({ section }) => (
          <View style={{ paddingTop: spacing.lg, paddingBottom: spacing.xs }}>
            <Heading>{section.title}</Heading>
          </View>
        )}
        renderItem={({ item }) => {
          const editable = item.role === 'resident' || can(role, 'roles:manage');
          return (
            <Pressable
              accessibilityRole="button"
              disabled={!editable}
              onPress={() => router.push(`/admin/member/${item.id}`)}
              style={{ marginBottom: spacing.sm }}
            >
              <Card style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Body>{item.name}</Body>
                  <Caption>
                    {item.flat ? `Flat ${item.flat}` : 'No flat on record'}
                    {item.relation ? ` · ${item.relation}` : ''}
                  </Caption>
                </View>
                {item.role !== 'resident' ? (
                  <Badge label={ROLE_LABEL[item.role]} tone="info" />
                ) : null}
                {editable ? <Caption>›</Caption> : null}
              </Card>
            </Pressable>
          );
        }}
      />
    </Screen>
  );
}
