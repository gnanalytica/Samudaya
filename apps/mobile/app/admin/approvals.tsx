import { useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import {
  ASSIGNABLE_ROLES,
  ROLE_LABEL,
  canApproveSpending,
  formatDate,
  formatMoney,
  isAdmin,
  positionLabel,
  type MemberRole,
} from '@samudaya/core';
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
import { spacing } from '../../src/lib/theme';

type Decision = 'approved' | 'rejected' | 'changes_requested';

/**
 * Admin inbox: expenses waiting for sign-off and people asking to join.
 * The database re-checks every decision (admin role, self-approval, the
 * designated-approver restriction), so errors from it are shown as-is.
 */
export default function Approvals() {
  const { activeCommunity, role, approvesSpending } = useAuth();
  const queryClient = useQueryClient();
  const currency = activeCommunity?.currency ?? 'INR';

  const { data, loading, refreshing, refresh } = useCommunityData(
    'admin:approvals',
    async (communityId) => {
      const [expenses, requests] = await Promise.all([
        supabase
          .from('expenses')
          .select(
            'id, name, category, amount, vendor, bill_url, spent_on, created_at, events(name, emoji), requester:memberships!expenses_requested_by_fkey(role, title, profiles(full_name))',
          )
          .eq('community_id', communityId)
          .eq('status', 'pending')
          .order('created_at', { ascending: true }),
        supabase
          .from('join_requests')
          .select(
            'id, claimed_name, claimed_phone, relation, created_at, units!join_requests_unit_id_fkey(block, number)',
          )
          .eq('community_id', communityId)
          .eq('status', 'pending')
          .order('created_at', { ascending: true }),
      ]);
      return { expenses: expenses.data ?? [], requests: requests.data ?? [] };
    },
  );

  const afterChange = () => {
    void queryClient.invalidateQueries({ queryKey: ['admin:approvals'] });
    void queryClient.invalidateQueries({ queryKey: ['admin:members'] });
  };

  if (!isAdmin(role)) {
    return (
      <Screen>
        <EmptyState title="Admins only" description="Approvals are handled by society admins." />
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

  const mayApprove = canApproveSpending(
    role,
    approvesSpending,
    activeCommunity?.restrict_spending_approval,
  );

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
      >
        <Heading>Expenses waiting ({data?.expenses.length ?? 0})</Heading>
        {!mayApprove ? (
          <Caption>
            Only designated spending approvers can approve here. You can still reject or ask for
            changes.
          </Caption>
        ) : null}
        {data?.expenses.length ? (
          data.expenses.map((expense) => (
            <ExpenseCard
              key={expense.id}
              expense={expense}
              currency={currency}
              mayApprove={mayApprove}
              onDone={afterChange}
            />
          ))
        ) : (
          <Card>
            <Caption>No expenses are waiting for a decision.</Caption>
          </Card>
        )}

        <Heading>Join requests ({data?.requests.length ?? 0})</Heading>
        {data?.requests.length ? (
          data.requests.map((request) => (
            <JoinRequestCard key={request.id} request={request} onDone={afterChange} />
          ))
        ) : (
          <Card>
            <Caption>Nobody is waiting to join.</Caption>
          </Card>
        )}
        <View style={{ height: spacing.xl }} />
      </ScrollView>
    </Screen>
  );
}

type ExpenseRow = {
  id: string;
  name: string;
  category: string | null;
  amount: number;
  vendor: string | null;
  bill_url: string | null;
  spent_on: string | null;
  created_at: string;
  events: { name: string; emoji: string } | null;
  requester: {
    role: MemberRole;
    title: string | null;
    profiles: { full_name: string | null } | null;
  } | null;
};

function ExpenseCard({
  expense,
  currency,
  mayApprove,
  onDone,
}: {
  expense: ExpenseRow;
  currency: string;
  mayApprove: boolean;
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
      p_expense_id: expense.id,
      p_decision: decision,
      p_note: decision === 'approved' ? undefined : note.trim() || undefined,
    });
    setBusy(null);
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    onDone();
  };

  const requester = expense.requester;

  return (
    <Card style={{ gap: spacing.sm }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Body>{expense.name}</Body>
          <Caption>
            {expense.events?.emoji} {expense.events?.name}
          </Caption>
        </View>
        <Heading>{formatMoney(expense.amount, currency)}</Heading>
      </View>
      <Caption>
        {expense.vendor ? `Vendor: ${expense.vendor}` : 'No vendor given'}
        {expense.spent_on ? ` · ${formatDate(expense.spent_on)}` : ''}
      </Caption>
      <Caption>
        Requested by {requester?.profiles?.full_name ?? 'someone'}
        {requester ? ` (${positionLabel(requester.role, requester.title)})` : ''}
      </Caption>
      <View style={{ flexDirection: 'row' }}>
        <Badge
          label={expense.bill_url ? '📎 Bill attached' : 'No bill attached'}
          tone={expense.bill_url ? 'success' : 'warning'}
        />
      </View>

      {mode ? (
        <View style={{ gap: spacing.sm }}>
          <Input
            label={mode === 'rejected' ? 'Reason for rejecting' : 'What needs to change?'}
            value={note}
            onChangeText={setNote}
            placeholder="Optional note for the requester"
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
          {mayApprove ? (
            <Button
              label="Approve"
              onPress={() => void decide('approved')}
              loading={busy === 'approved'}
            />
          ) : null}
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <View style={{ flex: 1 }}>
              <Button
                label="Ask for changes"
                variant="secondary"
                onPress={() => setMode('changes_requested')}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Button label="Reject" variant="secondary" onPress={() => setMode('rejected')} />
            </View>
          </View>
        </View>
      )}
      <ErrorText message={error} />
    </Card>
  );
}

type JoinRequestRow = {
  id: string;
  claimed_name: string;
  claimed_phone: string | null;
  relation: string;
  created_at: string;
  units: { block: string | null; number: string } | null;
};

function JoinRequestCard({ request, onDone }: { request: JoinRequestRow; onDone: () => void }) {
  const [grant, setGrant] = useState<MemberRole>('resident');
  const [busy, setBusy] = useState<'approve' | 'reject' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const review = async (approve: boolean) => {
    setBusy(approve ? 'approve' : 'reject');
    setError(null);
    const { error: rpcError } = await supabase.rpc('review_join_request', {
      p_request_id: request.id,
      p_approve: approve,
      p_role: approve ? grant : undefined,
    });
    setBusy(null);
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    onDone();
  };

  const flat = request.units
    ? [request.units.block, request.units.number].filter(Boolean).join('-')
    : 'No flat chosen';

  return (
    <Card style={{ gap: spacing.sm }}>
      <Body>{request.claimed_name}</Body>
      <Caption>
        {flat} · {request.relation}
        {request.claimed_phone ? ` · ${request.claimed_phone}` : ''}
      </Caption>
      <Caption>Asked {formatDate(request.created_at.slice(0, 10))}</Caption>
      <Caption>Admit as</Caption>
      <ChipRow>
        {ASSIGNABLE_ROLES.map((option) => (
          <Chip
            key={option}
            label={ROLE_LABEL[option]}
            selected={grant === option}
            onPress={() => setGrant(option)}
          />
        ))}
      </ChipRow>
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <View style={{ flex: 1 }}>
          <Button
            label="Decline"
            variant="secondary"
            onPress={() => void review(false)}
            loading={busy === 'reject'}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Button label="Admit" onPress={() => void review(true)} loading={busy === 'approve'} />
        </View>
      </View>
      <ErrorText message={error} />
    </Card>
  );
}
