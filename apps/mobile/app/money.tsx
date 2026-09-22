import { useState } from 'react';
import { FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  LEDGER_FILTERS,
  filterLedger,
  formatDate,
  formatMoney,
  fundMovementLine,
  ledgerEvidence,
  ledgerFilterFrom,
  ledgerMeta,
  ledgerFlat,
  ledgerTitle,
  relativeTime,
} from '@samudaya/core';
import { useAuth } from '../src/lib/auth';
import { supabase } from '../src/lib/supabase';
import { useCommunityData } from '../src/lib/use-community-data';
import { reportHandled } from '../src/lib/observability';
import { Body, Button, Caption, Card, EmptyState, Loading, Screen } from '../src/components/ui';
import { Chip, ChipRow } from '../src/components/admin-ui';
import { StatTile } from '../src/components/event-ui';
import { ViewFileButton } from '../src/components/file-ui';
import { minTapTarget, spacing } from '../src/lib/theme';
import { useTheme } from '../src/lib/use-theme';

/**
 * The society's money, all of it, for everybody — the web Money page, on a
 * phone.
 *
 * The web app has had this since the ledger landed and the native app had
 * nothing: a resident with only the phone installed could see the money for
 * whichever event they happened to open and never the whole picture. Same two
 * reads, same 500-row bound, and the same filters through the same functions in
 * @samudaya/core, so the two surfaces cannot drift into disagreeing about what
 * "money in" means.
 *
 * Money in names the payer, their flat and how they paid; money out names the
 * vendor — the line society_ledger draws. Payments nobody has confirmed are not
 * here. Nothing on this screen is a way to contact anybody; RLS decides what
 * comes back, so a resident gets the resident's ledger without this screen
 * deciding anything — including which rows offer their evidence, since the view
 * hands a payment screenshot only to the payer and to staff.
 */
export default function Money() {
  const router = useRouter();
  const { colors } = useTheme();
  const { activeCommunity } = useAuth();
  const [direction, setDirection] = useState<string>('all');
  const [eventSlug, setEventSlug] = useState('');

  const currency = activeCommunity?.currency ?? 'INR';

  const { data, loading, refreshing, refresh, error } = useCommunityData(
    'money',
    async (communityId) => {
      const [ledger, totals, society, movements] = await Promise.all([
        // One string literal, not a concatenation: supabase-js reads the row type
        // off the literal itself, and `'a, b' + 'c'` widens it to string, which
        // hands every row back as GenericStringError.
        supabase
          .from('society_ledger')
          .select(
            'id, direction, happened_at, amount, counterpart, detail, payer_name, unit_label, method, receipt_no, document_url, confirmed_by, confirmed_at, event_slug, event_name',
          )
          .eq('community_id', communityId)
          .order('happened_at', { ascending: false })
          .limit(500),
        supabase.from('society_money').select('*').eq('community_id', communityId).maybeSingle(),
        supabase
          .from('society_balance')
          .select('balance, movements_in')
          .eq('community_id', communityId)
          .maybeSingle(),
        supabase
          .from('fund_movements')
          .select(
            'id, kind, amount, note, decided_at, from_event:events!fund_movements_from_event_id_fkey(name), to_event:events!fund_movements_to_event_id_fkey(name), decider:memberships!fund_movements_decided_by_fkey(profiles(full_name))',
          )
          .eq('community_id', communityId)
          .order('decided_at', { ascending: false })
          .limit(100),
      ]);
      // A read that fails must not arrive here as an empty ledger. The web app
      // learned this the expensive way — an ambiguous embed answered 300 for two
      // days while every society was told "Nothing to vote on yet" — and on a
      // money screen the wrong version is worse: "nothing has moved yet" is a
      // claim about the society's finances, not a blank list.
      const failure = ledger.error ?? totals.error;
      if (failure) {
        console.error(
          '[samudaya] read failed: the society ledger',
          failure.code,
          failure.message,
          failure.details ?? '',
        );
        reportHandled(failure, 'the society ledger');
        throw new Error(failure.message);
      }
      return {
        rows: ledger.data ?? [],
        totals: totals.data ?? null,
        society: society.data ?? null,
        movements: movements.data ?? [],
      };
    },
  );

  if (loading && !data) {
    return (
      <Screen>
        <Loading />
      </Screen>
    );
  }

  if (error && !data) {
    return (
      <Screen>
        <View style={{ padding: spacing.lg, gap: spacing.md }}>
          <EmptyState title="Could not load the ledger" description={error} />
          <Button label="Try again" onPress={refresh} />
        </View>
      </Screen>
    );
  }

  const rows = data?.rows ?? [];
  const totals = data?.totals ?? null;
  const visible = filterLedger(rows, ledgerFilterFrom(direction), eventSlug);
  const balance = Number(totals?.balance ?? 0);
  const heldBySociety = Number(data?.society?.balance ?? 0);
  const movements = data?.movements ?? [];

  // Built from the ledger rather than from events, so the filter only offers an
  // event that has something in it.
  const events = [...new Map(rows.map((row) => [row.event_slug, row.event_name])).entries()].filter(
    ([value]) => value,
  );
  events.sort((a, b) => String(a[1]).localeCompare(String(b[1])));

  return (
    <Screen>
      <FlatList
        data={visible}
        keyExtractor={(item) => item.id ?? String(item.receipt_no)}
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
        ListHeaderComponent={
          <View style={{ gap: spacing.md, marginBottom: spacing.sm }}>
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <StatTile label="COLLECTED" value={formatMoney(totals?.total_in ?? 0, currency)} />
              <StatTile label="SPENT" value={formatMoney(totals?.total_out ?? 0, currency)} />
            </View>
            <StatTile
              label="BALANCE"
              value={formatMoney(balance, currency)}
              tone={balance < 0 ? 'danger' : 'success'}
            />

            {/* What was left when an event closed, and what the committee
                decided to do with it — carry it to another event, or keep it.
                Only the second kind touches the balance, so the card is titled
                for the movements rather than for the figure. "The society is
                holding ₹12,000" is only worth saying if the next question —
                from what, and decided by whom — is answered here too. */}
            {movements.length ? (
              <Card style={{ gap: spacing.sm }}>
                <Body>Where money has moved</Body>
                <Caption>
                  Society balance · {formatMoney(heldBySociety, currency)} — what is left after all
                  of this, behind no event.
                </Caption>
                {movements.map((movement) => (
                  <View key={movement.id} style={{ gap: 2 }}>
                    <Body>{fundMovementLine(movement, currency)}</Body>
                    <Caption>
                      {movement.decided_at ? formatDate(movement.decided_at.slice(0, 10)) : ''}
                      {movement.decider?.profiles?.full_name
                        ? ` · decided by ${movement.decider.profiles.full_name}`
                        : ''}
                      {movement.note ? ` · ${movement.note}` : ''}
                    </Caption>
                  </View>
                ))}
              </Card>
            ) : null}

            <ChipRow>
              {LEDGER_FILTERS.map((option) => (
                <Chip
                  key={option.value}
                  label={option.label}
                  selected={direction === option.value}
                  onPress={() => setDirection(option.value)}
                />
              ))}
            </ChipRow>

            {events.length > 1 ? (
              <ChipRow>
                <Chip
                  label="Every event"
                  selected={eventSlug === ''}
                  onPress={() => setEventSlug('')}
                />
                {events.map(([value, label]) => (
                  <Chip
                    key={value ?? ''}
                    label={String(label ?? value)}
                    selected={eventSlug === value}
                    onPress={() => setEventSlug(value ?? '')}
                  />
                ))}
              </ChipRow>
            ) : null}

            <Caption>
              Confirmed payments in and approved bills out. A payment waiting to be confirmed is not
              here yet.
            </Caption>
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            title={rows.length ? 'Nothing matches that' : 'Nothing has moved yet'}
            description={
              rows.length
                ? 'Try a different filter.'
                : 'Confirmed payments and approved bills appear here, for every event, for ever.'
            }
          />
        }
        ListFooterComponent={
          <View style={{ gap: spacing.xs, paddingTop: spacing.lg }}>
            <Caption>
              Money in names who paid, their flat and how the money arrived, the way a contribution
              list always has. Money out names the vendor, the amount and whoever on the committee
              approved it, with the bill attached for anyone to open. A payment screenshot opens
              only for the payer and for staff. Nothing here is a way to contact anybody — that
              stays on People, for the people entitled to it.
            </Caption>
            {totals?.last_movement_at ? (
              <Caption>Last movement {relativeTime(totals.last_movement_at)}.</Caption>
            ) : null}
            {visible.length >= 500 ? <Caption>Showing the most recent 500.</Caption> : null}
          </View>
        }
        renderItem={({ item }) => {
          const incoming = item.direction === 'in';
          const when = item.happened_at ? formatDate(item.happened_at.slice(0, 10)) : null;
          const flat = ledgerFlat(item);
          const evidence = ledgerEvidence(item);
          return (
            <Card style={{ gap: spacing.xs, marginBottom: spacing.sm }}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md }}>
                <View style={{ flex: 1, gap: 2 }}>
                  {/* Name and flat on one line, the same pair the laptop shows
                      — through the same functions, so the two cannot drift
                      into naming a payment differently. A flat the society
                      does not know is said in the quieter ink the laptop
                      gives it, so the gap reads as a gap and not as a name
                      with something chopped off the end. */}
                  <Body>
                    {ledgerTitle(item)}
                    {flat ? (
                      <Text
                        style={
                          flat.known
                            ? { color: colors.inkMuted }
                            : { color: colors.inkSubtle, fontSize: 12 }
                        }
                      >
                        {` · ${flat.label}`}
                      </Text>
                    ) : null}
                  </Body>
                  <Caption>{[ledgerMeta(item), when].filter(Boolean).join(' · ')}</Caption>
                  {item.confirmed_at ? (
                    <Caption>
                      {incoming ? 'Confirmed' : 'Approved'} by {item.confirmed_by ?? 'the society'}{' '}
                      · {relativeTime(item.confirmed_at)}
                    </Caption>
                  ) : null}
                </View>
                {/* The sign, not just the colour, carries the direction: green
                    against dark ink is exactly the pair that goes on people who
                    cannot separate the two. */}
                <Text
                  style={{
                    color: incoming ? colors.success : colors.ink,
                    fontSize: 14,
                    fontWeight: '600',
                  }}
                >
                  {incoming ? '+' : '−'}
                  {formatMoney(Math.abs(Number(item.amount ?? 0)), currency)}
                </Text>
              </View>

              {item.event_slug ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => router.push(`/event/${item.event_slug}`)}
                  // Not hitSlop here: the bill chip sits four points below and
                  // is tappable too, so a slop big enough to matter would start
                  // taking its taps. The row grows instead.
                  style={{ minHeight: minTapTarget, justifyContent: 'center' }}
                >
                  <Caption>{String(item.event_name ?? 'Event')} ›</Caption>
                </Pressable>
              ) : null}

              {/* The bill for money out, the payer's screenshot for money in.
                  A row whose evidence is not this viewer's to open arrives
                  with a null path and grows no button. */}
              {evidence ? (
                <ViewFileButton
                  bucket={evidence.bucket}
                  value={evidence.path}
                  label={evidence.label}
                />
              ) : null}
            </Card>
          );
        }}
      />
    </Screen>
  );
}
