import { useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { EXPENSE_STATUS_LABEL, can, formatDate, formatMoney } from '@samudaya/core';
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
  Input,
  Loading,
  Screen,
} from '../../src/components/ui';
import { Chip, ChipRow, ErrorText } from '../../src/components/admin-ui';
import { ViewFileChip } from '../../src/components/file-ui';
import { spacing } from '../../src/lib/theme';

type Filter = 'pending' | 'changes_requested' | 'approved' | 'rejected';
type Decision = 'approved' | 'rejected' | 'changes_requested';

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'pending', label: 'Waiting' },
  { value: 'changes_requested', label: 'Sent back' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
];

/**
 * Every bill, by status. Staff upload bills and correct the ones sent back to
 * them; the committee approves, rejects or sends them back. Nobody approves a
 * bill they raised, and the database enforces it.
 */
export default function Bills() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { activeCommunity, role, membershipId } = useAuth();
  const currency = activeCommunity?.currency ?? 'INR';
  const [filter, setFilter] = useState<Filter>('pending');

  const { data, loading, refreshing, refresh } = useCommunityData(
    'admin:bills',
    async (communityId) => {
      const { data: rows } = await supabase
        .from('expenses')
        .select(
          'id, name, category, amount, vendor, method, bill_url, spent_on, status, review_note, requested_by, created_at, events(name, emoji), requester:memberships!expenses_requested_by_fkey(profiles(full_name))',
        )
        .eq('community_id', communityId)
        .order('created_at', { ascending: false })
        .limit(300);
      return rows ?? [];
    },
  );

  if (!can(role, 'expenses:submit')) {
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

  const afterChange = () => {
    void queryClient.invalidateQueries({ queryKey: ['admin:bills'] });
    void queryClient.invalidateQueries({ queryKey: [`home:${role}`] });
  };

  const rows = (data ?? []).filter((row) => row.status === filter);
  const counts = new Map<Filter, number>();
  for (const row of data ?? []) {
    if (row.status in EXPENSE_STATUS_LABEL) {
      counts.set(row.status as Filter, (counts.get(row.status as Filter) ?? 0) + 1);
    }
  }

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
      >
        <Button label="+ Add a bill" onPress={() => router.push('/admin/bill')} />
        <ChipRow>
          {FILTERS.map((item) => (
            <Chip
              key={item.value}
              label={`${item.label} (${counts.get(item.value) ?? 0})`}
              selected={filter === item.value}
              onPress={() => setFilter(item.value)}
            />
          ))}
        </ChipRow>

        {rows.length ? (
          rows.map((row) => (
            <BillCard
              key={row.id}
              bill={row}
              currency={currency}
              mayDecide={can(role, 'expenses:approve') && row.status === 'pending'}
              mayEdit={
                (row.status === 'pending' || row.status === 'changes_requested') &&
                (row.requested_by === membershipId || can(role, 'expenses:approve'))
              }
              ownBill={row.requested_by === membershipId}
              onEdit={() => router.push(`/admin/bill?id=${row.id}`)}
              onDone={afterChange}
            />
          ))
        ) : (
          <Card>
            <EmptyState title="Nothing here" />
          </Card>
        )}
      </ScrollView>
    </Screen>
  );
}

type BillRow = {
  id: string;
  name: string;
  category: string | null;
  amount: number;
  vendor: string | null;
  bill_url: string | null;
  spent_on: string;
  status: string;
  review_note: string | null;
  events: { name: string; emoji: string } | null;
  requester: { profiles: { full_name: string | null } | null } | null;
};

function BillCard({
  bill,
  currency,
  mayDecide,
  mayEdit,
  ownBill,
  onEdit,
  onDone,
}: {
  bill: BillRow;
  currency: string;
  mayDecide: boolean;
  mayEdit: boolean;
  ownBill: boolean;
  onEdit: () => void;
  onDone: () => void;
}) {
  const [mode, setMode] = useState<Exclude<Decision, 'approved'> | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState<Decision | null>(null);
  const [error, setError] = useState<string | null>(null);

  const decide = async (decision: Decision) => {
    setBusy(decision);
    setError(null);
    const { error: rpcError } = await supabase.rpc('review_expense', {
      p_expense_id: bill.id,
      p_decision: decision,
      p_note: decision === 'approved' ? undefined : note.trim() || undefined,
    });
    setBusy(null);
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    setMode(null);
    onDone();
  };

  return (
    <Card style={{ gap: spacing.sm }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Body>{bill.name}</Body>
          <Caption>
            {bill.events?.emoji} {bill.events?.name}
          </Caption>
        </View>
        <Heading>{formatMoney(bill.amount, currency)}</Heading>
      </View>
      <Caption>
        {[bill.category, bill.vendor ?? 'No vendor', formatDate(bill.spent_on)]
          .filter(Boolean)
          .join(' · ')}
      </Caption>
      <Caption>Raised by {bill.requester?.profiles?.full_name ?? 'someone'}</Caption>
      <View style={{ flexDirection: 'row', gap: spacing.xs }}>
        <Badge
          label={bill.bill_url ? '📎 Bill attached' : 'No bill attached'}
          tone={bill.bill_url ? 'success' : 'warning'}
        />
        {bill.status !== 'pending' ? (
          <Badge label={EXPENSE_STATUS_LABEL[bill.status as keyof typeof EXPENSE_STATUS_LABEL]} />
        ) : null}
      </View>
      <ViewFileChip bucket="bills" value={bill.bill_url} label="View bill" />
      {bill.review_note ? <Body muted>Note: {bill.review_note}</Body> : null}

      {mayEdit ? (
        <Button
          label={bill.status === 'changes_requested' ? 'Correct and resubmit' : 'Edit bill'}
          variant="secondary"
          onPress={onEdit}
        />
      ) : null}

      {mayDecide ? (
        mode ? (
          <View style={{ gap: spacing.sm }}>
            <Input
              label={mode === 'rejected' ? 'Reason for rejecting' : 'What needs to change?'}
              value={note}
              onChangeText={setNote}
              placeholder="Shown to whoever raised the bill"
              multiline
            />
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <View style={{ flex: 1 }}>
                <Button label="Cancel" variant="secondary" onPress={() => setMode(null)} />
              </View>
              <View style={{ flex: 1 }}>
                <Button
                  label={mode === 'rejected' ? 'Reject' : 'Send back'}
                  onPress={() => void decide(mode)}
                  loading={busy === mode}
                />
              </View>
            </View>
          </View>
        ) : (
          <View style={{ gap: spacing.sm }}>
            {ownBill ? (
              <Caption>You raised this bill, so another committee member must approve it.</Caption>
            ) : (
              <Button
                label="Approve"
                onPress={() => void decide('approved')}
                loading={busy === 'approved'}
              />
            )}
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <View style={{ flex: 1 }}>
                <Button
                  label="Send back"
                  variant="secondary"
                  onPress={() => setMode('changes_requested')}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Button label="Reject" variant="secondary" onPress={() => setMode('rejected')} />
              </View>
            </View>
          </View>
        )
      ) : null}
      <ErrorText message={error} />
    </Card>
  );
}
